// Server-side payment workflow: Stripe webhook events, enrollment after payment, and admin
// payment requests (payment links / invoices / offline). Everything external is passed in
// (database client, Stripe client, email sender, audit), so the same code runs in the route
// handlers and in the tests against the local database and stripe-mock.
//
// Rules:
//  - Money is recorded only from verified Stripe events (or an admin's explicit offline entry),
//    never from a browser redirect. Amounts are cents.
//  - Every event is recorded once in stripe_events; a redelivered event that was fully
//    processed is ignored. Each handler is also safe to run twice (conditional updates).
//  - Payment and enrollment are independent: a refund never withdraws anyone, a full cohort
//    never loses a payment (the registration is flagged instead).
//  - The app never refunds or adjusts charges; refunds happen in Stripe and are only recorded.
import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { OutgoingEmail, SendResult } from './email'
import type { AccessEmailInput, AccessEmailResult } from './account-access'
import { escapeHtml as esc, safeHttpUrl } from './security'

export type EnrollMode = 'review' | 'automatic'
type AuditFn = (actorId: string | null, action: string, entityType: string, entityId: string | null,
  details?: Record<string, unknown>, extra?: { label?: string | null; outcome?: 'success' | 'failed' | 'blocked'; system?: boolean; changes?: Record<string, unknown> }) => Promise<void>

export interface PaymentDeps {
  db: SupabaseClient
  /** Needed for receipts, refund matching and payment requests; webhook processing works without it. */
  stripe?: Stripe | null
  deliverEmail: (msg: OutgoingEmail) => Promise<SendResult>
  sendAccessEmail: (i: AccessEmailInput) => Promise<AccessEmailResult>
  audit: AuditFn
  /** Defaults to reading the database setting; anything but 'automatic' means review. */
  enrollMode?: () => Promise<EnrollMode>
  emails: { fromTlc: string; fromPlatform: string; ownerInbox: string }
  siteUrl?: string
  now?: () => Date
}

export const ENROLLABLE_COHORT_STATUSES = ['draft', 'upcoming', 'active']
const MONEY_STATES = ['paid', 'refunded', 'partially_refunded']
const NOTIFY_WINDOW_MS = 4 * 86400_000
const clip = (s: string | null | undefined, n: number) => (s ?? '').slice(0, n)
/** For case-insensitive exact matches with .ilike(): `_` and `%` in an email are not wildcards. */
export const likeExact = (s: string) => s.replace(/[\\%_]/g, c => `\\${c}`)
const idOf = (v: string | { id: string } | null | undefined) => (typeof v === 'string' ? v : v?.id ?? null)
const nowOf = (d: PaymentDeps) => (d.now ? d.now() : new Date())
const site = (d: PaymentDeps) => d.siteUrl ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://tramainecrawford.com'

// ====================================================================== signature
/**
 * Verifies a webhook request. Returns null for a missing or invalid signature (the caller
 * answers 400). Uses only the signing secret; no API key or network access is needed.
 */
export function verifyStripeEvent(stripeLib: { webhooks: { constructEvent: (payload: string, header: string, secret: string) => Stripe.Event } }, rawBody: string, signature: string | null, secret: string): Stripe.Event | null {
  if (!signature || !secret) return null
  try {
    return stripeLib.webhooks.constructEvent(rawBody, signature, secret)
  } catch {
    return null
  }
}

/** The owner's setting (app_private.settings enroll_on_payment). Fails safe to 'review'. */
export async function readEnrollMode(db: SupabaseClient): Promise<EnrollMode> {
  for (const fn of ['system_enroll_on_payment_mode', 'enroll_on_payment_mode']) {
    try {
      const { data, error } = await db.rpc(fn)
      if (!error && data === 'automatic') return 'automatic'
      if (!error && data === 'review') return 'review'
    } catch { /* function not installed */ }
  }
  return 'review'
}

// ====================================================================== event dispatch
export interface EventResult { httpStatus: number; outcome: string; detail?: string; duplicate?: boolean }
interface HandlerResult { outcome: string; detail?: string; retry?: boolean }

export const HANDLED_EVENTS = [
  'checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed',
  'checkout.session.expired', 'payment_intent.payment_failed', 'charge.refunded',
  'invoice.paid', 'invoice.payment_failed', 'invoice.voided', 'invoice.marked_uncollectible',
] as const

export async function processStripeEvent(event: Stripe.Event, deps: PaymentDeps): Promise<EventResult> {
  const { db } = deps
  if (!(HANDLED_EVENTS as readonly string[]).includes(event.type)) {
    return { httpStatus: 200, outcome: 'ignored_type' }
  }

  // Record the event first. A duplicate id that was fully processed is not handled again;
  // one that is still unprocessed (an earlier attempt failed part-way) is retried.
  const ins = await db.from('stripe_events').insert({ id: event.id, type: event.type })
  if (ins.error) {
    if (ins.error.code !== '23505') return { httpStatus: 500, outcome: 'db_error', detail: 'stripe_events insert failed' }
    const { data: prev } = await db.from('stripe_events').select('processed_at, outcome').eq('id', event.id).maybeSingle()
    if (prev?.processed_at) return { httpStatus: 200, outcome: prev.outcome ?? 'duplicate', duplicate: true }
  }

  let result: HandlerResult
  try {
    result = await dispatch(event, deps)
  } catch (e) {
    result = { outcome: 'error', detail: e instanceof Error ? e.message : String(e), retry: true }
  }
  await db.from('stripe_events').update({
    outcome: clip(result.outcome, 60), detail: result.detail ? clip(result.detail, 500) : null,
    processed_at: result.retry ? null : nowOf(deps).toISOString(),
  }).eq('id', event.id)
  return { httpStatus: result.retry ? 500 : 200, outcome: result.outcome, detail: result.detail }
}

async function dispatch(event: Stripe.Event, deps: PaymentDeps): Promise<HandlerResult> {
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
    case 'checkout.session.async_payment_failed':
    case 'checkout.session.expired':
      return onCheckoutSession(event.data.object as Stripe.Checkout.Session, event.type, deps)
    case 'payment_intent.payment_failed':
      return onPaymentIntentFailed(event.data.object as Stripe.PaymentIntent, deps)
    case 'charge.refunded':
      return onChargeRefunded(event.data.object as Stripe.Charge, deps)
    case 'invoice.paid':
    case 'invoice.payment_failed':
    case 'invoice.voided':
    case 'invoice.marked_uncollectible':
      return onInvoice(event.data.object as Stripe.Invoice, event.type, deps)
    default:
      return { outcome: 'ignored_type' }
  }
}

// ====================================================================== checkout sessions
async function onCheckoutSession(session: Stripe.Checkout.Session, type: string, deps: PaymentDeps): Promise<HandlerResult> {
  const prId = session.metadata?.payment_request_id
  if (prId || session.payment_link) return onPaymentRequestSession(session, type, deps)
  const regId = session.metadata?.registration_id
  if (!regId) return { outcome: 'ignored_no_metadata' } // e.g. coaching payment links

  if (type === 'checkout.session.expired') {
    const { data, error } = await deps.db.from('registrations')
      .update({ payment_status: 'expired' })
      .eq('id', regId).eq('stripe_session_id', session.id).in('payment_status', ['unpaid'])
      .select('id')
    if (error) return { outcome: 'db_error', detail: error.message, retry: true }
    return { outcome: data?.length ? 'registration_expired' : 'registration_expired_noop' }
  }
  if (type === 'checkout.session.async_payment_failed') {
    const { data, error } = await deps.db.from('registrations')
      .update({ payment_status: 'failed', payment_failed_at: nowOf(deps).toISOString(), payment_error: 'The bank payment did not go through.' })
      .eq('id', regId).eq('stripe_session_id', session.id).in('payment_status', ['unpaid', 'pending'])
      .select('id')
    if (error) return { outcome: 'db_error', detail: error.message, retry: true }
    if (data?.length) await deps.audit(null, 'registration.payment_failed', 'registration', regId, { session: session.id }, { system: true, outcome: 'failed' })
    return { outcome: data?.length ? 'registration_failed' : 'registration_failed_noop' }
  }
  // completed (card: paid now; bank debits: 'unpaid' until async_payment_succeeded)
  if (type === 'checkout.session.completed' && session.payment_status === 'unpaid') {
    const { data, error } = await deps.db.from('registrations')
      .update({ payment_status: 'pending', stripe_session_id: session.id })
      .eq('id', regId).in('payment_status', ['unpaid', 'expired', 'failed'])
      .select('id')
    if (error) return { outcome: 'db_error', detail: error.message, retry: true }
    return { outcome: data?.length ? 'registration_pending' : 'registration_pending_noop' }
  }
  return recordRegistrationPayment(regId, session, deps)
}

const REG_COLUMNS = 'id, full_name, email, program_id, cohort_id, status, payment_status, stripe_session_id, stripe_payment_intent_id, amount_paid_cents, enrollment_issue, inquiry_id, confirmation_email_sent_at, owner_notified_at, paid_at'

interface RegRow {
  id: string; full_name: string; email: string; program_id: string | null; cohort_id: string | null; status: string | null
  payment_status: string | null; stripe_session_id: string | null; stripe_payment_intent_id: string | null; amount_paid_cents: number | null
  enrollment_issue: string | null; inquiry_id: string | null; confirmation_email_sent_at: string | null; owner_notified_at: string | null; paid_at: string | null
}

/** Receipt link of the charge behind a payment, when Stripe can be asked. */
async function receiptFor(deps: PaymentDeps, paymentIntentId: string | null): Promise<string | null> {
  if (!deps.stripe || !paymentIntentId) return null
  try {
    const pi = await deps.stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge'] })
    const charge = pi.latest_charge && typeof pi.latest_charge !== 'string' ? pi.latest_charge : null
    return safeHttpUrl(charge?.receipt_url ?? null)
  } catch {
    return null
  }
}

/**
 * A completed, paid Checkout Session for a registration. Records the payment once, decides
 * whether the person can be enrolled, and sends the two notifications (each once).
 */
export async function recordRegistrationPayment(regId: string, session: Stripe.Checkout.Session, deps: PaymentDeps): Promise<HandlerResult> {
  const { db } = deps
  const { data: reg, error } = await db.from('registrations').select(REG_COLUMNS).eq('id', regId).maybeSingle<RegRow>()
  if (error) return { outcome: 'db_error', detail: error.message, retry: true }
  if (!reg) {
    await deps.audit(null, 'registration.payment_unmatched', 'registration', regId, { session: session.id, amount_cents: session.amount_total }, { system: true, outcome: 'failed' })
    return { outcome: 'registration_missing', detail: `No registration ${regId} for paid session ${session.id}` }
  }
  const piId = idOf(session.payment_intent as string | Stripe.PaymentIntent | null)
  const amount = session.amount_total ?? 0
  const now = nowOf(deps)
  let detail = ''

  if (MONEY_STATES.includes(reg.payment_status ?? '')) {
    const samePayment = reg.stripe_session_id === session.id || (!!piId && reg.stripe_payment_intent_id === piId)
    if (!samePayment) {
      // A second payment for one registration (two checkout tabs). Keep both on record and
      // ask the owner to refund one; nothing is refunded automatically.
      await db.from('registrations').update({
        enrollment_issue: 'refund_review', enrollment_issue_at: now.toISOString(),
        payment_error: clip(`A second payment (${piId ?? session.id}, ${(amount / 100).toFixed(2)}) was received for this registration. Refund one of them in Stripe.`, 300),
      }).eq('id', reg.id)
      await deps.audit(null, 'registration.duplicate_payment', 'registration', reg.id, { session: session.id, payment_intent: piId, amount_cents: amount }, { system: true, label: reg.full_name, outcome: 'failed' })
      await notifyOwner(deps, {
        subject: `Second payment received — ${reg.full_name}`, template: 'payment_duplicate_owner', relatedId: reg.id,
        lines: [`${esc(reg.full_name)} paid twice for the same registration (${esc((amount / 100).toFixed(2))} USD again). Refund one of the payments in Stripe; the app does not refund anything itself.`],
        href: `${site(deps)}/admin/registrations?id=${reg.id}`,
      })
      return { outcome: 'duplicate_payment', detail: `registration ${reg.id}` }
    }
    detail = 'already recorded'
    // Finishing a notification only makes sense within Stripe's redelivery window (3 days).
    // Older payments (e.g. the historical free registrations) are never emailed again.
    const paidAt = reg.paid_at ? new Date(reg.paid_at).getTime() : 0
    if (now.getTime() - paidAt > NOTIFY_WINDOW_MS) return { outcome: 'registration_paid', detail: 'already recorded; no notifications (older than the retry window)' }
  } else {
    const receiptUrl = await receiptFor(deps, piId)
    const expected = Number(session.metadata?.expected_amount_cents)
    const mismatch = (Number.isFinite(expected) && expected > 0 && session.amount_subtotal != null && session.amount_subtotal !== expected)
      || (!!session.currency && session.currency !== 'usd')
    const { data: claimed, error: claimError } = await db.from('registrations').update({
      payment_status: 'paid', paid_at: now.toISOString(), amount_paid_cents: amount, amount_paid: Math.round(amount / 100),
      currency: session.currency ?? 'usd', stripe_payment_intent_id: piId, stripe_session_id: session.id,
      receipt_url: receiptUrl, payment_error: null, payment_failed_at: null, checkout_expires_at: null,
    }).eq('id', reg.id).not('payment_status', 'in', `(${MONEY_STATES.join(',')})`).select('id')
    if (claimError) return { outcome: 'db_error', detail: claimError.message, retry: true }

    if (claimed?.length) {
      const decision = await decideEnrollment(deps, reg, mismatch)
      detail = decision.detail
      await deps.audit(null, 'registration.payment_received', 'registration', reg.id,
        { amount_cents: amount, session: session.id, payment_intent: piId, mode: decision.mode, issue: decision.issue, enrolled: decision.enrolled },
        { system: true, label: reg.full_name })
    } else {
      detail = 'recorded concurrently'
    }
  }

  const notified = await sendRegistrationNotifications(deps, reg.id)
  return { outcome: notified.retry ? 'notification_retry' : 'registration_paid', detail: [detail, notified.detail].filter(Boolean).join('; '), retry: notified.retry }
}

interface Decision { mode: EnrollMode; issue: string | null; enrolled: boolean; detail: string }

/** After a payment: flag a seat problem, or (automatic mode only) enroll the person. */
async function decideEnrollment(deps: PaymentDeps, reg: RegRow, amountMismatch: boolean): Promise<Decision> {
  const { db } = deps
  const mode = deps.enrollMode ? await deps.enrollMode() : await readEnrollMode(db)
  let issue: string | null = amountMismatch ? 'amount_mismatch' : null
  let detail = ''
  if (!issue) {
    const { data: cohort } = reg.cohort_id
      ? await db.from('cohorts').select('id, name, status, capacity').eq('id', reg.cohort_id).maybeSingle()
      : { data: null }
    if (!cohort || !ENROLLABLE_COHORT_STATUSES.includes(cohort.status)) {
      issue = 'cohort_unavailable'
      detail = cohort ? `cohort is ${cohort.status}` : 'no cohort'
    } else if (cohort.capacity != null) {
      const [{ count: active }, { data: waiting }] = await Promise.all([
        db.from('cohort_enrollments').select('id', { count: 'exact', head: true }).eq('cohort_id', cohort.id).eq('status', 'active'),
        db.from('registrations').select('id, payment_status, status').eq('cohort_id', cohort.id).neq('id', reg.id)
          .in('status', ['pending', 'waitlist']).in('payment_status', ['paid', 'complimentary', 'partially_refunded']),
      ])
      const taken = (active ?? 0) + (waiting?.length ?? 0)
      if (taken >= cohort.capacity) { issue = 'cohort_full'; detail = `${active ?? 0} enrolled + ${waiting?.length ?? 0} paid awaiting confirmation of ${cohort.capacity}` }
    }
  }

  let enrolled = false
  if (!issue && mode === 'automatic' && reg.cohort_id) {
    const r = await enrollRegistrant(deps, { email: reg.email, fullName: reg.full_name, cohortId: reg.cohort_id, inquiryId: reg.inquiry_id, registrationId: reg.id })
    if (r.ok) {
      enrolled = true
      await db.from('registrations').update({ status: 'confirmed' }).eq('id', reg.id)
      detail = `enrolled automatically (${r.outcome})`
    } else {
      issue = r.code === 'cohort_full' ? 'cohort_full' : r.code === 'cohort_unavailable' ? 'cohort_unavailable' : 'enrollment_failed'
      detail = r.message
    }
  }
  if (issue) await db.from('registrations').update({ enrollment_issue: issue, enrollment_issue_at: nowOf(deps).toISOString() }).eq('id', reg.id)
  return { mode, issue, enrolled, detail: issue ? `issue ${issue}${detail ? `: ${detail}` : ''}` : detail || `awaiting confirmation (${mode})` }
}

// ====================================================================== enrollment
export type EnrollResult =
  | { ok: true; outcome: 'invited' | 'enrolled' | 'reenrolled' | 'already_enrolled'; userId: string; emailStatus: string | null }
  | { ok: false; code: 'cohort_full' | 'cohort_unavailable' | 'enrollment_failed'; message: string }

/**
 * Enrolls one person in a cohort with the same rules as POST /api/invite (role
 * impact_participant): new person → account + invitation; existing account → enrollment +
 * set-up link (never signed in) or "you're enrolled" notice; already enrolled → no change;
 * withdrew earlier or a non-participant account → not changed, reported for the owner.
 */
export async function enrollRegistrant(deps: PaymentDeps, input: { email: string; fullName: string; cohortId: string; inquiryId?: string | null; registrationId?: string | null }): Promise<EnrollResult> {
  const { db } = deps
  const email = input.email.trim().toLowerCase()
  const { data: cohort } = await db.from('cohorts').select('id, name, capacity, status').eq('id', input.cohortId).maybeSingle()
  if (!cohort) return { ok: false, code: 'cohort_unavailable', message: 'The cohort no longer exists.' }
  if (!ENROLLABLE_COHORT_STATUSES.includes(cohort.status)) return { ok: false, code: 'cohort_unavailable', message: `${cohort.name} is ${cohort.status}.` }

  const seatsFull = async () => {
    if (cohort.capacity == null) return false
    const { count } = await db.from('cohort_enrollments').select('id', { count: 'exact', head: true }).eq('cohort_id', cohort.id).eq('status', 'active')
    return (count ?? 0) >= cohort.capacity
  }
  const recordForInquiry = async (result: string, userId: string | null, detail: string) => {
    if (!input.inquiryId) return
    await db.from('inquiry_participants').upsert(
      { inquiry_id: input.inquiryId, email, full_name: input.fullName || email, user_id: userId, cohort_id: cohort.id, result, detail: clip(detail, 500), updated_at: nowOf(deps).toISOString() },
      { onConflict: 'inquiry_id,email' })
  }
  const label = `${input.fullName || email} — ${cohort.name}`

  const { data: existing } = await db.from('profiles').select('id, full_name, role').ilike('email', likeExact(email)).maybeSingle()
  if (existing) {
    if (existing.role !== 'impact_participant') {
      return { ok: false, code: 'enrollment_failed', message: `This email belongs to a ${existing.role === 'admin' ? 'administrator' : 'coaching'} account; enroll them by hand if that is intended.` }
    }
    const { data: current } = await db.from('cohort_enrollments').select('id, status').eq('cohort_id', cohort.id).eq('user_id', existing.id).maybeSingle()
    if (current?.status === 'active' || current?.status === 'completed') {
      await recordForInquiry('already_enrolled', existing.id, 'Already enrolled in this cohort.')
      return { ok: true, outcome: 'already_enrolled', userId: existing.id, emailStatus: null }
    }
    if (current?.status === 'withdrawn') return { ok: false, code: 'enrollment_failed', message: 'They withdrew from this cohort earlier; re-enroll them by hand if that is intended.' }
    if (await seatsFull()) return { ok: false, code: 'cohort_full', message: `${cohort.name} is full.` }
    const write = await db.from('cohort_enrollments').insert({ user_id: existing.id, cohort_id: cohort.id, status: 'active' }).select('id, status').single()
    if (write.error || write.data?.status !== 'active') {
      const full = write.error?.details === 'cohort_full'
      await deps.audit(null, 'enrollment.create', 'enrollment', existing.id, { cohort_id: cohort.id, source: 'payment' }, { system: true, label, outcome: 'failed' })
      return { ok: false, code: full ? 'cohort_full' : 'enrollment_failed', message: full ? `${cohort.name} is full.` : 'The enrollment could not be saved.' }
    }
    await deps.audit(null, 'enrollment.returning', 'enrollment', existing.id, { cohort_id: cohort.id, source: 'payment' }, { system: true, label })
    const { data: authUser } = await db.auth.admin.getUserById(existing.id)
    const neverSignedIn = !authUser?.user?.last_sign_in_at
    const mail = await deps.sendAccessEmail({ kind: neverSignedIn ? 'account_setup' : 'enrolled_notice', userId: existing.id, email, name: existing.full_name || input.fullName, cohortName: cohort.name, relatedType: 'enrollment', relatedId: write.data.id })
    await recordForInquiry(neverSignedIn ? 'setup_link_sent' : 'enrolled', existing.id, `Enrolled in ${cohort.name} after payment. Email: ${mail.status}.`)
    return { ok: true, outcome: 'enrolled', userId: existing.id, emailStatus: mail.status }
  }

  if (await seatsFull()) return { ok: false, code: 'cohort_full', message: `${cohort.name} is full.` }
  const { data: link, error: linkError } = await db.auth.admin.generateLink({
    type: 'invite', email, options: { data: { full_name: input.fullName, role: 'impact_participant' }, redirectTo: `${site(deps)}/reset?type=invite` },
  })
  if (linkError || !link?.user) return { ok: false, code: 'enrollment_failed', message: `The account could not be created: ${linkError?.message ?? 'unknown error'}.` }
  const userId = link.user.id
  await db.from('profiles').update({ full_name: input.fullName || null, role: 'impact_participant', email }).eq('id', userId)
  const enr = await db.from('cohort_enrollments').insert({ user_id: userId, cohort_id: cohort.id, status: 'active' }).select('id').single()
  if (enr.error || !enr.data) {
    await deps.audit(null, 'user.invite', 'person', userId, { cohort_id: cohort.id, source: 'payment', enrolled: false }, { system: true, label, outcome: 'failed' })
    return { ok: false, code: enr.error?.details === 'cohort_full' ? 'cohort_full' : 'enrollment_failed', message: 'The account was created, but the enrollment could not be saved.' }
  }
  const mail = await deps.sendAccessEmail({ kind: 'invitation', userId, email, name: input.fullName, role: 'impact_participant', cohortName: cohort.name, inviteLink: link.properties?.action_link, relatedType: 'enrollment', relatedId: enr.data.id })
  await deps.audit(null, 'user.invite', 'person', userId, { cohort_id: cohort.id, source: 'payment', email_status: mail.status }, { system: true, label })
  await recordForInquiry('invited', userId, `Account created and enrolled in ${cohort.name} after payment. Email: ${mail.status}.`)
  return { ok: true, outcome: 'invited', userId, emailStatus: mail.status }
}

// ====================================================================== notifications
const formatDate = (d: string | null) => d ? new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null
const formatTime = (t: string | null) => {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'} ET`
}

type Marker = 'confirmation_email_sent_at' | 'owner_notified_at'

/** Claims a once-only marker; only one concurrent caller gets true (null: database error, retry). */
async function claim(db: SupabaseClient, regId: string, column: Marker, at: string): Promise<boolean | null> {
  const { data, error } = await db.from('registrations').update({ [column]: at }).eq('id', regId).is(column, null).select('id')
  if (error) return null
  return !!data?.length
}
const release = (db: SupabaseClient, regId: string, column: Marker) => db.from('registrations').update({ [column]: null }).eq('id', regId)

/**
 * The participant's confirmation (not a receipt; Stripe sends that) and the owner's
 * notification, each sent once. A failed send releases its marker and asks for a retry.
 */
export async function sendRegistrationNotifications(deps: PaymentDeps, regId: string): Promise<{ retry: boolean; detail: string }> {
  const { db } = deps
  const { data } = await db.from('registrations')
    .select('id, full_name, email, status, payment_status, amount_paid_cents, enrollment_issue, confirmation_email_sent_at, owner_notified_at, programs(name), cohorts(name, start_date, end_date, session_day, session_time, book_title, book_image_url, book_purchase_url)')
    .eq('id', regId).maybeSingle()
  if (!data) return { retry: false, detail: 'registration gone' }
  const reg = data as unknown as {
    id: string; full_name: string; email: string; status: string | null; amount_paid_cents: number | null; enrollment_issue: string | null
    confirmation_email_sent_at: string | null; owner_notified_at: string | null; programs: { name: string } | null
    cohorts: { name: string; start_date: string | null; end_date: string | null; session_day: string | null; session_time: string | null; book_title: string | null; book_image_url: string | null; book_purchase_url: string | null } | null
  }
  const at = nowOf(deps).toISOString()
  const programName = reg.programs?.name ?? 'The Impact Lab'
  const cohort = reg.cohorts
  const cents = reg.amount_paid_cents ?? 0
  const enrolled = reg.status === 'confirmed'
  const results: string[] = []
  let retry = false

  const mine = reg.confirmation_email_sent_at ? false : await claim(db, reg.id, 'confirmation_email_sent_at', at)
  if (mine === null) retry = true
  if (mine) {
    const r = await deps.deliverEmail({
      template: 'registration_confirmation', from: deps.emails.fromTlc, to: reg.email,
      subject: enrolled ? 'Your Impact Lab place is confirmed' : 'We received your Impact Lab registration',
      html: participantEmailHtml({ name: reg.full_name, programName, cohort, enrolled, issue: !!reg.enrollment_issue, charged: cents > 0 }),
      related: { type: 'registration', id: reg.id },
    })
    results.push(`participant email ${r.status}`)
    if (r.status === 'failed') { retry = true; await release(db, reg.id, 'confirmation_email_sent_at') }
  }

  const ours = reg.owner_notified_at ? false : await claim(db, reg.id, 'owner_notified_at', at)
  if (ours === null) retry = true
  if (ours) {
    const issueLine = reg.enrollment_issue
      ? `<strong>Needs your attention:</strong> ${esc(OWNER_ISSUE_TEXT[reg.enrollment_issue] ?? 'review this registration')}`
      : enrolled ? 'They were enrolled automatically and sent their access email.' : 'They are <strong>not enrolled yet</strong>. Review the registration and click “Confirm and give access”.'
    const r = await notifyOwner(deps, {
      subject: `${cents > 0 ? 'Payment received' : 'New registration'} — ${reg.full_name}${reg.enrollment_issue ? ' (needs attention)' : ''}`,
      template: 'registration_owner', relatedId: reg.id, href: `${site(deps)}/admin/registrations?id=${reg.id}`,
      lines: [issueLine],
      table: [['Name', esc(reg.full_name)], ['Email', esc(reg.email)], ['Program', esc(programName)], ['Cohort', esc(cohort?.name ?? '')], ['Amount paid', cents > 0 ? esc(`$${(cents / 100).toFixed(2)}`) : 'No charge']],
    })
    results.push(`owner email ${r.status}`)
    if (r.status === 'failed') { retry = true; await release(db, reg.id, 'owner_notified_at') }
  }
  return { retry, detail: results.join(', ') }
}

const OWNER_ISSUE_TEXT: Record<string, string> = {
  cohort_full: 'the cohort was full when they paid. Raise the capacity and confirm them, or refund the payment in Stripe.',
  cohort_unavailable: 'the cohort is not open for enrollment. Move them to another cohort, or refund the payment in Stripe.',
  enrollment_failed: 'the payment was received but enrollment did not complete. Open the registration and confirm them.',
  amount_mismatch: 'the amount paid differs from the price. Check the payment in Stripe before confirming.',
  refund_review: 'a refund or second payment needs your review.',
}

async function notifyOwner(deps: PaymentDeps, m: { subject: string; template: string; relatedId: string; lines: string[]; href: string; table?: [string, string][]; key?: string }) {
  const rows = (m.table ?? []).map(([k, v]) => `<tr><td style="color: #4A5260; width: 130px;">${esc(k)}</td><td style="font-weight: 600;">${v}</td></tr>`).join('')
  return deps.deliverEmail({
    template: m.template, from: deps.emails.fromPlatform, to: deps.emails.ownerInbox, subject: m.subject, idempotencyKey: m.key,
    related: { type: m.template.startsWith('payment_request') ? 'payment_request' : 'registration', id: m.relatedId },
    html: `
      <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #1C2430;">
        <div style="background: #001737; padding: 2rem; margin-bottom: 2rem;">
          <h1 style="color: #C88820; font-size: 1.25rem; letter-spacing: 0.08em; margin: 0;">${esc(m.subject)}</h1>
        </div>
        <div style="padding: 0 1rem;">
          ${m.lines.map(l => `<p style="font-size: 1rem; line-height: 1.75;">${l}</p>`).join('')}
          ${rows ? `<div style="background: #F7F5F0; border-left: 3px solid #C88820; padding: 1.25rem 1.5rem; margin: 1.5rem 0;"><table style="width: 100%; font-size: 0.9rem; line-height: 1.9;">${rows}</table></div>` : ''}
          <a href="${esc(m.href)}" style="display: inline-block; background: #C88820; color: #001737; padding: 0.75rem 1.5rem; text-decoration: none; font-weight: 700; font-size: 0.85rem; letter-spacing: 0.08em; text-transform: uppercase; margin-top: 1rem; border-radius: 2px;">Open in the admin panel</a>
        </div>
      </div>`,
  })
}

function participantEmailHtml(p: {
  name: string; programName: string; enrolled: boolean; issue: boolean; charged: boolean
  cohort: { name: string; start_date: string | null; end_date: string | null; session_day: string | null; session_time: string | null; book_title: string | null; book_image_url: string | null; book_purchase_url: string | null } | null
}): string {
  const c = p.cohort
  let schedule = ''
  let book = ''
  if (c) {
    const start = formatDate(c.start_date), end = formatDate(c.end_date), time = formatTime(c.session_time)
    if (start && end) schedule += `<p style="font-size: 0.85rem; color: #4A5260; margin: 0.5rem 0 0;">${esc(start)} to ${esc(end)}</p>`
    if (c.session_day && time) schedule += `<p style="font-size: 0.85rem; color: #4A5260; margin: 0.25rem 0 0;">${esc(c.session_day)}s at ${esc(time)}</p>`
    if (c.book_title) {
      const buy = safeHttpUrl(c.book_purchase_url), img = safeHttpUrl(c.book_image_url)
      book = `
        <div style="background: #F7F5F0; border-left: 3px solid #C88820; padding: 1.5rem; margin-bottom: 1.5rem;">
          <p style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.15em; color: #C88820; margin-bottom: 0.75rem;">What We Are Reading</p>
          <table style="width: 100%;"><tr>
            ${img ? `<td style="width: 90px; vertical-align: top; padding-right: 1rem;"><img src="${esc(img)}" alt="${esc(c.book_title)}" style="width: 90px; height: auto; border-radius: 3px; display: block;" /></td>` : ''}
            <td style="vertical-align: top;">
              <p style="font-size: 1rem; font-weight: 700; color: #001737; margin: 0 0 0.5rem;">${esc(c.book_title)}</p>
              ${buy ? `<a href="${esc(buy)}" style="display: inline-block; background: #C88820; color: #001737; padding: 0.5rem 1rem; text-decoration: none; font-weight: 700; font-size: 0.75rem; letter-spacing: 0.05em; text-transform: uppercase; border-radius: 2px;">Buy the Book</a>` : ''}
            </td>
          </tr></table>
        </div>`
    }
  }
  const next = p.enrolled
    ? 'Your place is confirmed. You will receive a separate email with access to your Learning Hub.'
    : p.issue
      ? 'Tramaine will be in touch personally about your place in the cohort.'
      : 'Tramaine will confirm your place and send your Learning Hub access by email.'
  const receipt = p.charged ? '<p style="font-size: 0.9rem; line-height: 1.75; margin-bottom: 1.5rem; color: #4A5260;">This email is not a receipt. Your payment receipt is sent separately by Stripe, our payment processor.</p>' : ''
  return `
    <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #1C2430;">
      <div style="background: #001737; padding: 2rem; text-align: center; margin-bottom: 2rem;">
        <h1 style="color: #C88820; font-size: 1.5rem; letter-spacing: 0.08em; margin: 0;">TLC LEADERSHIP</h1>
        <p style="color: rgba(255,255,255,0.5); font-size: 0.75rem; letter-spacing: 0.2em; text-transform: uppercase; margin: 0.5rem 0 0;">The Impact Lab</p>
      </div>
      <div style="padding: 0 1rem;">
        <p style="font-size: 1rem; line-height: 1.75; margin-bottom: 1.5rem;">Hi ${esc(p.name)},</p>
        <p style="font-size: 1rem; line-height: 1.75; margin-bottom: 1.5rem;">Thank you for registering for The Impact Lab. We have received your registration${p.charged ? ' and payment' : ''}.</p>
        <div style="background: #F7F5F0; border-left: 3px solid #C88820; padding: 1.5rem; margin-bottom: 1.5rem;">
          <p style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.15em; color: #C88820; margin-bottom: 0.75rem;">Your Registration</p>
          <p style="font-size: 1rem; font-weight: 700; color: #001737; margin-bottom: 0.25rem;">${esc(p.programName)}</p>
          <p style="font-size: 0.9rem; color: #4A5260; margin-bottom: 0;">${esc(c?.name ?? '')}</p>
          ${schedule}
        </div>
        ${book}
        <p style="font-size: 1rem; line-height: 1.75; margin-bottom: 1.5rem;">${next}</p>
        ${receipt}
        <p style="font-size: 1rem; line-height: 1.75; margin-bottom: 1.5rem;">If you have any questions, reach out to Tramaine directly at <a href="mailto:tramaine@tramainecrawford.com" style="color: #C88820;">tramaine@tramainecrawford.com</a> or <a href="tel:+12025991381" style="color: #C88820;">(202) 599-1381</a>.</p>
        <p style="font-size: 1rem; line-height: 1.75; margin-top: 2rem; color: #4A5260;">Tramaine L. Crawford<br/>TLC Leadership Consulting &amp; Coaching</p>
      </div>
      <div style="background: #001737; padding: 1.5rem; text-align: center; margin-top: 2rem;">
        <p style="color: rgba(255,255,255,0.3); font-size: 0.75rem; margin: 0;">2001 L St NW, Suite 500, Washington, DC 20036</p>
      </div>
    </div>`
}

// ====================================================================== failures and refunds
async function onPaymentIntentFailed(pi: Stripe.PaymentIntent, deps: PaymentDeps): Promise<HandlerResult> {
  const message = clip(pi.last_payment_error?.message ?? 'The payment was declined.', 300)
  const at = nowOf(deps).toISOString()
  const regId = pi.metadata?.registration_id
  if (regId) {
    const { data, error } = await deps.db.from('registrations')
      .update({ payment_status: 'failed', payment_failed_at: at, payment_error: message, stripe_payment_intent_id: pi.id })
      .eq('id', regId).in('payment_status', ['unpaid', 'pending']).select('id')
    if (error) return { outcome: 'db_error', detail: error.message, retry: true }
    return { outcome: data?.length ? 'registration_failed' : 'registration_failed_noop' }
  }
  const prId = pi.metadata?.payment_request_id
  if (prId) {
    const { data, error } = await deps.db.from('payment_requests')
      .update({ status: 'failed', updated_at: at }).eq('id', prId).in('status', ['open']).select('id')
    if (error) return { outcome: 'db_error', detail: error.message, retry: true }
    return { outcome: data?.length ? 'payment_request_failed' : 'payment_request_failed_noop' }
  }
  return { outcome: 'ignored_unknown_payment' }
}

/** Refund status from Stripe's totals: never lower than what is already recorded. */
export function refundState(paidCents: number, refundedCents: number, fullyRefunded: boolean): 'refunded' | 'partially_refunded' {
  return fullyRefunded || (paidCents > 0 && refundedCents >= paidCents) ? 'refunded' : 'partially_refunded'
}

async function onChargeRefunded(charge: Stripe.Charge, deps: PaymentDeps): Promise<HandlerResult> {
  const { db } = deps
  const piId = idOf(charge.payment_intent as string | Stripe.PaymentIntent | null)
  const refunded = charge.amount_refunded ?? 0
  const at = nowOf(deps).toISOString()
  if (!piId) return { outcome: 'ignored_unknown_charge' }

  const { data: reg } = await db.from('registrations').select('id, full_name, amount_paid_cents, amount_refunded_cents').eq('stripe_payment_intent_id', piId).maybeSingle()
  if (reg) {
    if ((reg.amount_refunded_cents ?? 0) >= refunded) return { outcome: 'refund_already_recorded' }
    const status = refundState(reg.amount_paid_cents ?? charge.amount, refunded, charge.refunded)
    // Only the payment fields change: the enrollment stays as it is and the owner decides.
    const { error } = await db.from('registrations').update({
      payment_status: status, amount_refunded_cents: refunded, refunded_at: at, enrollment_issue: 'refund_review', enrollment_issue_at: at,
    }).eq('id', reg.id).lt('amount_refunded_cents', refunded)
    if (error) return { outcome: 'db_error', detail: error.message, retry: true }
    await deps.audit(null, 'registration.refund_recorded', 'registration', reg.id, { refunded_cents: refunded, status }, { system: true, label: reg.full_name })
    return { outcome: `registration_${status}`, detail: `${refunded} cents refunded` }
  }

  const prId = await paymentRequestForPaymentIntent(deps, piId)
  if (prId) {
    const { data: pr } = await db.from('payment_requests').select('id, amount_paid_cents, amount_refunded_cents').eq('id', prId).maybeSingle()
    if (!pr) return { outcome: 'ignored_unknown_charge' }
    if (pr.amount_refunded_cents >= refunded) return { outcome: 'refund_already_recorded' }
    const status = refundState(pr.amount_paid_cents || charge.amount, refunded, charge.refunded)
    const { error } = await db.from('payment_requests').update({ status, amount_refunded_cents: refunded, updated_at: at }).eq('id', pr.id).lt('amount_refunded_cents', refunded)
    if (error) return { outcome: 'db_error', detail: error.message, retry: true }
    await deps.audit(null, 'payment_request.refund_recorded', 'payment_request', pr.id, { refunded_cents: refunded, status }, { system: true })
    return { outcome: `payment_request_${status}` }
  }
  return { outcome: 'ignored_unknown_charge' }
}

/** Which payment request a PaymentIntent paid: its metadata (payment links) or its invoice. */
async function paymentRequestForPaymentIntent(deps: PaymentDeps, piId: string): Promise<string | null> {
  if (!deps.stripe) return null
  try {
    const pi = await deps.stripe.paymentIntents.retrieve(piId)
    if (pi.metadata?.payment_request_id) return pi.metadata.payment_request_id
  } catch { /* not retrievable */ }
  try {
    const list = await deps.stripe.invoicePayments.list({ payment: { type: 'payment_intent', payment_intent: piId }, limit: 1 })
    const invoiceId = idOf(list.data[0]?.invoice as string | Stripe.Invoice | null | undefined)
    if (invoiceId) {
      const { data } = await deps.db.from('payment_requests').select('id').eq('stripe_object_id', invoiceId).maybeSingle()
      if (data) return data.id
    }
  } catch { /* not an invoice payment */ }
  return null
}

// ====================================================================== payment requests (webhook side)
async function findPaymentRequest(deps: PaymentDeps, metadataId: string | undefined, stripeObjectId: string | null) {
  const cols = 'id, status, amount_cents, amount_paid_cents, payer_name, description, inquiry_id, method, stripe_object_id'
  if (metadataId) {
    const { data } = await deps.db.from('payment_requests').select(cols).eq('id', metadataId).maybeSingle()
    if (data) return data
  }
  if (stripeObjectId) {
    const { data } = await deps.db.from('payment_requests').select(cols).eq('stripe_object_id', stripeObjectId).maybeSingle()
    if (data) return data
  }
  return null
}

const PAYABLE = ['draft', 'open', 'failed', 'expired', 'partially_paid']

async function markRequestPaid(deps: PaymentDeps, pr: { id: string; payer_name: string; description: string; inquiry_id: string | null; amount_cents: number }, amountPaid: number, source: string): Promise<HandlerResult> {
  const at = nowOf(deps).toISOString()
  const status = amountPaid >= pr.amount_cents ? 'paid' : 'partially_paid'
  const { data, error } = await deps.db.from('payment_requests')
    .update({ status, amount_paid_cents: amountPaid, paid_at: at, updated_at: at }).eq('id', pr.id).in('status', PAYABLE).select('id')
  if (error) return { outcome: 'db_error', detail: error.message, retry: true }
  if (!data?.length) {
    await deps.audit(null, 'payment_request.extra_payment', 'payment_request', pr.id, { source, amount_cents: amountPaid }, { system: true, label: `${pr.payer_name} — ${pr.description}`, outcome: 'failed' })
    return { outcome: 'payment_request_already_closed', detail: 'payment received for a request that is not open; check Stripe' }
  }
  await deps.audit(null, 'payment_request.paid', 'payment_request', pr.id, { source, amount_cents: amountPaid, status }, { system: true, label: `${pr.payer_name} — ${pr.description}` })
  await notifyOwner(deps, {
    subject: `Payment received — ${pr.payer_name}`, template: 'payment_request_paid_owner', relatedId: pr.id, key: `payment-request:${pr.id}:${status}`,
    href: pr.inquiry_id ? `${site(deps)}/admin/inquiries?id=${pr.inquiry_id}` : `${site(deps)}/admin/reports`,
    lines: [`${esc(pr.payer_name)} paid <strong>${esc(`$${(amountPaid / 100).toFixed(2)}`)}</strong> for “${esc(pr.description)}”${status === 'partially_paid' ? ` (of $${(pr.amount_cents / 100).toFixed(2)} requested)` : ''}. Enroll their participants from the inquiry when you are ready.`],
  })
  return { outcome: `payment_request_${status}` }
}

async function onPaymentRequestSession(session: Stripe.Checkout.Session, type: string, deps: PaymentDeps): Promise<HandlerResult> {
  const linkId = idOf(session.payment_link as string | Stripe.PaymentLink | null)
  const pr = await findPaymentRequest(deps, session.metadata?.payment_request_id, linkId ?? session.id)
  if (!pr) return { outcome: 'ignored_unknown_request' }
  const at = nowOf(deps).toISOString()
  if (type === 'checkout.session.expired') {
    if (linkId) return { outcome: 'payment_link_session_expired' } // the link itself still works
    await deps.db.from('payment_requests').update({ status: 'expired', updated_at: at }).eq('id', pr.id).eq('status', 'open')
    return { outcome: 'payment_request_expired' }
  }
  if (type === 'checkout.session.async_payment_failed') {
    await deps.db.from('payment_requests').update({ status: 'failed', updated_at: at }).eq('id', pr.id).in('status', ['open'])
    return { outcome: 'payment_request_failed' }
  }
  if (type === 'checkout.session.completed' && session.payment_status === 'unpaid') return { outcome: 'payment_request_processing' }
  const result = await markRequestPaid(deps, pr, session.amount_total ?? 0, session.id)
  // A payment link is single-use for a request: switch it off once paid (best effort).
  if (linkId && deps.stripe && result.outcome === 'payment_request_paid') {
    try { await deps.stripe.paymentLinks.update(linkId, { active: false }) } catch { /* the owner can deactivate it in Stripe */ }
  }
  return result
}

async function onInvoice(inv: Stripe.Invoice, type: string, deps: PaymentDeps): Promise<HandlerResult> {
  const pr = await findPaymentRequest(deps, inv.metadata?.payment_request_id, inv.id ?? null)
  if (!pr) return { outcome: 'ignored_unknown_invoice' }
  const at = nowOf(deps).toISOString()
  const db = deps.db
  switch (type) {
    case 'invoice.paid': return markRequestPaid(deps, pr, inv.amount_paid ?? 0, inv.id ?? 'invoice')
    case 'invoice.payment_failed':
      await db.from('payment_requests').update({ status: 'failed', updated_at: at }).eq('id', pr.id).in('status', ['open', 'failed'])
      return { outcome: 'payment_request_failed' }
    case 'invoice.voided':
      await db.from('payment_requests').update({ status: 'void', updated_at: at }).eq('id', pr.id).in('status', ['draft', 'open', 'failed', 'expired'])
      return { outcome: 'payment_request_void' }
    case 'invoice.marked_uncollectible':
      await db.from('payment_requests').update({ status: 'failed', updated_at: at }).eq('id', pr.id).in('status', ['open', 'failed'])
      return { outcome: 'payment_request_uncollectible' }
  }
  return { outcome: 'ignored_type' }
}

// ====================================================================== admin: payment requests
export interface PaymentRequestRecord {
  id: string; method: 'payment_link' | 'invoice' | 'offline'; status: string; payer_name: string; payer_email: string | null
  description: string; seats: number | null; amount_cents: number; amount_paid_cents: number; amount_refunded_cents: number; currency: string
  stripe_object_id: string | null; stripe_url: string | null; due_date: string | null; inquiry_id: string | null
}

export class PaymentRequestError extends Error {
  status: number
  constructor(message: string, status = 400) { super(message); this.status = status }
}

const daysUntil = (due: string, now: Date) => Math.max(1, Math.ceil((new Date(`${due}T23:59:59-05:00`).getTime() - now.getTime()) / 86400_000))

/**
 * Creates the Stripe side of a draft request and opens it. Offline requests have no Stripe
 * object. Stripe calls use idempotency keys derived from the request id, so pressing Send again
 * after a failure does not create duplicate products, invoices or links.
 */
export async function sendPaymentRequest(deps: PaymentDeps, pr: PaymentRequestRecord): Promise<PaymentRequestRecord> {
  if (pr.status !== 'draft') throw new PaymentRequestError('Only a request that has not been sent yet can be sent.', 409)
  const at = nowOf(deps)
  let patch: Record<string, unknown>
  if (pr.method === 'offline') {
    patch = { status: 'open' }
  } else {
    const stripe = deps.stripe
    if (!stripe) throw new PaymentRequestError('Stripe is not configured on the server.', 503)
    const metadata = { payment_request_id: pr.id }
    const seats = pr.seats ? ` (${pr.seats} seat${pr.seats === 1 ? '' : 's'})` : ''
    const key = (step: string) => `payment-request:${pr.id}:${step}`
    if (pr.method === 'payment_link') {
      const product = await stripe.products.create({ name: clip(`${pr.description}${seats}`, 250), metadata }, { idempotencyKey: key('product') })
      const price = await stripe.prices.create({ product: product.id, unit_amount: pr.amount_cents, currency: 'usd', metadata }, { idempotencyKey: key('price') })
      const link = await stripe.paymentLinks.create({
        line_items: [{ price: price.id, quantity: 1 }], metadata,
        payment_intent_data: { metadata, description: clip(`${pr.payer_name} — ${pr.description}`, 300) },
        restrictions: { completed_sessions: { limit: 1 } },
        after_completion: { type: 'hosted_confirmation', hosted_confirmation: { custom_message: 'Thank you. TLC Leadership has received your payment and Tramaine will be in touch about next steps.' } },
      }, { idempotencyKey: key('link') })
      patch = { status: 'open', stripe_object_id: link.id, stripe_url: safeHttpUrl(link.url) }
    } else {
      if (!pr.payer_email) throw new PaymentRequestError('An invoice needs the payer’s email address: Stripe emails the invoice to it.')
      if (!pr.due_date) throw new PaymentRequestError('An invoice needs a due date.')
      const found = await stripe.customers.list({ email: pr.payer_email, limit: 1 })
      const customer = found.data[0] ?? await stripe.customers.create({ email: pr.payer_email, name: pr.payer_name, metadata }, { idempotencyKey: key('customer') })
      const invoice = await stripe.invoices.create({
        customer: customer.id, collection_method: 'send_invoice', days_until_due: daysUntil(pr.due_date, at),
        description: clip(pr.description, 500), metadata, pending_invoice_items_behavior: 'exclude', auto_advance: false,
      }, { idempotencyKey: key('invoice') })
      await stripe.invoiceItems.create({ customer: customer.id, invoice: invoice.id, amount: pr.amount_cents, currency: 'usd', description: clip(`${pr.description}${seats}`, 500), metadata }, { idempotencyKey: key('item') })
      const finalized = await stripe.invoices.finalizeInvoice(invoice.id!, {}, { idempotencyKey: key('finalize') })
      // Stripe emails the invoice (with its payment page) to the customer.
      await stripe.invoices.sendInvoice(finalized.id!, {}, { idempotencyKey: key('send') })
      patch = { status: 'open', stripe_object_id: finalized.id, stripe_url: safeHttpUrl(finalized.hosted_invoice_url ?? null) }
    }
  }
  const { data, error } = await deps.db.from('payment_requests').update({ ...patch, updated_at: at.toISOString() }).eq('id', pr.id).eq('status', 'draft').select('*').single()
  if (error || !data) throw new PaymentRequestError(`Stripe accepted the request, but it could not be saved here (${error?.message ?? 'no row'}). Check Stripe before sending it again.`, 500)
  return data as PaymentRequestRecord
}

/** Reads the request's current state from Stripe and records it (no changes in Stripe). */
export async function refreshPaymentRequest(deps: PaymentDeps, pr: PaymentRequestRecord): Promise<{ record: PaymentRequestRecord; summary: string }> {
  const stripe = deps.stripe
  if (pr.method === 'offline' || !pr.stripe_object_id) return { record: pr, summary: 'This request has no Stripe record to check.' }
  if (!stripe) throw new PaymentRequestError('Stripe is not configured on the server.', 503)
  const at = nowOf(deps).toISOString()
  let patch: Record<string, unknown> = {}
  let summary = ''
  let piId: string | null = null

  if (pr.method === 'invoice') {
    const inv = await stripe.invoices.retrieve(pr.stripe_object_id)
    const map: Record<string, string> = { paid: 'paid', void: 'void', uncollectible: 'failed', draft: 'draft' }
    const next = inv.status ? map[inv.status] : undefined
    if (next === 'paid') patch = { status: (inv.amount_paid ?? 0) >= pr.amount_cents ? 'paid' : 'partially_paid', amount_paid_cents: inv.amount_paid ?? 0, paid_at: inv.status_transitions?.paid_at ? new Date(inv.status_transitions.paid_at * 1000).toISOString() : at }
    else if (next) patch = { status: next }
    summary = `Stripe shows this invoice as ${inv.status ?? 'unknown'}${inv.amount_paid ? ` (${(inv.amount_paid / 100).toFixed(2)} paid)` : ''}.`
    if (inv.status === 'paid') {
      try {
        const pays = await stripe.invoicePayments.list({ invoice: inv.id!, limit: 1 })
        piId = pays.data[0]?.payment?.payment_intent ? idOf(pays.data[0].payment.payment_intent as string | Stripe.PaymentIntent) : null
      } catch { /* refunds will still arrive by webhook */ }
    }
  } else {
    const link = await stripe.paymentLinks.retrieve(pr.stripe_object_id)
    const sessions = await stripe.checkout.sessions.list({ payment_link: link.id, limit: 20 })
    const paid = sessions.data.find(s => s.status === 'complete' && (s.payment_status === 'paid' || s.payment_status === 'no_payment_required'))
    if (paid) {
      patch = { status: (paid.amount_total ?? 0) >= pr.amount_cents ? 'paid' : 'partially_paid', amount_paid_cents: paid.amount_total ?? 0, paid_at: at }
      piId = idOf(paid.payment_intent as string | Stripe.PaymentIntent | null)
      summary = `Stripe shows a completed payment of ${((paid.amount_total ?? 0) / 100).toFixed(2)} on this link.`
    } else {
      summary = link.active ? 'No completed payment on this link yet.' : 'No completed payment; the link is switched off in Stripe.'
    }
  }
  if (piId) {
    try {
      const pi = await stripe.paymentIntents.retrieve(piId, { expand: ['latest_charge'] })
      const charge = pi.latest_charge && typeof pi.latest_charge !== 'string' ? pi.latest_charge : null
      if (charge && charge.amount_refunded > (pr.amount_refunded_cents ?? 0)) {
        patch = { ...patch, amount_refunded_cents: charge.amount_refunded, status: refundState(charge.amount, charge.amount_refunded, charge.refunded) }
        summary += ` ${(charge.amount_refunded / 100).toFixed(2)} has been refunded in Stripe.`
      }
    } catch { /* keep what we have */ }
  }
  // Never move a closed record backwards (e.g. paid → open) from a refresh.
  if (patch.status && ['paid', 'refunded', 'partially_refunded', 'void'].includes(pr.status) && ['open', 'draft', 'failed'].includes(patch.status as string)) delete patch.status
  if (Object.keys(patch).length === 0) return { record: pr, summary: summary || 'Nothing has changed.' }
  const { data, error } = await deps.db.from('payment_requests').update({ ...patch, updated_at: at }).eq('id', pr.id).select('*').single()
  if (error || !data) throw new PaymentRequestError(`The Stripe status could not be saved: ${error?.message ?? 'no row'}.`, 500)
  return { record: data as PaymentRequestRecord, summary }
}

/** Cancels an unpaid request: voids the invoice / switches off the link in Stripe first. */
export async function voidPaymentRequest(deps: PaymentDeps, pr: PaymentRequestRecord): Promise<PaymentRequestRecord> {
  if (!['draft', 'open', 'failed', 'expired'].includes(pr.status)) {
    throw new PaymentRequestError(pr.status === 'void' ? 'This request is already cancelled.' : 'A paid request cannot be cancelled here. Refund it in Stripe if needed; the refund is recorded automatically.', 409)
  }
  if (pr.stripe_object_id && pr.method !== 'offline') {
    if (!deps.stripe) throw new PaymentRequestError('Stripe is not configured on the server.', 503)
    if (pr.method === 'invoice') {
      const inv = await deps.stripe.invoices.retrieve(pr.stripe_object_id)
      if (inv.status === 'paid') throw new PaymentRequestError('Stripe shows this invoice as paid. Press Refresh instead.', 409)
      if (inv.status === 'open' || inv.status === 'uncollectible') await deps.stripe.invoices.voidInvoice(pr.stripe_object_id)
      else if (inv.status === 'draft') await deps.stripe.invoices.del(pr.stripe_object_id)
    } else {
      await deps.stripe.paymentLinks.update(pr.stripe_object_id, { active: false })
    }
  }
  const { data, error } = await deps.db.from('payment_requests').update({ status: 'void', updated_at: nowOf(deps).toISOString() }).eq('id', pr.id).select('*').single()
  if (error || !data) throw new PaymentRequestError(`Cancelled in Stripe, but not saved here: ${error?.message ?? 'no row'}.`, 500)
  return data as PaymentRequestRecord
}

// ====================================================================== admin: registration sync
/**
 * Re-reads a registration's Checkout Session from Stripe (for a missed webhook) and records
 * what Stripe says, through the same code the webhook uses.
 */
export async function syncRegistrationFromStripe(deps: PaymentDeps, regId: string): Promise<string> {
  if (!deps.stripe) throw new PaymentRequestError('Stripe is not configured on the server.', 503)
  const { data: reg } = await deps.db.from('registrations').select('id, stripe_session_id, payment_status, stripe_payment_intent_id').eq('id', regId).maybeSingle()
  if (!reg) throw new PaymentRequestError('Registration not found.', 404)
  if (!reg.stripe_session_id) return 'This registration never went to Stripe checkout, so there is nothing to check.'
  const session = await deps.stripe.checkout.sessions.retrieve(reg.stripe_session_id)
  if (session.metadata?.registration_id && session.metadata.registration_id !== reg.id) throw new PaymentRequestError('The Stripe session belongs to a different registration.', 409)
  session.metadata = { ...(session.metadata ?? {}), registration_id: reg.id }
  if (session.status === 'complete' && (session.payment_status === 'paid' || session.payment_status === 'no_payment_required')) {
    const r = await recordRegistrationPayment(reg.id, session, deps)
    const piId = idOf(session.payment_intent as string | Stripe.PaymentIntent | null)
    if (piId) {
      try {
        const pi = await deps.stripe.paymentIntents.retrieve(piId, { expand: ['latest_charge'] })
        const charge = pi.latest_charge && typeof pi.latest_charge !== 'string' ? pi.latest_charge : null
        if (charge?.amount_refunded) await onChargeRefunded(charge, deps)
        if (charge?.receipt_url) await deps.db.from('registrations').update({ receipt_url: safeHttpUrl(charge.receipt_url) }).eq('id', reg.id).is('receipt_url', null)
      } catch { /* receipt and refund stay as recorded */ }
    }
    return r.outcome === 'duplicate_payment' ? 'Stripe shows a second payment for this registration; it is flagged for review.' : 'Stripe shows this checkout as paid; the payment is recorded.'
  }
  if (session.status === 'expired') {
    await deps.db.from('registrations').update({ payment_status: 'expired' }).eq('id', reg.id).eq('payment_status', 'unpaid')
    return 'Stripe shows this checkout expired without payment.'
  }
  if (session.status === 'complete' && session.payment_status === 'unpaid') return 'Stripe shows the payment is still processing (bank payment).'
  return 'Stripe shows this checkout is still open and unpaid.'
}
