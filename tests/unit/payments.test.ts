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
