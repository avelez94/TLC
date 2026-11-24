import { formatDateET } from '@/lib/business-time'
import { resourceOpenHref } from '@/lib/resource-links'
import { certificatePdfHref } from './logic'
import { cardStyle, h2Style, h3Style, mutedText, outlineLinkStyle, StatusBadge } from './ui'
import type { AnnouncementRow, CertificateRow, ResourceRow } from './types'

export function AnnouncementsList({ items, profileId, headingLevel = 'h2' }: { items: AnnouncementRow[]; profileId: string | null; headingLevel?: 'h2' | 'h3' }) {
  const Title = headingLevel
  return (
    <>
      {items.map(a => {
        const audience = a.target_user_id && a.target_user_id === profileId ? 'Just for you' : a.cohort_id ? 'Your cohort' : 'All participants'
        return (
          <article key={a.id} style={{ ...cardStyle, borderLeft: '4px solid var(--gold)' }}>
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{formatDateET(a.created_at, 'long')}</span>
              <StatusBadge kind="info">{audience}</StatusBadge>
            </div>
            <Title style={{ ...h2Style, marginBottom: '0.5rem' }}>{a.title}</Title>
            {a.body && <p style={{ color: 'var(--slate)', fontSize: '0.88rem', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{a.body}</p>}
          </article>
        )
      })}
    </>
  )
}

export function ResourcesList({ resources, headingLevel = 'h2' }: { resources: ResourceRow[]; headingLevel?: 'h2' | 'h3' }) {
  const Title = headingLevel
  const groups = new Map<string, ResourceRow[]>()
  for (const r of resources) {
    const key = r.topic || r.type || 'General'
    groups.set(key, [...(groups.get(key) ?? []), r])
  }
  return (
    <>
      {[...groups.entries()].map(([category, items]) => (
        <section key={category} style={cardStyle}>
          <Title style={{ ...h2Style, marginBottom: '0.75rem', textTransform: 'capitalize' }}>{category}</Title>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {items.map(r => {
              const href = resourceOpenHref(r)
              return (
                <li key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0', borderBottom: '1px solid var(--mist)', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <span style={{ color: 'var(--ink)', fontSize: '0.88rem', fontWeight: 500 }}>{r.title}</span>
                    {r.description && <span style={{ display: 'block', color: 'var(--slate)', fontSize: '0.78rem' }}>{r.description}</span>}
                  </div>
                  {href && <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`Open ${r.title} (opens in a new tab)`} style={outlineLinkStyle}>Open</a>}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </>
  )
}

export function certificateTitle(c: CertificateRow): string {
  return c.pathway_name || c.programs?.name || 'Impact Lab program'
}

export function CertificateCard({ cert, headingLevel = 'h2' }: { cert: CertificateRow; headingLevel?: 'h2' | 'h3' }) {
  const Title = headingLevel
  const title = certificateTitle(cert)
  const completed = cert.completion_date || cert.issued_at
  return (
    <article style={{ ...cardStyle, borderLeft: '4px solid var(--gold)' }}>
      <Title style={{ ...h3Style, fontSize: '1.25rem', marginBottom: '0.25rem' }}>{title}</Title>
      <p style={{ ...mutedText, marginBottom: '0.75rem' }}>Certificate of Completion{cert.cohort_name ? ` · ${cert.cohort_name}` : ''}</p>
      <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.35rem 1rem', fontSize: '0.82rem', marginBottom: '1rem' }}>
        {cert.certificate_number && <><dt style={{ color: 'var(--slate)' }}>Certificate number</dt><dd style={{ color: 'var(--ink)', fontFamily: 'var(--font-jetbrains), monospace', overflowWrap: 'anywhere' }}>{cert.certificate_number}</dd></>}
        {completed && <><dt style={{ color: 'var(--slate)' }}>Completed</dt><dd style={{ color: 'var(--ink)' }}>{formatDateET(completed, 'long')}</dd></>}
        {cert.issued_at && cert.completion_date && <><dt style={{ color: 'var(--slate)' }}>Issued</dt><dd style={{ color: 'var(--ink)' }}>{formatDateET(cert.issued_at, 'long')}</dd></>}
      </dl>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <a href={certificatePdfHref(cert.id)} className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.65rem 1.25rem' }} aria-label={`Download PDF of your ${title} certificate`}>Download PDF</a>
        <a href={certificatePdfHref(cert.id, true)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost-dark" style={{ fontSize: '0.8rem', padding: '0.65rem 1.25rem' }} aria-label={`View your ${title} certificate (opens in a new tab)`}>View</a>
      </div>
    </article>
  )
}
