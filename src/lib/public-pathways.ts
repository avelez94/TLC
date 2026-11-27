import { DEFAULT_PATHWAYS, mergePathways, PATHWAY_SLUGS, type PathwayRow } from './pathways'
import { POLICY_META, POLICY_SLUGS } from './policies'

export const PUBLIC_PATHWAYS_TAG = 'public-pathways'

/**
 * The pathways visitors may see, for site-wide links (footer, contact form, page metadata).
 * Cached for up to five minutes and refreshed immediately when an administrator saves a
 * pathway (see /api/admin/revalidate-public), so most pages stay pre-rendered and fast.
 * If the database cannot be reached, the approved defaults are used.
 */
export async function visiblePathwayLinks(): Promise<{ slug: string; name: string }[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const fallback = DEFAULT_PATHWAYS.map(p => ({ slug: p.slug, name: p.name }))
  if (!url || !key) return fallback
  try {
    const res = await fetch(
      `${url}/rest/v1/programs?select=id,slug,pathway_number,name,tagline,opening_statement,audience,description,leadership_goal,keywords,price_label,enrollment_open,is_public&slug=in.(${PATHWAY_SLUGS.join(',')})`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, next: { tags: [PUBLIC_PATHWAYS_TAG], revalidate: 300 }, signal: AbortSignal.timeout(3000) },
    )
    if (!res.ok) return fallback
    return mergePathways((await res.json()) as PathwayRow[]).map(p => ({ slug: p.slug, name: p.name }))
  } catch {
    return fallback
  }
}

export const PUBLIC_POLICIES_TAG = 'public-policies'

/**
 * Footer links to the policies that are published (never to drafts). Cached for up to five
 * minutes and refreshed immediately when a policy is published or unpublished.
 */
export async function publishedPolicyLinks(): Promise<{ slug: string; name: string; path: string }[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return []
  try {
    const res = await fetch(`${url}/rest/v1/rpc/published_policies`, {
      method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: '{}',
      next: { tags: [PUBLIC_POLICIES_TAG], revalidate: 300 }, signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return []
    const rows = (await res.json()) as { slug: string }[]
    return POLICY_SLUGS.filter(s => rows.some(r => r.slug === s)).map(s => ({ slug: s, name: POLICY_META[s].name, path: POLICY_META[s].path }))
  } catch {
    return []
  }
}
