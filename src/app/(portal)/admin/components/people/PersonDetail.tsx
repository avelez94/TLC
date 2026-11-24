'use client'

import { useState } from 'react'
import type { Profile } from '@/types'
import type { AdminPanel } from '../../useAdminPanel'
import { enrollmentOutcome, OUTCOME_LABEL } from '@/lib/admin-metrics'
import { formatDateET, formatDateTimeET } from '@/lib/business-time'
import { InlineError } from '../feedback'
import { helpStyle, inputStyle, labelStyle, linkButtonStyle, dangerLinkStyle, secondaryButtonStyle, statusBadge } from '../shared'
import CoachingBilling from './CoachingBilling'
import Link from 'next/link'
import { Detail, detailGrid, enrollableCohortChoices, ENROLLABLE_STATUSES, personLabel, primaryButton, ROLE_LABEL } from './common'
import EmailProblems from './EmailProblems'

const subTitle = { fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.15rem', color: 'var(--navy)', letterSpacing: '0.04em', margin: '0 0 0.6rem' }
const block = { background: 'white', border: '1px solid var(--mist)', borderRadius: '6px', padding: '1.25rem', marginBottom: '1.25rem' }

export default function PersonDetail({ panel, user }: { panel: AdminPanel; user: Profile }) {
  const name = personLabel(user)
  const inquiryIds = new Set(panel.inquiryParticipants.filter(p => p.user_id === user.id).map(p => p.inquiry_id))
  const fromInquiries = panel.inquiries.filter(i => inquiryIds.has(i.id))
  return (
    <div style={{ padding: '1.25rem', background: 'var(--paper)', borderBottom: '1px solid var(--mist)' }}>
      <div style={detailGrid}>
        <Detail label="Email">{user.email ? <a href={`mailto:${user.email}`} style={{ color: '#8a5a10' }}>{user.email}</a> : 'None'}</Detail>
        {user.phone && <Detail label="Phone">{user.phone}</Detail>}
        {user.organization && <Detail label="Organization">{user.organization}</Detail>}
        <Detail label="Joined">{formatDateET(user.created_at, 'long') || 'Unknown'}</Detail>
        <Detail label="Last sign-in">{user.last_sign_in_at ? formatDateTimeET(user.last_sign_in_at) : 'Has not signed in yet (no password chosen)'}</Detail>
        <Detail label="Time zone">{user.timezone || 'Not set'}</Detail>
        {fromInquiries.length > 0 && (
          <Detail label="Came from">
            {fromInquiries.map(i => <Link key={i.id} href={`/admin/inquiries?id=${i.id}`} style={{ color: '#8a5a10', display: 'block' }}>{i.organization || i.contact_name} inquiry →</Link>)}
          </Detail>
        )}
      </div>
      <EmailProblems panel={panel} userId={user.id} />

      <Enrollments panel={panel} user={user} name={name} />
      {user.role === 'coaching_client' && <CoachingBilling panel={panel} user={user} />}
      {(user.role !== 'admin' || panel.certificates.some(c => c.user_id === user.id)) && <Certificates panel={panel} user={user} />}
      <RoleAndAccess panel={panel} user={user} name={name} />
    </div>
  )
}

function Enrollments({ panel, user, name }: { panel: AdminPanel; user: Profile; name: string }) {
  const [pick, setPick] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const mine = panel.enrollments.filter(e => e.user_id === user.id)
  if (user.role !== 'impact_participant' && mine.length === 0) return null

  const choices = enrollableCohortChoices(panel).filter(c => !mine.some(e => e.cohort_id === c.cohort.id))

  const enroll = async (cohortId: string, key: string) => {
    setError(null)
    setBusyId(key)
    const msg = await panel.handleEnrollUser(user.id, cohortId)
    setBusyId(null)
    if (msg) { setError(msg); return }
    if (key === 'new') setPick('')
  }

  const withdraw = async (enrollmentId: string, cohortName: string) => {
    setError(null)
    const yes = await panel.confirm({
      title: `Withdraw ${name} from ${cohortName}?`,
      consequences: [
        "They lose access to this cohort's materials and community.",
        'Their history, reflections and certificates are kept.',
        'You can re-enroll them later.',
      ],
      confirmLabel: 'Withdraw',
      danger: true,
    })
    if (!yes) return
    setBusyId(enrollmentId)
    const msg = await panel.handleWithdrawEnrollment(enrollmentId)
    setBusyId(null)
    if (msg) setError(msg)
  }

  return (
    <section style={block}>
      <h3 style={subTitle}>Cohort enrollments</h3>
      {mine.length === 0 ? (
        <p style={{ ...helpStyle, margin: '0 0 0.75rem' }}>Not enrolled in any cohort.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: '0 0 0.75rem', padding: 0 }}>
          {mine.map(e => {
            const cohort = panel.cohorts.find(c => c.id === e.cohort_id)
            const outcome = enrollmentOutcome(e.status, cohort?.status ?? null)
            const cohortName = cohort?.name ?? 'Unknown cohort'
            const canWithdraw = e.status === 'active' && (outcome === 'in_progress' || outcome === 'starting')
            const canReenroll = e.status === 'withdrawn' && !!cohort && ENROLLABLE_STATUSES.includes(cohort.status)
            return (
              <li key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', padding: '0.6rem 0', borderBottom: '1px solid var(--mist)' }}>
                <span style={{ fontSize: '0.92rem', color: 'var(--ink)', fontWeight: 600, flex: '1 1 180px' }}>
                  {cohortName}
                  {cohort?.programs?.name && <span style={{ fontWeight: 400, color: 'var(--slate)' }}> · {cohort.programs.name}</span>}
                </span>
                {statusBadge(outcome === 'awaiting_review' ? 'pending' : outcome, OUTCOME_LABEL[outcome])}
                {e.status === 'completed' && e.completed_at && <span style={{ fontSize: '0.82rem', color: 'var(--slate)' }}>on {formatDateET(e.completed_at)}</span>}
                {(outcome === 'awaiting_review' || outcome === 'in_progress' || e.status === 'completed') && (
                  <Link href={`/admin/cohorts?cohort=${e.cohort_id}&section=completion`} style={{ fontSize: '0.85rem', fontWeight: 600, color: '#8a5a10' }}>
                    {e.status === 'completed' ? 'Certificate →' : 'Completion review →'}
                  </Link>
                )}
                {canWithdraw && (
                  <button type="button" onClick={() => withdraw(e.id, cohortName)} disabled={busyId !== null} style={{ ...dangerLinkStyle, minHeight: '36px' }}>
                    {busyId === e.id ? 'Withdrawing…' : 'Withdraw'}
                  </button>
                )}
                {canReenroll && (
                  <button type="button" onClick={() => enroll(e.cohort_id, e.id)} disabled={busyId !== null} style={{ ...linkButtonStyle, minHeight: '36px' }}>
                    {busyId === e.id ? 'Re-enrolling…' : 'Re-enroll'}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {user.role === 'impact_participant' && (
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 260px', minWidth: 0 }}>
            <label htmlFor={`enroll-${user.id}`} style={labelStyle}>Enroll in a cohort</label>
            <select id={`enroll-${user.id}`} value={pick} onChange={e => { setPick(e.target.value); setError(null) }} style={inputStyle}>
              <option value="">Choose a cohort…</option>
              {choices.map(c => <option key={c.cohort.id} value={c.cohort.id} disabled={c.full}>{c.label}</option>)}
            </select>
          </div>
          <button type="button" className="btn btn-primary" style={primaryButton} disabled={!pick || busyId !== null} onClick={() => enroll(pick, 'new')}>
            {busyId === 'new' ? 'Enrolling…' : 'Enroll'}
          </button>
        </div>
      )}
      <InlineError message={error} />
      {user.role === 'impact_participant' && (
        <p style={{ ...helpStyle, fontSize: '0.85rem', margin: '0.6rem 0 0' }}>Use this for returning participants too. Their account, history and certificates stay the same. Full cohorts cannot be chosen.</p>
      )}
    </section>
  )
}

function Certificates({ panel, user }: { panel: AdminPanel; user: Profile }) {
  const mine = panel.certificates.filter(c => c.user_id === user.id)
  return (
    <section style={block}>
      <h3 style={subTitle}>Certificates</h3>
      {mine.length === 0 ? (
        <p style={{ ...helpStyle, margin: 0 }}>No certificates yet. Certificates are issued from the cohort&apos;s <strong>Completion &amp; certificates</strong> section after you record that the program was completed.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {mine.map(c => (
            <li key={c.id} style={{ display: 'flex', gap: '0.5rem 1rem', flexWrap: 'wrap', alignItems: 'center', padding: '0.55rem 0', borderBottom: '1px solid var(--mist)', fontSize: '0.92rem', color: 'var(--ink)' }}>
              <span style={{ flex: '1 1 220px' }}>
                <strong style={{ color: 'var(--navy)' }}>{c.pathway_name ?? c.programs?.name ?? 'Program'}</strong>
                {(c.cohort_name ?? (c.cohort_id ? panel.cohorts.find(x => x.id === c.cohort_id)?.name : null)) && <span> · {c.cohort_name ?? panel.cohorts.find(x => x.id === c.cohort_id)?.name}</span>}
                <span style={{ display: 'block', color: 'var(--slate)', fontSize: '0.82rem' }}>
                  {c.certificate_number ? `${c.certificate_number} · ` : ''}issued {formatDateET(c.issued_at)}{c.revoked_at ? ` · revoked ${formatDateET(c.revoked_at)}` : ''}
                </span>
              </span>
              {c.revoked_at ? statusBadge('cancelled', 'Revoked') : (
                <span style={{ display: 'flex', gap: '0.75rem' }}>
                  <a href={`/api/certificates/${c.id}/pdf?inline=1`} target="_blank" rel="noopener noreferrer" style={{ color: '#8a5a10', fontWeight: 600, fontSize: '0.85rem' }}>View</a>
                  <a href={`/api/certificates/${c.id}/pdf`} style={{ color: '#8a5a10', fontWeight: 600, fontSize: '0.85rem' }}>Download</a>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function RoleAndAccess({ panel, user, name }: { panel: AdminPanel; user: Profile; name: string }) {
  const [role, setRole] = useState<string>(user.role)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const isMe = user.id === panel.me.id
  const adminCount = panel.users.filter(u => u.role === 'admin').length
  const onlyAdmin = user.role === 'admin' && adminCount <= 1
  const locked = isMe || onlyAdmin

  const changeRole = async () => {
    setError(null)
    if (role === user.role) return
    const from = ROLE_LABEL[user.role] ?? user.role
    const to = ROLE_LABEL[role] ?? role
    const consequences: string[] = []
    if (role === 'admin') {
      consequences.push(
        'They get full access to every participant record, inquiry and setting in this admin portal.',
        'They should turn on two-step verification right away.',
      )
    } else if (user.role === 'admin') {
      consequences.push('They lose admin access immediately.')
      consequences.push(role === 'coaching_client' ? 'They will see the coaching portal when they sign in.' : 'They will see the Impact Lab participant portal when they sign in.')
    } else {
      consequences.push(role === 'coaching_client'
        ? 'They will see the coaching portal instead of the Impact Lab portal when they sign in.'
        : 'They will see the Impact Lab participant portal instead of the coaching portal when they sign in.')
      consequences.push('Their enrollments, certificates and history are kept.')
    }
    const yes = await panel.confirm({
      title: `Change ${name} to ${to}?`,
      message: `Their role changes from ${from} to ${to}.`,
      consequences,
      confirmLabel: 'Change role',
      danger: role === 'admin' || user.role === 'admin',
    })
    if (!yes) return
    setBusy(true)
    const msg = await panel.handleUpdateUserRole(user.id, role)
    setBusy(false)
    if (msg) setError(msg)
  }

  const neverSignedIn = !user.last_sign_in_at
  const sendAccess = async () => {
    if (!user.email) return
    const yes = await panel.confirm({
      title: neverSignedIn ? 'Send a new account set-up link?' : 'Send a password reset email?',
      message: `To ${user.email}`,
      consequences: neverSignedIn
        ? ['They have not chosen a password yet, so they get a fresh link to set one up.', 'Earlier links stop working once this one is used.']
        : ['They get a link to choose a new password.', 'Their current password keeps working until they change it.'],
      confirmLabel: 'Send email',
    })
    if (!yes) return
    setSending(true)
    await panel.handleSendAccessEmail(user.id)
    setSending(false)
  }

  return (
    <section style={{ ...block, marginBottom: 0 }}>
      <h3 style={subTitle}>Role and sign-in</h3>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 220px', minWidth: 0, maxWidth: '320px' }}>
          <label htmlFor={`role-${user.id}`} style={labelStyle}>Role</label>
          <select id={`role-${user.id}`} value={role} disabled={locked || busy} onChange={e => { setRole(e.target.value); setError(null) }} style={inputStyle}>
            {Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <button type="button" onClick={changeRole} disabled={locked || busy || role === user.role} style={{ ...secondaryButtonStyle, fontSize: '0.85rem', minHeight: '44px' }}>
          {busy ? 'Changing…' : 'Change role'}
        </button>
      </div>
      {isMe && <p style={{ ...helpStyle, fontSize: '0.85rem', margin: '0.5rem 0 0' }}>You can&apos;t change your own role. Ask the other administrator.</p>}
      {!isMe && onlyAdmin && <p style={{ ...helpStyle, fontSize: '0.85rem', margin: '0.5rem 0 0' }}>{name} is the only administrator, so their role can&apos;t be changed. Make someone else an administrator first.</p>}
      <InlineError message={error} />

      <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--mist)' }}>
        <button type="button" onClick={sendAccess} disabled={sending || !user.email} style={{ ...secondaryButtonStyle, fontSize: '0.85rem', minHeight: '44px' }}>
          {sending ? 'Sending…' : 'Send sign-in email'}
        </button>
        <p style={{ ...helpStyle, fontSize: '0.85rem', margin: '0.5rem 0 0' }}>
          {neverSignedIn
            ? 'They have not signed in yet, so this sends a fresh link to set up their password (not a "sign in" email).'
            : 'Sends a link to choose a new password, for when they forgot it.'} The result (accepted or failed) is shown right away.
        </p>
      </div>
    </section>
  )
}
