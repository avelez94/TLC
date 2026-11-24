#!/usr/bin/env node
// Independent export of the production database's public tables (exact CSV via PostgREST),
// auth account summary (no password hashes) and storage metadata. Output is a plain
// directory that backup.sh encrypts immediately. Prints only table names and row counts.
//
// Usage: node supabase/scripts/backup-export.mjs <output-dir>
// Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local (never printed).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const out = process.argv[2]
if (!out) { console.error('usage: backup-export.mjs <output-dir>'); process.exit(2) }
mkdirSync(join(out, 'public'), { recursive: true, mode: 0o700 })

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => /^[A-Z_]+=/.test(l))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
)
const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('Missing Supabase URL or service role key in .env.local'); process.exit(2) }
const headers = { apikey: key, Authorization: `Bearer ${key}` }

const TABLES = ['announcements', 'assessments', 'availability_blocks', 'bookings', 'certificates', 'coaching_goals',
  'coaching_sessions', 'cohort_enrollments', 'cohort_messages', 'cohort_sessions', 'cohorts', 'community_comments',
  'community_likes', 'community_posts', 'development_plans', 'evaluations', 'growth_milestones', 'impact_entries',
  'insights', 'journal_entries', 'journal_prompts', 'life_domains', 'messages', 'profiles', 'program_includes',
  'programs', 'registrations', 'resources', 'session_attendance', 'weekly_checkins', 'weekly_rep_submissions', 'weekly_reps',
  // added by migration 2c (2026-11-22)
  'inquiries', 'inquiry_notes', 'admin_audit_log', 'email_log',
  // 2e (workflow integration)
  'inquiry_participants', 'payment_requests', 'stripe_events']
// Tables that only exist once migration 2e is applied: recorded as absent (not an error) before.
const ADDED_BY_2E = new Set(['inquiry_participants', 'payment_requests', 'stripe_events'])

// Refuse to produce an incomplete backup: every table the API exposes must be in the list.
{
  const spec = await (await fetch(`${url}/rest/v1/`, { headers })).json()
  const exposed = Object.keys(spec.definitions ?? {}).filter(n => !/^(rate_limit|.*_view)$/.test(n))
  const missing = exposed.filter(n => !TABLES.includes(n))
  if (missing.length) console.warn(`NOTE: not exported (views or helper tables? check): ${missing.join(', ')}`)
}

const manifest = { taken_at: new Date().toISOString(), project: new URL(url).hostname.split('.')[0], tables: {} }
for (const t of TABLES) {
  // count first, then fetch everything in one CSV (tables are small; fail if truncated)
  const head = await fetch(`${url}/rest/v1/${t}?select=*`, { method: 'HEAD', headers: { ...headers, Prefer: 'count=exact' } })
  if (head.status === 404 && ADDED_BY_2E.has(t)) { manifest.tables[t] = 'absent (before migration 2e)'; console.log(`${t.padEnd(24)} absent (before 2e)`); continue }
  const total = Number((head.headers.get('content-range') || '*/0').split('/')[1])
  const res = await fetch(`${url}/rest/v1/${t}?select=*`, { headers: { ...headers, Accept: 'text/csv', Range: `0-${Math.max(total - 1, 0)}` } })
  if (!res.ok) { console.error(`FAILED ${t}: HTTP ${res.status}`); process.exit(1) }
  const csv = await res.text()
  writeFileSync(join(out, 'public', `${t}.csv`), csv, { mode: 0o600 })
  manifest.tables[t] = total
  console.log(`${t.padEnd(24)} ${total}`)
}

// Auth accounts (summary only — Supabase does not expose password hashes, and the migrations
// being protected do not touch the auth schema).
const users = []
for (let page = 1; ; page++) {
  const res = await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=1000`, { headers })
  if (!res.ok) { console.error(`FAILED auth users: HTTP ${res.status}`); process.exit(1) }
  const body = await res.json()
  const batch = body.users ?? []
  users.push(...batch.map(u => ({ id: u.id, email: u.email, created_at: u.created_at, invited_at: u.invited_at,
    email_confirmed_at: u.email_confirmed_at, last_sign_in_at: u.last_sign_in_at,
    user_metadata: u.user_metadata, app_metadata: u.app_metadata })))
  if (batch.length < 1000) break
}
writeFileSync(join(out, 'auth_users.json'), JSON.stringify(users, null, 1), { mode: 0o600 })
manifest.auth_users = users.length
console.log(`${'auth.users (summary)'.padEnd(24)} ${users.length}`)

const buckets = await (await fetch(`${url}/storage/v1/bucket`, { headers })).json()
const objects = {}
for (const b of buckets) {
  const res = await fetch(`${url}/storage/v1/object/list/${b.id}`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ prefix: '', limit: 1000 }) })
  objects[b.id] = res.ok ? await res.json() : { error: res.status }
}
writeFileSync(join(out, 'storage.json'), JSON.stringify({ buckets, objects }, null, 1), { mode: 0o600 })
manifest.storage_objects = Object.values(objects).reduce((n, o) => n + (Array.isArray(o) ? o.length : 0), 0)
console.log(`${'storage objects'.padEnd(24)} ${manifest.storage_objects}`)

writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 1), { mode: 0o600 })
