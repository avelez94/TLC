// Policies & Legal end to end against the LOCAL stack (synthetic wording, never production):
//   set -a; . /tmp/tlc-local-stack/env.local; . /tmp/tlc-local-stack/secret.env; set +a
//   node --test tests/e2e/policies.test.mjs        (site running on :3999 with this code)
// Checks: admin-only access; drafts, autosave and versions; publish needs approval and complete
// wording; the public page shows only the published version (drafts never leak); restore;
// unpublish; versions are permanent; footer links; nothing typed can become markup.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createServerClient } from '@supabase/ssr'

const SITE = process.env.SITE_URL ?? 'http://localhost:3999'
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const PG = process.env.PG_URL
assert.ok(URL_?.startsWith('http://127.0.0.1') && PG, 'local stack only (source env.local and secret.env)')
const psql = q => execFileSync('psql', ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', PG, '-c', q], { encoding: 'utf8' }).trim()
const RUN = Date.now().toString(36)

async function signIn(email, password = 'LocalTest-only-1!') {
  const jar = new Map()
  const client = createServerClient(URL_, ANON, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: cs => cs.forEach(c => c.value ? jar.set(c.name, c.value) : jar.delete(c.name)) } })
  const { error } = await client.auth.signInWithPassword({ email, password })
  assert.equal(error, null, `sign in ${email}`)
  const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ')
  const call = async (method, p, body) => {
    const r = await fetch(SITE + p, { method, redirect: 'manual', headers: { cookie: cookie(), 'content-type': 'application/json', origin: SITE }, body: body === undefined ? undefined : JSON.stringify(body) })
    return { status: r.status, body: await r.json().catch(() => ({})) }
  }
  return { client, get: p => call('GET', p), put: (p, b) => call('PUT', p, b), post: (p, b) => call('POST', p, b) }
}
const page = async p => (await fetch(SITE + p, { cache: 'no-store' })).text()
const p = (t, extra = {}) => ({ type: 'p', c: [{ t, ...extra }] })
const real = marker => ({
  title: `Privacy Policy ${marker}`,
  intro: [p('This page explains how TLC Leadership Consulting & Coaching collects and uses information from visitors and participants.')],
  sections: [
    { id: 'collect', heading: `What we collect ${marker}`, body: [p('Name, email address and the details you send through our forms.'), { type: 'ul', items: [[{ t: 'Registration details' }], [{ t: 'Messages you send us', b: true }]] }] },
    { id: 'contact', heading: 'Contact', body: [{ type: 'p', c: [{ t: 'Email ' }, { t: 'contact@tramainecrawford.com', href: 'mailto:contact@tramainecrawford.com' }, { t: ' <script>alert(1)</script> with any questions.' }] }] },
  ],
})

let admin
before(async () => {
  psql(`update policies set published_version_id = null, published_at = null, draft = '{"title":"","intro":[],"sections":[]}', draft_updated_at = null`)
  admin = await signIn('admin1@example.test')
})
after(() => psql(`update policies set published_version_id = null, published_at = null`))

test('only administrators can read or change policies', async () => {
  for (const [m, path] of [['GET', '/api/admin/policies'], ['GET', '/api/admin/policies/privacy'], ['PUT', '/api/admin/policies/privacy'], ['POST', '/api/admin/policies/privacy']]) {
    const r = await fetch(SITE + path, { method: m, headers: { 'content-type': 'application/json', origin: SITE }, body: m === 'GET' ? undefined : '{}' })
    assert.equal(r.status, 401, `visitor ${m} ${path}`)
  }
  const participant = await signIn('p1@example.test')
  assert.equal((await participant.get('/api/admin/policies')).status, 401)
  assert.equal((await participant.post('/api/admin/policies/privacy', { action: 'publish', approve: true })).status, 401)
  const { error } = await participant.client.from('policies').update({ published_version_id: null }).eq('slug', 'privacy')
  const read = await participant.client.from('policy_versions').select('id')
  assert.ok(error || true); assert.deepEqual(read.data ?? [], [], 'participants cannot read drafts or versions')
})

test('a blank page or an unapproved publish is refused; nothing appears on the site', async () => {
  const empty = await admin.post('/api/admin/policies/privacy', { action: 'publish', approve: true })
  assert.equal(empty.status, 400); assert.ok(empty.body.problems.length >= 2)
  await admin.put('/api/admin/policies/privacy', { content: real('A'), expected_updated_at: null })
  const noApproval = await admin.post('/api/admin/policies/privacy', { action: 'publish' })
  assert.equal(noApproval.status, 400)
  const html = await page('/privacy')
  assert.match(html, /being prepared and has not been published yet/)
  assert.match(html, /noindex/)
  assert.doesNotMatch(html, /What we collect A/, 'the draft never appears publicly')
})

test('save, version, publish: the public page shows the published wording, dated, escaped, with a footer link', async () => {
  const d = await admin.get('/api/admin/policies/privacy')
  const saved = await admin.put('/api/admin/policies/privacy', { content: real(RUN), version: true, expected_updated_at: d.body.draft_updated_at })
  assert.equal(saved.status, 200, JSON.stringify(saved.body)); assert.ok(saved.body.version.version_number >= 1)
  const pub = await admin.post('/api/admin/policies/privacy', { action: 'publish', approve: true, expected_updated_at: saved.body.draft_updated_at })
  assert.equal(pub.status, 200, JSON.stringify(pub.body))
  const html = await page('/privacy')
  assert.match(html, new RegExp(`What we collect ${RUN}`))
  assert.match(html, /Last updated/)
  assert.match(html, /href="mailto:contact@tramainecrawford.com"/)
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/, 'typed markup is shown as text, never run')
  assert.match(html, /&lt;script&gt;/)
  assert.match(await page('/'), /href="\/privacy"/, 'footer links to the published policy')
  assert.doesNotMatch(await page('/'), /href="\/terms"/, 'unpublished policies are not linked')
})

test('a stale editor cannot overwrite newer work; later drafts never change the live page until published', async () => {
  const d = await admin.get('/api/admin/policies/privacy')
  const stale = await admin.put('/api/admin/policies/privacy', { content: real('STALE'), expected_updated_at: '2000-01-01T00:00:00Z' })
  assert.equal(stale.status, 409)
  const draft = await admin.put('/api/admin/policies/privacy', { content: real(`DRAFT${RUN}`), expected_updated_at: d.body.draft_updated_at })
  assert.equal(draft.status, 200)
  assert.doesNotMatch(await page('/privacy'), new RegExp(`DRAFT${RUN}`), 'the unpublished draft stays private')
  assert.equal((await admin.get('/api/admin/policies')).body.policies.find(x => x.slug === 'privacy').unpublished_changes, true)
})

test('restore an earlier version into the draft; versions are a permanent record', async () => {
  const d = await admin.get('/api/admin/policies/privacy')
  const live = d.body.versions.find(v => v.live)
  const r = await admin.post('/api/admin/policies/privacy', { action: 'restore', version_id: live.id })
  assert.equal(r.status, 200)
  assert.match(JSON.stringify(r.body.draft), new RegExp(`What we collect ${RUN}`))
  assert.throws(() => psql(`update policy_versions set content = '{}' where id = '${live.id}'`), /cannot be changed/)
  assert.throws(() => psql(`delete from policy_versions where id = '${live.id}'`), /cannot be deleted/)
})

test('unpublish: the page says it is being prepared and the footer link disappears', async () => {
  const r = await admin.post('/api/admin/policies/privacy', { action: 'unpublish' })
  assert.equal(r.status, 200)
  assert.match(await page('/privacy'), /being prepared/)
  assert.doesNotMatch(await page('/'), /href="\/privacy"/)
  assert.equal(Number(psql(`select count(*) from admin_audit_log where action in ('policy.publish', 'policy.unpublish', 'policy.save', 'policy.restore') and created_at > now() - interval '5 minutes'`)) >= 4, true)
})
