'use client'

// Shared pieces for the People screens (Participants, All certificates, Registration history).
import { useState } from 'react'
import type { AdminPanel } from '../../useAdminPanel'
import type { Cohort, Profile } from '@/types'
import { seatsTaken } from '@/lib/admin-metrics'
import { formatDateET } from '@/lib/business-time'
import { InlineError } from '../feedback'
import { helpStyle, inputStyle, labelStyle, programChoices, isPathway } from '../shared'

export const ROLE_LABEL: Record<string, string> = {
  impact_participant: 'Impact Lab participant',
  coaching_client: 'Coaching client',
  admin: 'Administrator',
}

const COHORT_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', upcoming: 'Upcoming', active: 'In progress', completed: 'Completed', archived: 'Archived', cancelled: 'Cancelled',
}

/** Cohorts people can be enrolled in now: Draft, Upcoming or In progress. */
export const ENROLLABLE_STATUSES = ['draft', 'upcoming', 'active']

export interface CohortChoice { cohort: Cohort; label: string; full: boolean }

/** Enrollable cohorts with seat information. Full cohorts are marked so the option can be disabled. */
export function enrollableCohortChoices(panel: AdminPanel): CohortChoice[] {
  return panel.cohorts
    .filter(c => ENROLLABLE_STATUSES.includes(c.status))
    .map(c => {
      const taken = seatsTaken(c.id, panel.enrollments)
      const full = c.capacity != null && taken >= c.capacity
      const seats = c.capacity != null ? (full ? `Full (${taken} of ${c.capacity} seats)` : `${c.capacity - taken} of ${c.capacity} seats left`) : `${taken} enrolled, no seat limit`
      const program = c.programs?.name ? ` (${c.programs.name})` : ''
      const start = c.start_date ? `, starts ${formatDateET(c.start_date)}` : ''
      return { cohort: c, full, label: `${c.name}${program} · ${COHORT_STATUS_LABEL[c.status] ?? c.status}${start} · ${seats}` }
    })
}

export const personLabel = (u: Pick<Profile, 'full_name' | 'email'>) => u.full_name || u.email || 'Unnamed person'

export const primaryButton = { fontSize: '0.85rem', padding: '0.65rem 1.1rem' }

/** A row of filter buttons (one selected). */
export function FilterBar({ label, options, value, onChange }: { label: string; options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div role="group" aria-label={label} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
      {options.map(o => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} aria-pressed={value === o.value}
          style={{ padding: '0.55rem 0.9rem', minHeight: '40px', borderRadius: '2px', border: '1.5px solid rgba(0,23,55,0.15)', background: value === o.value ? 'var(--navy)' : 'white', color: value === o.value ? 'white' : 'var(--navy)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-montserrat), sans-serif' }}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <span style={labelStyle}>{label}</span>
      <div style={{ color: 'var(--ink)', fontSize: '0.92rem', lineHeight: 1.5, overflowWrap: 'anywhere' }}>{children}</div>
    </div>
  )
}

export const detailGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem 1.25rem', marginBottom: '1.25rem' }

/**
 * Issue a certificate. With `userId` the person is fixed (inside a participant's record);
 * without it, a participant is chosen first (All certificates page).
 */
export function IssueCertificateForm({ panel, userId: fixedUserId, idPrefix }: { panel: AdminPanel; userId?: string; idPrefix: string }) {
  const [pickedUser, setPickedUser] = useState('')
  const userId = fixedUserId ?? pickedUser

  // Default to the program of a cohort the person completed (most recent first).
  const completedCohort = (uid: string) => {
    for (const e of panel.enrollments.filter(x => x.user_id === uid)) {
      const c = panel.cohorts.find(x => x.id === e.cohort_id)
      if (!c || e.status === 'withdrawn') continue
      if (e.status === 'completed' || c.status === 'completed' || c.status === 'archived') return c
    }
    return null
  }
  const defaultsFor = (uid: string) => {
    const c = uid ? completedCohort(uid) : null
    const prog = c ? panel.programs.find(p => p.id === c.program_id) : undefined
    return { program: prog?.id ?? '', cohort: c?.id ?? '', historical: !!prog && !isPathway(prog) }
  }

  const initial = defaultsFor(userId)
  const [programId, setProgramId] = useState(initial.program)
  const [cohortId, setCohortId] = useState(initial.cohort)
  const [showHistorical, setShowHistorical] = useState(initial.historical)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const choosePerson = (uid: string) => {
    setPickedUser(uid)
    const d = defaultsFor(uid)
    setProgramId(d.program); setCohortId(d.cohort); setShowHistorical(d.historical); setError(null)
  }

  const people = panel.users.filter(u => u.role !== 'admin').sort((a, b) => personLabel(a).localeCompare(personLabel(b)))
  const programOptions = programChoices(panel.programs, showHistorical)
  // Cohorts this person was enrolled in that belong to the chosen program.
  const theirCohorts = userId
    ? panel.enrollments.filter(e => e.user_id === userId)
      .map(e => panel.cohorts.find(c => c.id === e.cohort_id))
      .filter((c): c is Cohort => !!c && (!programId || c.program_id === programId))
    : []

  const submit = async () => {
    setError(null)
    if (!userId) { setError('Choose the participant first.'); return }
    if (!programId) { setError('Choose the pathway or program the certificate is for.'); return }
    const name = panel.personName(userId)
    const prog = panel.programs.find(p => p.id === programId)?.name ?? 'this program'
    const cohort = cohortId ? panel.cohorts.find(c => c.id === cohortId)?.name : null
    const yes = await panel.confirm({
      title: 'Issue this certificate?',
      message: `${name} will receive a certificate for ${prog}${cohort ? ` (${cohort})` : ''}.`,
      consequences: ['They will see it in their portal right away.', 'It is kept on their record.'],
      confirmLabel: 'Issue certificate',
    })
    if (!yes) return
    setBusy(true)
    const msg = await panel.handleIssueCertificate(userId, programId, cohortId || null)
    setBusy(false)
    if (msg) { setError(msg); return }
    if (!fixedUserId) setPickedUser('')
    setCohortId('')
    if (!fixedUserId) setProgramId('')
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        {!fixedUserId && (
          <div>
            <label htmlFor={`${idPrefix}-person`} style={labelStyle}>Participant</label>
            <select id={`${idPrefix}-person`} value={pickedUser} onChange={e => choosePerson(e.target.value)} style={inputStyle}>
              <option value="">Choose a participant…</option>
              {people.map(u => <option key={u.id} value={u.id}>{personLabel(u)}{u.full_name && u.email ? ` (${u.email})` : ''}</option>)}
            </select>
          </div>
        )}
        <div>
          <label htmlFor={`${idPrefix}-program`} style={labelStyle}>Pathway or program</label>
          <select id={`${idPrefix}-program`} value={programId} onChange={e => { setProgramId(e.target.value); setCohortId('') }} style={inputStyle}>
            <option value="">Choose…</option>
            {programOptions.map(p => <option key={p.id} value={p.id}>{p.name}{isPathway(p) ? '' : ' (historical)'}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', fontSize: '0.88rem', color: 'var(--slate)', cursor: 'pointer' }}>
            <input type="checkbox" checked={showHistorical} onChange={e => {
              setShowHistorical(e.target.checked)
              const p = panel.programs.find(x => x.id === programId)
              if (!e.target.checked && p && !isPathway(p)) { setProgramId(''); setCohortId('') }
            }} style={{ width: '18px', height: '18px' }} />
            Show historical programs
          </label>
        </div>
        <div>
          <label htmlFor={`${idPrefix}-cohort`} style={labelStyle}>Cohort (optional)</label>
          <select id={`${idPrefix}-cohort`} value={cohortId} onChange={e => setCohortId(e.target.value)} style={inputStyle} disabled={!userId}>
            <option value="">No specific cohort</option>
            {theirCohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {userId && programId && theirCohorts.length === 0 && (
            <p style={{ ...helpStyle, fontSize: '0.85rem', margin: '0.4rem 0 0' }}>They have no cohort in this program, so the certificate will not name a cohort.</p>
          )}
        </div>
      </div>
      <button type="button" onClick={submit} disabled={busy} className="btn btn-primary" style={{ ...primaryButton, marginTop: '1rem' }}>
        {busy ? 'Issuing…' : 'Issue certificate'}
      </button>
      <InlineError message={error} />
    </div>
  )
}
