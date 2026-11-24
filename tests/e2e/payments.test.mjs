// Payment workflow checks against the LOCAL stack (scripts/local-stack/start.sh). Synthetic
// data only ("TEST" rows, removed afterwards); touches no remote service and no real Stripe.
//
//   set -a; . /tmp/tlc-local-stack/env.local; . /tmp/tlc-local-stack/secret.env; set +a
//   scripts/local-stack/stripe-mock.sh start        # optional: enables the stripe-mock checks
//   STRIPE_MOCK_URL=http://127.0.0.1:12111 node --import ./tests/register.mjs --test tests/e2e/payments.test.mjs
//
// Part 1 runs src/lib/payments.ts directly against the local database with the service key,
// feeding it webhook payloads signed with stripe.webhooks.generateTestHeaderString and verified
// exactly as the webhook route does. Stripe API calls (receipts, payment links, invoices) go
// to stripe-mock when STRIPE_MOCK_URL is set and are skipped otherwise.
// Part 2 (PAYMENTS_SITE_TESTS=1) calls the running site on SITE_URL (default :3999) once it has
// been rebuilt with this code: webhook signature handling, checkout guard, admin routes.
import { test, before, after, describe } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { processStripeEvent, verifyStripeEvent, sendPaymentRequest, refreshPaymentRequest, voidPaymentRequest, syncRegistrationFromStripe, readEnrollMode } from '../../src/lib/payments.ts'
import { paymentAttentionItems, paymentState } from '../../src/lib/payment-attention.ts'
import { checkoutSessionParams, CHECKOUT_WINDOW_SECONDS } from '../../src/lib/checkout-pricing.ts'

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const PG = process.env.PG_URL
assert.ok(URL_?.startsWith('http://127.0.0.1'), 'refusing to run against anything but the local stack')
assert.ok(SERVICE && PG, 'source /tmp/tlc-local-stack/env.local and secret.env first')

const SECRET = 'whsec_test_payments_local'
const db = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
const psql = q => execFileSync('psql', ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', PG, '-c', q], { encoding: 'utf8' }).trim()
const mock = process.env.STRIPE_MOCK_URL ? new URL(process.env.STRIPE_MOCK_URL) : null
const stripeMock = mock ? new Stripe('sk_test_123', { host: mock.hostname, port: Number(mock.port), protocol: mock.protocol.replace(':', '') }) : null

const ID = {
  newLeaders: psql(`select id from programs where slug = 'new-leaders'`), // created by migration 2c; differs per database
  full: '3e5700e0-0000-4000-8000-0000000000f1',      // TEST cohort, capacity 2 (filled below)
  open: '3e5700e0-0000-4000-8000-0000000000f2',      // TEST cohort, no capacity limit
  done: '3e5700e0-0000-4000-8000-0000000000f3',      // TEST cohort, completed
  p2: '10000000-0000-0000-0000-0000000000b2', p3: '10000000-0000-0000-0000-0000000000b3', p5: '10000000-0000-0000-0000-0000000000b5',
  admin1: '10000000-0000-0000-0000-0000000000a1',
}

// ---------------------------------------------------------------- fakes for email / audit
const sent = []
const access = []
const audits = []
let failNext = new Set() // templates whose next send fails
const deps = (over = {}) => ({
  db, stripe: stripeMock,
  deliverEmail: async msg => {
    if (failNext.has(msg.template)) { failNext.delete(msg.template); sent.push({ ...msg, status: 'failed' }); return { sent: false, status: 'failed', error: 'simulated' } }
    sent.push({ ...msg, status: 'accepted' }); return { sent: true, status: 'accepted' }
  },
  sendAccessEmail: async i => { access.push(i); return { kind: i.kind, sent: true, status: 'accepted' } },
  audit: async (...a) => { audits.push(a) },
  enrollMode: async () => 'review',
  emails: { fromTlc: 'TLC <noreply@example.test>', fromPlatform: 'Platform <noreply@example.test>', ownerInbox: 'owner-test@example.test' },
  siteUrl: 'http://localhost:3999',
  ...over,
})

let seq = 0
const evtId = () => `evt_test_pay_${Date.now()}_${++seq}`
/** A signed delivery, verified the same way the webhook route verifies it. */
function deliver(type, object, id = evtId()) {
  const payload = JSON.stringify({ id, object: 'event', type, api_version: Stripe.API_VERSION, created: Math.floor(Date.now() / 1000), data: { object }, livemode: false, pending_webhooks: 1, request: { id: null, idempotency_key: null } })
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET })
  const event = verifyStripeEvent(Stripe, payload, header, SECRET)
  assert.ok(event, 'signed payload verifies')
  return { event, payload, header, id }
}
const run = (type, object, over, id) => processStripeEvent(deliver(type, object, id).event, deps(over))

const session = (o) => ({
  id: `cs_test_pay_${++seq}`, object: 'checkout.session', mode: 'payment', status: 'complete', payment_status: 'paid', currency: 'usd',
  amount_total: 25000, amount_subtotal: 25000, payment_intent: `pi_test_pay_${seq}`, payment_link: null, metadata: {}, ...o,
})

async function newReg(fields) {
  const { data, error } = await db.from('registrations').insert({
    full_name: 'TEST Payer', status: 'pending', payment_status: 'unpaid', program_id: ID.newLeaders, cohort_id: ID.open,
    checkout_expires_at: new Date(Date.now() + 30 * 60_000).toISOString(), ...fields,
  }).select('*').single()
  assert.equal(error, null, error?.message)
  return data
}
const reg = async id => (await db.from('registrations').select('*').eq('id', id).single()).data
const emailsFor = (to, template) => sent.filter(m => m.to === to && (!template || m.template === template) && m.status === 'accepted')

function cleanup() {
  psql(`delete from payment_requests where payer_name like 'TEST%';
        delete from registrations where email like 'test-pay-%' or full_name like 'TEST%';
        delete from stripe_events where id like 'evt_test_pay_%';
        delete from inquiry_participants where email like 'test-pay-%';
        delete from cohort_enrollments where cohort_id in ('${ID.full}', '${ID.open}', '${ID.done}');
        delete from cohorts where id in ('${ID.full}', '${ID.open}', '${ID.done}');
        delete from auth.users where email like 'test-pay-%';
        delete from inquiries where contact_name like 'TEST%';`)
}

before(() => {
  cleanup()
  psql(`insert into cohorts (id, program_id, name, status, capacity) values
          ('${ID.full}', '${ID.newLeaders}', 'TEST Full Cohort', 'upcoming', 2),
          ('${ID.open}', '${ID.newLeaders}', 'TEST Open Cohort', 'upcoming', null),
          ('${ID.done}', '${ID.newLeaders}', 'TEST Finished Cohort', 'completed', null);
        insert into cohort_enrollments (cohort_id, user_id, status) values ('${ID.full}', '${ID.p2}', 'active'), ('${ID.full}', '${ID.p3}', 'active');`)
})
after(cleanup)

// ================================================================ part 1: library + local DB
describe('webhook security', () => {
  test('invalid, missing or wrong-secret signatures are rejected; valid ones verify', () => {
    const { payload, header } = deliver('checkout.session.completed', session({}))
    assert.equal(verifyStripeEvent(Stripe, payload.replace('25000', '1'), header, SECRET), null, 'tampered body')
    assert.equal(verifyStripeEvent(Stripe, payload, header, 'whsec_other'), null, 'other secret')
    assert.equal(verifyStripeEvent(Stripe, payload, null, SECRET), null, 'no header')
    assert.equal(verifyStripeEvent(Stripe, payload, 't=1,v1=deadbeef', SECRET), null, 'forged header')
    const old = Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET, timestamp: Math.floor(Date.now() / 1000) - 3600 })
    assert.equal(verifyStripeEvent(Stripe, payload, old, SECRET), null, 'replayed after the 5-minute tolerance')
  })

  test('the enroll-on-payment setting fails safe to review for the service role', async () => {
    assert.equal(await readEnrollMode(db), 'review')
  })
})

describe('individual checkout', () => {
  test('paid → recorded once; duplicate delivery ignored; notifications once; not a receipt; no enrollment in review mode', async () => {
    const r = await newReg({ email: 'test-pay-one@example.test', stripe_session_id: 'cs_test_pay_one' })
    const s = session({ id: 'cs_test_pay_one', metadata: { registration_id: r.id, expected_amount_cents: '25000' } })
    const id = evtId()
    const first = await run('checkout.session.completed', s, {}, id)
    assert.equal(first.httpStatus, 200)
    assert.equal(first.outcome, 'registration_paid')
    const row = await reg(r.id)
    assert.equal(row.payment_status, 'paid')
    assert.equal(row.amount_paid_cents, 25000)
    assert.equal(row.amount_paid, 250, 'legacy whole-dollar column kept in step')
    assert.equal(row.stripe_payment_intent_id, s.payment_intent)
    assert.equal(row.status, 'pending', 'review mode: the owner confirms')
    assert.equal(row.enrollment_issue, null)
    assert.equal(row.checkout_expires_at, null)
    const mine = emailsFor('test-pay-one@example.test')
    assert.equal(mine.length, 1)
    assert.match(mine[0].html, /not a receipt/)
    assert.match(mine[0].html, /Tramaine will confirm your place/)
    assert.doesNotMatch(mine[0].subject, /confirmed/i, 'does not promise enrollment')
    assert.equal(sent.filter(m => m.template === 'registration_owner' && m.related?.id === r.id).length, 1)

    const again = await run('checkout.session.completed', s, {}, id)
    assert.equal(again.duplicate, true, 'same event id is not processed twice')
    const other = await run('checkout.session.async_payment_succeeded', s)
    assert.equal(other.httpStatus, 200)
    assert.equal(emailsFor('test-pay-one@example.test').length, 1, 'no second confirmation')
    assert.equal(psql(`select processed_at is not null from stripe_events where id = '${id}'`), 't')
    assert.equal(paymentState(await reg(r.id)).label, 'Paid $250.00')
    const items = paymentAttentionItems({ registrations: [await reg(r.id)], paymentRequests: [], cohorts: [], enrollments: [] })
    assert.equal(items[0]?.id, `payment-confirm:${r.id}`)
    assert.equal(items[0]?.href, `/admin/registrations?id=${r.id}`)
  })

  test('a failed notification email is retried by Stripe without recording the payment twice', async () => {
    const r = await newReg({ email: 'test-pay-retry@example.test', stripe_session_id: 'cs_test_pay_retry' })
    const s = session({ id: 'cs_test_pay_retry', metadata: { registration_id: r.id } })
    const id = evtId()
    failNext = new Set(['registration_confirmation'])
    const first = await run('checkout.session.completed', s, {}, id)
    assert.equal(first.httpStatus, 500, 'asks Stripe to redeliver')
    assert.equal((await reg(r.id)).payment_status, 'paid', 'payment stored before email')
    assert.equal((await reg(r.id)).confirmation_email_sent_at, null)
    assert.equal(psql(`select processed_at is null from stripe_events where id = '${id}'`), 't')
    const retry = await run('checkout.session.completed', s, {}, id)
    assert.equal(retry.httpStatus, 200)
    assert.equal(emailsFor('test-pay-retry@example.test').length, 1, 'participant email sent on retry')
    assert.equal(sent.filter(m => m.template === 'registration_owner' && m.related?.id === r.id).length, 1, 'owner not emailed twice')
    assert.equal(audits.filter(a => a[1] === 'registration.payment_received' && a[3] === r.id).length, 1, 'payment recorded once')
  })

  test('bank payment: completed-unpaid → pending; async failure → failed with reason', async () => {
    const r = await newReg({ email: 'test-pay-bank@example.test', stripe_session_id: 'cs_test_pay_bank' })
    const s = session({ id: 'cs_test_pay_bank', payment_status: 'unpaid', metadata: { registration_id: r.id } })
    assert.equal((await run('checkout.session.completed', s)).outcome, 'registration_pending')
    assert.equal((await reg(r.id)).payment_status, 'pending')
    assert.equal((await run('checkout.session.async_payment_failed', s)).outcome, 'registration_failed')
    const row = await reg(r.id)
    assert.equal(row.payment_status, 'failed')
    assert.ok(row.payment_failed_at)
    assert.match(row.payment_error, /did not go through/)
    assert.equal(emailsFor('test-pay-bank@example.test').length, 0, 'nothing promised')
    const items = paymentAttentionItems({ registrations: [row], paymentRequests: [], cohorts: [], enrollments: [] })
    assert.equal(items[0]?.id, `payment-failed:${r.id}`)
  })

  test('card decline (payment_intent.payment_failed) records the reason', async () => {
    const r = await newReg({ email: 'test-pay-decline@example.test', stripe_session_id: 'cs_test_pay_decline' })
    const out = await run('payment_intent.payment_failed', { id: 'pi_test_pay_decline', object: 'payment_intent', metadata: { registration_id: r.id }, last_payment_error: { message: 'Your card was declined.' } })
    assert.equal(out.outcome, 'registration_failed')
    const row = await reg(r.id)
    assert.equal(row.payment_status, 'failed')
    assert.equal(row.payment_error, 'Your card was declined.')
  })

  test('expiry: unpaid → expired; an old session never expires a newer checkout', async () => {
    const r = await newReg({ email: 'test-pay-expire@example.test', stripe_session_id: 'cs_test_pay_new' })
    const old = await run('checkout.session.expired', session({ id: 'cs_test_pay_old', status: 'expired', payment_status: 'unpaid', metadata: { registration_id: r.id } }))
    assert.equal(old.outcome, 'registration_expired_noop')
    assert.equal((await reg(r.id)).payment_status, 'unpaid')
    const cur = await run('checkout.session.expired', session({ id: 'cs_test_pay_new', status: 'expired', payment_status: 'unpaid', metadata: { registration_id: r.id } }))
    assert.equal(cur.outcome, 'registration_expired')
    assert.equal((await reg(r.id)).payment_status, 'expired')
    assert.equal(paymentState(await reg(r.id)).label, 'Checkout expired')
  })

  test('refund (partial, then full) is recorded and flagged; the enrollment is never withdrawn', async () => {
    psql(`insert into cohort_enrollments (cohort_id, user_id, status) values ('${ID.open}', '${ID.p5}', 'active') on conflict do nothing`)
    const r = await newReg({ email: 'p5@example.test', full_name: 'TEST Finley', cohort_id: ID.open, stripe_session_id: 'cs_test_pay_refund' })
    await run('checkout.session.completed', session({ id: 'cs_test_pay_refund', payment_intent: 'pi_test_pay_refund', metadata: { registration_id: r.id } }))
    await db.from('registrations').update({ status: 'confirmed' }).eq('id', r.id)
    const charge = (refunded, full) => ({ id: 'ch_test_pay_refund', object: 'charge', payment_intent: 'pi_test_pay_refund', amount: 25000, amount_refunded: refunded, refunded: full })
    assert.equal((await run('charge.refunded', charge(10000, false))).outcome, 'registration_partially_refunded')
    let row = await reg(r.id)
    assert.equal(row.payment_status, 'partially_refunded')
    assert.equal(row.amount_refunded_cents, 10000)
    assert.equal(row.enrollment_issue, 'refund_review')
    assert.equal((await run('charge.refunded', charge(10000, false))).outcome, 'refund_already_recorded', 'same total again changes nothing')
    assert.equal((await run('charge.refunded', charge(25000, true))).outcome, 'registration_refunded')
    row = await reg(r.id)
    assert.equal(row.payment_status, 'refunded')
    assert.equal(row.status, 'confirmed', 'registration decision untouched')
    assert.equal(psql(`select status from cohort_enrollments where cohort_id = '${ID.open}' and user_id = '${ID.p5}'`), 'active', 'still enrolled')
    const items = paymentAttentionItems({ registrations: [row], paymentRequests: [], cohorts: [], enrollments: [] })
    assert.equal(items[0]?.id, `payment-issue:${r.id}`)
    assert.match(items[0].title, /Refund recorded/)
  })

  test('cohort full by the time payment arrives: payment kept, issue flagged with what to do', async () => {
    const r = await newReg({ email: 'test-pay-full@example.test', cohort_id: ID.full, stripe_session_id: 'cs_test_pay_full' })
    const out = await run('checkout.session.completed', session({ id: 'cs_test_pay_full', metadata: { registration_id: r.id } }), { enrollMode: async () => 'automatic' })
    assert.equal(out.httpStatus, 200)
    const row = await reg(r.id)
    assert.equal(row.payment_status, 'paid')
    assert.equal(row.enrollment_issue, 'cohort_full')
    assert.equal(row.status, 'pending', 'not confirmed')
    assert.equal(access.filter(a => a.email === 'test-pay-full@example.test').length, 0, 'no access email')
    const mail = emailsFor('test-pay-full@example.test')[0]
    assert.match(mail.html, /in touch personally/)
    const owner = sent.find(m => m.template === 'registration_owner' && m.related?.id === r.id)
    assert.match(owner.subject, /needs attention/)
    const items = paymentAttentionItems({
      registrations: [row], paymentRequests: [],
      cohorts: [{ id: ID.full, name: 'TEST Full Cohort', status: 'upcoming', capacity: 2 }],
      enrollments: [{ user_id: ID.p2, cohort_id: ID.full, status: 'active' }, { user_id: ID.p3, cohort_id: ID.full, status: 'active' }],
    })
    assert.equal(items[0].severity, 'urgent')
    assert.match(items[0].detail, /2 of 2 seats taken.*Raise the cohort’s capacity.*refund/)
  })

  test('cohort no longer open (finished) → cohort_unavailable', async () => {
    const r = await newReg({ email: 'test-pay-done@example.test', cohort_id: ID.done, stripe_session_id: 'cs_test_pay_done' })
    await run('checkout.session.completed', session({ id: 'cs_test_pay_done', metadata: { registration_id: r.id } }))
    assert.equal((await reg(r.id)).enrollment_issue, 'cohort_unavailable')
  })

  test('amount different from the price shown → amount_mismatch (promotion codes still allowed)', async () => {
    const r = await newReg({ email: 'test-pay-mismatch@example.test', stripe_session_id: 'cs_test_pay_mismatch' })
    await run('checkout.session.completed', session({ id: 'cs_test_pay_mismatch', amount_subtotal: 9700, amount_total: 9700, metadata: { registration_id: r.id, expected_amount_cents: '25000' } }))
    assert.equal((await reg(r.id)).enrollment_issue, 'amount_mismatch')
    const promo = await newReg({ email: 'test-pay-promo@example.test', stripe_session_id: 'cs_test_pay_promo' })
    await run('checkout.session.completed', session({ id: 'cs_test_pay_promo', amount_subtotal: 25000, amount_total: 20000, metadata: { registration_id: promo.id, expected_amount_cents: '25000' } }))
    const p = await reg(promo.id)
    assert.equal(p.enrollment_issue, null, 'a discount is not a mismatch')
    assert.equal(p.amount_paid_cents, 20000, 'what was actually paid is recorded')
  })

  test('returning participant paying for another cohort (automatic mode): enrolled with the right email', async () => {
    psql(`delete from cohort_enrollments where cohort_id = '${ID.open}' and user_id = '${ID.p5}'`)
    const r = await newReg({ email: 'P5@Example.test', full_name: 'TEST Finley again', cohort_id: ID.open, stripe_session_id: 'cs_test_pay_return' })
    const out = await run('checkout.session.completed', session({ id: 'cs_test_pay_return', metadata: { registration_id: r.id } }), { enrollMode: async () => 'automatic' })
    assert.equal(out.httpStatus, 200)
    const row = await reg(r.id)
    assert.equal(row.status, 'confirmed')
    assert.equal(row.enrollment_issue, null)
    assert.equal(psql(`select status from cohort_enrollments where cohort_id = '${ID.open}' and user_id = '${ID.p5}'`), 'active')
    assert.equal(psql(`select status from cohort_enrollments where cohort_id = '30000000-0000-0000-0000-0000000000c2' and user_id = '${ID.p5}'`), 'active', 'other cohort untouched')
    const a = access.find(x => x.userId === ID.p5)
    assert.ok(a && ['account_setup', 'enrolled_notice'].includes(a.kind), 'set-up link or enrolled notice, never a second invitation')
    assert.match(emailsFor('P5@Example.test')[0].subject, /place is confirmed/)
  })

  test('new person (automatic mode): account created, enrolled, invitation sent', async () => {
    const r = await newReg({ email: 'test-pay-new@example.test', full_name: 'TEST Newcomer', cohort_id: ID.open, stripe_session_id: 'cs_test_pay_newperson' })
    await run('checkout.session.completed', session({ id: 'cs_test_pay_newperson', metadata: { registration_id: r.id } }), { enrollMode: async () => 'automatic' })
    assert.equal((await reg(r.id)).status, 'confirmed')
    const uid = psql(`select id from profiles where email = 'test-pay-new@example.test'`)
    assert.ok(uid)
    assert.equal(psql(`select role from profiles where id = '${uid}'`), 'impact_participant')
    assert.equal(psql(`select status from cohort_enrollments where cohort_id = '${ID.open}' and user_id = '${uid}'`), 'active')
    assert.equal(access.find(x => x.userId === uid)?.kind, 'invitation')
  })

  test('an email containing _ never matches someone else’s account (p_@ would match p1..p8 as a pattern)', async () => {
    const r = await newReg({ email: 'p_@example.test', full_name: 'TEST Underscore', cohort_id: ID.open, stripe_session_id: 'cs_test_pay_underscore' })
    await run('checkout.session.completed', session({ id: 'cs_test_pay_underscore', metadata: { registration_id: r.id } }), { enrollMode: async () => 'automatic' })
    const uid = psql(`select id from profiles where email = 'p_@example.test'`)
    assert.ok(uid, 'a new account was created for exactly this address')
    assert.equal(access.find(x => x.email === 'p_@example.test')?.kind, 'invitation')
    psql(`delete from auth.users where email = 'p_@example.test'`)
  })

  test('payment succeeds but enrollment fails (email belongs to a coaching account): payment kept, flagged', async () => {
    const r = await newReg({ email: 'coach@example.test', full_name: 'TEST Coach', cohort_id: ID.open, stripe_session_id: 'cs_test_pay_coach' })
    await run('checkout.session.completed', session({ id: 'cs_test_pay_coach', metadata: { registration_id: r.id } }), { enrollMode: async () => 'automatic' })
    const row = await reg(r.id)
    assert.equal(row.payment_status, 'paid')
    assert.equal(row.enrollment_issue, 'enrollment_failed')
    assert.equal(row.status, 'pending')
    assert.equal(psql(`select count(*) from cohort_enrollments where cohort_id = '${ID.open}' and user_id = '10000000-0000-0000-0000-0000000000c1'`), '0')
  })

  test('a historical paid registration is never emailed again (redelivery or "Check payment in Stripe")', async () => {
    const r = await newReg({ email: 'test-pay-history@example.test', status: 'confirmed', payment_status: 'paid', amount_paid: 0, stripe_session_id: 'cs_test_pay_history', paid_at: '2026-07-01T12:00:00Z', checkout_expires_at: null })
    const out = await run('checkout.session.completed', session({ id: 'cs_test_pay_history', amount_total: 0, amount_subtotal: 0, payment_status: 'no_payment_required', metadata: { registration_id: r.id } }))
    assert.equal(out.httpStatus, 200)
    assert.equal(emailsFor('test-pay-history@example.test').length, 0)
    assert.equal(sent.filter(m => m.related?.id === r.id).length, 0, 'owner not emailed either')
    const row = await reg(r.id)
    assert.equal(row.amount_paid, 0, 'history not rewritten')
    assert.equal(row.amount_paid_cents, null)
    assert.equal(paymentState(row).label, 'Free (no charge)')
  })

  test('a second payment for the same registration is flagged for a refund decision (nothing refunded)', async () => {
    const r = await newReg({ email: 'test-pay-twice@example.test', stripe_session_id: 'cs_test_pay_twice_a' })
    await run('checkout.session.completed', session({ id: 'cs_test_pay_twice_a', payment_intent: 'pi_test_pay_twice_a', metadata: { registration_id: r.id } }))
    const out = await run('checkout.session.completed', session({ id: 'cs_test_pay_twice_b', payment_intent: 'pi_test_pay_twice_b', metadata: { registration_id: r.id } }))
    assert.equal(out.outcome, 'duplicate_payment')
    const row = await reg(r.id)
    assert.equal(row.enrollment_issue, 'refund_review')
    assert.match(row.payment_error, /second payment/)
    assert.equal(row.stripe_payment_intent_id, 'pi_test_pay_twice_a', 'the first payment stays the one on record')
  })

  test('complimentary place: allowed by the schema, shown as Complimentary, holds no money', async () => {
    const r = await newReg({ email: 'test-pay-comp@example.test', checkout_expires_at: null })
    const { error } = await db.from('registrations').update({ payment_status: 'complimentary', complimentary_reason: 'TEST scholarship', complimentary_approved_by: ID.admin1 }).eq('id', r.id)
    assert.equal(error, null)
    const row = await reg(r.id)
    assert.equal(paymentState(row).label, 'Complimentary')
    assert.equal(paymentAttentionItems({ registrations: [row], paymentRequests: [], cohorts: [], enrollments: [] }).length, 0, 'awaits the normal confirm, no payment alert')
  })

  test('events for other products (coaching payment links, unknown charges) are ignored, still recorded once', async () => {
    const out = await run('checkout.session.completed', session({ id: 'cs_test_pay_coaching', metadata: {} }))
    assert.equal(out.outcome, 'ignored_no_metadata')
    const ch = await run('charge.refunded', { id: 'ch_x', object: 'charge', payment_intent: 'pi_unknown_test', amount: 100, amount_refunded: 100, refunded: true }, { stripe: null })
    assert.equal(ch.outcome, 'ignored_unknown_charge')
    assert.equal((await run('customer.created', { id: 'cus_x', object: 'customer' })).outcome, 'ignored_type')
  })
})

describe('organisation payment requests', () => {
  let inquiryId
  before(() => {
    inquiryId = psql(`insert into inquiries (kind, contact_name, organization, email, status, message, source) values ('organization', 'TEST Org Contact', 'TEST Org', 'test-pay-org@example.test', 'qualified', 'TEST', 'test') returning id`).split('\n')[0]
  })
  const newRequest = async fields => {
    const { data, error } = await db.from('payment_requests').insert({ inquiry_id: inquiryId, payer_name: 'TEST Org', payer_email: 'test-pay-org@example.test', description: 'TEST 10 seats', method: 'invoice', seats: 10, amount_cents: 500000, status: 'open', due_date: '2099-01-31', ...fields }).select('*').single()
    assert.equal(error, null, error?.message)
    return data
  }

  test('invoice paid (invoice.paid) → paid, owner told once; voided → void; failed → failed', async () => {
    const pr = await newRequest({ stripe_object_id: 'in_test_pay_paid' })
    const inv = { id: 'in_test_pay_paid', object: 'invoice', amount_paid: 500000, metadata: { payment_request_id: pr.id } }
    assert.equal((await run('invoice.paid', inv)).outcome, 'payment_request_paid')
    const row = (await db.from('payment_requests').select('*').eq('id', pr.id).single()).data
    assert.equal(row.status, 'paid')
    assert.equal(row.amount_paid_cents, 500000)
    assert.ok(row.paid_at)
    assert.equal((await run('invoice.paid', inv)).outcome, 'payment_request_already_closed', 'a second paid event does not double count')
    assert.equal((await db.from('payment_requests').select('amount_paid_cents').eq('id', pr.id).single()).data.amount_paid_cents, 500000)
    assert.equal(sent.filter(m => m.template === 'payment_request_paid_owner' && m.related?.id === pr.id).length, 1)

    const v = await newRequest({ stripe_object_id: 'in_test_pay_void' })
    await run('invoice.voided', { id: 'in_test_pay_void', object: 'invoice', metadata: {} })
    assert.equal((await db.from('payment_requests').select('status').eq('id', v.id).single()).data.status, 'void')
    const f = await newRequest({ stripe_object_id: 'in_test_pay_fail', due_date: '2000-01-01' })
    await run('invoice.payment_failed', { id: 'in_test_pay_fail', object: 'invoice', metadata: { payment_request_id: f.id } })
    const failed = (await db.from('payment_requests').select('*').eq('id', f.id).single()).data
    assert.equal(failed.status, 'failed')
    const items = paymentAttentionItems({ registrations: [], paymentRequests: [failed], cohorts: [], enrollments: [] })
    assert.equal(items[0].id, `payment-request-failed:${f.id}`)
    assert.equal(items[0].href, `/admin/inquiries?id=${inquiryId}`)
  })

  test('payment link paid (checkout.session.completed with payment_request_id) → paid', async () => {
    const pr = await newRequest({ method: 'payment_link', stripe_object_id: 'plink_test_pay_1' })
    const out = await run('checkout.session.completed', session({ id: 'cs_test_pay_link', payment_link: 'plink_test_pay_1', amount_total: 500000, amount_subtotal: 500000, metadata: { payment_request_id: pr.id } }), { stripe: null })
    assert.equal(out.outcome, 'payment_request_paid')
    assert.equal((await db.from('payment_requests').select('status').eq('id', pr.id).single()).data.status, 'paid')
  })

  test('overdue request appears in Needs your attention with an exact link', async () => {
    const pr = await newRequest({ stripe_object_id: null, method: 'offline', due_date: '2000-01-01' })
    const items = paymentAttentionItems({ registrations: [], paymentRequests: [pr], cohorts: [], enrollments: [] })
    assert.equal(items[0].id, `payment-request-overdue:${pr.id}`)
    assert.equal(items[0].href, `/admin/inquiries?id=${inquiryId}`)
  })

  test('stripe-mock: create a payment link and an invoice, refresh and cancel them', { skip: !stripeMock && 'set STRIPE_MOCK_URL to run' }, async () => {
    const link = await sendPaymentRequest(deps(), await newRequest({ method: 'payment_link', status: 'draft' }))
    assert.equal(link.status, 'open')
    assert.match(link.stripe_object_id, /^plink_/)
    assert.match(link.stripe_url, /^https:\/\//)
    const inv = await sendPaymentRequest(deps(), await newRequest({ method: 'invoice', status: 'draft' }))
    assert.equal(inv.status, 'open')
    assert.match(inv.stripe_object_id, /^in_/)
    const refreshed = await refreshPaymentRequest(deps(), link)
    assert.ok(refreshed.summary)
    const off = await sendPaymentRequest(deps(), await newRequest({ method: 'offline', status: 'draft', payer_email: null }))
    assert.equal(off.status, 'open')
    assert.equal(off.stripe_object_id, null, 'offline has no Stripe object')
    assert.equal((await voidPaymentRequest(deps(), link)).status, 'void')
    await assert.rejects(sendPaymentRequest(deps(), link), /Only a request that has not been sent/)
    await assert.rejects(sendPaymentRequest(deps(), await newRequest({ method: 'invoice', status: 'draft', payer_email: null, stripe_object_id: null })), /needs the payer’s email/)
  })

  test('stripe-mock: the Checkout Session the checkout route sends is accepted by the Stripe API schema', { skip: !stripeMock && 'set STRIPE_MOCK_URL to run' }, async () => {
    const params = checkoutSessionParams({ registrationId: ID.open, cohortId: ID.open, email: 'test-pay-x@example.test', siteUrl: 'http://localhost:3999', expiresAt: Math.floor(Date.now() / 1000) + CHECKOUT_WINDOW_SECONDS, pricing: { amountCents: 25000, productName: 'New Leaders', description: 'TEST cohort' } })
    assert.equal(params.line_items[0].price_data.unit_amount, 25000, 'server price only')
    assert.equal(params.metadata.expected_amount_cents, '25000')
    assert.ok(params.expires_at - Date.now() / 1000 >= 30 * 60, 'at least Stripe’s 30-minute minimum')
    assert.deepEqual(params.payment_method_types, ['card'], 'card only: no delayed bank payments unless the owner chooses them')
    // stripe-mock 0.206 validates against API 2026-09-30.endive, which no longer takes
    // payment_method_types here; the app pins 2026-06-24.dahlia (stripe-node 22.3), where it is valid.
    const forMock = { ...params }
    delete forMock.payment_method_types
    const s = await stripeMock.checkout.sessions.create(forMock)
    assert.match(s.id, /^cs_/)
    await stripeMock.checkout.sessions.expire(s.id) // used before reusing an abandoned registration
  })

  test('stripe-mock: receipt link and missed-webhook sync go through the Stripe API', { skip: !stripeMock && 'set STRIPE_MOCK_URL to run' }, async () => {
    const r = await newReg({ email: 'test-pay-sync@example.test', stripe_session_id: 'cs_test_pay_sync' })
    const msg = await syncRegistrationFromStripe(deps(), r.id)
    assert.equal(typeof msg, 'string')
    const r2 = await newReg({ email: 'test-pay-receipt@example.test', stripe_session_id: 'cs_test_pay_receipt' })
    await run('checkout.session.completed', session({ id: 'cs_test_pay_receipt', payment_intent: 'pi_test_receipt', metadata: { registration_id: r2.id } }))
    const row = await reg(r2.id)
    assert.equal(row.payment_status, 'paid')
    assert.ok(row.receipt_url === null || /^https:\/\//.test(row.receipt_url), 'receipt link (if any) is an https URL')
  })
})

// ================================================================ part 2: the running site
const SITE = process.env.SITE_URL ?? 'http://localhost:3999'
describe('site routes (after a rebuild with this code)', { skip: process.env.PAYMENTS_SITE_TESTS !== '1' && 'set PAYMENTS_SITE_TESTS=1 once :3999 runs this code' }, () => {
  const SITE_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec_local_dummy'
  const post = (path, body, headers = {}) => fetch(SITE + path, { method: 'POST', headers: { 'content-type': 'application/json', origin: SITE, ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) })

  test('webhook: unsigned or badly signed requests are refused (400) and change nothing', async () => {
    const payload = JSON.stringify({ id: evtId(), object: 'event', type: 'checkout.session.completed', data: { object: session({ metadata: { registration_id: '00000000-0000-0000-0000-000000000000' } }) } })
    assert.equal((await post('/api/webhook', payload)).status, 400)
    assert.equal((await post('/api/webhook', payload, { 'stripe-signature': Stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_wrong' }) })).status, 400)
  })

  test('webhook: a signed event is handled once; the duplicate is acknowledged', async () => {
    const r = await newReg({ email: 'test-pay-site@example.test', stripe_session_id: 'cs_test_pay_site' })
    const id = evtId()
    const payload = JSON.stringify({ id, object: 'event', type: 'checkout.session.completed', data: { object: session({ id: 'cs_test_pay_site', metadata: { registration_id: r.id } }) } })
    const sig = () => ({ 'stripe-signature': Stripe.webhooks.generateTestHeaderString({ payload, secret: SITE_SECRET }) })
    const first = await post('/api/webhook', payload, sig())
    assert.equal(first.status, 200)
    assert.equal((await reg(r.id)).payment_status, 'paid')
    const dup = await (await post('/api/webhook', payload, sig())).json()
    assert.equal(dup.duplicate, true)
  })

  test('checkout stays closed (503) while CHECKOUT_ENABLED is unset', async () => {
    const res = await post('/api/checkout', { full_name: 'TEST', email: 'test-pay-x@example.test', program_id: ID.newLeaders, cohort_id: ID.open })
    assert.equal(res.status, 503)
  })

  test('admin payment routes refuse visitors and participants', async () => {
    for (const path of ['/api/admin/payment-requests', `/api/admin/registrations/${ID.open}`]) {
      assert.equal((await post(path, { action: 'complimentary', reason: 'x' })).status, 401)
    }
    assert.equal((await fetch(`${SITE}/api/admin/registrations`)).status, 401)
    const p = await signIn('p1@example.test')
    assert.equal((await p.post('/api/admin/payment-requests', { inquiry_id: ID.open })).status, 401)
  })

  test('admin: complimentary needs a reason, records the approver, refuses a paid registration', async () => {
    const a = await signIn('admin1@example.test')
    const r = await newReg({ email: 'test-pay-comp2@example.test', checkout_expires_at: null })
    assert.equal((await a.post(`/api/admin/registrations/${r.id}`, { action: 'complimentary', reason: '' })).status, 400)
    assert.equal((await a.post(`/api/admin/registrations/${r.id}`, { action: 'complimentary', reason: 'TEST partner' })).status, 200)
    const row = await reg(r.id)
    assert.equal(row.payment_status, 'complimentary')
    assert.equal(row.complimentary_approved_by, ID.admin1)
    const paid = await newReg({ email: 'test-pay-comp3@example.test', payment_status: 'paid', amount_paid_cents: 1000 })
    assert.equal((await a.post(`/api/admin/registrations/${paid.id}`, { action: 'complimentary', reason: 'TEST' })).status, 409)
  })

  test('admin: payment request validation (amount typed in cents, invoice needs email and due date)', async () => {
    const a = await signIn('admin1@example.test')
    const inq = psql(`insert into inquiries (kind, contact_name, email, status, message, source) values ('organization', 'TEST Site Org', 'test-pay-site-org@example.test', 'qualified', 'TEST', 'test') returning id`).split('\n')[0]
    const base = { inquiry_id: inq, payer_name: 'TEST Site Org', description: 'TEST seats', method: 'offline', amount_cents: 120000 }
    assert.equal((await a.post('/api/admin/payment-requests', { ...base, amount_cents: 12.5 })).status, 400)
    assert.equal((await a.post('/api/admin/payment-requests', { ...base, method: 'invoice' })).status, 400)
    const ok = await (await a.post('/api/admin/payment-requests', base)).json()
    assert.equal(ok.ok, true)
    assert.equal(ok.request.status, 'open')
    const paid = await a.post(`/api/admin/payment-requests/${ok.request.id}`, { action: 'mark_paid', note: 'TEST check #1' })
    assert.equal(paid.status, 200)
    assert.equal((await db.from('payment_requests').select('status').eq('id', ok.request.id).single()).data.status, 'paid')
  })
})

async function signIn(email) {
  const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const jar = new Map()
  const client = createServerClient(URL_, ANON, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: cs => cs.forEach(c => c.value ? jar.set(c.name, c.value) : jar.delete(c.name)) } })
  const { error } = await client.auth.signInWithPassword({ email, password: 'LocalTest-only-1!' })
  assert.equal(error, null, `sign in ${email}`)
  const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ')
  const post = (path, body) => fetch(SITE + path, { method: 'POST', redirect: 'manual', headers: { cookie: cookie(), 'content-type': 'application/json', origin: SITE }, body: JSON.stringify(body) })
  return { client, post }
}
