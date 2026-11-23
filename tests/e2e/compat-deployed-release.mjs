// Compatibility probe: the database calls made by the release deployed before 2d (a66b5da), run
// against the local stack with 2d applied.  set -a; . /tmp/tlc-local-stack/env.local; set +a; node tests/e2e/compat-deployed-release.mjs
import { createClient } from '@supabase/supabase-js'
const { NEXT_PUBLIC_SUPABASE_URL: U, NEXT_PUBLIC_SUPABASE_ANON_KEY: A } = process.env
const results = []
const check = (name, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`)
const anon = createClient(U, A, { auth: { persistSession: false } })
// Public pages (old code)
let r = await anon.from('programs').select('id, slug, pathway_number, name, tagline, opening_statement, audience, description, leadership_goal, keywords, price_label, enrollment_open, is_public').in('slug', ['emerging-leaders', 'new-leaders', 'practicing-leaders'])
check('old /impact pathway query', !r.error && r.data.length === 3)
r = await anon.from('programs').select('*').eq('type', 'cohort').order('sort_order')
check('old /register programs query', !r.error && r.data.every(p => p.is_public), `(${r.data?.length} public rows)`)
r = await anon.from('cohorts').select('id, program_id, name, start_date, end_date, status, session_day, session_time, created_at, includes, expectations, book_title, book_image_url, book_purchase_url, description, programs(*)').in('status', ['upcoming'])
check('old /register cohorts query', !r.error)
// Old admin panel
const admin = createClient(U, A, { auth: { persistSession: false } })
await admin.auth.signInWithPassword({ email: 'admin1@example.test', password: 'LocalTest-only-1!' })
const COH = 'id, program_id, name, start_date, end_date, status, created_at, session_day, session_time, includes, expectations, book_title, book_image_url, book_purchase_url, description, capacity'
for (const [n, q] of [
  ['programs', admin.from('programs').select('*').order('name')],
  ['cohorts', admin.from('cohorts').select(`${COH}, programs(name)`)],
  ['reps', admin.from('weekly_reps').select('*, cohorts(name)')],
  ['prompts', admin.from('journal_prompts').select('*, programs(name)')],
  ['posts', admin.from('community_posts').select('*, profiles(full_name, role), cohorts(name), community_likes(user_id), community_comments(*, profiles(full_name, role))')],
  ['announcements', admin.from('announcements').select('*, cohorts(name)')],
  ['resources', admin.from('resources').select('*, programs(name)')],
  ['certificates', admin.from('certificates').select('*, profiles(full_name), programs(name)')],
  ['enrollments', admin.from('cohort_enrollments').select('*, profiles(full_name, role), cohorts(name)')],
  ['meeting links', admin.rpc('cohort_meeting_links')],
  ['registrations', admin.from('registrations').select('*, programs(name, price_label), cohorts(name)')],
  ['inquiries', admin.from('inquiries').select('*')],
  ['audit read (old columns)', admin.from('admin_audit_log').select('id, actor_id, action, entity_type, created_at')],
]) { const x = await q; check(`old admin read: ${n}`, !x.error, x.error?.message ?? '') }
const me = (await admin.auth.getUser()).data.user.id
let w = await admin.from('admin_audit_log').insert({ actor_id: me, action: 'program.update', entity_type: 'program', entity_id: null, details: {} })
check('old client logAction insert', !w.error, w.error?.message ?? '')
// (no .select(): signed-in users cannot read the meeting-link column since phase 2b; the app never asks for it)
w = await admin.from('cohorts').update({ capacity: 9 }).eq('id', '30000000-0000-0000-0000-0000000000c3')
const cap = await admin.from('cohorts').select('capacity').eq('id', '30000000-0000-0000-0000-0000000000c3').single()
check('old cohort capacity update', !w.error && cap.data?.capacity === 9)
w = await admin.from('programs').update({ tagline: 'Make the Transition to Leadership' }).eq('slug', 'new-leaders').select()
check('old pathway save', !w.error && w.data.length === 1)
w = await admin.from('inquiries').update({ status: 'contacted' }).neq('id', '00000000-0000-0000-0000-000000000000').select()
check('old inquiry update', !w.error)
w = await admin.from('weekly_reps').delete().eq('id', '40000000-0000-0000-0000-0000000000e1')
check('old rep delete with reflections now refused (protection)', !!w.error)
console.log(results.join('\n'))
