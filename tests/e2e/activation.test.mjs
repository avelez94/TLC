// Simulates production right after the owner switches live payments on (CHECKOUT_ENABLED=true)
// while the policies are unpublished and no cohort is eligible. Local only: a build started with
//   CHECKOUT_ENABLED=true STRIPE_SECRET_KEY=sk_live_placeholder… STRIPE_API_BASE=http://127.0.0.1:12111
//   (the placeholder key is never valid and every Stripe call goes to the local stripe-mock).
//   set -a; . /tmp/tlc-local-stack/env.local; . /tmp/tlc-local-stack/secret.env; set +a
//   ACTIVATED_SITE_URL=http://localhost:3996 STRIPE_MOCK_LOG=/tmp/tlc-local-stack/stripe-mock.log node --test tests/e2e/activation.test.mjs
// Expectation: nobody can pay, nothing is sent to Stripe, organisation invoices/links stay blocked,
// and the moment every condition is met (synthetic, then reverted) paid registration opens with no
// redeploy.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createServerClient } from '@supabase/ssr'

const SITE = process.env.ACTIVATED_SITE_URL ?? 'http://localhost:3996'
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const PG = process.env.PG_URL
const MOCK_LOG = process.env.STRIPE_MOCK_LOG ?? '/tmp/tlc-local-stack/stripe-mock.log'
assert.ok(URL_?.startsWith('http://127.0.0.1') && PG, 'local stack only')
const psql = q => execFileSync('psql', ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', PG, '-c', q], { encoding: 'utf8' }).trim()
const mock = () => { try { return readFileSync(MOCK_LOG, 'utf8') } catch { return '' } }
const page = async p => (await fetch(SITE + p, { cache: 'no-store' })).text()
const SPRING = '30000000-0000-0000-0000-0000000000c3'
const newLeaders = () => psql(`select id from programs where slug = 'new-leaders'`)
const accept = () => Object.fromEntries(['privacy', 'terms', 'refund'].map(s => [s, psql(`select coalesce(published_version_id::text, '') from policies where slug = '${s}'`)]))
const checkout = async (extra = {}) => {
  const r = await fetch(SITE + '/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json', origin: SITE }, body: JSON.stringify({ full_name: 'TEST Visitor', email: 'activation.visitor@example.test', program_id: newLeaders(), cohort_id: SPRING, accepted_policies: accept(), ...extra }) })
  return { status: r.status, body: await r.json().catch(() => ({})) }
}
async function signIn(email, password = 'LocalTest-only-1!') {
  const jar = new Map()
  const client = createServerClient(URL_, ANON, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: cs => cs.forEach(c => c.value ? jar.set(c.name, c.value) : jar.delete(c.name)) } })
  assert.equal((await client.auth.signInWithPassword({ email, password })).error, null)
  const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ')
  return async (method, p, body) => { const r = await fetch(SITE + p, { method, headers: { cookie: cookie(), 'content-type': 'application/json', origin: SITE }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json().catch(() => ({})) } }
}

let snapshot
before(() => {
  // Production-like: prices set, pathways closed, policies unpublished, Stripe verified (live mode).
  snapshot = psql(`select coalesce(string_agg(slug || ':' || coalesce(price::text,'') || ':' || coalesce(price_label,'') || ':' || enrollment_open, ',' order by slug), '') from programs where slug is not null`)
  psql(`update programs set price = 97, price_label = '$97', enrollment_open = false where slug = 'emerging-leaders';
        update programs set price = 149, price_label = '$149', enrollment_open = false where slug = 'new-leaders';
        update programs set price = 197, price_label = '$197', enrollment_open = false where slug = 'practicing-leaders';
        update policies set published_version_id = null, published_at = null;
        insert into launch_checks (key, value) values ('stripe', '{"verified":true,"verified_at":"2026-11-27T21:48:50Z","livemode":true,"account_id":"acct_x","account_ok":true,"events_complete":true,"missing_events":[],"endpoint_url":"x"}'::jsonb) on conflict (key) do update set value = excluded.value;
        delete from registrations where email = 'activation.visitor@example.test'; delete from app_private.rate_limits;`)
})
after(() => psql(`update policies set published_version_id = null, published_at = null; delete from launch_checks; delete from registrations where email = 'activation.visitor@example.test'; delete from payment_requests where description = 'TEST activation invoice'`))

test('after activation, with policies unpublished and no eligible cohort, nobody can pay and nothing reaches Stripe', async () => {
  const before = mock().length
  const r = await checkout()
  assert.equal(r.status, 503); assert.match(r.body.error, /policies are published/)
  assert.doesNotMatch(await page('/impact'), /\$(97|149|197)\b/, 'no prices on the Impact Lab page')
  assert.match(await page('/register'), /Enrollment for the next cohorts is not open yet/, 'register page sends visitors to the inquiry form')
  assert.equal(psql(`select count(*) from registrations where email = 'activation.visitor@example.test'`), '0')
  assert.equal(mock().length, before, 'no Stripe request at all')
})

test('after activation, organisation Stripe invoices and payment links stay blocked until the site-wide conditions are met', async () => {
  const admin = await signIn('admin1@example.test')
  const inquiry = psql(`select id from inquiries order by created_at limit 1`)
  const before = mock().length
  const r = await admin('POST', '/api/admin/payment-requests', { inquiry_id: inquiry, method: 'invoice', payer_name: 'TEST Org', payer_email: 'org@example.test', description: 'TEST activation invoice', amount_cents: 50000, due_date: '2099-01-01' })
  assert.equal(r.status, 403); assert.match(r.body.error, /Still needed: .*Privacy Policy/)
  assert.equal(mock().length, before, 'no invoice created in Stripe')
  const status = await admin('GET', '/api/admin/registrations')
  assert.equal(status.body.stripe_writes, false, 'the admin screens do not offer Stripe links or invoices yet')
  const lr = await admin('GET', '/api/admin/launch-readiness')
  assert.equal(lr.body.readiness.stripePayments.enabled, true, 'dashboard: Stripe payments enabled')
  assert.equal(lr.body.readiness.registration.available, false, 'dashboard: public paid registration not available')
})

test('once every condition is met (synthetic), paid registration opens with no redeploy; reverting closes it again', async () => {
  const text = slug => JSON.stringify({ title: `TEST ${slug}`, intro: [], sections: [{ id: 'a', heading: 'Section', body: [{ type: 'p', c: [{ t: 'Synthetic wording used only to prove the launch gate opens and closes on its own in a local test database, never shown anywhere real.' }] }] }] }).replace(/'/g, "''")
  for (const slug of ['privacy', 'terms', 'refund']) {
    psql(`with v as (insert into policy_versions (policy_slug, version_number, kind, content, content_hash) select '${slug}', coalesce(max(version_number), 0) + 1, 'published', '${text(slug)}'::jsonb, repeat('b', 64) from policy_versions where policy_slug = '${slug}' returning id)
          update policies set published_version_id = (select id from v), published_at = now() where slug = '${slug}'`)
  }
  // Still closed: the cohort and pathway are not ready.
  assert.equal((await checkout()).status, 503)
  psql(`update cohorts set status = 'upcoming', capacity = 20, zoom_link = 'https://zoom.us/j/0000000000', start_date = current_date + 40, end_date = current_date + 82 where id = '${SPRING}';
        insert into cohort_sessions (cohort_id, session_number, title, session_date) select '${SPRING}', 90, 'TEST session', current_date + 40 where not exists (select 1 from cohort_sessions where cohort_id = '${SPRING}' and session_date is not null);
        update programs set enrollment_open = true where slug = 'new-leaders'; delete from app_private.rate_limits;`)
  assert.match(await page('/impact'), /\$149/, 'price appears by itself')
  const missing = await checkout({ accepted_policies: {} })
  assert.equal(missing.status, 409, 'policies must still be accepted explicitly')
  const ok = await checkout()
  assert.equal(ok.status, 200, JSON.stringify(ok.body)); assert.ok(ok.body.url)
  assert.equal(psql(`select jsonb_array_length(policies_accepted) from registrations where email = 'activation.visitor@example.test'`), '3')
  // Unpublishing one policy closes it again immediately.
  psql(`update policies set published_version_id = null where slug = 'refund'; delete from app_private.rate_limits;`)
  assert.equal((await checkout({ email: 'activation.second@example.test' })).status, 503)
  assert.doesNotMatch(await page('/impact'), /\$149/)
  psql(`update programs set enrollment_open = false where slug = 'new-leaders'; delete from registrations where email like 'activation.%@example.test'`)
})
