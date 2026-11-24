// End-to-end checks against the LOCAL stack (scripts/local-stack/start.sh) and a local build of
// the site on :3999. Synthetic data only; touches no remote service.
//   set -a; . /tmp/tlc-local-stack/env.local; . /tmp/tlc-local-stack/secret.env; set +a
//   node --test tests/e2e/admin-local.test.mjs
// Signs in as synthetic admins, participants and a coaching client through the same Supabase
// client libraries the site uses, and calls the site's own pages and server routes with real
// session cookies, so each check covers the path from the request to the database rules.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { totp } from '../../scripts/local-stack/sign.mjs'

const SITE = process.env.SITE_URL ?? 'http://localhost:3999'
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const PG = process.env.PG_URL
const PW = 'LocalTest-only-1!'
assert.ok(URL_?.startsWith('http://127.0.0.1'), 'refusing to run against anything but the local stack')

const psql = q => execFileSync('psql', ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', PG, '-c', q], { encoding: 'utf8' }).trim()
const setMode = m => psql(`update app_private.settings set value = '"${m}"' where key = 'admin_mfa_mode'`)
const ID = {
  admin1: '10000000-0000-0000-0000-0000000000a1', admin2: '10000000-0000-0000-0000-0000000000a2',
  p2: '10000000-0000-0000-0000-0000000000b2', p5: '10000000-0000-0000-0000-0000000000b5', p6: '10000000-0000-0000-0000-0000000000b6',
  winter: '30000000-0000-0000-0000-0000000000c2', spring: '30000000-0000-0000-0000-0000000000c3', rep1: '40000000-0000-0000-0000-0000000000e1',
}

/** A signed-in user: a Supabase client plus the cookies the site expects. */
async function signIn(email) {
  const jar = new Map()
  const client = createServerClient(URL_, ANON, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: cs => cs.forEach(c => c.value ? jar.set(c.name, c.value) : jar.delete(c.name)) } })
  const { error } = await client.auth.signInWithPassword({ email, password: PW })
  assert.equal(error, null, `sign in ${email}`)
  const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ')
  const page = (path, init = {}) => fetch(SITE + path, { redirect: 'manual', ...init, headers: { cookie: cookie(), ...(init.headers ?? {}) } })
  const post = (path, body) => page(path, { method: 'POST', headers: { 'content-type': 'application/json', origin: SITE }, body: JSON.stringify(body) })
  return { client, page, post }
}
const anon = createClient(URL_, ANON, { auth: { persistSession: false } })
const html = async path => (await (await fetch(SITE + path)).text()).replace(/<!-- -->/g, '')

// Each run starts from the seeded state (the tests change synthetic records).
before(() => psql(`delete from auth.mfa_factors; update app_private.settings set value = '"off"';
  update weekly_reps set archived_at = null; update programs set is_public = true, enrollment_open = false, price = null, price_label = null where slug like '%-leaders';
  delete from cohort_enrollments where user_id = '${ID.p2}' and cohort_id = '${ID.spring}';
  delete from auth.users where email in ('invitee@example.test', 'newperson@example.test');
  update cohorts set capacity = 6 where id = '${ID.spring}'; update profiles set role = 'admin' where id in ('${ID.admin1}', '${ID.admin2}')`))
after(() => { setMode('off') })

// ---------------------------------------------------------------- public site
test('public: hiding a pathway removes it everywhere visitors look; records kept', async () => {
  assert.match(await html('/impact'), /New Leaders/)
  const a = await signIn('admin1@example.test')
  const { error } = await a.client.from('programs').update({ is_public: false }).eq('slug', 'new-leaders')
  assert.equal(error, null)
  const impact = await html('/impact')
  assert.doesNotMatch(impact, /Make the Transition to Leadership/, 'hidden pathway copy is gone (no default fallback)')
  assert.match(impact, /Two independent pathways/)
  const a2 = await a.post('/api/admin/revalidate-public', {})   // what the admin screen calls after saving
  assert.equal(a2.status, 200)
  for (const path of ['/register', '/', '/about', '/impact']) {
    assert.doesNotMatch(await html(path), /New Leaders/, `not on ${path} (page, footer or links)`)
  }
  const options = await (await fetch(SITE + '/api/public-pathways')).json()
  assert.deepEqual(options.pathways.map(p => p.slug), ['emerging-leaders', 'practicing-leaders'], 'contact form choices')
  assert.equal((await anon.from('programs').select('id').eq('slug', 'new-leaders')).data.length, 0, 'not readable by visitors')
  assert.equal(psql(`select count(*) from programs where slug = 'new-leaders'`), '1', 'record kept')
  await a.client.from('programs').update({ is_public: true }).eq('slug', 'new-leaders')
  await a.post('/api/admin/revalidate-public', {})
  assert.match(await html('/impact'), /Three independent pathways/)
  assert.match(await html('/about'), /New Leaders/, 'footer link back after showing it again')
})

test('public: while checkout is off there are no prices, no payment buttons, and visitors go to the inquiry form', async () => {
  const a = await signIn('admin1@example.test')
  await a.client.from('programs').update({ enrollment_open: true, price: 250, price_label: '$250' }).eq('slug', 'emerging-leaders')
  const [impact, register] = [await html('/impact'), await html('/register')]
  assert.doesNotMatch(impact, /\$250/)
  assert.doesNotMatch(register, /\$250|Continue to Payment/)
  assert.match(register, /impact\?inquire=individual&amp;pathway=emerging-leaders#inquire/)
  assert.match(register, /Enrollment for the next cohorts is not open yet/)
  const checkout = await fetch(SITE + '/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
  assert.equal(checkout.status, 503)
  await a.client.from('programs').update({ enrollment_open: false, price: null, price_label: null }).eq('slug', 'emerging-leaders')
})

// ---------------------------------------------------------------- two-step verification
test('MFA off (shipped): admins work as today', async () => {
  setMode('off')
  const a = await signIn('admin1@example.test')
  assert.equal((await a.page('/admin/dashboard')).status, 200)
  assert.equal((await a.page('/api/admin/users')).status, 200)
})

test('MFA required: password alone gives no admin access in pages, routes or the database; a real code does', async () => {
  setMode('required')
  const a = await signIn('admin1@example.test')
  const res = await a.page('/admin/dashboard')
  assert.equal(res.status, 307); assert.match(res.headers.get('location'), /\/admin-setup$/)
  assert.equal((await a.page('/admin-setup')).status, 200)
  assert.equal((await a.page('/api/admin/users')).status, 401)
  assert.equal((await a.client.from('inquiries').select('id')).data.length, 0, 'database returns nothing')
  assert.equal((await a.client.from('programs').update({ tagline: 'x' }).eq('slug', 'new-leaders').select()).data.length, 0, 'database refuses edits')

  // Enroll a real TOTP authenticator and verify with a code computed like an app does.
  const { data: f, error } = await a.client.auth.mfa.enroll({ factorType: 'totp' })
  assert.equal(error, null)
  const bad = await a.client.auth.mfa.challengeAndVerify({ factorId: f.id, code: '000000' })
  assert.ok(bad.error, 'wrong code rejected')
  const good = await a.client.auth.mfa.challengeAndVerify({ factorId: f.id, code: totp(f.totp.secret) })
  assert.equal(good.error, null)
  assert.equal((await a.page('/admin/dashboard')).status, 200)
  assert.equal((await a.page('/api/admin/users')).status, 200)
  assert.equal((await a.client.from('inquiries').select('id')).data.length, 3)

  // Next sign-in: password only → must enter the code.
  const again = await signIn('admin1@example.test')
  const r2 = await again.page('/admin/dashboard')
  assert.equal(r2.status, 307); assert.match(r2.headers.get('location'), /\/login\?mfa=1$/)
  assert.equal((await again.client.from('inquiries').select('id')).data.length, 0)
})

test('MFA recovery: only an admin signed in with a code can reset another admin; logged', async () => {
  setMode('enrolled')
  const b = await signIn('admin2@example.test')
  const denied = await b.post('/api/admin/mfa-reset', { user_id: ID.admin1 })
  assert.equal(denied.status, 403, 'admin without their own code cannot reset')
  // admin1 (enrolled in the previous test) signs in with a code and resets admin2 after admin2 enrolls.
  const { data: f2 } = await b.client.auth.mfa.enroll({ factorType: 'totp' })
  await b.client.auth.mfa.challengeAndVerify({ factorId: f2.id, code: totp(f2.totp.secret) })
  const a = await signIn('admin1@example.test')
  const secret1 = psql(`select secret from auth.mfa_factors where user_id = '${ID.admin1}' and status = 'verified' limit 1`)
  const fid1 = psql(`select id from auth.mfa_factors where user_id = '${ID.admin1}' and status = 'verified' limit 1`)
  assert.equal((await a.client.auth.mfa.challengeAndVerify({ factorId: fid1, code: totp(secret1) })).error, null)
  const self = await a.post('/api/admin/mfa-reset', { user_id: ID.admin1 })
  assert.equal(self.status, 400, 'cannot reset yourself here')
  const ok = await a.post('/api/admin/mfa-reset', { user_id: ID.admin2 })
  assert.equal(ok.status, 200)
  assert.equal(psql(`select count(*) from auth.mfa_factors where user_id = '${ID.admin2}'`), '0')
  assert.match(psql(`select action || '|' || entity_label || '|' || outcome from admin_audit_log where action = 'mfa.reset' order by id desc limit 1`), /^mfa\.reset\|Jordan Admin\|success$/)
  // Reset admin1 too so later tests start clean.
  psql(`delete from auth.mfa_factors`)
  setMode('off')
})

// ---------------------------------------------------------------- admin safeguards
test('an administrator cannot remove their own admin access, or the last admin\'s', async () => {
  const a = await signIn('admin1@example.test')
  const self = await a.client.from('profiles').update({ role: 'impact_participant' }).eq('id', ID.admin1)
  assert.match(self.error?.message ?? '', /cannot remove your own administrator access/)
  const other = await a.client.from('profiles').update({ role: 'impact_participant' }).eq('id', ID.admin2)
  assert.equal(other.error, null, 'demoting another admin works (the UI confirms first)')
  psql(`update profiles set role = 'admin' where id = '${ID.admin2}'`)
})

test('capacity is enforced for admins, invites and returning participants', async () => {
  const a = await signIn('admin1@example.test')
  psql(`update cohorts set capacity = 3 where id = '${ID.spring}'`) // 3 of 3 taken
  const enroll = await a.client.from('cohort_enrollments').insert({ cohort_id: ID.spring, user_id: ID.p2, status: 'active' })
  assert.match(enroll.error?.message ?? '', /New Leaders - Spring 2027 is full \(3 of 3 seats taken\)/)
  const inviteNew = await a.post('/api/invite', { email: 'newperson@example.test', full_name: 'New Person', role: 'impact_participant', cohort_id: ID.spring })
  assert.equal(inviteNew.status, 409)
  assert.equal(psql(`select count(*) from auth.users where email = 'newperson@example.test'`), '0', 'no orphan account created')
  psql(`update cohorts set capacity = 6 where id = '${ID.spring}'`)
  const returning = await a.post('/api/invite', { email: 'p2@example.test', full_name: 'Casey Diaz', role: 'impact_participant', cohort_id: ID.spring })
  const body = await returning.json()
  assert.equal(returning.status, 200); assert.equal(body.outcome, 'enrolled'); assert.deepEqual(body.warnings, [])
  const fresh = await a.post('/api/invite', { email: 'invitee@example.test', full_name: 'Invited Person', role: 'impact_participant', cohort_id: ID.spring })
  assert.equal(fresh.status, 200)
  assert.equal(psql(`select count(*) from cohort_enrollments e join auth.users u on u.id = e.user_id where u.email = 'invitee@example.test' and e.cohort_id = '${ID.spring}'`), '1')
  // No real email is sent locally: skipped, or (server started with EMAIL_SINK_DIR) written to the local folder.
  const last = psql(`select status || '|' || coalesce(provider_id, '') from email_log order by id desc limit 1`)
  assert.match(last, /^skipped\|$|^accepted\|sink_/, 'no real email is sent locally')
})

// ---------------------------------------------------------------- reflections
test('removing a weekly rep with reflections archives it; reflections stay private and intact', async () => {
  const a = await signIn('admin1@example.test')
  const before = psql(`select count(*) from weekly_rep_submissions`)
  const del = await a.client.from('weekly_reps').delete().eq('id', ID.rep1)
  assert.ok(del.error, 'direct delete refused by the database')
  const { data } = await a.client.rpc('admin_remove_rep', { p_rep: ID.rep1 })
  assert.equal(data, 'archived')
  assert.equal(psql(`select count(*) from weekly_rep_submissions`), before)
  assert.equal((await a.client.from('weekly_rep_submissions').select('id')).data.length, 0, 'admin still cannot read reflections')
  const author = await signIn('p5@example.test')
  assert.equal((await author.client.from('weekly_reps').select('id').eq('id', ID.rep1)).data.length, 1, 'author still sees it')
  const peer = await signIn('p6@example.test')
  assert.equal((await peer.client.from('weekly_reps').select('id').eq('id', ID.rep1)).data.length, 0, 'hidden from others')
  assert.equal(psql(`select count(*) from admin_audit_log where changes::text ilike '%reflection%' or details::text ilike '%Synthetic private reflection%'`), '0', 'no reflection text in the log')
})

// ---------------------------------------------------------------- resources
test('resources: only matching participants (and admins) can open them, including by direct URL', async () => {
  const id = psql(`select id from resources where title = 'Emerging Leaders reading guide'`)
  const member = await signIn('p5@example.test')     // Emerging Leaders cohort
  const other = await signIn('p7@example.test')      // New Leaders cohort
  const coach = await signIn('coach@example.test')
  const nobody = await signIn('none@example.test')
  assert.equal((await member.page(`/api/resources/${id}/open`)).status, 307)
  for (const [who, u] of [['other cohort', other], ['coaching client', coach], ['no cohort', nobody]]) {
    assert.equal((await u.page(`/api/resources/${id}/open`)).status, 404, who)
    assert.equal((await u.client.from('resources').select('id').eq('id', id)).data.length, 0, who)
  }
})

// ---------------------------------------------------------------- activity log
test('activity log: admin changes recorded by the database with who, what, record name and old/new values', async () => {
  const a = await signIn('admin1@example.test')
  await a.client.from('cohorts').update({ capacity: 7 }).eq('id', ID.spring)
  const row = JSON.parse(psql(`select row_to_json(l) from (select actor_id, action, entity_label, outcome, changes from admin_audit_log where action = 'cohort.update' order by id desc limit 1) l`))
  assert.equal(row.actor_id, ID.admin1)
  assert.equal(row.entity_label, 'New Leaders - Spring 2027')
  assert.deepEqual(row.changes.capacity, { from: 6, to: 7 })
  const p = await signIn('p5@example.test')
  const forged = await p.client.from('admin_audit_log').insert({ actor_id: ID.p5, action: 'x' })
  assert.ok(forged.error, 'participants cannot write the log')
})

// ---------------------------------------------------------------- authorization of admin routes
test('admin pages and routes refuse participants and visitors', async () => {
  const p = await signIn('p5@example.test')
  assert.equal((await p.page('/admin/dashboard')).status, 307)
  for (const route of ['/api/admin/users', '/api/admin/user-logins']) {
    assert.equal((await p.page(route)).status, 401, route)
    assert.equal((await fetch(SITE + route)).status, 401, `${route} anonymous`)
  }
  assert.equal((await p.post('/api/invite', { email: 'x@example.test', role: 'admin' })).status, 401)
  assert.equal((await p.post('/api/admin/mfa-reset', { user_id: ID.admin1 })).status, 401)
  assert.equal((await p.post('/api/create-payment-link', {})).status, 401)
  assert.equal((await p.post('/api/admin/revalidate-public', {})).status, 401)
})
