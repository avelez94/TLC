import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { PUBLIC_POLICIES_TAG } from '@/lib/public-pathways'
import { requireAdmin, supabaseAdmin } from '@/lib/supabase-server'
import { cleanPolicyContent, isPolicySlug, POLICY_META, publishProblems, type PolicyContent, type PolicySlug } from '@/lib/policies'
import { contentHash } from '@/lib/launch-server'
import { audit } from '@/lib/audit'

// One policy: read the draft and history, save the draft (autosave or a saved version), publish,
// unpublish, restore an earlier version. Administrators only; all writes happen here, on the
// server, with the content checked again (structure, sizes, links). Published versions are a
// permanent record (the database refuses to change or delete them).
const NO_STORE = { 'Cache-Control': 'private, no-store' }
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE })
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Same draft timestamp (the database and JavaScript format the same moment differently). */
const sameTime = (a: unknown, b: unknown) => (a == null && b == null) || (typeof a === 'string' && typeof b === 'string' && Date.parse(a) === Date.parse(b))

async function slugOf(params: Promise<{ slug: string }>): Promise<PolicySlug | null> {
  const { slug } = await params
  return isPolicySlug(slug) ? slug : null
}

async function addVersion(slug: PolicySlug, content: PolicyContent, kind: 'saved' | 'published', by: string, note?: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: last } = await supabaseAdmin.from('policy_versions').select('version_number').eq('policy_slug', slug).order('version_number', { ascending: false }).limit(1).maybeSingle()
    const version_number = (last?.version_number ?? 0) + 1
    const { data, error } = await supabaseAdmin.from('policy_versions')
      .insert({ policy_slug: slug, version_number, kind, content, content_hash: contentHash(content), created_by: by, note: note ?? null })
      .select('id, version_number').single()
    if (!error && data) return data
    if (error?.code !== '23505') throw new Error(error?.message ?? 'Could not save the version')
  }
  throw new Error('Could not save the version (try again)')
}

function revalidatePublic() {
  revalidateTag(PUBLIC_POLICIES_TAG, { expire: 0 })
  revalidatePath('/', 'layout') // footer links, policy pages, registration
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await requireAdmin())) return json({ error: 'Not authorized' }, 401)
  const slug = await slugOf(params)
  if (!slug) return json({ error: 'Not found' }, 404)
  const versionId = request.nextUrl.searchParams.get('version')
  if (versionId) {
    if (!UUID.test(versionId)) return json({ error: 'Not found' }, 404)
    const { data } = await supabaseAdmin.from('policy_versions').select('id, version_number, kind, content, created_at').eq('id', versionId).eq('policy_slug', slug).maybeSingle()
    if (!data) return json({ error: 'Not found' }, 404)
    const c = cleanPolicyContent(data.content)
    return json({ version: { ...data, content: c.ok ? c.content : null } })
  }
  const [{ data: row }, { data: versions }, { data: people }] = await Promise.all([
    supabaseAdmin.from('policies').select('slug, draft, draft_updated_at, draft_updated_by, published_version_id, published_at, published_by').eq('slug', slug).single(),
    supabaseAdmin.from('policy_versions').select('id, version_number, kind, note, created_at, created_by, content_hash').eq('policy_slug', slug).order('version_number', { ascending: false }).limit(200),
    supabaseAdmin.from('profiles').select('id, full_name, email').eq('role', 'admin'),
  ])
  const name = (id: string | null | undefined) => people?.find(p => p.id === id)?.full_name || people?.find(p => p.id === id)?.email || null
  const draft = cleanPolicyContent(row?.draft ?? {})
  const content = draft.ok ? draft.content : { title: '', intro: [], sections: [] }
  const published = versions?.find(v => v.id === row?.published_version_id) ?? null
  return json({
    slug, ...POLICY_META[slug], draft: content, draft_updated_at: row?.draft_updated_at ?? null, draft_updated_by: name(row?.draft_updated_by),
    published: published ? { id: published.id, version_number: published.version_number, published_at: row?.published_at, published_by: name(row?.published_by) } : null,
    unpublished_changes: !!published && contentHash(content) !== published.content_hash,
    publish_problems: publishProblems(content),
    versions: (versions ?? []).map(v => ({ id: v.id, version_number: v.version_number, kind: v.kind, note: v.note, created_at: v.created_at, created_by: name(v.created_by), live: v.id === row?.published_version_id })),
  })
}

/** Save the draft. `version: true` (the Save button) also keeps a version in the history. */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const admin = await requireAdmin()
  if (!admin) return json({ error: 'Not authorized' }, 401)
  const slug = await slugOf(params)
  if (!slug) return json({ error: 'Not found' }, 404)
  const body = await request.json().catch(() => null)
  const clean = cleanPolicyContent(body?.content)
  if (!clean.ok) return json({ error: clean.error }, 400)

  const { data: row } = await supabaseAdmin.from('policies').select('draft_updated_at').eq('slug', slug).single()
  // Someone else saved since this editor loaded: do not overwrite their work.
  if (body?.expected_updated_at !== undefined && !sameTime(row?.draft_updated_at ?? null, body.expected_updated_at ?? null)) {
    return json({ error: 'This policy was changed in another window or by another administrator. Reload to see the latest draft before saving.', conflict: true }, 409)
  }
  const now = new Date().toISOString()
  const { error } = await supabaseAdmin.from('policies').update({ draft: clean.content, draft_updated_at: now, draft_updated_by: admin.id, updated_at: now }).eq('slug', slug)
  if (error) return json({ error: 'The draft could not be saved. Try again.' }, 500)

  let version: { id: string; version_number: number } | null = null
  if (body?.version === true) {
    const { data: last } = await supabaseAdmin.from('policy_versions').select('content_hash, version_number, id').eq('policy_slug', slug).order('version_number', { ascending: false }).limit(1).maybeSingle()
    // An unchanged draft does not add a duplicate version.
    version = last?.content_hash === contentHash(clean.content) ? { id: last.id, version_number: last.version_number } : await addVersion(slug, clean.content, 'saved', admin.id)
    await audit(admin.id, 'policy.save', 'policy', slug, { version: version.version_number }, { label: POLICY_META[slug].name })
  }
  return json({ saved: true, draft_updated_at: now, version, publish_problems: publishProblems(clean.content) })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const admin = await requireAdmin()
  if (!admin) return json({ error: 'Not authorized' }, 401)
  const slug = await slugOf(params)
  if (!slug) return json({ error: 'Not found' }, 404)
  const body = await request.json().catch(() => ({}))
  const label = POLICY_META[slug].name

  if (body?.action === 'publish') {
    if (body.approve !== true) return json({ error: 'Confirm that you have reviewed and approve this wording before publishing.' }, 400)
    const { data: row } = await supabaseAdmin.from('policies').select('draft, draft_updated_at').eq('slug', slug).single()
    const clean = cleanPolicyContent(row?.draft ?? {})
    if (!clean.ok) return json({ error: clean.error }, 400)
    // Publish exactly what the administrator reviewed.
    if (body.expected_updated_at !== undefined && !sameTime(row?.draft_updated_at ?? null, body.expected_updated_at ?? null)) {
      return json({ error: 'The draft changed since you reviewed it. Review it again before publishing.', conflict: true }, 409)
    }
    const problems = publishProblems(clean.content)
    if (problems.length) return json({ error: 'This policy is not ready to publish.', problems }, 400)
    const v = await addVersion(slug, clean.content, 'published', admin.id, 'Published')
    const now = new Date().toISOString()
    const { error } = await supabaseAdmin.from('policies').update({ published_version_id: v.id, published_at: now, published_by: admin.id, updated_at: now }).eq('slug', slug)
    if (error) return json({ error: 'The policy could not be published. Try again.' }, 500)
    await audit(admin.id, 'policy.publish', 'policy', slug, { version: v.version_number }, { label: `${label} (version ${v.version_number})` })
    revalidatePublic()
    return json({ published: true, version_number: v.version_number, published_at: now })
  }

  if (body?.action === 'unpublish') {
    const now = new Date().toISOString()
    const { error } = await supabaseAdmin.from('policies').update({ published_version_id: null, published_at: null, published_by: null, updated_at: now }).eq('slug', slug)
    if (error) return json({ error: 'The policy could not be unpublished. Try again.' }, 500)
    await audit(admin.id, 'policy.unpublish', 'policy', slug, {}, { label })
    revalidatePublic()
    return json({ unpublished: true })
  }

  if (body?.action === 'restore') {
    if (typeof body.version_id !== 'string' || !UUID.test(body.version_id)) return json({ error: 'Choose a version to restore.' }, 400)
    const { data: v } = await supabaseAdmin.from('policy_versions').select('version_number, content').eq('id', body.version_id).eq('policy_slug', slug).maybeSingle()
    if (!v) return json({ error: 'That version was not found.' }, 404)
    const clean = cleanPolicyContent(v.content)
    if (!clean.ok) return json({ error: clean.error }, 400)
    const now = new Date().toISOString()
    await supabaseAdmin.from('policies').update({ draft: clean.content, draft_updated_at: now, draft_updated_by: admin.id, updated_at: now }).eq('slug', slug)
    const saved = await addVersion(slug, clean.content, 'saved', admin.id, `Restored from version ${v.version_number}`)
    await audit(admin.id, 'policy.restore', 'policy', slug, { from_version: v.version_number, version: saved.version_number }, { label })
    return json({ restored: true, from_version: v.version_number, version_number: saved.version_number, draft_updated_at: now, draft: clean.content })
  }

  return json({ error: 'Unknown action' }, 400)
}
