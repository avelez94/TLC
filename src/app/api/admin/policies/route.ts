import { NextResponse } from 'next/server'
import { requireAdmin, supabaseAdmin } from '@/lib/supabase-server'
import { cleanPolicyContent, POLICY_META, POLICY_SLUGS, publishProblems } from '@/lib/policies'
import { contentHash } from '@/lib/launch-server'

// Admin → Policies & Legal: the three policies with their status.
const NO_STORE = { 'Cache-Control': 'private, no-store' }

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Not authorized' }, { status: 401, headers: NO_STORE })
  const [{ data: rows }, { data: published }] = await Promise.all([
    supabaseAdmin.from('policies').select('slug, draft, draft_updated_at, published_version_id, published_at'),
    supabaseAdmin.from('policy_versions').select('id, policy_slug, version_number, content_hash').eq('kind', 'published'),
  ])
  const policies = POLICY_SLUGS.map(slug => {
    const r = rows?.find(x => x.slug === slug)
    const draft = cleanPolicyContent(r?.draft ?? {})
    const pv = published?.find(v => v.id === r?.published_version_id)
    const draftHash = draft.ok ? contentHash(draft.content) : null
    return {
      slug, ...POLICY_META[slug],
      status: r?.published_version_id ? 'published' : 'draft',
      published_version: pv?.version_number ?? null, published_at: r?.published_at ?? null,
      draft_updated_at: r?.draft_updated_at ?? null,
      unpublished_changes: !!pv && draftHash !== pv.content_hash,
      has_draft: !!draft.ok && (draft.content.title !== '' || draft.content.sections.length > 0),
      publish_problems: draft.ok ? publishProblems(draft.content) : ['The draft could not be read.'],
    }
  })
  return NextResponse.json({ policies }, { headers: NO_STORE })
}
