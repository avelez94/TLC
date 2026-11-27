// Public policy page (/privacy, /terms, /refund-policy). Shows only the published version.
// While a policy is unpublished the page says so plainly and is not indexed, so it never looks
// like an official policy.
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { loadPublishedPolicy } from '@/lib/launch-server'
import { POLICY_META, policyDate, type PolicySlug } from '@/lib/policies'
import PolicyDocument from './PolicyDocument'

const SITE = 'https://tramainecrawford.com'

export async function policyMetadata(slug: PolicySlug): Promise<Metadata> {
  await connection()
  const p = await loadPublishedPolicy(slug)
  const name = POLICY_META[slug].name
  return {
    title: `${name} | TLC Leadership Consulting & Coaching`,
    description: p ? `${name} for TLC Leadership Consulting & Coaching and The Impact Lab.` : `${name} (being prepared).`,
    alternates: { canonical: `${SITE}${POLICY_META[slug].path}` },
    robots: p ? undefined : { index: false, follow: true },
  }
}

export default async function PublicPolicyPage({ slug }: { slug: PolicySlug }) {
  await connection() // always the currently published version
  const p = await loadPublishedPolicy(slug)
  const name = POLICY_META[slug].name
  return (
    <div style={{ background: 'var(--paper)', minHeight: '70vh' }}>
      <div style={{ background: 'var(--navy)', padding: 'clamp(6.5rem, 12vw, 8rem) clamp(1.25rem, 5vw, 2.75rem) clamp(2rem, 5vw, 3rem)' }}>
        <div style={{ maxWidth: '780px', margin: '0 auto' }}>
          <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.66rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>TLC Leadership Consulting &amp; Coaching</span>
        </div>
      </div>
      <div style={{ maxWidth: '780px', margin: '0 auto', padding: 'clamp(2rem, 5vw, 3.5rem) clamp(1.25rem, 5vw, 2.75rem) clamp(3rem, 6vw, 5rem)' }}>
        {p ? (
          <PolicyDocument content={p.content} updated={policyDate(p.published_at)} version={p.version_number} />
        ) : (
          <div role="status">
            <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(2.2rem, 5vw, 3.4rem)', color: 'var(--navy)', letterSpacing: '0.03em', margin: '0 0 1rem' }}>{name}</h1>
            <p style={{ fontSize: '1.05rem', lineHeight: 1.75, color: 'var(--ink, #1C2430)', margin: '0 0 1rem' }}>
              Our {name} is being prepared and has not been published yet. Nothing on this page is an official policy.
            </p>
            <p style={{ fontSize: '1rem', lineHeight: 1.75, color: 'var(--slate)', margin: 0 }}>
              If you have a question in the meantime, email <a href="mailto:contact@tramainecrawford.com" style={{ color: '#8a5a10' }}>contact@tramainecrawford.com</a>.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
