// Payment status in plain words, and the payment items for "Needs your attention".
// Pure functions (no database, no Stripe): safe for admin screens and unit tests.
//
// Payment and enrollment are independent. A registration's payment_status says what happened
// with money; its status (pending/confirmed/declined/waitlist) is the owner's decision; whether
// the person is enrolled is read from cohort_enrollments. Historical registrations for free
// programs are payment_status 'paid' with no amount: shown as "Free (no charge)", never revenue.
import type { AttentionItem } from './attention-types'
import { todayET } from './business-time'

export interface PaymentRegistration {
  id: string
  full_name?: string | null
  email?: string | null
  cohort_id?: string | null
  status?: string | null
  payment_status?: string | null
  amount_paid?: number | null
  amount_paid_cents?: number | null
  amount_refunded_cents?: number | null
  currency?: string | null
  stripe_session_id?: string | null
  stripe_payment_intent_id?: string | null
  receipt_url?: string | null
  paid_at?: string | null
  refunded_at?: string | null
  payment_failed_at?: string | null
  payment_error?: string | null
  checkout_expires_at?: string | null
  enrollment_issue?: string | null
  enrollment_issue_at?: string | null
  complimentary_reason?: string | null
  complimentary_approved_by?: string | null
  inquiry_id?: string | null
  created_at?: string | null
  cohorts?: { name: string } | null
}

export interface PaymentRequestLike {
  id: string; inquiry_id: string | null; registration_id: string | null; cohort_id: string | null
  payer_name: string; description: string; method: string; status: string
  amount_cents: number; amount_paid_cents: number; amount_refunded_cents: number; currency: string
  due_date: string | null; created_at: string; updated_at?: string; paid_at?: string | null
}

// ------------------------------------------------------------------ money
export function formatCents(cents: number | null | undefined, currency = 'usd'): string {
  const value = (cents ?? 0) / 100
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(value)
  } catch {
    return `$${value.toFixed(2)}`
  }
}

/** "1,250.50" or "$1250" → cents. Null for anything that is not a positive amount with ≤ 2 decimals. */
export function parseDollarsToCents(input: string): number | null {
  const s = input.trim().replace(/^\$/, '').replace(/,/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null
  const [whole, frac = ''] = s.split('.')
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, '0'))
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null
}

/** Amount the person paid, in cents (falls back to the legacy whole-dollar column). */
export function paidCents(r: PaymentRegistration): number | null {
  if (r.amount_paid_cents != null) return r.amount_paid_cents
  if (r.amount_paid != null) return Math.round(Number(r.amount_paid) * 100)
  return null
}

const MONEY_STATES = new Set(['paid', 'partially_refunded', 'refunded'])

/** Checkout completed with no charge (historical free programs, or a 100% discount). */
export function isFreeCheckout(r: PaymentRegistration): boolean {
  return r.payment_status === 'paid' && !paidCents(r)
}

/**
 * Owner decision (2026-11-26): every Impact Lab program offered before paid enrollment existed was
 * complimentary. Release 2e (deployed 2026-11-26) introduced paid enrollment, so a registration
 * created before this moment records a free place even where the old free checkout left it
 * "unpaid" / "expired" or its program carried a list price. Those records are NOT changed: they
 * are only described and judged as complimentary. Registrations created later are judged normally,
 * whatever the status of their cohort.
 */
export const COMPLIMENTARY_ERA_ENDS = '2026-11-26T00:00:00Z'

/**
 * A registration from the complimentary era with no money recorded. Anything that did record money
 * (paid, refunded) or has no creation date is judged normally, so a real problem is never hidden.
 */
export function isHistoricalComplimentary(r: PaymentRegistration): boolean {
  const created = r.created_at ? Date.parse(r.created_at) : NaN
  if (Number.isNaN(created) || created >= Date.parse(COMPLIMENTARY_ERA_ENDS)) return false
  if ((paidCents(r) ?? 0) > 0 || (r.amount_refunded_cents ?? 0) > 0) return false
  return !['complimentary', 'refunded', 'partially_refunded'].includes(r.payment_status ?? '')
}

/** Money actually kept: paid minus refunded. Free, complimentary and unpaid are 0. */
export function netCollectedCents(r: PaymentRegistration): number {
  if (!MONEY_STATES.has(r.payment_status ?? '')) return 0
  return Math.max(0, (paidCents(r) ?? 0) - (r.amount_refunded_cents ?? 0))
}

export type PaymentTone = 'ok' | 'muted' | 'warn' | 'bad'
export interface PaymentState { key: string; label: string; tone: PaymentTone }

export function paymentState(r: PaymentRegistration, now: Date = new Date()): PaymentState {
  const cur = r.currency ?? 'usd'
  // Complimentary-era registrations whose old free checkout did not finish (record unchanged).
  if (r.payment_status !== 'paid' && isHistoricalComplimentary(r)) return { key: 'historical_free', label: 'Free program (no payment needed)', tone: 'muted' }
  switch (r.payment_status) {
    case 'paid':
      return isFreeCheckout(r) ? { key: 'free', label: 'Free (no charge)', tone: 'muted' } : { key: 'paid', label: `Paid ${formatCents(paidCents(r), cur)}`, tone: 'ok' }
    case 'complimentary': return { key: 'complimentary', label: 'Complimentary', tone: 'ok' }
    case 'pending': return { key: 'pending', label: 'Pending payment', tone: 'warn' }
    case 'failed': return { key: 'failed', label: 'Payment failed', tone: 'bad' }
    case 'expired': return { key: 'expired', label: 'Checkout expired', tone: 'muted' }
    case 'refunded': return { key: 'refunded', label: `Refunded ${formatCents(r.amount_refunded_cents, cur)}`, tone: 'warn' }
    case 'partially_refunded':
      return { key: 'partially_refunded', label: `Partially refunded (${formatCents(r.amount_refunded_cents, cur)} of ${formatCents(paidCents(r), cur)})`, tone: 'warn' }
    default:
      if (r.checkout_expires_at && new Date(r.checkout_expires_at).getTime() > now.getTime()) return { key: 'in_checkout', label: 'Checkout in progress', tone: 'muted' }
      return { key: 'unpaid', label: 'Not paid', tone: 'muted' }
  }
}

const owes = (r: PaymentRegistration) => !isHistoricalComplimentary(r)
export const PAYMENT_FILTERS: { value: string; label: string; test: (r: PaymentRegistration) => boolean }[] = [
  { value: 'paid', label: 'Paid', test: r => r.payment_status === 'paid' && !isFreeCheckout(r) },
  { value: 'free', label: 'Free (no charge)', test: r => isFreeCheckout(r) || isHistoricalComplimentary(r) },
  { value: 'complimentary', label: 'Complimentary', test: r => r.payment_status === 'complimentary' },
  { value: 'pending', label: 'Pending payment', test: r => r.payment_status === 'pending' && owes(r) },
  { value: 'failed', label: 'Payment failed', test: r => r.payment_status === 'failed' && owes(r) },
  { value: 'expired', label: 'Checkout expired', test: r => r.payment_status === 'expired' && owes(r) },
  { value: 'refunded', label: 'Refunded (full or partial)', test: r => r.payment_status === 'refunded' || r.payment_status === 'partially_refunded' },
  { value: 'unpaid', label: 'Not paid', test: r => (!r.payment_status || r.payment_status === 'unpaid') && owes(r) },
]

// ------------------------------------------------------------------ Stripe dashboard links
export type StripeObjectKind = 'payment' | 'invoice' | 'payment_link' | 'customer'
const DASHBOARD_PATH: Record<StripeObjectKind, string> = { payment: 'payments', invoice: 'invoices', payment_link: 'payment-links', customer: 'customers' }

/** Link to the object in the Stripe dashboard (test-mode objects live under /test/). */
export function stripeDashboardUrl(kind: StripeObjectKind, id: string, mode: 'test' | 'live' | 'unconfigured' = 'live'): string {
  return `https://dashboard.stripe.com/${mode === 'test' ? 'test/' : ''}${DASHBOARD_PATH[kind]}/${encodeURIComponent(id)}`
}

/** The Stripe object behind a payment request (null for offline arrangements and drafts). */
export function paymentRequestStripeKind(id: string | null): StripeObjectKind | null {
  if (!id) return null
  if (id.startsWith('in_')) return 'invoice'
  if (id.startsWith('plink_')) return 'payment_link'
  if (id.startsWith('pi_')) return 'payment'
  return null
}

// ------------------------------------------------------------------ enrollment issues
export const ENROLLMENT_ISSUE: Record<string, { title: string; todo: string }> = {
  cohort_full: { title: 'Paid, but the cohort is full', todo: 'Raise the cohort’s capacity in Cohorts and confirm them, or refund the payment in Stripe.' },
  cohort_unavailable: { title: 'Paid, but the cohort is not open', todo: 'Move the registration to another cohort (Edit details) and confirm them, or refund the payment in Stripe.' },
  enrollment_failed: { title: 'Paid, but enrollment did not complete', todo: 'Open the registration and use “Confirm and give access”. If it fails again, check their account in Participants.' },
  amount_mismatch: { title: 'Paid amount differs from the price', todo: 'Check the payment in Stripe. Confirm them if the amount is right; otherwise refund or collect the difference in Stripe.' },
  refund_review: { title: 'Refund recorded: decide about their place', todo: 'Their enrollment was not changed. Withdraw them from the cohort if the refund means they are not taking part, then mark this reviewed.' },
}

const SEAT_ISSUES = new Set(['cohort_full', 'cohort_unavailable', 'enrollment_failed'])

/** Whether an issue is still open (seat issues are settled once the registration is confirmed). */
export function issueIsOpen(r: PaymentRegistration): boolean {
  if (!r.enrollment_issue) return false
  if (SEAT_ISSUES.has(r.enrollment_issue) && r.status === 'confirmed') return false
  return true
}

// ------------------------------------------------------------------ payment requests
export const PAYMENT_REQUEST_LABEL: Record<string, string> = {
  draft: 'Not sent', open: 'Awaiting payment', paid: 'Paid', partially_paid: 'Partly paid', failed: 'Payment failed',
  void: 'Cancelled', expired: 'Expired', refunded: 'Refunded', partially_refunded: 'Partly refunded',
}
export const METHOD_LABEL: Record<string, string> = { payment_link: 'Payment link', invoice: 'Stripe invoice', offline: 'Offline (check, transfer…)' }

export function isOverdue(pr: PaymentRequestLike, today = todayET()): boolean {
  return (pr.status === 'open' || pr.status === 'partially_paid' || pr.status === 'failed') && !!pr.due_date && pr.due_date < today
}

/** Outstanding amount on an open request, in cents. */
export function outstandingCents(pr: PaymentRequestLike): number {
  if (!['open', 'partially_paid', 'failed', 'draft'].includes(pr.status)) return 0
  return Math.max(0, pr.amount_cents - pr.amount_paid_cents)
}

export function requestNetCollectedCents(pr: PaymentRequestLike): number {
  if (!['paid', 'partially_paid', 'refunded', 'partially_refunded'].includes(pr.status)) return 0
  return Math.max(0, pr.amount_paid_cents - pr.amount_refunded_cents)
}

// ------------------------------------------------------------------ attention items
export interface PaymentAttentionInput {
  registrations: PaymentRegistration[]
  paymentRequests: PaymentRequestLike[]
  cohorts: { id: string; name: string; status: string | null; capacity?: number | null }[]
  enrollments: { user_id: string; cohort_id: string; status: string | null }[]
  /** New York date (YYYY-MM-DD); defaults to today. */
  today?: string
  /** A payment request still unsent this long after it was created is flagged (minutes). */
  draftGraceMinutes?: number
  now?: Date
}

export function paymentAttentionItems(input: PaymentAttentionInput): AttentionItem[] {
  const today = input.today ?? todayET(input.now)
  const now = input.now ?? new Date()
  const cohorts = new Map(input.cohorts.map(c => [c.id, c]))
  const items: AttentionItem[] = []
  const regHref = (id: string) => `/admin/registrations?id=${id}`

  for (const r of input.registrations) {
    const who = r.full_name || r.email || 'A registration'
    const cohort = r.cohort_id ? cohorts.get(r.cohort_id) : undefined
    const cohortName = cohort?.name ?? r.cohorts?.name ?? 'their cohort'
    const money = netCollectedCents(r)
    const amount = formatCents(paidCents(r), r.currency ?? 'usd')

    if (issueIsOpen(r) && r.enrollment_issue) {
      const issue = ENROLLMENT_ISSUE[r.enrollment_issue] ?? { title: 'Payment needs review', todo: 'Open the registration.' }
      let detail = `${who} · ${cohortName} · ${amount}. ${issue.todo}`
      if (r.enrollment_issue === 'cohort_full' && cohort?.capacity != null) {
        const taken = input.enrollments.filter(e => e.cohort_id === cohort.id && e.status === 'active').length
        detail = taken < cohort.capacity
          ? `${who} · ${cohortName} · ${amount}. A seat is free now (${taken} of ${cohort.capacity} taken): confirm them.`
          : `${who} · ${cohortName} · ${amount}. ${taken} of ${cohort.capacity} seats taken. ${issue.todo}`
      }
      if (r.enrollment_issue === 'cohort_unavailable' && cohort?.status) detail = `${who} · ${cohortName} is ${cohort.status} · ${amount}. ${issue.todo}`
      items.push({
        id: `payment-issue:${r.id}`, severity: r.enrollment_issue === 'refund_review' ? 'action' : 'urgent', group: 'payments',
        title: `${issue.title}: ${who}`, detail, href: regHref(r.id), actionLabel: 'Open registration', since: r.enrollment_issue_at ?? r.paid_at ?? r.created_at ?? null,
      })
      continue
    }

    // Paid (real money) and waiting for the owner's decision.
    if ((r.payment_status === 'paid' || r.payment_status === 'partially_refunded') && money > 0 && (r.status ?? 'pending') === 'pending') {
      items.push({
        id: `payment-confirm:${r.id}`, severity: 'action', group: 'payments',
        title: `Paid ${amount}: confirm ${who}`, detail: `${cohortName}. Payment received; they are not enrolled until you confirm and give access.`,
        href: regHref(r.id), actionLabel: 'Review and confirm', since: r.paid_at ?? r.created_at ?? null,
      })
      continue
    }

    // Complimentary-era registrations never owed anything: no missing-payment items for them.
    if (isHistoricalComplimentary(r)) continue

    if (r.payment_status === 'failed' && r.status !== 'declined' && r.status !== 'confirmed') {
      items.push({
        id: `payment-failed:${r.id}`, severity: 'action', group: 'payments',
        title: `Payment failed: ${who}`, detail: `${cohortName}.${r.payment_error ? ` Stripe said: ${r.payment_error}` : ''} They have not been charged. Contact them if they still want to join.`,
        href: regHref(r.id), actionLabel: 'Open registration', since: r.payment_failed_at ?? r.created_at ?? null,
      })
      continue
    }

    // Records that do not agree with each other.
    if (r.status === 'confirmed' && r.stripe_session_id && ['unpaid', 'pending', 'failed', 'expired'].includes(r.payment_status ?? 'unpaid')) {
      items.push({
        id: `payment-mismatch:${r.id}`, severity: 'action', group: 'payments',
        title: `Confirmed without a completed payment: ${who}`,
        detail: `${cohortName}. Payment shows “${paymentState(r, now).label}”. Check Stripe; if this place is free on purpose, mark it complimentary with a reason.`,
        href: regHref(r.id), actionLabel: 'Open registration', since: r.created_at ?? null,
      })
      continue
    }
    if (r.status === 'declined' && money > 0) {
      items.push({
        id: `payment-mismatch:${r.id}`, severity: 'urgent', group: 'payments',
        title: `Declined but paid ${amount}: ${who}`, detail: `${cohortName}. Refund the payment in Stripe, or confirm them if declining was a mistake.`,
        href: regHref(r.id), actionLabel: 'Open registration', since: r.paid_at ?? r.created_at ?? null,
      })
    }
  }

  const graceMs = (input.draftGraceMinutes ?? 60) * 60_000
  for (const pr of input.paymentRequests) {
    const href = pr.inquiry_id ? `/admin/inquiries?id=${pr.inquiry_id}` : pr.registration_id ? regHref(pr.registration_id) : '/admin/reports'
    const owed = formatCents(outstandingCents(pr) || pr.amount_cents, pr.currency)
    const label = `${pr.payer_name} — ${pr.description}`
    if (pr.status === 'failed') {
      items.push({
        id: `payment-request-failed:${pr.id}`, severity: 'action', group: 'payments', title: `Payment failed: ${label}`,
        detail: `${owed} (${METHOD_LABEL[pr.method] ?? pr.method}). ${pr.method === 'invoice' ? 'The invoice can still be paid in Stripe; contact the payer.' : 'Contact the payer and send a new request if needed.'}`,
        href, actionLabel: 'Open', since: pr.updated_at ?? pr.created_at,
      })
    } else if (isOverdue(pr, today)) {
      items.push({
        id: `payment-request-overdue:${pr.id}`, severity: 'action', group: 'payments', title: `Payment overdue: ${label}`,
        detail: `${owed} was due ${pr.due_date}. Press Refresh to check Stripe, then follow up with the payer.`,
        href, actionLabel: 'Open', since: pr.due_date,
      })
    } else if (pr.status === 'draft' && pr.method !== 'offline' && now.getTime() - new Date(pr.created_at).getTime() > graceMs) {
      items.push({
        id: `payment-request-draft:${pr.id}`, severity: 'info', group: 'payments', title: `Payment request not sent: ${label}`,
        detail: `${owed}. Creating it in Stripe did not finish. Open it and press Send, or cancel it.`,
        href, actionLabel: 'Open', since: pr.created_at,
      })
    }
  }
  return items
}
