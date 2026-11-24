// End-to-end journeys (release 2e) against the LOCAL stack and a local production build on :3999
// started with EMAIL_SINK_DIR set, so emails are written to a folder instead of being sent.
// Synthetic data only; refuses to run against anything but 127.0.0.1.
//   set -a; . /tmp/tlc-local-stack/env.local; . /tmp/tlc-local-stack/secret.env; set +a
//   EMAIL_SINK_DIR=/tmp/tlc-local-stack/mail node --test tests/e2e/journeys.test.mjs
// Each journey goes through the same routes and database rules the screens use: public inquiry
// → admin follow-up → invitation (email link) → password set-up → portal data → participation →
// completion → certificate → alumni access; plus organizations, failures/resends and isolation.
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

const SITE = process.env.SITE_URL ?? 'http://localhost:3999'
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const PG = process.env.PG_URL
const SINK = process.env.EMAIL_SINK_DIR ?? '/tmp/tlc-local-stack/mail'
const PW = 'LocalTest-only-1!'
assert.ok(URL_?.startsWith('http://127.0.0.1'), 'refusing to run against anything but the local stack')

const psql = q => execFileSync('psql', ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', PG, '-c', q], { encoding: 'utf8' }).trim()
const ID = {
  admin1: '10000000-0000-0000-0000-0000000000a1', p1: '10000000-0000-0000-0000-0000000000b1', p2: '10000000-0000-0000-0000-0000000000b2',
  p5: '10000000-0000-0000-0000-0000000000b5', p7: '10000000-0000-0000-0000-0000000000b7',
  fall: '30000000-0000-0000-0000-0000000000c1', winter: '30000000-0000-0000-0000-0000000000c2', spring: '30000000-0000-0000-0000-0000000000c3',
  rep1: '40000000-0000-0000-0000-0000000000e1', rep2: '40000000-0000-0000-0000-0000000000e2',
}
const NEW_PEOPLE = ['journey.alex@example.test', 'org.one@example.test', 'org.two@example.test', 'org.three@example.test', 'resend.robin@example.test']

/** A signed-in user: a Supabase client plus the site's session cookies. */
async function signIn(email, password = PW) {
  const jar = new Map()
  const client = createServerClient(URL_, ANON, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: cs => cs.forEach(c => c.value ? jar.set(c.name, c.value) : jar.delete(c.name)) } })
  const { error } = await client.auth.signInWithPassword({ email, password })
  assert.equal(error, null, `sign in ${email}`)
  const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ')
  const page = (p, init = {}) => fetch(SITE + p, { redirect: 'manual', ...init, headers: { cookie: cookie(), ...(init.headers ?? {}) } })
  const post = async (p, body) => { const r = await page(p, { method: 'POST', headers: { 'content-type': 'application/json', origin: SITE }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json().catch(() => ({})) } }
  return { client, page, post }
}
const anon = createClient(URL_, ANON, { auth: { persistSession: false } })
const key = () => crypto.randomUUID()

/** The newest email in the sink for an address. */
function mailFor(to) {
  const files = readdirSync(SINK).filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(path.join(SINK, f), 'utf8')))
  return files.filter(m => m.to.toLowerCase() === to.toLowerCase()).sort((a, b) => a.at.localeCompare(b.at)).at(-1)
}
/** Follows an emailed one-time link, then sets a password the way the /reset page does. */
async function acceptLink(mail, password) {
  const link = mail.html.match(/href="(http:\/\/127\.0\.0\.1:54321\/local-link\/[^"]+)"/)?.[1]
  assert.ok(link, 'email contains a set-up link')
  const r = await fetch(link, { redirect: 'manual' })
  const loc = r.headers.get('location')
  assert.match(loc, /\/reset\?type=(invite|recovery)/, 'the link lands on the set-password page')
  const hash = new URLSearchParams(loc.split('#')[1])
  assert.ok(hash.get('access_token'), 'link signs them in once')
  const c = createClient(URL_, ANON, { auth: { persistSession: false } })
  await c.auth.setSession({ access_token: hash.get('access_token'), refresh_token: hash.get('refresh_token') })
  const { error } = await c.auth.updateUser({ password })
  assert.equal(error, null, 'password set')
  const again = await fetch(link, { redirect: 'manual' })
  assert.match(again.headers.get('location'), /error_code=otp_expired/, 'the link works only once')
}

before(() => {
  rmSync(SINK, { recursive: true, force: true }); mkdirSync(SINK, { recursive: true })
  psql(`delete from public.inquiry_participants; delete from public.inquiries where email like '%journey%' or organization like 'TEST %';
    delete from auth.users where email in (${NEW_PEOPLE.map(e => `'${e}'`).join(',')});
    delete from public.certificates; update public.cohort_enrollments set status = 'active' where status = 'completed';
    delete from public.cohort_enrollments where (user_id = '${ID.p5}' and cohort_id = '${ID.spring}') or (user_id = '${ID.p1}' and cohort_id = '${ID.winter}');
    update public.cohorts set capacity = 6, activity_open_until = null where id = '${ID.spring}';
    update public.cohorts set status = 'active', end_date = current_date + 28, activity_open_until = null where id = '${ID.winter}';
    delete from public.weekly_rep_submissions where rep_id = '${ID.rep2}';
    update app_private.settings set value = '"off"' where key = 'admin_mfa_mode';
    delete from public.email_log; delete from app_private.rate_limits;`)
})

// ---------------------------------------------------------------- Journey A
test('Journey A: inquiry → follow-up → invitation → account set-up → portal → work → completion → certificate → alumni access', async () => {
  // 1. A visitor sends an individual inquiry from the public page.
  const inq = await fetch(SITE + '/api/inquiries', { method: 'POST', headers: { 'content-type': 'application/json', origin: SITE },
    body: JSON.stringify({ kind: 'individual', contact_name: 'Alex Journey', email: 'journey.alex@example.test', pathways: ['emerging-leaders'], message: 'Synthetic journey test', website: '' }) })
  assert.equal(inq.status, 200, 'inquiry accepted')
  const inquiryId = psql(`select id from inquiries where email = 'journey.alex@example.test'`)
  assert.ok(inquiryId)

  // 2. Tramaine follows up (status, date, note) as an admin.
  const a = await signIn('admin1@example.test')
  assert.equal((await a.client.from('inquiries').update({ status: 'contacted', follow_up_on: new Date().toISOString().slice(0, 10) }).eq('id', inquiryId).select('id')).data.length, 1)
  assert.equal((await a.client.from('inquiry_notes').insert({ inquiry_id: inquiryId, author_id: ID.admin1, body: 'Called; wants Winter cohort' }).select('id')).error, null)

  // 3. Invite to a cohort from the inquiry (no retyping): account + enrollment + invitation email.
  const inv = await a.post('/api/invite', { email: 'journey.alex@example.test', full_name: 'Alex Journey', role: 'impact_participant', cohort_id: ID.winter, inquiry_id: inquiryId, idempotency_key: key() })
  assert.equal(inv.status, 200, JSON.stringify(inv.body))
  assert.equal(inv.body.outcome, 'invited')
  assert.equal(inv.body.email.status, 'accepted')
  assert.match(inv.body.message, /enrolled in Emerging Leaders - Winter 2027/)
  const alexId = inv.body.user_id
  assert.equal(psql(`select result || '|' || (user_id = '${alexId}') from inquiry_participants where inquiry_id = '${inquiryId}'`), 'invited|true', 'linked to the inquiry')
  assert.equal(psql(`select status from inquiries where id = '${inquiryId}'`), 'contacted', 'not marked Converted automatically')
  assert.equal(psql(`select related_user_id = '${alexId}' from email_log where template = 'invite' and status = 'accepted'`), 't', 'email logged against the person')
  assert.doesNotMatch(psql(`select coalesce(subject,'') || coalesce(error,'') from email_log where template = 'invite'`), /local-link|token/, 'no links in the log')

  // 4. Account set-up through the emailed link (fresh, one-time), then sign in.
  const mail = mailFor('journey.alex@example.test')
  assert.equal(mail.template, 'invite')
  assert.match(mail.html, /enrolled in <strong>Emerging Leaders - Winter 2027/)
  await acceptLink(mail, 'Journey-Alex-pass-1')
  const alex = await signIn('journey.alex@example.test', 'Journey-Alex-pass-1')

  // 5. Portal data: their cohort, sessions, reps, resources; not other cohorts.
  assert.equal((await alex.client.from('cohort_enrollments').select('cohort_id').eq('user_id', alexId)).data.length, 1)
  assert.equal((await alex.client.from('weekly_reps').select('id').eq('cohort_id', ID.winter)).data.length, 2)
  assert.ok((await alex.client.from('resources').select('id')).data.length >= 1, 'Emerging Leaders materials')
  assert.equal((await alex.client.from('weekly_reps').select('id').eq('cohort_id', ID.spring)).data.length, 0, 'cohort isolation')

  // 6. Learning activity: submits a rep; the admin sees who submitted, never the text.
  assert.equal((await alex.client.from('weekly_rep_submissions').insert({ rep_id: ID.rep2, user_id: alexId, reflection: 'Synthetic private reflection' }).select('id')).error, null)
  const part = await a.client.rpc('admin_cohort_participation', { p_cohort: ID.winter })
  assert.equal(part.error, null)
  assert.ok(part.data.some(r => r.user_id === alexId && r.rep_id === ID.rep2 && r.submitted_at))
  assert.ok(!JSON.stringify(part.data).includes('Synthetic private reflection'), 'no reflection text for admins')
  assert.equal((await a.client.from('weekly_rep_submissions').select('reflection').eq('user_id', alexId)).data.length, 0, 'admins cannot read reflections')

  // 7. Certificates need recorded completion; completion is recorded by an admin with name and date.
  const early = await a.client.from('certificates').insert({ user_id: alexId, cohort_id: ID.winter }).select('id')
  assert.match(early.error?.message ?? '', /Mark their program complete/)
  const done = await a.client.from('cohort_enrollments').update({ status: 'completed', completion_note: 'Synthetic' }).eq('user_id', alexId).eq('cohort_id', ID.winter).select('completed_at, completed_by')
  assert.equal(done.data[0].completed_by, ID.admin1); assert.ok(done.data[0].completed_at)
  const cert = await a.client.from('certificates').insert({ user_id: alexId, cohort_id: ID.winter }).select('id, certificate_number, participant_name, pathway_name, cohort_name').single()
  assert.equal(cert.error, null)
  assert.match(cert.data.certificate_number, /^TLC-\d{4}-\d{4}$/)
  assert.deepEqual([cert.data.participant_name, cert.data.pathway_name, cert.data.cohort_name], ['Alex Journey', 'Emerging Leaders', 'Emerging Leaders - Winter 2027'])
  const dup = await a.client.from('certificates').insert({ user_id: alexId, cohort_id: ID.winter }).select('id')
  assert.ok(dup.error, 'no duplicate certificate')

  // 8. Download (PDF) for the participant; other participants and visitors get nothing.
  const pdf = await alex.page(`/api/certificates/${cert.data.id}/pdf`)
  assert.equal(pdf.status, 200); assert.equal(pdf.headers.get('content-type'), 'application/pdf')
  assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 4).toString(), '%PDF')
  const other = await signIn('p5@example.test')
  assert.equal((await other.page(`/api/certificates/${cert.data.id}/pdf`)).status, 404)
  assert.equal((await fetch(`${SITE}/api/certificates/${cert.data.id}/pdf`, { redirect: 'manual' })).status, 401)

  // 9. The cohort ends (daily job): alumni keep read access; activity is read-only; logged as system.
  const jobStart = psql(`select now()`)
  psql(`update cohorts set end_date = current_date - 1 where id = '${ID.winter}'; select * from public.system_update_cohort_statuses(); select * from public.system_update_cohort_statuses();`)
  assert.equal(psql(`select status from cohorts where id = '${ID.winter}'`), 'completed')
  // Audit history from earlier runs is kept, so count only this run's entries: one, even though the job ran twice.
  assert.equal(psql(`select actor_type || '|' || action from admin_audit_log where entity_id = '${ID.winter}' and action = 'cohort.status_auto' and created_at >= '${jobStart}'`), 'system|cohort.status_auto')
  assert.equal((await alex.client.from('weekly_reps').select('id').eq('cohort_id', ID.winter)).data.length, 2, 'still sees the program')
  assert.equal((await alex.client.from('weekly_rep_submissions').select('reflection').eq('user_id', alexId)).data[0].reflection, 'Synthetic private reflection', 'own work kept')
  assert.equal((await alex.client.from('certificates').select('id')).data.length, 1, 'certificate available after the cohort ends')
  const late = await alex.client.from('weekly_rep_submissions').update({ reflection: 'edited later' }).eq('user_id', alexId).select('id')
  assert.equal(late.data?.length ?? 0, 0, 'finished program is read-only')
})

// ---------------------------------------------------------------- Journey B
test('Journey B: a returning participant joins another cohort and keeps the earlier one', async () => {
  const a = await signIn('admin1@example.test')
  const r = await a.post('/api/invite', { email: 'p1@example.test', full_name: 'Avery Brooks', role: 'impact_participant', cohort_id: ID.winter.replace('c2', 'c2'), idempotency_key: key() })
  // Winter has just finished in Journey A, so it is no longer enrollable: the server says so plainly.
  assert.equal(r.status, 409); assert.equal(r.body.code, 'cohort_unavailable')
  const ok = await a.post('/api/invite', { email: 'p5@example.test', full_name: 'Finley Gray', role: 'impact_participant', cohort_id: ID.spring, idempotency_key: key() })
  assert.equal(ok.status, 200, JSON.stringify(ok.body)); assert.equal(ok.body.outcome, 'enrolled')
  assert.equal(ok.body.email.kind, 'enrolled_notice', 'someone who already signs in gets a notice, not an invitation')
  assert.match(mailFor('p5@example.test').html, /Your earlier programs and certificates are still in your portal/)
  const again = await a.post('/api/invite', { email: 'p5@example.test', full_name: 'Finley Gray', role: 'impact_participant', cohort_id: ID.spring, idempotency_key: key() })
  assert.equal(again.body.outcome, 'already_enrolled', 'no duplicate enrollment'); assert.equal(again.body.email, null, 'and no duplicate email')
  const p5 = await signIn('p5@example.test')
  const mine = (await p5.client.from('cohort_enrollments').select('cohort_id, status').eq('user_id', ID.p5)).data
  assert.deepEqual(mine.map(e => e.cohort_id).sort(), [ID.winter, ID.spring].sort(), 'current and earlier program both visible')
})

// ---------------------------------------------------------------- Journey C
test('Journey C: an organization enrolls several employees; results per person; capacity respected', async () => {
  const a = await signIn('admin1@example.test')
  const { data: inq } = await a.client.from('inquiries').insert({ kind: 'organization', contact_name: 'Riley HR', organization: 'TEST Example County', email: 'riley.journey@example.test', pathways: ['new-leaders'], participants_estimate: '2-5', status: 'qualified' }).select('id').single()
  writeFileSync(path.join(SINK, 'fail-addresses.txt'), 'org.three@example.test\n')
  psql(`update cohorts set capacity = 6 where id = '${ID.spring}'`) // p1, p7, p8, p5 = 4 seats taken
  const people = [['Org One', 'org.one@example.test'], ['Org Two', 'org.two@example.test'], ['Org Three', 'org.three@example.test']]
  const results = []
  for (const [full_name, email] of people) results.push(await a.post('/api/invite', { email, full_name, role: 'impact_participant', cohort_id: ID.spring, inquiry_id: inq.id, idempotency_key: key() }))
  assert.deepEqual(results.map(r => r.status), [200, 200, 409], 'third person: cohort full (6 of 6)')
  assert.equal(results[2].body.code, 'cohort_full')
  assert.equal(psql(`select string_agg(result, ',' order by email) from inquiry_participants where inquiry_id = '${inq.id}'`), 'invited,failed,invited', 'every person recorded on the inquiry (one, three, two)')
  assert.equal(psql(`select count(*) from auth.users where email = 'org.three@example.test'`), '0', 'no account created when there is no seat')
  // Raise capacity; the third person is invited but the email fails: enrolled, failure reported truthfully.
  psql(`update cohorts set capacity = 7 where id = '${ID.spring}'`)
  const third = await a.post('/api/invite', { email: 'org.three@example.test', full_name: 'Org Three', role: 'impact_participant', cohort_id: ID.spring, inquiry_id: inq.id, idempotency_key: key() })
  assert.equal(third.status, 200); assert.equal(third.body.email.status, 'failed')
  assert.match(third.body.message, /could not be sent/)
  assert.equal(psql(`select count(*) from email_log where template = 'invite' and status = 'failed' and resolved_at is null and related_user_id is not null`), '1', 'shows in Needs your attention')
  assert.equal(psql(`select count(*) from cohort_enrollments where cohort_id = '${ID.spring}' and status = 'active'`), '7', 'within capacity')
  assert.equal(psql(`select status from inquiries where id = '${inq.id}'`), 'qualified', 'inquiry status changes only when Tramaine chooses')
})

// ---------------------------------------------------------------- Journey E
test('Journey E: failed invitation → accurate warning → safe resend → valid link → set-up → enrolled', async () => {
  const a = await signIn('admin1@example.test')
  writeFileSync(path.join(SINK, 'fail-addresses.txt'), 'resend.robin@example.test\n')
  psql(`update cohorts set capacity = 10 where id = '${ID.spring}'`)
  const inv = await a.post('/api/invite', { email: 'resend.robin@example.test', full_name: 'Robin Resend', role: 'impact_participant', cohort_id: ID.spring, idempotency_key: key() })
  assert.equal(inv.status, 200); assert.equal(inv.body.email.status, 'failed')
  const robin = inv.body.user_id
  const logId = Number(psql(`select id from email_log where related_user_id = '${robin}' and status = 'failed'`))
  // Still failing → resend reports failure and the problem stays open.
  const r1 = await a.post('/api/admin/email-resend', { log_id: logId, idempotency_key: key() })
  assert.equal(r1.status, 502); assert.match(r1.body.message, /could not be sent/)
  assert.equal(psql(`select resolved_at is null from email_log where id = ${logId}`), 't')
  // Address fixed → resend accepted with a FRESH set-up link (not "sign in"); original resolved.
  writeFileSync(path.join(SINK, 'fail-addresses.txt'), '')
  const k = key()
  const r2 = await a.post('/api/admin/email-resend', { log_id: logId, idempotency_key: k })
  assert.equal(r2.status, 200, JSON.stringify(r2.body)); assert.equal(r2.body.kind, 'account_setup'); assert.equal(r2.body.status, 'accepted')
  assert.equal(psql(`select resolved_at is not null from email_log where id = ${logId}`), 't')
  const r3 = await a.post('/api/admin/email-resend', { log_id: logId, idempotency_key: key() })
  assert.equal(r3.status, 409, 'cannot be resent twice')
  const mail = mailFor('resend.robin@example.test')
  assert.equal(mail.template, 'account_setup'); assert.match(mail.html, /haven't chosen a password yet/)
  await acceptLink(mail, 'Robin-Resend-pass-1')
  const signedIn = await signIn('resend.robin@example.test', 'Robin-Resend-pass-1')
  assert.equal((await signedIn.client.from('cohort_enrollments').select('status').eq('cohort_id', ID.spring)).data.find(Boolean)?.status, 'active', 'enrollment verified')
  // "Send sign-in email" twice within two minutes asks first; the same key never sends twice.
  const s1 = await a.post('/api/admin/access-email', { user_id: robin, idempotency_key: k + 'x' })
  assert.equal(s1.status, 200); assert.equal(s1.body.kind, 'password_reset', 'after signing in, a reset (not set-up) link')
  const s2 = await a.post('/api/admin/access-email', { user_id: robin, idempotency_key: key() })
  assert.equal(s2.status, 409); assert.equal(s2.body.code, 'recently_sent')
  const s3 = await a.post('/api/admin/access-email', { user_id: robin, idempotency_key: k + 'x', force: true })
  assert.equal(s3.body.status, 'duplicate', 'same request key is never sent twice')
})

// ---------------------------------------------------------------- Journey F
test('Journey F: completed cohort keeps history private and read-only unless an admin reopens activity', async () => {
  const p2 = await signIn('p2@example.test')   // Fall 2026 (completed), like the six real participants
  assert.equal((await p2.client.from('cohort_enrollments').select('status').eq('cohort_id', ID.fall)).data[0].status, 'active', 'completion not assumed')
  assert.ok((await p2.client.from('cohorts').select('id, name').eq('id', ID.fall)).data.length === 1)
  const post = await p2.client.from('community_posts').insert({ cohort_id: ID.fall, user_id: ID.p2, body: 'TEST late post' }).select('id')
  assert.ok(post.error, 'no new posts in a finished cohort')
  const chat = await p2.client.from('cohort_messages').insert({ cohort_id: ID.fall, user_id: ID.p2, content: 'TEST' }).select('id')
  assert.ok(chat.error, 'no new chat messages')
  psql(`update cohorts set activity_open_until = current_date + 2 where id = '${ID.fall}'`)
  const reopened = await p2.client.from('community_posts').insert({ cohort_id: ID.fall, user_id: ID.p2, body: 'TEST post while reopened' }).select('id')
  assert.equal(reopened.error, null, 'allowed while an admin has reopened activity')
  psql(`delete from community_posts where body like 'TEST %'; update cohorts set activity_open_until = null where id = '${ID.fall}'`)
  // Withdrawn people see nothing of the cohort.
  const p4 = await signIn('p4@example.test')
  assert.equal((await p4.client.from('community_posts').select('id').eq('cohort_id', ID.fall)).data.length, 0)
})

// ---------------------------------------------------------------- security
test('security: admin-only routes, functions and tables refuse participants and visitors', async () => {
  const p = await signIn('p5@example.test')
  for (const [route, body] of [['/api/admin/access-email', { user_id: ID.p2 }], ['/api/admin/email-resend', { log_id: 1 }], ['/api/invite', { email: 'x@example.test', role: 'admin' }]]) {
    assert.equal((await p.post(route, body)).status, 401, route)
  }
  assert.ok((await p.client.rpc('admin_cohort_participation', { p_cohort: ID.winter })).error, 'participation is admin-only')
  assert.ok((await p.client.rpc('admin_resolve_email', { p_id: 1 })).error)
  for (const t of ['inquiry_participants', 'payment_requests', 'stripe_events', 'email_log', 'admin_audit_log']) {
    assert.equal((await p.client.from(t).select('*')).data?.length ?? 0, 0, `${t} hidden from participants`)
    assert.equal((await anon.from(t).select('*')).data?.length ?? 0, 0, `${t} hidden from visitors`)
  }
  assert.ok((await anon.rpc('system_update_cohort_statuses')).error, 'visitors cannot run the status job')
  assert.ok((await p.client.from('certificates').insert({ user_id: ID.p5, cohort_id: ID.winter }).select('id')).error, 'participants cannot issue certificates')
  assert.ok((await p.client.from('cohort_enrollments').update({ status: 'completed' }).eq('user_id', ID.p5).select('id')).data?.length === 0, 'or complete themselves')
  assert.equal((await fetch(`${SITE}/api/cron/update-cohort-statuses`)).status, 401)
})

// ---------------------------------------------------------------- joins the screens use
test('the joins the admin and portal screens use still work (no ambiguous links to profiles)', async () => {
  const a = await signIn('admin1@example.test')
  const p = await signIn('p1@example.test')
  for (const [who, c] of [['admin', a.client], ['participant', p.client]]) {
    for (const [table, sel] of [
      ['certificates', '*, profiles(full_name), programs(name)'],
      ['cohort_enrollments', '*, profiles(full_name, role), cohorts(name)'],
      ['cohort_enrollments', 'user_id, status, profiles(full_name)'],
      ['cohort_messages', '*, profiles(full_name), cohorts(name)'],
      ['community_posts', '*, profiles(full_name, role), cohorts(name), community_likes(user_id), community_comments(*, profiles(full_name, role))'],
    ]) {
      const { error } = await c.from(table).select(sel).limit(1)
      assert.equal(error, null, `${who}: ${table} ${sel}: ${error?.message}`)
    }
  }
})
