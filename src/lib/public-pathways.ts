import { DEFAULT_PATHWAYS, mergePathways, PATHWAY_SLUGS, type PathwayRow } from './pathways'

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
