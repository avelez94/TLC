// Renders a policy's structured content with React (no HTML injection). Used by the public
// policy pages, the admin preview and the refund disclosure on the registration page.
import type { ReactNode } from 'react'
import { safePolicyHref, type Block, type Inline, type PolicyContent } from '@/lib/policies'

function Run({ r }: { r: Inline }) {
  let node: ReactNode = r.t
  if (r.u) node = <u>{node}</u>
  if (r.i) node = <em>{node}</em>
  if (r.b) node = <strong>{node}</strong>
  const href = safePolicyHref(r.href)
  if (href) {
    const external = /^https?:/i.test(href)
    node = <a href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} style={{ color: '#8a5a10', textDecoration: 'underline' }}>{node}</a>
  }
  return <>{node}</>
}

const Line = ({ runs }: { runs: Inline[] }) => <>{runs.map((r, i) => <Run key={i} r={r} />)}</>

export function PolicyBlocks({ blocks, size = '1rem' }: { blocks: Block[]; size?: string }) {
  const text = { color: 'var(--ink, #1C2430)', fontSize: size, lineHeight: 1.75, margin: '0 0 1rem', whiteSpace: 'pre-wrap' as const }
  return (
    <>
      {blocks.map((b, i) => b.type === 'p'
        ? <p key={i} style={text}><Line runs={b.c} /></p>
        : b.type === 'ul'
          ? <ul key={i} style={{ ...text, paddingLeft: '1.4rem', listStyle: 'disc' }}>{b.items.map((it, j) => <li key={j} style={{ marginBottom: '0.35rem' }}><Line runs={it} /></li>)}</ul>
          : <ol key={i} style={{ ...text, paddingLeft: '1.4rem', listStyle: 'decimal' }}>{b.items.map((it, j) => <li key={j} style={{ marginBottom: '0.35rem' }}><Line runs={it} /></li>)}</ol>)}
    </>
  )
}

/** The full document: title, last-updated date, introduction, contents and sections. */
export default function PolicyDocument({ content, updated, version, compact = false, headingLevel = 1 }: {
  content: PolicyContent; updated?: string | null; version?: number | null; compact?: boolean; headingLevel?: 1 | 2
}) {
  const H = headingLevel === 1 ? 'h1' : 'h2'
  const S = headingLevel === 1 ? 'h2' : 'h3'
  const sections = content.sections.filter(s => s.heading || s.body.length)
  return (
    <article style={{ fontFamily: 'var(--font-montserrat), sans-serif' }}>
      <H style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: compact ? '1.6rem' : 'clamp(2.2rem, 5vw, 3.4rem)', color: 'var(--navy)', letterSpacing: '0.03em', lineHeight: 1.05, margin: '0 0 0.75rem', textWrap: 'balance' }}>
        {content.title}
      </H>
      {updated && (
        <p style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.72rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#8a5a10', margin: '0 0 1.75rem' }}>
          Last updated {updated}{version ? ` · Version ${version}` : ''}
        </p>
      )}
      {content.intro.length > 0 && <div style={{ marginBottom: '1.5rem' }}><PolicyBlocks blocks={content.intro} size={compact ? '0.92rem' : '1.05rem'} /></div>}
      {!compact && sections.length > 3 && (
        <nav aria-label="Contents" style={{ background: 'rgba(0,23,55,0.035)', border: '1px solid rgba(0,23,55,0.08)', borderRadius: '6px', padding: '1rem 1.25rem', margin: '0 0 2rem' }}>
          <p style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.66rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--slate)', margin: '0 0 0.5rem' }}>Contents</p>
          <ol style={{ margin: 0, paddingLeft: '1.3rem', display: 'grid', gap: '0.3rem', fontSize: '0.92rem', listStyle: 'decimal' }}>
            {sections.map(s => <li key={s.id}><a href={`#${s.id}`} style={{ color: 'var(--navy)' }}>{s.heading}</a></li>)}
          </ol>
        </nav>
      )}
      {sections.map(s => (
        <section key={s.id} id={s.id} style={{ scrollMarginTop: '90px', marginBottom: compact ? '1rem' : '1.75rem' }}>
          {s.heading && (
            <S style={{ fontFamily: compact ? 'var(--font-montserrat), sans-serif' : 'var(--font-bebas), sans-serif', fontSize: compact ? '0.98rem' : '1.55rem', fontWeight: compact ? 700 : 400, color: 'var(--navy)', letterSpacing: compact ? 0 : '0.03em', margin: '0 0 0.6rem', textWrap: 'balance' }}>
              {s.heading}
            </S>
          )}
          <PolicyBlocks blocks={s.body} size={compact ? '0.9rem' : '1rem'} />
        </section>
      ))}
    </article>
  )
}
