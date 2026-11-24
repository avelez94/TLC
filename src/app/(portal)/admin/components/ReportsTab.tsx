'use client'

import { useMemo, useState } from 'react'
import type { AdminPanel } from '../useAdminPanel'
import { cohortCounts, enrollmentOutcome, OUTCOME_LABEL } from '@/lib/admin-metrics'
import { csvDateTimeET, formatDateET, todayET } from '@/lib/business-time'
import { downloadCsv, toCsv } from '@/lib/csv'
import {
  formatCents, isFreeCheckout, isOverdue, netCollectedCents, outstandingCents, paidCents, paymentState, requestNetCollectedCents,
  METHOD_LABEL, PAYMENT_REQUEST_LABEL, type PaymentRegistration,
} from '@/lib/payment-attention'
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
      ['Cohort', 'Pathway or program', 'Cohort status', 'Seats taken', 'Capacity', 'In progress', 'Starting soon', 'Completed (recorded)', 'Finished, completion not recorded', 'Withdrew', 'In a cancelled cohort'],
      byCohort.map(({ c, n }) => [c.name, programName(c.program_id), COHORT_STATUS[c.status] ?? c.status, n.seatsTaken, c.capacity ?? 'No limit', n.inProgress, n.starting, n.completed, n.awaitingReview, n.withdrawn, n.cancelled]),
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
      awaitingReview: rows.filter(e => outcome(e) === 'awaiting_review').length,
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
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '760px' }}>
              <thead><tr>{['Cohort', 'Pathway', 'Status', 'Seats', 'In progress / Starting', 'Completed', 'Completion not recorded', 'Withdrew'].map(h => <th key={h} scope="col" style={thStyle}>{h}</th>)}</tr></thead>
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
                  <td style={tdStyle}>{n.awaitingReview ? <span style={{ color: '#7a4a00', fontWeight: 600 }} title={OUTCOME_LABEL.awaiting_review}>{n.awaitingReview} finished · not recorded</span> : (c.status === 'completed' || c.status === 'archived') ? '0' : '—'}</td>
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
                {r.people} {r.people === 1 ? 'person' : 'people'} · {r.completed} completed{r.awaitingReview ? ` · ${r.awaitingReview} finished, completion not recorded` : ''} · {r.withdrawn} withdrew · {r.certificates} certificate{r.certificates === 1 ? '' : 's'} issued
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
            ['Checkout completed, free (no charge)', regCount(r => isFreeCheckout(r as PaymentRegistration))],
            ['Paid (money received)', regCount(r => netCollectedCents(r as PaymentRegistration) > 0 || (r as PaymentRegistration).payment_status === 'refunded')],
            ['Complimentary', regCount(r => r.payment_status === 'complimentary')],
          ]} />
          <p style={{ ...helpStyle, fontSize: '0.82rem', margin: '0.75rem 0 0' }}>
            “Checkout completed, free” counts registrations that went through the online checkout for programs that were free. They are not money. Amounts are under Payments.
          </p>
        </section>
      </div>

      <PaymentsReport panel={panel} programName={programName} />

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
          <li><strong>Completed</strong>: an administrator recorded the person as Completed. Completion is never assumed because a cohort ended.</li>
          <li><strong>Completion not recorded</strong> (“{OUTCOME_LABEL.awaiting_review}”): still enrolled in a cohort that is now Completed or Archived, with no completion recorded yet. Record it from the cohort’s Completion section.</li>
          <li><strong>Withdrew</strong>: the enrollment was marked Withdrawn. Their history and certificates are kept.</li>
          <li><strong>Cohort cancelled</strong>: enrolled in a cohort that was Cancelled; not counted as completed or withdrawn.</li>
          <li><strong>People</strong> (by pathway or program): different people enrolled in any of its cohorts; someone in two cohorts counts once. Administrators are not counted. Completed and withdrew there count enrollments.</li>
          <li><strong>Certificates issued</strong>: certificates recorded for that pathway or program.</li>
          <li><strong>Converted</strong>: inquiries marked Converted, as a share of all inquiries.</li>
          <li><strong>Collected</strong> (Payments): money Stripe reported as paid (or that you recorded for an offline request), minus refunds. Free checkouts and complimentary places are counted, never as money. Nothing is estimated from prices or seats.</li>
          <li><strong>Outstanding</strong>: payment requests sent and not yet fully paid (open, partly paid or failed). Not counted as collected.</li>
        </ul>
      </section>
    </div>
  )
}

// ------------------------------------------------------------------ payments
type PayReg = PaymentRegistration & { program_id: string | null; created_at: string }

function PaymentsReport({ panel, programName }: { panel: AdminPanel; programName: (id: string | null | undefined) => string }) {
  const regs = panel.registrations as unknown as PayReg[]
  const requests = panel.paymentRequests
  const cohortName = (id: string | null) => (id ? panel.cohorts.find(c => c.id === id)?.name ?? 'Unknown cohort' : 'No cohort')
  const cohortProgram = (id: string | null) => (id ? panel.cohorts.find(c => c.id === id)?.program_id ?? null : null)

  const m = (() => {
    const regCollected = regs.reduce((n, r) => n + netCollectedCents(r), 0)
    const reqCollected = requests.reduce((n, r) => n + requestNetCollectedCents(r), 0)
    const regRefunds = regs.filter(r => (r.amount_refunded_cents ?? 0) > 0)
    const reqRefunds = requests.filter(r => r.amount_refunded_cents > 0)
    const outstanding = requests.filter(r => outstandingCents(r) > 0 && r.status !== 'draft')
    const group = (key: (x: { program: string | null; cohort: string | null }) => string) => {
      const map = new Map<string, { individual: number; org: number; payers: number }>()
      const add = (k: string, field: 'individual' | 'org', cents: number) => {
        if (cents <= 0) return
        const v = map.get(k) ?? { individual: 0, org: 0, payers: 0 }
        v[field] += cents; v.payers += 1; map.set(k, v)
      }
      for (const r of regs) add(key({ program: r.program_id, cohort: r.cohort_id ?? null }), 'individual', netCollectedCents(r))
      for (const r of requests) add(key({ program: cohortProgram(r.cohort_id), cohort: r.cohort_id }), 'org', requestNetCollectedCents(r))
      return [...map.entries()].sort((a, b) => (b[1].individual + b[1].org) - (a[1].individual + a[1].org))
    }
    return {
      regCollected, reqCollected, total: regCollected + reqCollected,
      paidCount: regs.filter(r => netCollectedCents(r) > 0).length,
      orgPaid: requests.filter(r => requestNetCollectedCents(r) > 0),
      refundCents: regRefunds.reduce((n, r) => n + (r.amount_refunded_cents ?? 0), 0) + reqRefunds.reduce((n, r) => n + r.amount_refunded_cents, 0),
      refundCount: regRefunds.length + reqRefunds.length,
      free: regs.filter(isFreeCheckout).length,
      complimentary: regs.filter(r => r.payment_status === 'complimentary').length,
      failedRegs: regs.filter(r => r.payment_status === 'failed').length,
      failedReqs: requests.filter(r => r.status === 'failed').length,
      awaiting: regs.filter(r => netCollectedCents(r) > 0 && (r.status ?? 'pending') === 'pending').length,
      outstanding, outstandingCents: outstanding.reduce((n, r) => n + outstandingCents(r), 0),
      byProgram: group(x => programName(x.program)),
      byCohort: group(x => cohortName(x.cohort)),
    }
  })()

  const exportPayments = () => {
    const rows: (string | number | null)[][] = [
      ...regs.filter(r => r.payment_status && r.payment_status !== 'unpaid').map(r => [
        'Registration', r.full_name ?? '', r.email ?? '', programName(r.program_id), cohortName(r.cohort_id ?? null), paymentState(r).label,
        ((paidCents(r) ?? 0) / 100).toFixed(2), ((r.amount_refunded_cents ?? 0) / 100).toFixed(2), (netCollectedCents(r) / 100).toFixed(2), '0.00',
        csvDateTimeET(r.paid_at ?? null), r.status ?? '', r.complimentary_reason ?? '', r.stripe_payment_intent_id ?? '',
      ]),
      ...requests.map(r => [
        `Payment request (${METHOD_LABEL[r.method] ?? r.method})`, r.payer_name, r.payer_email ?? '', programName(cohortProgram(r.cohort_id)), cohortName(r.cohort_id),
        PAYMENT_REQUEST_LABEL[r.status] ?? r.status, (r.amount_paid_cents / 100).toFixed(2), (r.amount_refunded_cents / 100).toFixed(2),
        (requestNetCollectedCents(r) / 100).toFixed(2), (outstandingCents(r) / 100).toFixed(2), csvDateTimeET(r.paid_at), r.due_date ?? '', r.description, r.stripe_object_id ?? '',
      ]),
    ]
    downloadCsv(`payments-${todayET()}.csv`, toCsv(
      ['Type', 'Name or payer', 'Email', 'Pathway or program', 'Cohort', 'Payment status', 'Paid (USD)', 'Refunded (USD)', 'Collected (USD)', 'Outstanding (USD)', 'Paid at (ET)', 'Decision / due date', 'Note', 'Stripe reference'],
      rows,
    ))
  }

  const tile = (label: string, value: string, sub?: string) => (
    <div style={{ background: 'var(--paper)', padding: '0.85rem', borderRadius: '4px' }}>
      <span style={{ fontSize: '0.8rem', color: 'var(--slate)' }}>{label}</span>
      <div style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.7rem', color: 'var(--navy)' }}>{value}</div>
      {sub && <span style={{ fontSize: '0.78rem', color: 'var(--slate)' }}>{sub}</span>}
    </div>
  )

  return (
    <section style={cardStyle} aria-labelledby="rep-pay">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '0.75rem' }}>
        <h2 id="rep-pay" style={{ ...sectionTitleStyle, margin: 0 }}>Payments</h2>
        <button type="button" onClick={exportPayments} style={{ ...secondaryButtonStyle, padding: '0.75rem 1rem' }}>Export payments CSV</button>
      </div>
      <p style={{ ...helpStyle, fontSize: '0.86rem' }}>
        From recorded payments only (Stripe, or offline payments you marked paid). Collected, outstanding and enrollment are separate: a payment does not mean someone is enrolled, and an enrollment does not mean anyone paid.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
        {tile('Collected (after refunds)', formatCents(m.total), `${formatCents(m.regCollected)} individuals · ${formatCents(m.reqCollected)} organizations`)}
        {tile('Outstanding', formatCents(m.outstandingCents), `${m.outstanding.length} open request${m.outstanding.length === 1 ? '' : 's'}`)}
        {tile('Refunded', formatCents(m.refundCents), `${m.refundCount} payment${m.refundCount === 1 ? '' : 's'}`)}
        {tile('Paid, awaiting your confirmation', String(m.awaiting), 'not enrolled yet')}
      </div>
      <StatRows rows={[
        ['Individual payments (registrations with money kept)', m.paidCount],
        ['Organization payments received', `${m.orgPaid.length} · ${formatCents(m.reqCollected)}`],
        ['Complimentary places (no charge, approved by you)', m.complimentary],
        ['Free checkouts (earlier free programs, no charge)', m.free],
        ['Failed payments', `${m.failedRegs} registration${m.failedRegs === 1 ? '' : 's'} · ${m.failedReqs} request${m.failedReqs === 1 ? '' : 's'}`],
      ]} />

      <div className="two-col-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
        {([['By pathway or program', m.byProgram], ['By cohort', m.byCohort]] as const).map(([title, rows]) => (
          <div key={title}>
            <h3 style={{ ...sectionTitleStyle, fontSize: '1.05rem' }}>{title}</h3>
            {rows.length === 0 ? <p style={emptyStyle}>No money collected yet.</p> : rows.map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '0.45rem 0', borderBottom: '1px solid var(--mist)', fontSize: '0.88rem' }}>
                <span>{k}</span>
                <span style={{ textAlign: 'right' }}><strong style={{ color: 'var(--navy)' }}>{formatCents(v.individual + v.org)}</strong><br />
                  <span style={{ color: 'var(--slate)', fontSize: '0.78rem' }}>{v.individual ? `${formatCents(v.individual)} individuals` : ''}{v.individual && v.org ? ' · ' : ''}{v.org ? `${formatCents(v.org)} organizations` : ''}</span></span>
              </div>
            ))}
          </div>
        ))}
      </div>

      <h3 style={{ ...sectionTitleStyle, fontSize: '1.05rem', marginTop: '1.25rem' }}>Outstanding requests</h3>
      {m.outstanding.length === 0 ? <p style={emptyStyle}>Nothing outstanding.</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
            <thead><tr>{['Payer', 'For', 'Method', 'Outstanding', 'Due', 'Status'].map(h => <th key={h} scope="col" style={thStyle}>{h}</th>)}</tr></thead>
            <tbody>{m.outstanding.map(r => (
              <tr key={r.id}>
                <td style={tdStyle}>{r.inquiry_id ? <a href={`/admin/inquiries?id=${r.inquiry_id}`} style={{ color: '#8a5a10', fontWeight: 600 }}>{r.payer_name}</a> : r.payer_name}</td>
                <td style={tdStyle}>{r.description}{r.seats ? ` (${r.seats} seats)` : ''}</td>
                <td style={tdStyle}>{METHOD_LABEL[r.method] ?? r.method}</td>
                <td style={tdStyle}><strong>{formatCents(outstandingCents(r), r.currency)}</strong>{r.amount_paid_cents > 0 ? ` of ${formatCents(r.amount_cents, r.currency)}` : ''}</td>
                <td style={tdStyle}>{r.due_date ? <span style={isOverdue(r) ? { color: '#b3261e', fontWeight: 700 } : undefined}>{formatDateET(r.due_date)}{isOverdue(r) ? ' · overdue' : ''}</span> : '—'}</td>
                <td style={tdStyle}>{PAYMENT_REQUEST_LABEL[r.status] ?? r.status}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  )
}
