'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { AdminPanel } from '../useAdminPanel'
import { formatDateTimeET } from '@/lib/business-time'
import { cardStyle, helpStyle, inputStyle, labelStyle, pageTitleStyle, sectionTitleStyle, tdStyle, thStyle } from './shared'
import { IssueCertificateForm } from './people/common'

export default function CertificatesTab(panel: AdminPanel) {
  const { certificates, cohorts } = panel
  const [search, setSearch] = useState('')
  const q = search.trim().toLowerCase()
  const rows = certificates
    .map(c => ({
      c,
      person: c.profiles?.full_name || c.profiles?.email || panel.personName(c.user_id),
      email: c.profiles?.email ?? '',
      program: c.programs?.name ?? 'Unknown program',
      cohort: c.cohort_id ? cohorts.find(x => x.id === c.cohort_id)?.name ?? 'Unknown cohort' : '',
    }))
    .filter(r => !q || [r.person, r.email, r.program, r.cohort].some(v => v.toLowerCase().includes(q)))

  return (
    <div>
      <span style={labelStyle}>People</span>
      <h1 style={pageTitleStyle}>All certificates</h1>
      <p style={helpStyle}>
        Certificates are normally issued from a participant&apos;s record in{' '}
        <Link href="/admin/users" style={{ color: '#8a5a10', fontWeight: 600 }}>Participants</Link>. This page lists every certificate in one place.
      </p>

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>Issue a certificate</h2>
        <IssueCertificateForm panel={panel} idPrefix="allcerts" />
      </section>

      <div style={{ marginBottom: '1rem', maxWidth: '420px' }}>
        <label htmlFor="cert-search" style={labelStyle}>Search certificates</label>
        <input id="cert-search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Person, program or cohort" style={inputStyle} />
      </div>

      {certificates.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', color: 'var(--slate)', fontSize: '0.92rem' }}>No certificates issued yet.</div>
      ) : (
        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '560px' }}>
              <caption style={{ textAlign: 'left', padding: '0.75rem 1rem', color: 'var(--slate)', fontSize: '0.85rem' }}>
                {rows.length} of {certificates.length} certificate{certificates.length === 1 ? '' : 's'}
              </caption>
              <thead><tr>{['Person', 'Program', 'Cohort', 'Issued (ET)'].map(h => <th key={h} scope="col" style={thStyle}>{h}</th>)}</tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.c.id}>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 600, color: 'var(--navy)' }}>{r.person}</span>
                      {r.email && r.email !== r.person && <span style={{ display: 'block', color: 'var(--slate)', fontSize: '0.82rem' }}>{r.email}</span>}
                    </td>
                    <td style={tdStyle}>{r.program}</td>
                    <td style={tdStyle}>{r.cohort || <span style={{ color: 'var(--slate)' }}>Not specified</span>}</td>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{formatDateTimeET(r.c.issued_at)}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={4} style={{ ...tdStyle, textAlign: 'center', color: 'var(--slate)' }}>No certificates match this search.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
