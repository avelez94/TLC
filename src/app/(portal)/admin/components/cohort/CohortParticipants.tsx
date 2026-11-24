// Everyone enrolled in one cohort (current, completed and withdrawn), plus enrolling someone.
import { useState } from 'react'
import Link from 'next/link'
import { enrollmentOutcome, OUTCOME_LABEL, seatsTaken } from '@/lib/admin-metrics'
import { formatDateET } from '@/lib/business-time'
import { InlineError } from '../feedback'
import { inputStyle, labelStyle, linkButtonStyle, dangerLinkStyle, statusBadge } from '../shared'
import { inlineLinkStyle, metaStyle, panelBoxStyle, rowStyle, smallButtonStyle, subheadStyle, type CohortSectionProps } from './ui'

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

  const sendAccess = async (enrollmentId: string, userId: string) => {
    setBusyId(enrollmentId)
    const err = await panel.handleSendAccessEmail(userId)
    setRowErrors(prev => ({ ...prev, [enrollmentId]: err }))
    setBusyId(null)
  }
  const undelivered = new Set(panel.emailProblems
    .filter(m => (m.status === 'failed' || m.status === 'bounced') && !m.resolved_at && m.related_user_id)
    .map(m => m.related_user_id as string))

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
                  {e.status !== 'withdrawn' && (() => {
                    const person = panel.users.find(u => u.id === e.user_id)
                    if (!person || person.role === 'admin' || person.last_sign_in_at) return null
                    return (
                      <span style={{ ...metaStyle, fontSize: '0.8rem', display: 'block', color: undelivered.has(e.user_id) ? '#8c1d18' : 'var(--slate)' }}>
                        {undelivered.has(e.user_id) ? 'Not signed in yet · their last email did not arrive. ' : 'Not signed in yet. '}
                        <button type="button" onClick={() => void sendAccess(e.id, e.user_id)} disabled={busy} style={{ ...linkButtonStyle, fontSize: '0.8rem' }}>
                          {busy ? 'Sending…' : 'Send sign-in email'}
                        </button>
                      </span>
                    )
                  })()}
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
          <Link id={`cohort-${cohort.id}-link-invite`} href={`/admin/users?invite=1&cohort=${cohort.id}`} style={inlineLinkStyle}>Invite someone new</Link>
          {' '}— opens the invitation form for this cohort. They get an email and set their own password.
        </p>
        <p style={{ ...metaStyle, fontSize: '0.82rem', margin: '0.4rem 0 0' }}>People who withdrew are listed above with a Re-enroll button.</p>
      </div>

      <div style={panelBoxStyle}>
        <h4 style={subheadStyle}>For this cohort’s participants</h4>
        <ul style={{ ...metaStyle, margin: 0, paddingLeft: '1.1rem' }}>
          <li style={{ marginBottom: '0.35rem' }}>
            <Link id={`cohort-${cohort.id}-link-resource`} href={`/admin/resources?cohort=${cohort.id}`} style={inlineLinkStyle}>Add a resource for this cohort</Link>
            {' '}— materials they see in their portal.
          </li>
          <li>
            <Link id={`cohort-${cohort.id}-link-announcement`} href={`/admin/announcements?cohort=${cohort.id}`} style={inlineLinkStyle}>Post a welcome announcement</Link>
            {' '}— shown in their portal (no email is sent).
          </li>
        </ul>
      </div>
    </div>
  )
}
