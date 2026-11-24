'use client'

// "All certificates": every certificate in one list, with search, a status filter and a CSV
// export. Certificates are issued (and revoked) in each cohort's Completion & certificates
// section, where completion is recorded first.
import { useState } from 'react'
import Link from 'next/link'
import type { AdminPanel } from '../useAdminPanel'
import { csvDateTimeET, formatDateET } from '@/lib/business-time'
import { downloadCsv, toCsv } from '@/lib/csv'
import { cardStyle, helpStyle, inputStyle, labelStyle, pageTitleStyle, secondaryButtonStyle, statusBadge, tdStyle, thStyle } from './shared'
import { cohortSectionHref, inlineLinkStyle } from './cohort/ui'

type StatusFilter = 'all' | 'valid' | 'revoked'

const pdfHref = (id: string, inline = false) => `/api/certificates/${id}/pdf${inline ? '?inline=1' : ''}`

export default function CertificatesTab(panel: AdminPanel) {
  const { certificates, cohorts } = panel
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')

  const all = certificates.map(c => {
    const cohort = c.cohort_id ? cohorts.find(x => x.id === c.cohort_id) : undefined
    return {
      c,
      number: c.certificate_number ?? '',
      person: c.participant_name || c.profiles?.full_name || c.profiles?.email || panel.personName(c.user_id),
      email: c.profiles?.email ?? '',
      pathway: c.pathway_name || c.programs?.name || 'Unknown pathway',
      cohort: c.cohort_name || cohort?.name || '',
      cohortExists: !!cohort,
      revoked: !!c.revoked_at,
    }
  })
  const q = search.trim().toLowerCase()
  const rows = all
    .filter(r => status === 'all' || (status === 'revoked' ? r.revoked : !r.revoked))
    .filter(r => !q || [r.number, r.person, r.email, r.pathway, r.cohort].some(v => v.toLowerCase().includes(q)))
  const revokedCount = all.filter(r => r.revoked).length

  const exportCsv = () => {
    const csv = toCsv(
      ['Certificate number', 'Participant', 'Email', 'Pathway', 'Cohort', 'Completion date', 'Issued (ET)', 'Status', 'Revoked (ET)', 'Revoke reason', 'Signer'],
      rows.map(r => [
        r.number, r.person, r.email, r.pathway, r.cohort, r.c.completion_date ?? '', csvDateTimeET(r.c.issued_at),
        r.revoked ? 'Revoked' : 'Valid', csvDateTimeET(r.c.revoked_at), r.c.revoked_reason ?? '', r.c.signer_name ?? '',
      ]),
    )
    downloadCsv(`certificates-${new Date().toISOString().slice(0, 10)}.csv`, csv)
  }

  return (
    <div>
      <span style={labelStyle}>People</span>
      <h1 style={pageTitleStyle}>All certificates</h1>
      <p style={helpStyle}>
        Every certificate in one place. To issue a certificate, open the cohort and use its <strong>Completion &amp; certificates</strong> section:
        you record each participant’s completion there first, then issue the certificate.{' '}
        <Link href="/admin/cohorts" style={inlineLinkStyle}>Go to Cohorts</Link>
      </p>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1rem' }}>
        <div style={{ flex: '1 1 260px', maxWidth: '420px' }}>
          <label htmlFor="cert-search" style={labelStyle}>Search certificates</label>
          <input id="cert-search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Number, person, pathway or cohort" style={inputStyle} />
        </div>
        <div style={{ flex: '0 1 200px' }}>
          <label htmlFor="cert-status" style={labelStyle}>Show</label>
          <select id="cert-status" value={status} onChange={e => setStatus(e.target.value as StatusFilter)} style={inputStyle}>
            <option value="all">All ({all.length})</option>
            <option value="valid">Valid ({all.length - revokedCount})</option>
            <option value="revoked">Revoked ({revokedCount})</option>
          </select>
        </div>
        <button type="button" onClick={exportCsv} disabled={rows.length === 0} style={{ ...secondaryButtonStyle, minHeight: '44px' }}>
          Export CSV ({rows.length})
        </button>
      </div>

      {certificates.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', color: 'var(--slate)', fontSize: '0.92rem' }}>No certificates issued yet.</div>
      ) : (
        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
          <div role="region" aria-label="Certificates" tabIndex={0} style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '760px' }}>
              <caption style={{ textAlign: 'left', padding: '0.75rem 1rem', color: 'var(--slate)', fontSize: '0.85rem' }}>
                {rows.length} of {certificates.length} certificate{certificates.length === 1 ? '' : 's'}. Scroll sideways on small screens.
              </caption>
              <thead>
                <tr>{['Number', 'Participant', 'Pathway & cohort', 'Completed', 'Issued', 'Status', 'Certificate'].map(h => <th key={h} scope="col" style={thStyle}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.c.id}>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.8rem' }}>{r.number || <span style={{ color: 'var(--slate)' }}>None</span>}</td>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 600, color: 'var(--navy)' }}>{r.person}</span>
                      {r.email && r.email !== r.person && <span style={{ display: 'block', color: 'var(--slate)', fontSize: '0.82rem', overflowWrap: 'anywhere' }}>{r.email}</span>}
                    </td>
                    <td style={tdStyle}>
                      {r.pathway}
                      <span style={{ display: 'block', color: 'var(--slate)', fontSize: '0.82rem' }}>
                        {r.cohort || 'No cohort'}
                        {r.cohortExists && r.c.cohort_id && (
                          <> · <Link href={cohortSectionHref(r.c.cohort_id, 'completion')} style={inlineLinkStyle}>Completion<span className="sr-only"> for {r.cohort}</span></Link></>
                        )}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{r.c.completion_date ? formatDateET(r.c.completion_date) : '—'}</td>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{formatDateET(r.c.issued_at)}</td>
                    <td style={tdStyle}>
                      {r.revoked ? statusBadge('cancelled', 'Revoked') : statusBadge('open', 'Valid')}
                      {r.revoked && (
                        <span style={{ display: 'block', color: 'var(--slate)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                          {formatDateET(r.c.revoked_at)}{r.c.revoked_reason ? ` · ${r.c.revoked_reason}` : ''}
                        </span>
                      )}
                    </td>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                      <a href={pdfHref(r.c.id, true)} target="_blank" rel="noopener noreferrer" style={inlineLinkStyle}>View<span className="sr-only"> {r.person}’s certificate (opens in a new tab)</span></a>
                      {' · '}
                      <a href={pdfHref(r.c.id)} style={inlineLinkStyle}>Download<span className="sr-only"> {r.person}’s certificate</span></a>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={7} style={{ ...tdStyle, textAlign: 'center', color: 'var(--slate)' }}>No certificates match this search.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
