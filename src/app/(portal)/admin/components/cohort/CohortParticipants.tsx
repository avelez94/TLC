// Everyone enrolled in one cohort (current, completed and withdrawn), plus enrolling someone.
import { useState } from 'react'
import Link from 'next/link'
import { enrollmentOutcome, OUTCOME_LABEL, seatsTaken } from '@/lib/admin-metrics'
import { formatDateET } from '@/lib/business-time'
import { InlineError } from '../feedback'
import { inputStyle, labelStyle, linkButtonStyle, dangerLinkStyle, statusBadge } from '../shared'
import { metaStyle, panelBoxStyle, rowStyle, smallButtonStyle, subheadStyle, type CohortSectionProps } from './ui'

const ORDER: Record<string, number> = { active: 0, completed: 1, withdrawn: 2 }

export default function CohortParticipants({ panel, cohort }: CohortSectionProps) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rowErrors, setRowErrors] = useState<Record<string, string | null>>({})
  const [pick, setPick] = useState('')
  const [enrolling, setEnrolling] = useState(false)
  const [enrollError, setEnrollError] = useState<string | null>(null)

  const nameOf = (userId: string, fallback?: string | null) => fallback || panel.personName(userId)
  const emailOf = (userId: string, fallback?: string | null) => fallback ?? panel.users.find(u => u.id === userId)?.email ?? ''

  const rows = panel.enrollments
    .filter(e => e.cohort_id === cohort.id)
    .map(e => ({ e, name: nameOf(e.user_id, e.profiles?.full_name), email: emailOf(e.user_id, e.profiles?.email) }))
    .sort((a, b) => (ORDER[a.e.status] ?? 3) - (ORDER[b.e.status] ?? 3) || a.name.localeCompare(b.name))

  const taken = seatsTaken(cohort.id, panel.enrollments)
  const full = cohort.capacity != null && taken >= cohort.capacity
  const already = new Set(rows.map(r => r.e.user_id))
  const candidates = panel.users
    .filter(u => u.role === 'impact_participant' && !already.has(u.id))
    .sort((a, b) => (a.full_name || a.email || '').localeCompare(b.full_name || b.email || ''))

  const withdraw = async (enrollmentId: string, name: string) => {
    if (!(await panel.confirm({
      title: `Withdraw ${name}?`,
      message: `${name} will be marked as withdrawn from ${cohort.name}.`,
      consequences: [
        'They lose access to this cohort’s materials and community.',
        'Their history, reflections and certificates are kept.',
        'You can re-enroll them later.',
      ],
      confirmLabel: 'Withdraw',
      danger: true,
    }))) return
    setBusyId(enrollmentId)
    const err = await panel.handleWithdrawEnrollment(enrollmentId)
    setRowErrors(prev => ({ ...prev, [enrollmentId]: err }))
    setBusyId(null)
  }

  const reenroll = async (enrollmentId: string, userId: string) => {
    setBusyId(enrollmentId)
    const err = await panel.handleEnrollUser(userId, cohort.id)
    setRowErrors(prev => ({ ...prev, [enrollmentId]: err }))
    setBusyId(null)
  }

  const enroll = async () => {
    if (!pick) { setEnrollError('Choose a person to enroll.'); return }
    setEnrolling(true)
    setEnrollError(null)
    const err = await panel.handleEnrollUser(pick, cohort.id)
    setEnrolling(false)
    if (err) setEnrollError(err)
    else setPick('')
  }

  const selectId = `enroll-${cohort.id}`
  return (
    <div>
      <p style={{ ...metaStyle, margin: '0 0 0.5rem' }}>
        {cohort.capacity != null ? `${taken} of ${cohort.capacity} seats taken.` : `${taken} enrolled, no seat limit.`}
        {' '}Withdrawn and completed participants stay on this list so their history is visible.
      </p>

      {rows.length === 0 ? (
        <p style={{ ...metaStyle, margin: '0.75rem 0' }}>Nobody is enrolled yet. Enroll an existing participant below, or invite someone new.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {rows.map(({ e, name, email }) => {
            const outcome = enrollmentOutcome(e.status, cohort.status)
            const busy = busyId === e.id
            return (
              <li key={e.id} style={rowStyle}>
                <div style={{ minWidth: 0, flex: '1 1 220px' }}>
                  <span style={{ display: 'block', fontWeight: 600, color: 'var(--navy)', fontSize: '0.92rem' }}>{name}</span>
                  {email && <span style={{ ...metaStyle, display: 'block', overflowWrap: 'anywhere' }}>{email}</span>}
                  {e.enrolled_at && <span style={{ ...metaStyle, fontSize: '0.8rem', display: 'block' }}>Enrolled {formatDateET(e.enrolled_at)}</span>}
                  <InlineError message={rowErrors[e.id]} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  {statusBadge(outcome, OUTCOME_LABEL[outcome])}
                  {e.status === 'active' && (
                    <button type="button" onClick={() => void withdraw(e.id, name)} disabled={busy} style={{ ...dangerLinkStyle, padding: '0.5rem 0' }}>
                      {busy ? 'Withdrawing…' : 'Withdraw'}
                    </button>
                  )}
                  {e.status === 'withdrawn' && (
                    <button type="button" onClick={() => void reenroll(e.id, e.user_id)} disabled={busy} style={{ ...linkButtonStyle, padding: '0.5rem 0' }}>
                      {busy ? 'Re-enrolling…' : 'Re-enroll'}
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <div style={panelBoxStyle}>
        <h4 style={subheadStyle}>Enroll a participant</h4>
        {full && <p style={{ ...metaStyle, color: '#8c1d18', margin: '0 0 0.75rem' }}>This cohort is full ({taken} of {cohort.capacity} seats). Raise the capacity under Details to add someone.</p>}
        <label htmlFor={selectId} style={labelStyle}>Existing Impact Lab participant</label>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <select id={selectId} value={pick} onChange={e => { setPick(e.target.value); setEnrollError(null) }} style={{ ...inputStyle, flex: '1 1 240px', width: 'auto' }}>
            <option value="">{candidates.length ? 'Choose a person…' : 'Everyone is already listed above'}</option>
            {candidates.map(u => <option key={u.id} value={u.id}>{u.full_name || u.email}{u.full_name && u.email ? ` (${u.email})` : ''}</option>)}
          </select>
          <button type="button" className="btn btn-primary" onClick={() => void enroll()} disabled={enrolling || !candidates.length} style={smallButtonStyle}>
            {enrolling ? 'Enrolling…' : 'Enroll'}
          </button>
        </div>
        <InlineError message={enrollError} />
        <p style={{ ...metaStyle, margin: '0.75rem 0 0' }}>
          Someone without an account yet?{' '}
          <Link href={`/admin/users?invite=1&cohort=${cohort.id}`} style={{ color: '#8a5a10', fontWeight: 600 }}>Invite someone new</Link>
          {' '}— opens the invitation form for this cohort. They get an email and set their own password.
        </p>
        <p style={{ ...metaStyle, fontSize: '0.82rem', margin: '0.4rem 0 0' }}>People who withdrew are listed above with a Re-enroll button.</p>
      </div>
    </div>
  )
}
