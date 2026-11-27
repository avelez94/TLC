import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { connection } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { assertSafeEnvironment } from '@/lib/env-guard'
import { mergePathways, PATHWAY_FOR_WHOM, PATHWAY_SLUGS, type PathwayRow } from '@/lib/pathways'
import RegisterClient from './RegisterClient'
import { loadLaunchReadiness, loadPublishedPolicy } from '@/lib/launch-server'
import { POLICY_META, POLICY_SLUGS, policyDate } from '@/lib/policies'

export const metadata: Metadata = {
  title: 'Join The Impact Lab | TLC Leadership',
  alternates: { canonical: 'https://tramainecrawford.com/register' },
}

async function visiblePathways() {
  assertSafeEnvironment(process.env)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return mergePathways(null)
  try {
    const supabase = createClient(url, key, { auth: { persistSession: false } })
    const { data, error } = await supabase
      .from('programs')
      .select('id, slug, pathway_number, name, tagline, opening_statement, audience, description, leadership_goal, keywords, price_label, enrollment_open, is_public')
      .in('slug', PATHWAY_SLUGS)
      .abortSignal(AbortSignal.timeout(3000))
    return mergePathways(error ? null : (data as PathwayRow[]))
  } catch {
    return mergePathways(null)
  }
}

// While online registration (checkout) is switched off, this page never shows cohorts as open,
// prices or payment buttons: it sends visitors to the inquiry form for their pathway instead.
export default async function RegisterPage() {
  await connection()
  // The server-side launch gate decides: only cohorts that pass every check are offered, with the
  // published policies the participant must accept.
  const readiness = await loadLaunchReadiness().catch(() => null)
  if (readiness?.open) {
    const refund = await loadPublishedPolicy('refund')
    const policies = readiness.policies.filter(p => p.published && p.versionId).map(p => ({
      slug: p.slug, name: POLICY_META[p.slug].name, path: POLICY_META[p.slug].path, versionId: p.versionId as string, versionNumber: p.version ?? 0, updated: policyDate(p.publishedAt),
    }))
    if (refund && policies.length === POLICY_SLUGS.length) {
      return <RegisterClient gate={{ openCohortIds: readiness.openCohortIds, policies, refund: refund.content }} />
    }
  }
  const pathways = await visiblePathways()

  const mono = { fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.65rem', letterSpacing: '0.15em', textTransform: 'uppercase' as const }
  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', fontFamily: 'var(--font-montserrat), sans-serif' }}>
      <div style={{ background: 'var(--navy)', padding: 'clamp(1.25rem, 3vw, 1.75rem) clamp(1.25rem, 5vw, 2.75rem)', borderBottom: '1px solid rgba(200,136,32,0.15)' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/"><Image src="/images/tlc-logo.png" alt="TLC Leadership" width={80} height={68} style={{ height: '68px', width: 'auto' }} /></Link>
          <Link href="/impact" style={{ ...mono, color: 'rgba(255,255,255,0.55)' }}>&#8592; Back to Impact Lab</Link>
        </div>
      </div>

      <main style={{ maxWidth: '720px', margin: '0 auto', padding: 'clamp(2rem, 5vw, 4rem) clamp(1.25rem, 5vw, 2.75rem)' }}>
        <span style={{ ...mono, fontSize: '0.62rem', letterSpacing: '0.2em', color: '#8a5a10', display: 'block', marginBottom: '0.75rem' }}>The Impact Lab</span>
        <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(2rem, 5vw, 3.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', lineHeight: 1, marginBottom: '0.75rem' }}>Join a Cohort</h1>
        <p style={{ color: 'var(--slate)', fontSize: '1rem', lineHeight: 1.75, marginBottom: '2rem' }}>
          Enrollment for the next cohorts is not open yet. Tell us which pathway interests you and we will
          contact you with dates and details. Organizations can ask about bringing a cohort to their team.
        </p>

        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {pathways.map(p => (
            <li key={p.slug} style={{ background: 'white', border: '1.5px solid rgba(0,23,55,0.1)', borderRadius: '6px', padding: '1.5rem 1.75rem' }}>
              <h2 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.75rem', color: 'var(--navy)', letterSpacing: '0.04em', margin: 0 }}>{p.name}</h2>
              <p style={{ color: 'var(--slate)', fontSize: '0.95rem', lineHeight: 1.6, margin: '0.35rem 0 1rem' }}>{PATHWAY_FOR_WHOM[p.slug]}</p>
              <Link href={`/impact?inquire=individual&pathway=${p.slug}#inquire`} className="btn btn-primary" style={{ fontSize: '0.8rem' }}>
                Ask about the next {p.name} cohort
              </Link>
            </li>
          ))}
        </ul>

        <p style={{ color: 'var(--slate)', fontSize: '0.92rem', lineHeight: 1.7, marginTop: '2rem' }}>
          Bringing a group from your organization?{' '}
          <Link href="/impact?inquire=organization#inquire" style={{ color: '#8a5a10', fontWeight: 600 }}>Start an organizational inquiry</Link>.
          {' '}Already a participant? <Link href="/login" style={{ color: '#8a5a10', fontWeight: 600 }}>Sign in</Link>.
        </p>
      </main>
    </div>
  )
}
