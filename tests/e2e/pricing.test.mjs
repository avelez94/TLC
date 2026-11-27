// Pathway pricing end to end, in Stripe TEST mode only (local stack + stripe-mock, synthetic data).
// Run against a local build started with CHECKOUT_ENABLED=true, STRIPE_SECRET_KEY=sk_test_…,
// STRIPE_API_BASE=http://127.0.0.1:12111 and EMAIL_SINK_DIR set (never production):
//   set -a; . /tmp/tlc-local-stack/env.local; . /tmp/tlc-local-stack/secret.env; set +a
//   STRIPE_MOCK_LOG=/tmp/tlc-local-stack/stripe-mock.log node --test tests/e2e/pricing.test.mjs
// Checks: the price shown is the price sent to Stripe (Emerging $97, New $149, Practicing $197);
// historical programs stay separate and are never charged; a paid registration is recorded by the
// signed webhook, then confirmed, invited and given access; complimentary places need no Stripe;
// capacity holds during checkout; payment and enrollment stay independent.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, rmSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

const SITE = process.env.SITE_URL ?? 'http://localhost:3999'
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const PG = process.env.PG_URL
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET
const MOCK_LOG = process.env.STRIPE_MOCK_LOG ?? '/tmp/tlc-local-stack/stripe-mock.log'
const SINK = process.env.EMAIL_SINK_DIR ?? '/tmp/tlc-local-stack/mail'
assert.ok(URL_?.startsWith('http://127.0.0.1') && PG && WEBHOOK_SECRET, 'local stack only (source env.local and secret.env)')

const psql = q => execFileSync('psql', ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', PG, '-c', q], { encoding: 'utf8' }).trim()
const PRICES = { 'emerging-leaders': 97, 'new-leaders': 149, 'practicing-leaders': 197 }
const programId = slug => psql(`select id from programs where slug = '${slug}'`)
const historicalId = name => psql(`select id from programs where name = '${name}' and slug is null`)
const mockRequests = () => { try { return readFileSync(MOCK_LOG, 'utf8') } catch { return '' } }

async function signIn(email, password = 'LocalTest-only-1!') {
  const jar = new Map()
  const client = createServerClient(URL_, ANON, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: cs => cs.forEach(c => c.value ? jar.set(c.name, c.value) : jar.delete(c.name)) } })
  const { error } = await client.auth.signInWithPassword({ email, password })
  assert.equal(error, null, `sign in ${email}`)
  const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ')
  const post = async (p, body) => { const r = await fetch(SITE + p, { method: 'POST', redirect: 'manual', headers: { cookie: cookie(), 'content-type': 'application/json', origin: SITE }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json().catch(() => ({})) } }
  return { client, post }
}
// The published policy versions the registration page shows; checkout requires exactly these.
const ACCEPT = () => Object.fromEntries(['privacy', 'terms', 'refund'].map(s => [s, psql(`select published_version_id from policies where slug = '${s}'`)]))
const checkout = async body => { const r = await fetch(SITE + '/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json', origin: SITE }, body: JSON.stringify({ accepted_policies: ACCEPT(), ...body }) }); return { status: r.status, body: await r.json().catch(() => ({})) } }
const STRIPE_VERIFIED = `'{"verified":true,"verified_at":"2026-11-28T15:00:00Z","livemode":false,"account_id":"acct_test","account_ok":true,"events_complete":true,"missing_events":[],"endpoint_url":"http://localhost:3999/api/webhook"}'`
const policyText = slug => JSON.stringify({ title: `TEST ${slug} policy`, intro: [{ type: 'p', c: [{ t: 'Synthetic policy wording for automated tests only; never shown on the live site.' }] }], sections: [{ id: 'one', heading: 'Section one', body: [{ type: 'p', c: [{ t: 'This synthetic section exists so the launch gate treats the policy as published in the local test database.' }] }] }] }).replace(/'/g, "''")
// Launch state for these tests: synthetic published policies and a verified (test-mode) Stripe check.
function openLaunchState() {
  psql(`insert into launch_checks (key, value) values ('stripe', ${STRIPE_VERIFIED}::jsonb) on conflict (key) do update set value = excluded.value`)
  for (const slug of ['privacy', 'terms', 'refund']) {
    psql(`with v as (insert into policy_versions (policy_slug, version_number, kind, content, content_hash)
            select '${slug}', coalesce(max(version_number), 0) + 1, 'published', '${policyText(slug)}'::jsonb, repeat('a', 64) from policy_versions where policy_slug = '${slug}' returning id)
          update policies set published_version_id = (select id from v), published_at = now() where slug = '${slug}'`)
  }
}
const webhook = async event => {
  const payload = JSON.stringify(event)
  const r = await fetch(SITE + '/api/webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET }) }, body: payload })
  return r.status
}
let seq = 0
const paidEvent = (reg, amountCents) => ({
  id: `evt_test_pricing_${Date.now()}_${++seq}`, object: 'event', type: 'checkout.session.completed', api_version: '2026-06-24.dahlia', created: Math.floor(Date.now() / 1000),
  data: { object: { id: reg.stripe_session_id, object: 'checkout.session', mode: 'payment', status: 'complete', payment_status: 'paid', currency: 'usd',
    amount_total: amountCents, amount_subtotal: amountCents, payment_intent: `pi_test_pricing_${seq}`, payment_link: null, customer_email: reg.email,
    metadata: { registration_id: reg.id, expected_amount_cents: String(amountCents), cohort_id: reg.cohort_id } } },
})
const COHORTS = {}
let HISTORICAL_BEFORE = ''
const historicalSnapshot = () => psql(`select coalesce(string_agg(name || ':' || coalesce(price::text, '') || ':' || coalesce(price_label, '') || ':' || is_public || ':' || enrollment_open, ', ' order by name), '') from programs where slug is null and type = 'cohort'`)

before(async () => {
  rmSync(SINK, { recursive: true, force: true }); mkdirSync(SINK, { recursive: true })
  psql(`delete from registrations where email like 'pricing.%@example.test';
        delete from auth.users where email like 'pricing.%@example.test';
        delete from cohort_enrollments where cohort_id in (select id from cohorts where name like 'TEST Pricing %');
        delete from cohorts where name like 'TEST Pricing %';
        delete from app_private.rate_limits;
        update app_private.settings set value = '"review"' where key = 'enroll_on_payment';`)
  HISTORICAL_BEFORE = historicalSnapshot()
  openLaunchState()
  // The owner's prices, set the way the admin Pathways screen sets them (price and shown price together).
  const admin = await signIn('admin1@example.test')
  for (const [slug, dollars] of Object.entries(PRICES)) {
    const r = await admin.client.from('programs').update({ price: dollars, price_label: `$${dollars}`, enrollment_open: true }).eq('slug', slug).select('id')
    assert.equal(r.error, null); assert.equal(r.data.length, 1)
    const id = psql(`insert into cohorts (program_id, name, status, capacity, start_date, end_date, zoom_link) values ('${programId(slug)}', 'TEST Pricing ${slug}', 'upcoming', 2, current_date + 30, current_date + 72, 'https://zoom.us/j/0000000000') returning id`).split('\n')[0]
    psql(`insert into cohort_sessions (cohort_id, session_number, title, session_date) values ('${id}', 1, 'Session 1', current_date + 30)`)
    COHORTS[slug] = id
  }
})

test('a pathway that is not open for enrollment cannot be paid for, even with an upcoming cohort', async () => {
  psql(`update programs set enrollment_open = false where slug = 'emerging-leaders'`)
  try {
    const r = await checkout({ full_name: 'Pricing Closed', email: 'pricing.closed@example.test', program_id: programId('emerging-leaders'), cohort_id: COHORTS['emerging-leaders'] })
    assert.equal(r.status, 503, 'the launch gate refuses it')
    assert.equal(psql(`select count(*) from registrations where email = 'pricing.closed@example.test'`), '0')
  } finally {
    psql(`update programs set enrollment_open = true where slug = 'emerging-leaders'`)
  }
})

test('the price shown is exactly the amount sent to Stripe, for each pathway', async () => {
  for (const [slug, dollars] of Object.entries(PRICES)) {
    assert.equal(psql(`select price || '|' || price_label from programs where slug = '${slug}'`), `${dollars}|$${dollars}`)
    const before = mockRequests().length
    const r = await checkout({ full_name: `TEST ${slug}`, email: `pricing.${slug}@example.test`, program_id: programId(slug), cohort_id: COHORTS[slug] })
    assert.equal(r.status, 200, JSON.stringify(r.body)); assert.ok(r.body.url, 'a Stripe Checkout link is returned')
    const sent = mockRequests().slice(before)
    assert.match(sent, new RegExp(`unit_amount:${dollars * 100}\\b`), `Stripe receives ${dollars * 100} cents`)
    assert.match(sent, new RegExp(`expected_amount_cents:${dollars * 100}\\b`))
    assert.match(sent, /receipt_email:pricing\./, 'Stripe is asked to email the receipt')
  }
})

test('historical programs stay separate: never offered, never charged, prices untouched', async () => {
  assert.ok(HISTORICAL_BEFORE, 'there are historical programs to check')
  assert.equal(historicalSnapshot(), HISTORICAL_BEFORE, 'historical programs unchanged by configuring the pathways')
  assert.ok(!HISTORICAL_BEFORE.includes(':true:'), 'no historical program is public or open')
  const fall = psql(`select c.id from cohorts c join programs p on p.id = c.program_id where p.name = 'Impact Makers' and p.slug is null limit 1`)
  const r = await checkout({ full_name: 'TEST historical', email: 'pricing.historical@example.test', program_id: historicalId('Impact Makers'), cohort_id: fall })
  assert.notEqual(r.status, 200, 'a finished historical cohort cannot be bought')
  assert.equal(psql(`select count(*) from registrations where email = 'pricing.historical@example.test' and stripe_session_id is not null`), '0')
})

test('paid: the signed webhook records the money, the owner confirms, the person is invited and gets access', async () => {
  const reg = JSON.parse(psql(`select row_to_json(r) from (select id, email, cohort_id, stripe_session_id from registrations where email = 'pricing.new-leaders@example.test') r`))
  assert.equal(await webhook(paidEvent(reg, 14900)), 200)
  assert.equal(psql(`select payment_status || '|' || amount_paid_cents || '|' || status from registrations where id = '${reg.id}'`), 'paid|14900|pending', 'paid, waiting for the owner (review mode)')
  assert.equal(psql(`select count(*) from cohort_enrollments where cohort_id = '${reg.cohort_id}'`), '0', 'payment alone does not enroll anyone')
  assert.ok(readdirSync(SINK).some(f => JSON.parse(readFileSync(path.join(SINK, f), 'utf8')).to === reg.email), 'payment confirmation email sent (not a receipt)')
  // The owner confirms: invitation, enrollment, account set-up, sign-in, the right cohort.
  const admin = await signIn('admin1@example.test')
  const inv = await admin.post('/api/invite', { email: reg.email, full_name: 'TEST new-leaders', role: 'impact_participant', cohort_id: reg.cohort_id, idempotency_key: crypto.randomUUID() })
  assert.equal(inv.status, 200, JSON.stringify(inv.body)); assert.equal(inv.body.outcome, 'invited'); assert.equal(inv.body.email.status, 'accepted')
  assert.equal((await admin.client.from('registrations').update({ status: 'confirmed' }).eq('id', reg.id).select('id')).error, null)
  const mail = readdirSync(SINK).map(f => JSON.parse(readFileSync(path.join(SINK, f), 'utf8'))).filter(m => m.to === reg.email && m.template === 'invite').at(-1)
  const link = mail.html.match(/href="(http:\/\/127\.0\.0\.1:54321\/local-link\/[^"]+)"/)[1]
  const hash = new URLSearchParams((await fetch(link, { redirect: 'manual' })).headers.get('location').split('#')[1])
  const p = createClient(URL_, ANON, { auth: { persistSession: false } })
  await p.auth.setSession({ access_token: hash.get('access_token'), refresh_token: hash.get('refresh_token') })
  assert.equal((await p.auth.updateUser({ password: 'Pricing-test-pass-1' })).error, null)
  const participant = await signIn(reg.email, 'Pricing-test-pass-1')
  const mine = (await participant.client.from('cohort_enrollments').select('cohort_id, status').eq('user_id', inv.body.user_id)).data
  assert.deepEqual(mine, [{ cohort_id: reg.cohort_id, status: 'active' }], 'sees exactly the cohort they paid for')
  assert.equal(psql(`select payment_status from registrations where id = '${reg.id}'`), 'paid', 'enrollment did not change the payment record')
})

test('complimentary place: no Stripe involved, approver recorded, enrollment still a separate decision', async () => {
  const admin = await signIn('admin1@example.test')
  const reg = psql(`insert into registrations (full_name, email, status, payment_status, program_id, cohort_id) values ('TEST complimentary', 'pricing.comp@example.test', 'pending', 'unpaid', '${programId('emerging-leaders')}', '${COHORTS['emerging-leaders']}') returning id`).split('\n')[0]
  const before = mockRequests().length
  const r = await admin.post(`/api/admin/registrations/${reg}`, { action: 'complimentary', reason: 'Scholarship (test)' })
  assert.equal(r.status, 200, JSON.stringify(r.body))
  assert.equal(psql(`select payment_status || '|' || (complimentary_approved_by is not null) || '|' || status from registrations where id = '${reg}'`), 'complimentary|true|pending')
  assert.equal(mockRequests().length, before, 'nothing sent to Stripe')
})

test('capacity holds during checkout: a full cohort refuses another checkout', async () => {
  const slug = 'practicing-leaders'
  psql(`update cohorts set capacity = 1 where id = '${COHORTS[slug]}'`) // one open checkout already holds the only seat
  const r = await checkout({ full_name: 'TEST second', email: 'pricing.second@example.test', program_id: programId(slug), cohort_id: COHORTS[slug] })
  assert.equal(r.status, 409, JSON.stringify(r.body))
})


after(() => {
  // Leave the local database neutral for other suites (versions themselves are permanent).
  psql(`update policies set published_version_id = null, published_at = null; delete from launch_checks;`)
})

const blockedBy = async (name, breakSql, restoreSql, expectStatus = 503) => {
  psql(`delete from app_private.rate_limits; ${breakSql}`)
  try {
    const email = `pricing.gate.${name}@example.test`
    const r = await checkout({ full_name: 'TEST gate', email, program_id: programId('new-leaders'), cohort_id: COHORTS['new-leaders'] })
    assert.equal(r.status, expectStatus, `${name}: ${JSON.stringify(r.body)}`)
    assert.equal(psql(`select count(*) from registrations where email = '${email}'`), '0', `${name}: no registration, no Stripe session`)
    return r
  } finally { psql(restoreSql) }
}

test('gate: an unpublished policy blocks payment server-side, with a clear explanation', async () => {
  for (const slug of ['privacy', 'terms', 'refund']) {
    const id = psql(`select published_version_id from policies where slug = '${slug}'`)
    const r = await blockedBy(`policy-${slug}`, `update policies set published_version_id = null where slug = '${slug}'`, `update policies set published_version_id = '${id}' where slug = '${slug}'`)
    assert.match(r.body.error, /policies are published/)
  }
})

test('gate: Stripe not verified, webhook events incomplete, or a cohort not fully set up blocks payment', async () => {
  await blockedBy('stripe', `delete from launch_checks`, `insert into launch_checks (key, value) values ('stripe', ${STRIPE_VERIFIED}::jsonb)`)
  await blockedBy('events', `update launch_checks set value = jsonb_set(value, '{events_complete}', 'false')`, `update launch_checks set value = ${STRIPE_VERIFIED}::jsonb`)
  const c = COHORTS['new-leaders']
  await blockedBy('meeting', `update cohorts set zoom_link = null where id = '${c}'`, `update cohorts set zoom_link = 'https://zoom.us/j/0000000000' where id = '${c}'`)
  await blockedBy('draft', `update cohorts set status = 'draft' where id = '${c}'`, `update cohorts set status = 'upcoming' where id = '${c}'`)
  await blockedBy('started', `update cohorts set start_date = current_date - 1 where id = '${c}'`, `update cohorts set start_date = current_date + 30 where id = '${c}'`)
  await blockedBy('price', `update programs set price_label = '$97' where slug = 'new-leaders'`, `update programs set price_label = '$149' where slug = 'new-leaders'`)
})

test('policy acceptance: missing or out-of-date versions are refused; the registration records the accepted versions and time', async () => {
  psql(`delete from app_private.rate_limits`)
  const stale = await checkout({ full_name: 'TEST stale', email: 'pricing.stale@example.test', program_id: programId('new-leaders'), cohort_id: COHORTS['new-leaders'], accepted_policies: {} })
  assert.equal(stale.status, 409); assert.equal(stale.body.policies_changed, true)
  assert.equal(psql(`select count(*) from registrations where email = 'pricing.stale@example.test'`), '0')
  const row = JSON.parse(psql(`select row_to_json(r) from (select policies_accepted, policies_accepted_at from registrations where email = 'pricing.new-leaders@example.test') r`))
  const live = ACCEPT()
  assert.ok(row.policies_accepted_at, 'acceptance time recorded')
  assert.deepEqual(Object.fromEntries(row.policies_accepted.map(p => [p.slug, p.version_id])), live, 'exactly the published versions')
  assert.ok(row.policies_accepted.every(p => p.version_number > 0 && p.published_at))
})

test('public pages follow the gate: price and registration only while it is open', async () => {
  const page = async p => (await fetch(SITE + p)).text()
  assert.match(await page('/impact'), /\$149/, 'open: price shown')
  assert.doesNotMatch(await page('/register'), /Enrollment for the next cohorts is not open yet/, 'open: the registration form is offered')
  const id = psql(`select published_version_id from policies where slug = 'terms'`)
  psql(`update policies set published_version_id = null where slug = 'terms'`)
  try {
    assert.doesNotMatch(await page('/impact'), /\$149/, 'terms unpublished: no price')
    assert.match(await page('/register'), /Enrollment for the next cohorts is not open yet/)
  } finally { psql(`update policies set published_version_id = '${id}' where slug = 'terms'`) }
})
