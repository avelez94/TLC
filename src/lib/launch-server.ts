// Server-only loaders for the launch gate and published policies (service role).
import { createHash } from 'node:crypto'
import { supabaseAdmin } from './supabase-server'
import { stripeMode } from './stripe'
import { isProductionDeployment } from './env-guard'
import { checkoutEnabled, PATHWAY_SLUGS } from './pathways'
import { todayET } from './business-time'
import { evaluateLaunchReadiness, type LaunchReadiness, type StripeCheck } from './launch-readiness'
import { cleanPolicyContent, isPolicySlug, stableJson, type PolicyContent, type PolicySlug } from './policies'

export const contentHash = (c: PolicyContent) => createHash('sha256').update(stableJson(c)).digest('hex')

export interface PublishedPolicy { slug: PolicySlug; version_id: string; version_number: number; published_at: string | null; content: PolicyContent }

/** Published versions only (never drafts). */
export async function loadPublishedPolicies(): Promise<Partial<Record<PolicySlug, { version_id: string; version_number: number; published_at: string | null }>>> {
  const { data, error } = await supabaseAdmin.rpc('published_policies')
  if (error || !Array.isArray(data)) return {}
  const out: Partial<Record<PolicySlug, { version_id: string; version_number: number; published_at: string | null }>> = {}
  for (const r of data as { slug: string; version_id: string; version_number: number; published_at: string | null }[]) {
    if (isPolicySlug(r.slug)) out[r.slug] = { version_id: r.version_id, version_number: r.version_number, published_at: r.published_at }
  }
  return out
}

export async function loadPublishedPolicy(slug: PolicySlug): Promise<PublishedPolicy | null> {
  const { data, error } = await supabaseAdmin.rpc('published_policy', { p_slug: slug })
  if (error || !data) return null
  const d = data as { version_id: string; version_number: number; published_at: string | null; content: unknown }
  const clean = cleanPolicyContent(d.content)
  if (!clean.ok) return null
  return { slug, version_id: d.version_id, version_number: d.version_number, published_at: d.published_at, content: clean.content }
}

export async function loadStripeCheck(): Promise<StripeCheck | null> {
  const { data } = await supabaseAdmin.from('launch_checks').select('value').eq('key', 'stripe').maybeSingle()
  return (data?.value as StripeCheck | undefined) ?? null
}

export async function saveStripeCheck(value: StripeCheck, by: string | null) {
  await supabaseAdmin.from('launch_checks').upsert({ key: 'stripe', value, checked_at: new Date().toISOString(), checked_by: by })
}

/** Everything the gate needs, read fresh for this request. */
export async function loadLaunchReadiness(): Promise<LaunchReadiness> {
  const [programs, cohorts, policies, stripeCheck] = await Promise.all([
    supabaseAdmin.from('programs').select('id, slug, name, type, price, price_label, is_public, enrollment_open').in('slug', PATHWAY_SLUGS),
    supabaseAdmin.from('cohorts').select('id, program_id, name, status, start_date, end_date, capacity, zoom_link').in('status', ['draft', 'upcoming']),
    loadPublishedPolicies(),
    loadStripeCheck(),
  ])
  const cohortRows = cohorts.data ?? []
  const datedSessions: Record<string, number> = {}
  if (cohortRows.length) {
    const { data: sessions } = await supabaseAdmin.from('cohort_sessions').select('cohort_id, session_date').in('cohort_id', cohortRows.map(c => c.id)).not('session_date', 'is', null)
    for (const s of sessions ?? []) datedSessions[s.cohort_id] = (datedSessions[s.cohort_id] ?? 0) + 1
  }
  const order = (slug: string | null) => PATHWAY_SLUGS.indexOf((slug ?? '') as (typeof PATHWAY_SLUGS)[number])
  return evaluateLaunchReadiness({
    env: {
      checkoutEnabled: checkoutEnabled(), stripeMode: stripeMode(), production: isProductionDeployment(process.env),
      webhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET, siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? '',
    },
    stripeCheck, policies,
    pathways: (programs.data ?? []).sort((a, b) => order(a.slug) - order(b.slug)),
    cohorts: cohortRows, datedSessions, today: todayET(),
  })
}
