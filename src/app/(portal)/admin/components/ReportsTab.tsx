import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { AdminPanel } from '../useAdminPanel'
import { cardStyle, inputStyle, labelStyle, statusBadge, thStyle, tdStyle } from './shared'

const h3 = { fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.15rem', color: 'var(--navy)', letterSpacing: '0.04em', margin: '0 0 1rem' } as const
const INQUIRY_STEPS = [['new', 'New'], ['contacted', 'Contacted'], ['qualified', 'Qualified'], ['follow_up', 'Follow-up needed'], ['converted', 'Converted'], ['closed', 'Closed']] as const

function download(name: string, rows: (string | number)[][]) {
  const csv = rows.map(r => r.map(v => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url)
}

export default function ReportsTab({ programs, cohorts, enrollments, registrations, certificates }: AdminPanel) {
  const [programFilter, setProgramFilter] = useState('all')
  const [inquiryCounts, setInquiryCounts] = useState<Record<string, number> | null>(null)

  useEffect(() => {
    supabase.from('inquiries').select('status, kind').then(({ data, error }) => {
      if (error || !data) return
      const c: Record<string, number> = {}
      for (const r of data) c[r.status] = (c[r.status] ?? 0) + 1
      c.__org = data.filter(r => r.kind === 'organization').length
      c.__total = data.length
      setInquiryCounts(c)
    })
  }, [])

  const programName = (id: string | null) => programs.find(p => p.id === id)?.name ?? 'Unassigned'
  const shownCohorts = cohorts.filter(c => programFilter === 'all' || c.program_id === programFilter)

  const byCohort = useMemo(() => shownCohorts.map(c => {
    const rows = enrollments.filter(e => e.cohort_id === c.id)
    return { c, active: rows.filter(e => e.status === 'active').length, completed: rows.filter(e => e.status === 'completed').length, withdrawn: rows.filter(e => e.status === 'withdrawn').length }
  }), [shownCohorts, enrollments])

  const byProgram = programs.map(p => {
    const ids = cohorts.filter(c => c.program_id === p.id).map(c => c.id)
    return { p, cohorts: ids.length, enrollments: enrollments.filter(e => ids.includes(e.cohort_id)).length, certificates: certificates.filter(c => c.program_id === p.id).length }
  }).filter(r => r.cohorts || r.enrollments || r.certificates)

  const regs = registrations as { status: string; payment_status: string | null }[]
  const regStats = { total: regs.length, paid: regs.filter(r => r.payment_status === 'paid').length, confirmed: regs.filter(r => r.status === 'confirmed').length, pending: regs.filter(r => r.status === 'pending').length }

  return (
    <div>
      <span style={labelStyle}>Reports</span>
      <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', margin: '0.25rem 0 0.5rem' }}>Program Reports</h1>
      <p style={{ color: 'var(--slate)', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '1.5rem', maxWidth: '46rem' }}>
        These are operational numbers (enrollments, registrations, inquiries) taken directly from the database. They describe participation, not leadership growth: they do not measure how effectively anyone leads. Participant reflections and journals are private and are not included.
      </p>

      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1rem' }}>
          <h3 style={{ ...h3, margin: 0 }}>Enrollment by cohort</h3>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label htmlFor="rep-program" style={labelStyle}>Program</label>
              <select id="rep-program" value={programFilter} onChange={e => setProgramFilter(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
                <option value="all">All programs</option>{programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <button className="btn btn-ghost-dark" style={{ fontSize: '0.78rem', padding: '0.6rem 1rem' }}
              onClick={() => download(`enrollment-by-cohort-${new Date().toISOString().slice(0, 10)}.csv`, [['Cohort', 'Program', 'Status', 'Capacity', 'Active', 'Completed', 'Withdrawn'], ...byCohort.map(r => [r.c.name, programName(r.c.program_id), r.c.status, r.c.capacity ?? '', r.active, r.completed, r.withdrawn])])}>Export CSV</button>
          </div>
        </div>
        {byCohort.length === 0 ? <p style={{ color: 'var(--slate)', fontSize: '0.85rem' }}>No cohorts yet.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Cohort', 'Program', 'Status', 'Fill', 'Completed', 'Withdrawn'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
              <tbody>{byCohort.map(({ c, active, completed, withdrawn }) => (
                <tr key={c.id}>
                  <td style={tdStyle}><strong style={{ color: 'var(--navy)' }}>{c.name}</strong></td>
                  <td style={tdStyle}>{programName(c.program_id)}</td>
                  <td style={tdStyle}>{statusBadge(c.status)}</td>
                  <td style={tdStyle}>{c.capacity ? `${active} / ${c.capacity} (${Math.round((active / c.capacity) * 100)}%)` : `${active} active · no capacity set`}</td>
                  <td style={tdStyle}>{completed}</td>
                  <td style={tdStyle}>{withdrawn}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>

      <div className="two-col-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div style={cardStyle}>
          <h3 style={h3}>By program</h3>
          {byProgram.length === 0 ? <p style={{ color: 'var(--slate)', fontSize: '0.85rem' }}>No activity yet.</p> : byProgram.map(r => (
            <div key={r.p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', padding: '0.55rem 0', borderBottom: '1px solid var(--mist)', fontSize: '0.85rem', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, color: 'var(--navy)' }}>{r.p.name}</span>
              <span style={{ color: 'var(--slate)' }}>{r.cohorts} cohorts · {r.enrollments} enrollments · {r.certificates} certificates</span>
            </div>
          ))}
        </div>
        <div style={cardStyle}>
          <h3 style={h3}>Registrations</h3>
          {[['Total', regStats.total], ['Paid', regStats.paid], ['Confirmed', regStats.confirmed], ['Awaiting review', regStats.pending]].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--mist)', fontSize: '0.88rem' }}><span>{k}</span><strong style={{ color: 'var(--navy)' }}>{v}</strong></div>
          ))}
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={h3}>Inquiries</h3>
        {!inquiryCounts ? <p style={{ color: 'var(--slate)', fontSize: '0.85rem' }}>No inquiry data yet.</p> : (
          <>
            <p style={{ color: 'var(--slate)', fontSize: '0.85rem', margin: '0 0 0.75rem' }}>{inquiryCounts.__total} total · {inquiryCounts.__org} from organizations · {inquiryCounts.__total ? Math.round(((inquiryCounts.converted ?? 0) / inquiryCounts.__total) * 100) : 0}% converted</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem' }}>
              {INQUIRY_STEPS.map(([k, l]) => (
                <div key={k} style={{ background: 'var(--paper)', padding: '0.75rem', borderRadius: '4px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--slate)' }}>{l}</span>
                  <div style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.8rem', color: 'var(--navy)' }}>{inquiryCounts[k] ?? 0}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
