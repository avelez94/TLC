import { test } from 'node:test'
import assert from 'node:assert/strict'
import Stripe from 'stripe'
import {
  formatCents, parseDollarsToCents, paymentState, netCollectedCents, isFreeCheckout, paymentAttentionItems, stripeDashboardUrl,
  paymentRequestStripeKind, issueIsOpen, outstandingCents, requestNetCollectedCents, isOverdue, PAYMENT_FILTERS, type PaymentRegistration, type PaymentRequestLike,
} from '../../src/lib/payment-attention'
import { checkoutSeatCheck, registrationHoldsSeat, resolveCheckoutPrice, CHECKOUT_WINDOW_SECONDS, checkoutSessionParams } from '../../src/lib/checkout-pricing'
import { verifyStripeEvent, refundState, processStripeEvent, likeExact, HANDLED_EVENTS, type PaymentDeps } from '../../src/lib/payments'
import { stripeMode } from '../../src/lib/stripe'

const NOW = new Date('2026-11-23T15:00:00Z')
const reg = (o: Partial<PaymentRegistration>): PaymentRegistration => ({ id: 'r1', full_name: 'Pat Doe', email: 'pat@example.test', cohort_id: 'c1', status: 'pending', payment_status: 'unpaid', ...o })

// ---------------------------------------------------------------- money
test('dollar input becomes exact cents; anything ambiguous is refused', () => {
  assert.equal(parseDollarsToCents('1,250.50'), 125050)
  assert.equal(parseDollarsToCents('$97'), 9700)
  assert.equal(parseDollarsToCents('0.1'), 10)
  assert.equal(parseDollarsToCents('19.99'), 1999, 'no floating point drift')
  for (const bad of ['', '0', '-5', '1.234', 'abc', '1e3', '12,34.5.6']) assert.equal(parseDollarsToCents(bad), null, bad)
  assert.equal(formatCents(125050), '$1,250.50')
})

test('historical free registrations show as "Free (no charge)" and are never revenue', () => {
  for (const r of [reg({ payment_status: 'paid', amount_paid: 0 }), reg({ payment_status: 'paid', amount_paid: null, amount_paid_cents: null }), reg({ payment_status: 'paid', amount_paid_cents: 0 })]) {
    assert.equal(paymentState(r).label, 'Free (no charge)')
    assert.equal(isFreeCheckout(r), true)
    assert.equal(netCollectedCents(r), 0)
  }
  assert.equal(PAYMENT_FILTERS.find(f => f.value === 'paid')!.test(reg({ payment_status: 'paid', amount_paid: 0 })), false)
})

test('payment labels for every state; collected = paid minus refunded', () => {
  assert.equal(paymentState(reg({ payment_status: 'paid', amount_paid_cents: 25000 })).label, 'Paid $250.00')
  assert.equal(paymentState(reg({ payment_status: 'paid', amount_paid: 197 })).label, 'Paid $197.00', 'legacy whole-dollar amounts')
  assert.equal(paymentState(reg({ payment_status: 'complimentary' })).label, 'Complimentary')
  assert.equal(paymentState(reg({ payment_status: 'pending' })).label, 'Pending payment')
  assert.equal(paymentState(reg({ payment_status: 'failed' })).label, 'Payment failed')
  assert.equal(paymentState(reg({ payment_status: 'expired' })).label, 'Checkout expired')
  assert.equal(paymentState(reg({ payment_status: 'refunded', amount_paid_cents: 25000, amount_refunded_cents: 25000 })).label, 'Refunded $250.00')
  assert.equal(paymentState(reg({ payment_status: 'partially_refunded', amount_paid_cents: 25000, amount_refunded_cents: 5000 })).label, 'Partially refunded ($50.00 of $250.00)')
  assert.equal(paymentState(reg({ checkout_expires_at: '2026-11-23T15:20:00Z' }), NOW).label, 'Checkout in progress')
  assert.equal(paymentState(reg({ checkout_expires_at: '2026-11-23T14:00:00Z' }), NOW).label, 'Not paid')
  assert.equal(netCollectedCents(reg({ payment_status: 'partially_refunded', amount_paid_cents: 25000, amount_refunded_cents: 5000 })), 20000)
  assert.equal(netCollectedCents(reg({ payment_status: 'refunded', amount_paid_cents: 25000, amount_refunded_cents: 25000 })), 0)
  assert.equal(netCollectedCents(reg({ payment_status: 'complimentary', amount_paid_cents: 25000 })), 0)
})

test('email lookups are exact: _ and % in an address are not wildcards', () => {
  assert.equal(likeExact('first_last@example.test'), 'first\\_last@example.test')
  assert.equal(likeExact('100%@example.test'), '100\\%@example.test')
})

test('refund status never depends on the order refunds arrive in', () => {
  assert.equal(refundState(25000, 5000, false), 'partially_refunded')
  assert.equal(refundState(25000, 25000, false), 'refunded')
  assert.equal(refundState(25000, 100, true), 'refunded', "Stripe's own 'fully refunded' flag wins")
})

test('Stripe dashboard links use /test/ for test-mode keys; the key itself is never exposed', () => {
  assert.equal(stripeDashboardUrl('payment', 'pi_123', 'test'), 'https://dashboard.stripe.com/test/payments/pi_123')
  assert.equal(stripeDashboardUrl('invoice', 'in_1', 'live'), 'https://dashboard.stripe.com/invoices/in_1')
  assert.equal(paymentRequestStripeKind('plink_9'), 'payment_link')
  assert.equal(paymentRequestStripeKind(null), null)
  assert.equal(stripeMode('sk_test_abc'), 'test')
  assert.equal(stripeMode('rk_live_abc'), 'live')
  assert.equal(stripeMode(''), 'unconfigured')
})

// ---------------------------------------------------------------- seats during checkout
test('seats: open checkouts and payments awaiting confirmation hold a seat; expired, declined and confirmed do not', () => {
  const rows = [
    { id: 'a', status: 'pending', payment_status: 'unpaid', checkout_expires_at: '2026-11-23T15:20:00Z' }, // paying now
    { id: 'b', status: 'pending', payment_status: 'unpaid', checkout_expires_at: '2026-11-23T14:00:00Z' }, // abandoned
    { id: 'c', status: 'pending', payment_status: 'paid' },          // waiting for the owner
    { id: 'd', status: 'confirmed', payment_status: 'paid' },        // already an enrollment
    { id: 'e', status: 'declined', payment_status: 'paid' },
    { id: 'f', status: 'pending', payment_status: 'complimentary' },
    { id: 'g', status: 'pending', payment_status: 'expired' },
  ]
  assert.deepEqual(rows.filter(r => registrationHoldsSeat(r, NOW)).map(r => r.id), ['a', 'c', 'f'])
  assert.equal(checkoutSeatCheck({ capacity: 6, activeEnrollments: 3, registrations: rows, now: NOW }).full, true, '3 enrolled + 3 held = 6')
  assert.equal(checkoutSeatCheck({ capacity: 6, activeEnrollments: 3, registrations: rows, now: NOW, excludeRegistrationId: 'a' }).full, false, 'my own earlier attempt does not block me')
  assert.equal(checkoutSeatCheck({ capacity: null, activeEnrollments: 99, registrations: rows, now: NOW }).full, false, 'no limit')
})

test('checkout charges only the server price, opens for 30+ minutes, card only, and carries the registration id', () => {
  const price = resolveCheckoutPrice({ id: 'p', name: 'New Leaders', type: 'cohort', price: 250, price_label: '$250' }, { id: 'c', program_id: 'p', name: 'Spring', status: 'upcoming' })
  assert.ok(price.ok)
  if (!price.ok) return
  const p = checkoutSessionParams({ registrationId: 'r1', cohortId: 'c', email: 'pat@example.test', siteUrl: 'https://site.test', expiresAt: 1_000_000 + CHECKOUT_WINDOW_SECONDS, pricing: price })
  assert.equal(p.line_items?.[0].price_data?.unit_amount, 25000)
  assert.equal(p.metadata?.registration_id, 'r1')
  assert.equal(p.metadata?.expected_amount_cents, '25000')
  assert.equal(p.payment_intent_data?.receipt_email, 'pat@example.test', 'Stripe sends the receipt')
  assert.deepEqual(p.payment_method_types, ['card'])
  assert.ok(CHECKOUT_WINDOW_SECONDS >= 30 * 60)
  assert.match(p.success_url!, /\{CHECKOUT_SESSION_ID\}/)
  assert.equal(resolveCheckoutPrice({ id: 'p', name: 'Makers', type: 'cohort', price: 149, price_label: '$97' }, { id: 'c', program_id: 'p', name: 'x', status: 'upcoming' }).ok, false, 'never charge a price different from the one shown')
})

// ---------------------------------------------------------------- webhook verification & idempotency
const SECRET = 'whsec_unit'
const signed = (event: object) => {
  const payload = JSON.stringify(event)
  return { payload, header: Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET }) }
}

test('webhook signatures: only a correctly signed, recent payload is accepted', () => {
  const { payload, header } = signed({ id: 'evt_1', object: 'event', type: 'checkout.session.completed', data: { object: {} } })
  assert.equal(verifyStripeEvent(Stripe, payload, header, SECRET)?.id, 'evt_1')
  assert.equal(verifyStripeEvent(Stripe, payload + ' ', header, SECRET), null)
  assert.equal(verifyStripeEvent(Stripe, payload, header, 'whsec_other'), null)
  assert.equal(verifyStripeEvent(Stripe, payload, null, SECRET), null)
  assert.equal(verifyStripeEvent(Stripe, payload, header, ''), null, 'no secret configured → nothing accepted')
})

/** Minimal stand-in for the stripe_events table to test the record-once rule. */
function fakeDb(processed: Record<string, string | null>) {
  const calls: string[] = []
  const chain = (result: unknown) => {
    const c: Record<string, unknown> = {}
    for (const m of ['eq', 'in', 'not', 'is', 'lt', 'neq', 'select', 'order', 'limit']) c[m] = () => c
    c.maybeSingle = async () => result
    c.single = async () => result
    c.then = (res: (v: unknown) => unknown) => Promise.resolve(result).then(res)
    return c
  }
  const db = {
    from(table: string) {
      return {
        insert(row: { id: string }) {
          calls.push(`${table}.insert`)
          if (row.id in processed) return Promise.resolve({ error: { code: '23505' } })
          processed[row.id] = null
          return Promise.resolve({ error: null })
        },
        select() { return chain({ data: { processed_at: 'x', outcome: 'registration_paid' } }) },
        update() { calls.push(`${table}.update`); return chain({ data: [], error: null }) },
      }
    },
  }
  return { db, calls }
}

test('a redelivered event that was fully processed is acknowledged and not processed again', async () => {
  const { db, calls } = fakeDb({ evt_done: 'processed' })
  const deps = { db, deliverEmail: async () => ({ sent: true, status: 'accepted' }), sendAccessEmail: async () => ({}), audit: async () => {}, emails: { fromTlc: '', fromPlatform: '', ownerInbox: '' } } as unknown as PaymentDeps
  const r = await processStripeEvent({ id: 'evt_done', type: 'checkout.session.completed', data: { object: { metadata: { registration_id: 'r' } } } } as unknown as Stripe.Event, deps)
  assert.equal(r.duplicate, true)
  assert.equal(r.httpStatus, 200)
  assert.deepEqual(calls, ['stripe_events.insert'], 'no registration was touched')
})

test('event types the app does not use are acknowledged without touching the database', async () => {
  const { db, calls } = fakeDb({})
  const r = await processStripeEvent({ id: 'evt_x', type: 'customer.created', data: { object: {} } } as unknown as Stripe.Event, { db } as unknown as PaymentDeps)
  assert.equal(r.outcome, 'ignored_type')
  assert.equal(calls.length, 0)
  for (const t of ['checkout.session.completed', 'checkout.session.expired', 'charge.refunded', 'invoice.paid', 'payment_intent.payment_failed']) assert.ok((HANDLED_EVENTS as readonly string[]).includes(t), t)
})

// ---------------------------------------------------------------- attention items
const cohorts = [{ id: 'c1', name: 'Spring 2027', status: 'upcoming', capacity: 2 }, { id: 'c2', name: 'Old', status: 'completed', capacity: null }]
const pr = (o: Partial<PaymentRequestLike>): PaymentRequestLike => ({
  id: 'q1', inquiry_id: 'i1', registration_id: null, cohort_id: null, payer_name: 'Acme', description: '10 seats', method: 'invoice', status: 'open',
  amount_cents: 500000, amount_paid_cents: 0, amount_refunded_cents: 0, currency: 'usd', due_date: '2026-12-01', created_at: '2026-11-20T00:00:00Z', ...o,
})

test('attention: each payment problem gets one item, with an exact link and what to do', () => {
  const items = paymentAttentionItems({
    today: '2026-11-23', now: NOW, cohorts, enrollments: [{ user_id: 'u1', cohort_id: 'c1', status: 'active' }, { user_id: 'u2', cohort_id: 'c1', status: 'active' }],
    registrations: [
      reg({ id: 'full', payment_status: 'paid', amount_paid_cents: 25000, enrollment_issue: 'cohort_full' }),
      reg({ id: 'unavail', cohort_id: 'c2', payment_status: 'paid', amount_paid_cents: 25000, enrollment_issue: 'cohort_unavailable' }),
      reg({ id: 'await', payment_status: 'paid', amount_paid_cents: 25000 }),
      reg({ id: 'failed', payment_status: 'failed', payment_error: 'Card declined' }),
      reg({ id: 'refund', status: 'confirmed', payment_status: 'partially_refunded', amount_paid_cents: 25000, amount_refunded_cents: 5000, enrollment_issue: 'refund_review' }),
      reg({ id: 'mismatch', status: 'confirmed', payment_status: 'expired', stripe_session_id: 'cs_1' }),
      reg({ id: 'declinedpaid', status: 'declined', payment_status: 'paid', amount_paid_cents: 25000 }),
      reg({ id: 'free-history', status: 'confirmed', payment_status: 'paid', amount_paid: 0 }),
      reg({ id: 'free-pending', status: 'pending', payment_status: 'paid', amount_paid: 0 }),
      reg({ id: 'fixed', status: 'confirmed', payment_status: 'paid', amount_paid_cents: 25000, enrollment_issue: 'cohort_full' }),
      reg({ id: 'comp', payment_status: 'complimentary', complimentary_reason: 'Scholarship' }),
    ],
    paymentRequests: [pr({ id: 'overdue', due_date: '2026-11-01' }), pr({ id: 'ok' }), pr({ id: 'pfail', status: 'failed' }), pr({ id: 'draft', status: 'draft', method: 'payment_link' }), pr({ id: 'paid', status: 'paid', due_date: '2026-01-01' })],
  })
  const ids = items.map(i => i.id)
  assert.deepEqual(ids.sort(), [
    'payment-confirm:await', 'payment-failed:failed', 'payment-issue:full', 'payment-issue:refund', 'payment-issue:unavail',
    'payment-mismatch:declinedpaid', 'payment-mismatch:mismatch', 'payment-request-draft:draft', 'payment-request-failed:pfail', 'payment-request-overdue:overdue',
  ].sort())
  const by = (id: string) => items.find(i => i.id === id)!
  assert.equal(by('payment-issue:full').severity, 'urgent')
  assert.match(by('payment-issue:full').detail!, /2 of 2 seats taken.*Raise the cohort’s capacity.*refund the payment in Stripe/)
  assert.match(by('payment-issue:unavail').detail!, /Old is completed/)
  assert.equal(by('payment-issue:full').href, '/admin/registrations?id=full')
  assert.equal(by('payment-request-overdue:overdue').href, '/admin/inquiries?id=i1')
  assert.match(by('payment-issue:refund').detail!, /not changed/)
  for (const i of items) { assert.equal(i.group, 'payments'); assert.ok(i.href.startsWith('/admin/')) }
})

test('attention: a seat freed up is said plainly; a confirmed registration settles a seat issue', () => {
  const [item] = paymentAttentionItems({ today: '2026-11-23', now: NOW, cohorts, enrollments: [{ user_id: 'u1', cohort_id: 'c1', status: 'active' }], paymentRequests: [],
    registrations: [reg({ id: 'x', payment_status: 'paid', amount_paid_cents: 100, enrollment_issue: 'cohort_full' })] })
  assert.match(item.detail!, /A seat is free now \(1 of 2 taken\): confirm them/)
  assert.equal(issueIsOpen(reg({ status: 'confirmed', enrollment_issue: 'cohort_full' })), false)
  assert.equal(issueIsOpen(reg({ status: 'confirmed', enrollment_issue: 'refund_review' })), true, 'refunds stay open until reviewed')
})

test('payment requests: outstanding, collected and overdue follow the records', () => {
  assert.equal(outstandingCents(pr({ status: 'partially_paid', amount_paid_cents: 200000 })), 300000)
  assert.equal(outstandingCents(pr({ status: 'void' })), 0)
  assert.equal(requestNetCollectedCents(pr({ status: 'partially_refunded', amount_paid_cents: 500000, amount_refunded_cents: 100000 })), 400000)
  assert.equal(requestNetCollectedCents(pr({ status: 'open' })), 0)
  assert.equal(isOverdue(pr({ due_date: '2026-11-22' }), '2026-11-23'), true)
  assert.equal(isOverdue(pr({ due_date: '2026-11-23' }), '2026-11-23'), false, 'due today is not overdue')
  assert.equal(isOverdue(pr({ due_date: '2026-11-01', status: 'paid' }), '2026-11-23'), false)
})

// ---------------------------------------------------------------- no live Stripe writes while payments are off
import { stripeWritesAllowed } from '../../src/lib/stripe'
import { sendPaymentRequest, voidPaymentRequest, PaymentRequestError } from '../../src/lib/payments'

test('Stripe writes: live key needs CHECKOUT_ENABLED=true; test keys always; no key never', () => {
  assert.equal(stripeWritesAllowed({ STRIPE_SECRET_KEY: 'sk_live_abc' }), false)
  assert.equal(stripeWritesAllowed({ STRIPE_SECRET_KEY: 'sk_live_abc', CHECKOUT_ENABLED: 'false' }), false)
  assert.equal(stripeWritesAllowed({ STRIPE_SECRET_KEY: 'rk_live_abc', CHECKOUT_ENABLED: '1' }), false, 'only the exact value true switches it on')
  assert.equal(stripeWritesAllowed({ STRIPE_SECRET_KEY: 'sk_live_abc', CHECKOUT_ENABLED: 'true' }), true)
  assert.equal(stripeWritesAllowed({ STRIPE_SECRET_KEY: 'sk_test_abc' }), true)
  assert.equal(stripeWritesAllowed({}), false)
})

test('while Stripe writes are off, sending or cancelling a Stripe request never calls Stripe', async () => {
  const touched: string[] = []
  const stripe = new Proxy({}, { get: (_t, k) => { touched.push(String(k)); throw new Error('Stripe must not be called') } })
  const deps = { db: {} as never, stripe: stripe as never, deliverEmail: async () => ({ sent: false, status: 'skipped' as const }), sendAccessEmail: async () => ({}) as never, audit: async () => {}, emails: { fromTlc: '', fromPlatform: '', ownerInbox: '' }, allowStripeWrites: false }
  const pr = { id: 'r1', method: 'invoice', status: 'draft', payer_name: 'Org', payer_email: 'a@example.test', description: 'Seats', amount_cents: 50000, amount_paid_cents: 0, amount_refunded_cents: 0, currency: 'usd', stripe_object_id: null, stripe_url: null, due_date: '2027-01-31', seats: 2 } as never
  await assert.rejects(sendPaymentRequest(deps, pr), (e: unknown) => e instanceof PaymentRequestError && e.status === 403)
  await assert.rejects(sendPaymentRequest(deps, { ...(pr as object), method: 'payment_link' } as never), (e: unknown) => e instanceof PaymentRequestError && e.status === 403)
  await assert.rejects(voidPaymentRequest(deps, { ...(pr as object), status: 'open', stripe_object_id: 'in_123' } as never), (e: unknown) => e instanceof PaymentRequestError && e.status === 403)
  assert.deepEqual(touched, [], 'no Stripe method was even looked up')
})

// ---------------------------------------------------------------- historical complimentary programs
import { COMPLIMENTARY_ERA_ENDS, isHistoricalComplimentary } from '../../src/lib/payment-attention'

const HIST = '2026-08-12T15:00:00Z' // registered while every program was complimentary
const NEW = '2027-01-10T15:00:00Z'  // registered after paid enrollment existed
const cohortsMix = [
  { id: 'done', name: 'Impact Makers - Fall 2026', status: 'completed', capacity: null },
  { id: 'live', name: 'New Leaders - Spring 2027', status: 'active', capacity: 10 },
  { id: 'done27', name: 'New Leaders - Winter 2027', status: 'completed', capacity: 10 },
]
const alerts = (regs: PaymentRegistration[], enrollments: { user_id: string; cohort_id: string; status: string | null }[] = []) =>
  paymentAttentionItems({ today: '2027-02-01', now: new Date('2027-02-01T15:00:00Z'), cohorts: cohortsMix, enrollments, paymentRequests: [], registrations: regs }).map(i => i.id).sort()

test('historical complimentary: the free-era confirmed registration with an unfinished checkout raises no payment alert', () => {
  const r = reg({ id: 'kemp-like', cohort_id: 'done', status: 'confirmed', payment_status: 'unpaid', stripe_session_id: 'cs_old', created_at: HIST })
  assert.equal(isHistoricalComplimentary(r), true)
  assert.deepEqual(alerts([r]), [], 'no "Confirmed without a completed payment"')
  assert.equal(paymentState(r).label, 'Free program (no payment needed)')
  for (const s of ['unpaid', 'expired', 'pending', 'failed'] as const) {
    assert.deepEqual(alerts([reg({ id: s, cohort_id: 'done', status: 'confirmed', payment_status: s, stripe_session_id: 'cs', created_at: HIST })]), [], `free era, ${s}`)
    assert.deepEqual(alerts([reg({ id: s, cohort_id: 'done', status: 'pending', payment_status: s, created_at: HIST })]), [], `free era pending decision, ${s}`)
  }
  // Free-era registrations that completed the free checkout keep their existing label.
  assert.equal(paymentState(reg({ payment_status: 'paid', amount_paid: null, created_at: HIST })).label, 'Free (no charge)')
})

test('historical complimentary: filters show free-era registrations as free, never as "Not paid"', () => {
  const test = (v: string) => PAYMENT_FILTERS.find(f => f.value === v)!.test
  const r = reg({ status: 'confirmed', payment_status: 'unpaid', stripe_session_id: 'cs', created_at: HIST })
  assert.equal(test('free')(r), true); assert.equal(test('unpaid')(r), false)
  const e = reg({ payment_status: 'expired', created_at: HIST })
  assert.equal(test('free')(e), true); assert.equal(test('expired')(e), false)
})

test('paid era: a confirmed registration without a completed payment still alerts, in completed and active cohorts', () => {
  for (const cohort_id of ['done27', 'live', 'done']) {
    const r = reg({ id: `x-${cohort_id}`, cohort_id, status: 'confirmed', payment_status: 'unpaid', stripe_session_id: 'cs_new', created_at: NEW })
    assert.equal(isHistoricalComplimentary(r), false)
    assert.deepEqual(alerts([r]), [`payment-mismatch:x-${cohort_id}`], `cohort ${cohort_id}`)
    assert.equal(paymentState(r).label, 'Not paid')
  }
  // The boundary: one second before is complimentary, the moment itself is not.
  const before = new Date(Date.parse(COMPLIMENTARY_ERA_ENDS) - 1000).toISOString()
  assert.equal(isHistoricalComplimentary(reg({ created_at: before })), true)
  assert.equal(isHistoricalComplimentary(reg({ created_at: COMPLIMENTARY_ERA_ENDS })), false)
  // No creation date: judged normally (never silently excused).
  assert.deepEqual(alerts([reg({ id: 'nodate', cohort_id: 'live', status: 'confirmed', payment_status: 'expired', stripe_session_id: 'cs' })]), ['payment-mismatch:nodate'])
})

test('paid era: genuine payment alerts all still fire (failed, awaiting confirmation, declined-but-paid, enrollment issues)', () => {
  assert.deepEqual(alerts([
    reg({ id: 'failed', cohort_id: 'live', status: 'pending', payment_status: 'failed', created_at: NEW }),
    reg({ id: 'await', cohort_id: 'live', status: 'pending', payment_status: 'paid', amount_paid_cents: 19700, created_at: NEW }),
    reg({ id: 'declinedpaid', cohort_id: 'done27', status: 'declined', payment_status: 'paid', amount_paid_cents: 19700, created_at: NEW }),
    reg({ id: 'full', cohort_id: 'live', status: 'pending', payment_status: 'paid', amount_paid_cents: 19700, enrollment_issue: 'cohort_full', created_at: NEW }),
  ]), ['payment-confirm:await', 'payment-failed:failed', 'payment-issue:full', 'payment-mismatch:declinedpaid'])
  // Complimentary places (recorded by an admin) never alert, before or after the cutoff.
  assert.deepEqual(alerts([reg({ id: 'comp', cohort_id: 'live', status: 'confirmed', payment_status: 'complimentary', complimentary_reason: 'Scholarship', created_at: NEW })]), [])
})

test('free era with real money recorded is judged normally (a real problem is never hidden)', () => {
  const paid = reg({ id: 'money', cohort_id: 'done', status: 'pending', payment_status: 'paid', amount_paid_cents: 14900, created_at: HIST })
  assert.equal(isHistoricalComplimentary(paid), false)
  assert.deepEqual(alerts([paid]), ['payment-confirm:money'])
  const declinedPaid = reg({ id: 'dp', cohort_id: 'done', status: 'declined', payment_status: 'paid', amount_paid: 149, created_at: HIST })
  assert.deepEqual(alerts([declinedPaid]), ['payment-mismatch:dp'])
  assert.equal(isHistoricalComplimentary(reg({ payment_status: 'refunded', amount_refunded_cents: 14900, created_at: HIST })), false)
  assert.equal(isHistoricalComplimentary(reg({ payment_status: 'complimentary', created_at: HIST })), false, 'already recorded as complimentary: keeps that label')
})

test('payment and enrollment stay independent; records are only read, never changed', () => {
  const regs = [
    reg({ id: 'h', cohort_id: 'done', status: 'confirmed', payment_status: 'unpaid', stripe_session_id: 'cs', created_at: HIST }),
    reg({ id: 'n', cohort_id: 'live', status: 'confirmed', payment_status: 'unpaid', stripe_session_id: 'cs', created_at: NEW }),
  ]
  const snapshot = JSON.stringify(regs)
  const withoutEnrollments = alerts(regs)
  const withEnrollments = alerts(regs, [{ user_id: 'u1', cohort_id: 'done', status: 'completed' }, { user_id: 'u2', cohort_id: 'live', status: 'active' }])
  assert.deepEqual(withoutEnrollments, ['payment-mismatch:n']); assert.deepEqual(withEnrollments, withoutEnrollments, 'enrollment does not change payment alerts')
  assert.equal(paymentState(regs[1]).label, 'Not paid', 'payment label ignores enrollment and decision')
  assert.equal(JSON.stringify(regs), snapshot, 'inputs untouched: nothing marked paid or complimentary')
})
