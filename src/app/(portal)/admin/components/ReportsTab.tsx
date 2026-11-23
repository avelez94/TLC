'use client'

import { useMemo, useState } from 'react'
import type { AdminPanel } from '../useAdminPanel'
import { cohortCounts, enrollmentOutcome } from '@/lib/admin-metrics'
import { todayET } from '@/lib/business-time'
import { downloadCsv, toCsv } from '@/lib/csv'
import { cardStyle, helpStyle, inputStyle, labelStyle, pageTitleStyle, programChoices, secondaryButtonStyle, sectionTitleStyle, statusBadge, tdStyle, thStyle } from './shared'

const INQUIRY_STEPS: [string, string][] = [
  ['new', 'New'], ['contacted', 'Contacted'], ['qualified', 'Qualified'], ['follow_up', 'Follow-up needed'], ['converted', 'Converted'], ['closed', 'Closed'],
]
const COHORT_STATUS: Record<string, string> = {
  draft: 'Draft', upcoming: 'Upcoming', active: 'Active', completed: 'Completed', archived: 'Archived', cancelled: 'Cancelled',
}
const emptyStyle = { color: 'var(--slate)', fontSize: '0.9rem', margin: 0 } as const

function StatRows({ rows }: { rows: [string, number | string][] }) {
  return (
    <dl style={{ margin: 0 }}>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '0.5rem 0', borderBottom: '1px solid var(--mist)', fontSize: '0.9rem' }}>
          <dt style={{ color: 'var(--ink)' }}>{k}</dt><dd style={{ margin: 0, fontWeight: 700, color: 'var(--navy)' }}>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

export default function ReportsTab(panel: AdminPanel) {
  const { programs, cohorts, enrollments, registrations, certificates, inquiries, users } = panel
  const [programFilter, setProgramFilter] = useState('all')

  const choices = useMemo(() => programChoices(programs, true), [programs])
  const programName = (id: string | null | undefined) => programs.find(p => p.id === id)?.name ?? 'No pathway'
  const admins = useMemo(() => new Set(users.filter(u => u.role === 'admin').map(u => u.id)), [users])

  const byCohort = useMemo(() => cohorts
    .filter(c => programFilter === 'all' || c.program_id === programFilter)
    .map(c => ({ c, n: cohortCounts(c, enrollments) })), [cohorts, enrollments, programFilter])

  const exportCohorts = () => {
    const csv = toCsv(
      ['Cohort', 'Pathway or program', 'Cohort status', 'Seats taken', 'Capacity', 'In progress', 'Starting soon', 'Completed', 'Withdrew', 'In a cancelled cohort'],
      byCohort.map(({ c, n }) => [c.name, programName(c.program_id), COHORT_STATUS[c.status] ?? c.status, n.seatsTaken, c.capacity ?? 'No limit', n.inProgress, n.starting, n.completed, n.withdrawn, n.cancelled]),
    )
    downloadCsv(`enrollment-by-cohort-${todayET()}.csv`, csv)
  }

  const cohortStatus = useMemo(() => new Map(cohorts.map(c => [c.id, c.status])), [cohorts])
  const byProgram = useMemo(() => choices.map(p => {
    const ids = new Set(cohorts.filter(c => c.program_id === p.id).map(c => c.id))
    const rows = enrollments.filter(e => ids.has(e.cohort_id) && !admins.has(e.user_id))
    const outcome = (e: typeof rows[number]) => enrollmentOutcome(e.status, cohortStatus.get(e.cohort_id) ?? null)
    return {
      p,
      people: new Set(rows.map(e => e.user_id)).size,
      completed: rows.filter(e => outcome(e) === 'completed').length,
      withdrawn: rows.filter(e => outcome(e) === 'withdrawn').length,
      certificates: certificates.filter(c => c.program_id === p.id).length,
    }
  }).filter(r => r.p.pathway_number != null || r.people || r.certificates), [choices, cohorts, enrollments, certificates, admins, cohortStatus])

  const regCount = (fn: (r: (typeof registrations)[number]) => boolean) => registrations.filter(fn).length
  const inqTotal = inquiries.length
  const inqCount = (status: string) => inquiries.filter(i => i.status === status).length
  const inqOrgs = inquiries.filter(i => i.kind === 'organization').length
  const converted = inqCount('converted')

  return (
    <div>
      <span style={labelStyle}>Insights</span>
      <h1 style={pageTitleStyle}>Reports</h1>
      <p style={{ ...helpStyle, maxWidth: '46rem', marginBottom: '1.5rem' }}>
        Every number here comes straight from the records in the database; nothing is estimated. These numbers describe participation
        (who enrolled, finished or withdrew), not how effectively anyone leads. Participant reflections and journals are private and are never included.
      </p>

      <section style={cardStyle} aria-labelledby="rep-cohort">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1rem' }}>
          <h2 id="rep-cohort" style={{ ...sectionTitleStyle, margin: 0 }}>Enrollment by cohort</h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label htmlFor="rep-program" style={labelStyle}>Pathway or program</label>
              <select id="rep-program" value={programFilter} onChange={e => setProgramFilter(e.target.value)} style={{ ...inputStyle, width: 'auto', maxWidth: '100%' }}>
                <option value="all">All, including historical programs</option>
                {choices.map(p => <option key={p.id} value={p.id}>{p.name}{p.pathway_number == null ? ' (historical)' : ''}</option>)}
              </select>
            </div>
            <button type="button" onClick={exportCohorts} disabled={byCohort.length === 0} style={{ ...secondaryButtonStyle, padding: '0.75rem 1rem', opacity: byCohort.length ? 1 : 0.5 }}>
              Export CSV ({byCohort.length})
            </button>
          </div>
        </div>
        {byCohort.length === 0 ? <p style={emptyStyle}>No cohorts {programFilter === 'all' ? 'yet' : 'for this pathway or program'}.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '640px' }}>
              <thead><tr>{['Cohort', 'Pathway', 'Status', 'Seats', 'In progress / Starting', 'Completed', 'Withdrew'].map(h => <th key={h} scope="col" style={thStyle}>{h}</th>)}</tr></thead>
              <tbody>{byCohort.map(({ c, n }) => (
                <tr key={c.id}>
                  <td style={tdStyle}><strong style={{ color: 'var(--navy)' }}>{c.name}</strong></td>
                  <td style={tdStyle}>{programName(c.program_id)}</td>
                  <td style={tdStyle}>{statusBadge(c.status)}</td>
                  <td style={tdStyle}>{c.capacity ? `${n.seatsTaken} / ${c.capacity}` : `${n.seatsTaken} · no limit`}</td>
                  <td style={tdStyle}>
                    {c.status === 'cancelled'
                      ? <span style={{ color: 'var(--slate)' }}>{n.cancelled} (cohort cancelled)</span>
                      : c.status === 'active' ? `${n.inProgress} in progress` : n.starting ? `${n.starting} starting` : '0'}
                  </td>
                  <td style={tdStyle}>{n.completed}</td>
                  <td style={tdStyle}>{n.withdrawn}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      <div className="two-col-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <section style={cardStyle} aria-labelledby="rep-program-h">
          <h2 id="rep-program-h" style={sectionTitleStyle}>By pathway or program</h2>
          {byProgram.length === 0 ? <p style={emptyStyle}>No pathways or programs yet.</p> : byProgram.map(r => (
            <div key={r.p.id} style={{ padding: '0.6rem 0', borderBottom: '1px solid var(--mist)', fontSize: '0.9rem' }}>
              <div style={{ fontWeight: 600, color: 'var(--navy)' }}>{r.p.name}{r.p.pathway_number == null && <span style={{ color: 'var(--slate)', fontWeight: 400 }}> (historical)</span>}</div>
              <div style={{ color: 'var(--slate)', fontSize: '0.85rem', marginTop: '0.15rem' }}>
                {r.people} {r.people === 1 ? 'person' : 'people'} · {r.completed} completed · {r.withdrawn} withdrew · {r.certificates} certificate{r.certificates === 1 ? '' : 's'} issued
              </div>
            </div>
          ))}
        </section>

        <section style={cardStyle} aria-labelledby="rep-reg">
          <h2 id="rep-reg" style={sectionTitleStyle}>Registration history</h2>
          <StatRows rows={[
            ['Total registrations', registrations.length],
            ['Confirmed', regCount(r => r.status === 'confirmed')],
            ['Declined', regCount(r => r.status === 'declined')],
            ['Waitlist', regCount(r => r.status === 'waitlist')],
            ['Pending', regCount(r => r.status === 'pending')],
            ['Checkout completed', regCount(r => r.payment_status === 'paid')],
          ]} />
          <p style={{ ...helpStyle, fontSize: '0.82rem', margin: '0.75rem 0 0' }}>
            “Checkout completed” counts registrations that went through the online checkout. Past programs were free, so this is not an amount of money.
          </p>
        </section>
      </div>

      <section style={cardStyle} aria-labelledby="rep-inq">
        <h2 id="rep-inq" style={sectionTitleStyle}>Inquiries</h2>
        {inqTotal === 0 ? <p style={emptyStyle}>No inquiries yet.</p> : (
          <>
            <p style={{ color: 'var(--slate)', fontSize: '0.9rem', margin: '0 0 0.75rem' }}>
              {inqTotal} total · {inqOrgs} from organizations · {inqTotal - inqOrgs} from individuals · {Math.round((converted / inqTotal) * 100)}% converted
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem' }}>
              {INQUIRY_STEPS.map(([k, l]) => (
                <div key={k} style={{ background: 'var(--paper)', padding: '0.75rem', borderRadius: '4px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--slate)' }}>{l}</span>
                  <div style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.8rem', color: 'var(--navy)' }}>{inqCount(k)}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <section style={cardStyle} aria-labelledby="rep-defs">
        <h2 id="rep-defs" style={sectionTitleStyle}>Definitions</h2>
        <ul style={{ ...helpStyle, paddingLeft: '1.2rem', margin: 0 }}>
          <li><strong>Seats</strong>: people currently enrolled (status Active) compared with the cohort’s capacity. This is the same count the site checks before letting anyone else in.</li>
          <li><strong>In progress</strong>: enrolled in a cohort that is running now (status Active).</li>
          <li><strong>Starting</strong>: enrolled in a cohort that has not started yet (Upcoming or Draft).</li>
          <li><strong>Completed</strong>: marked Completed, or enrolled in a cohort that is now Completed or Archived.</li>
          <li><strong>Withdrew</strong>: the enrollment was marked Withdrawn. Their history and certificates are kept.</li>
          <li><strong>Cohort cancelled</strong>: enrolled in a cohort that was Cancelled; not counted as completed or withdrawn.</li>
          <li><strong>People</strong> (by pathway or program): different people enrolled in any of its cohorts; someone in two cohorts counts once. Administrators are not counted. Completed and withdrew there count enrollments.</li>
          <li><strong>Certificates issued</strong>: certificates recorded for that pathway or program.</li>
          <li><strong>Converted</strong>: inquiries marked Converted, as a share of all inquiries.</li>
        </ul>
      </section>
    </div>
  )
}
