// Compatibility probe for migration 2e: the database calls made by the DEPLOYED release (2d, main
// 91d7f23) for admins, participants and coaching clients. Run it against the local stack with
// 2d only and again with 2e applied, then compare: every difference must be an intended 2e change.
//   set -a; . /tmp/tlc-local-stack/env.local; set +a; node tests/e2e/compat-2e.mjs > /tmp/compat-<label>.txt
// Synthetic data only (local stack seed); refuses to run against anything but 127.0.0.1.
import { createClient } from '@supabase/supabase-js'
const { NEXT_PUBLIC_SUPABASE_URL: U, NEXT_PUBLIC_SUPABASE_ANON_KEY: A } = process.env
if (!U?.startsWith('http://127.0.0.1')) throw new Error('local stack only')
const PW = 'LocalTest-only-1!'
const C = { fall: '30000000-0000-0000-0000-0000000000c1', winter: '30000000-0000-0000-0000-0000000000c2', spring: '30000000-0000-0000-0000-0000000000c3' }
const P = { p2: '10000000-0000-0000-0000-0000000000b2', p3: '10000000-0000-0000-0000-0000000000b3', p5: '10000000-0000-0000-0000-0000000000b5', p6: '10000000-0000-0000-0000-0000000000b6' }
// The deployed portal's column list (participants cannot read the meeting-link column since phase 2b).
const COHORT_COLUMNS = 'id, program_id, name, start_date, end_date, status, created_at, session_day, session_time, includes, expectations, book_title, book_image_url, book_purchase_url, description'
const REP_WINTER = '40000000-0000-0000-0000-0000000000e2'
const lines = []
const report = (who, what, r) => lines.push(`${who.padEnd(12)} ${what.padEnd(58)} ${r.error ? 'refused: ' + (r.error.message || r.error.code).slice(0, 90) : 'ok' + (Array.isArray(r.data) ? ` (${r.data.length} rows)` : '')}`)
async function as(email) {
  const c = createClient(U, A, { auth: { persistSession: false } })
  const { data, error } = await c.auth.signInWithPassword({ email, password: PW })
  if (error) throw new Error(`sign in ${email}: ${error.message}`)
  return { c, id: data.user.id }
}

// ---- participant in a running cohort (Winter): the 2d portal's reads and writes
{
  const { c, id } = await as('p5@example.test')
  report('participant', 'read own enrollments', await c.from('cohort_enrollments').select(`*, cohorts!inner(${COHORT_COLUMNS}, programs(*))`).eq('user_id', id).eq('status', 'active'))
  report('participant', 'read Winter weekly reps', await c.from('weekly_reps').select('*').eq('cohort_id', C.winter))
  report('participant', 'read own rep submissions', await c.from('weekly_rep_submissions').select('*').eq('user_id', id))
  report('participant', 'read community (Winter)', await c.from('community_posts').select('*, profiles(full_name, role), community_likes(user_id), community_comments(*, profiles(full_name, role))').eq('cohort_id', C.winter))
  report('participant', 'read cohort members (Winter)', await c.from('cohort_enrollments').select('user_id, profiles(full_name)').eq('cohort_id', C.winter).eq('status', 'active'))
  report('participant', 'read cohort chat (Winter)', await c.from('cohort_messages').select('*, profiles(full_name)').eq('cohort_id', C.winter))
  report('participant', 'read announcements', await c.from('announcements').select('*'))
  report('participant', 'read own certificates', await c.from('certificates').select('*, programs(name)').eq('user_id', id))
  report('participant', 'submit weekly rep (Winter)', await c.from('weekly_rep_submissions').insert({ rep_id: REP_WINTER, user_id: id, reflection: 'compat probe' }).select('id'))
  report('participant', 'write journal entry', await c.from('journal_entries').insert({ user_id: id, portal_type: 'impact', body: 'compat probe' }).select('id'))
  const post = await c.from('community_posts').insert({ user_id: id, cohort_id: C.winter, body: 'compat probe' }).select('id').single()
  report('participant', 'post in community (Winter)', post)
  if (post.data) {
    report('participant', 'edit own post', await c.from('community_posts').update({ body: 'compat probe edited' }).eq('id', post.data.id).select('id'))
    report('participant', 'comment on post', await c.from('community_comments').insert({ post_id: post.data.id, user_id: id, body: 'compat probe' }).select('id'))
    report('participant', 'like post', await c.from('community_likes').insert({ post_id: post.data.id, user_id: id }).select('post_id'))
    report('participant', 'unlike post', await c.from('community_likes').delete().eq('post_id', post.data.id).eq('user_id', id).select('post_id'))
    report('participant', 'delete own post', await c.from('community_posts').delete().eq('id', post.data.id).select('id'))
  }
  report('participant', 'cohort chat message (Winter)', await c.from('cohort_messages').insert({ cohort_id: C.winter, user_id: id, content: 'compat probe' }).select('id'))
}

// ---- participant whose only cohort has finished (like the six Fall 2026 participants)
{
  const { c, id } = await as('p2@example.test')
  report('past (Fall)', 'read own enrollments', await c.from('cohort_enrollments').select(`*, cohorts!inner(${COHORT_COLUMNS}, programs(*))`).eq('user_id', id).eq('status', 'active'))
  report('past (Fall)', 'read Fall weekly reps', await c.from('weekly_reps').select('*').eq('cohort_id', C.fall))
  report('past (Fall)', 'read own rep submissions', await c.from('weekly_rep_submissions').select('*').eq('user_id', id))
  report('past (Fall)', 'read own journal', await c.from('journal_entries').select('*').eq('user_id', id))
  report('past (Fall)', 'read Fall community', await c.from('community_posts').select('*').eq('cohort_id', C.fall))
  report('past (Fall)', 'write journal entry (not tied to a cohort)', await c.from('journal_entries').insert({ user_id: id, portal_type: 'impact', body: 'compat probe' }).select('id'))
  report('past (Fall)', 'post in finished cohort', await c.from('community_posts').insert({ user_id: id, cohort_id: C.fall, body: 'compat probe' }).select('id'))
  report('past (Fall)', 'chat in finished cohort', await c.from('cohort_messages').insert({ cohort_id: C.fall, user_id: id, content: 'compat probe' }).select('id'))
}

// ---- coaching client: the 2d coaching portal's reads and writes
{
  const { c, id } = await as('coach@example.test')
  report('coaching', 'read own profile', await c.from('profiles').select('id, full_name, role').eq('id', id))
  report('coaching', 'find Tramaine (admin) to message', await c.from('profiles').select('id, full_name, role').eq('role', 'admin'))
  report('coaching', 'read announcements', await c.from('announcements').select('*').or('target_role.eq.coaching_client,cohort_id.is.null'))
  report('coaching', 'read resources', await c.from('resources').select('*').or('portal_type.eq.coaching,portal_type.eq.both'))
  report('coaching', 'read messages', await c.from('messages').select('*, profiles!messages_sender_id_fkey(full_name)').or(`sender_id.eq.${id},recipient_id.eq.${id}`))
  const admin = (await c.from('profiles').select('id').eq('role', 'admin').limit(1)).data?.[0]
  report('coaching', 'send message to Tramaine', await c.from('messages').insert({ sender_id: id, recipient_id: admin?.id, body: 'compat probe' }).select('id'))
  report('coaching', 'weekly check-in', await c.from('weekly_checkins').insert({ client_id: id, went_well: 'compat probe', challenging: '-', progress: '-', focus_today: '-', anything_changed: '-' }).select('id'))
}

// ---- administrator: the 2d admin panel's reads and writes
{
  const { c } = await as('admin1@example.test')
  for (const [n, q] of [
    ['read enrollments with people', c.from('cohort_enrollments').select('*, profiles(full_name, role), cohorts(name)')],
    ['read certificates with people', c.from('certificates').select('*, profiles(full_name), programs(name)')],
    ['read registrations', c.from('registrations').select('*, programs(name, price_label), cohorts(name)')],
    ['read inquiries', c.from('inquiries').select('*')],
    ['read coaching messages', c.from('messages').select('*, profiles!messages_sender_id_fkey(full_name)')],
    ['read coaching check-ins', c.from('weekly_checkins').select('*')],
    ['read activity log', c.from('admin_audit_log').select('*')],
    ['read email log', c.from('email_log').select('*')],
  ]) report('admin', n, await q)
  report('admin', 'enroll a participant (Spring)', await c.from('cohort_enrollments').insert({ cohort_id: C.spring, user_id: P.p6, status: 'active' }).select('id'))
  report('admin', 'withdraw that enrollment', await c.from('cohort_enrollments').update({ status: 'withdrawn' }).eq('cohort_id', C.spring).eq('user_id', P.p6).select('id'))
  report('admin', 'issue certificate, completion not recorded', await c.from('certificates').insert({ user_id: P.p3, cohort_id: C.fall, program_id: null }).select('id'))
  report('admin', 'set enrollment status to completed', await c.from('cohort_enrollments').update({ status: 'completed' }).eq('cohort_id', C.fall).eq('user_id', P.p3).select('id'))
  report('admin', 'issue certificate after completion', await c.from('certificates').insert({ user_id: P.p3, cohort_id: C.fall }).select('id'))
  report('admin', 'post an announcement', await c.from('announcements').insert({ title: 'compat probe', body: 'compat probe', cohort_id: C.winter }).select('id'))
  report('admin', 'update cohort details', await c.from('cohorts').update({ description: 'compat probe' }).eq('id', C.spring).select('id'))
  report('admin', 'update a registration status', await c.from('registrations').update({ status: 'confirmed' }).neq('id', '00000000-0000-0000-0000-000000000000').select('id'))
}

// ---- the 2d daily cron (service role, direct update)
{
  const svc = createClient(U, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  report('cron (2d)', 'service role updates cohort status directly', await svc.from('cohorts').update({ status: 'active' }).eq('id', C.winter).select('id'))
}
console.log(lines.join('\n'))
