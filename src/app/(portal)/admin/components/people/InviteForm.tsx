'use client'

import { useState } from 'react'
import type { AdminPanel, InviteInput } from '../../useAdminPanel'
import { InlineError } from '../feedback'
import { cardStyle, helpStyle, inputStyle, labelStyle, sectionTitleStyle, isPathway } from '../shared'
import { enrollableCohortChoices, primaryButton, ROLE_LABEL } from './common'

const EMPTY: InviteInput = { email: '', full_name: '', role: 'impact_participant', program_id: '', cohort_id: '' }

export default function InviteForm({ panel, initialCohortId, onClose }: { panel: AdminPanel; initialCohortId?: string; onClose: () => void }) {
  const [form, setForm] = useState<InviteInput>({ ...EMPTY, cohort_id: initialCohortId ?? '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const choices = enrollableCohortChoices(panel)
  const coachingPrograms = panel.programs.filter(p => p.type !== 'cohort' && !isPathway(p))
  const set = (patch: Partial<InviteInput>) => { setForm(f => ({ ...f, ...patch })); setError(null) }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const email = form.email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Enter a valid email address.'); return }
    if (!form.full_name.trim()) { setError('Enter their name.'); return }
    let program_id = ''
    let cohort_id = ''
    if (form.role === 'impact_participant' && form.cohort_id) {
      const choice = choices.find(c => c.cohort.id === form.cohort_id)
      if (!choice) { setError('That cohort is no longer open for enrollment. Choose another, or leave it empty.'); return }
      if (choice.full) { setError(`${choice.cohort.name} is full. Raise its capacity in Cohorts first, or choose another cohort.`); return }
      cohort_id = choice.cohort.id
      program_id = choice.cohort.program_id
    }
    if (form.role === 'coaching_client') program_id = form.program_id
    if (form.role === 'admin') {
      const yes = await panel.confirm({
        title: 'Invite an administrator?',
        message: `${form.full_name.trim()} (${email}) will be able to sign in to this admin portal.`,
        consequences: [
          'Administrators can see and change every participant record, inquiry and setting.',
          'They should turn on two-step verification right after setting their password.',
        ],
        confirmLabel: 'Send admin invitation',
        danger: true,
      })
      if (!yes) return
    }
    setBusy(true)
    const msg = await panel.handleInvite({ email, full_name: form.full_name.trim(), role: form.role, program_id, cohort_id })
    setBusy(false)
    if (msg) { setError(msg); return }
    setForm({ ...EMPTY })
    onClose()
  }

  return (
    <form onSubmit={submit} style={{ ...cardStyle, borderTop: '3px solid var(--gold)' }} noValidate>
      <h2 style={sectionTitleStyle}>Invite someone</h2>
      <p style={helpStyle}>They get an email to set their own password. If they already have an account, they are enrolled in the cohort instead.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div>
          <label htmlFor="invite-email" style={labelStyle}>Email</label>
          <input id="invite-email" type="email" autoComplete="off" value={form.email} onChange={e => set({ email: e.target.value })} placeholder="jane@example.com" style={inputStyle} />
        </div>
        <div>
          <label htmlFor="invite-name" style={labelStyle}>Name</label>
          <input id="invite-name" autoComplete="off" value={form.full_name} onChange={e => set({ full_name: e.target.value })} placeholder="Jane Smith" style={inputStyle} />
        </div>
        <div>
          <label htmlFor="invite-role" style={labelStyle}>Role</label>
          <select id="invite-role" value={form.role} onChange={e => set({ role: e.target.value, program_id: '' })} style={inputStyle}>
            {Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        {form.role === 'impact_participant' && (
          <div style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="invite-cohort" style={labelStyle}>Cohort (optional)</label>
            <select id="invite-cohort" value={form.cohort_id} onChange={e => set({ cohort_id: e.target.value })} style={inputStyle}>
              <option value="">No cohort yet</option>
              {choices.map(c => <option key={c.cohort.id} value={c.cohort.id} disabled={c.full}>{c.label}</option>)}
            </select>
            <p style={{ ...helpStyle, fontSize: '0.85rem', margin: '0.4rem 0 0' }}>Draft, upcoming and in-progress cohorts are listed. Full cohorts cannot be chosen.</p>
          </div>
        )}
        {form.role === 'coaching_client' && (
          <div>
            <label htmlFor="invite-program" style={labelStyle}>Coaching program</label>
            <select id="invite-program" value={form.program_id} onChange={e => set({ program_id: e.target.value })} style={inputStyle}>
              <option value="">Choose a program (optional)</option>
              {coachingPrograms.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}
        {form.role === 'admin' && (
          <p style={{ gridColumn: '1 / -1', color: '#8c1d18', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>
            Administrators have full access to every participant record, inquiry and setting. Only invite someone you trust, and ask them to turn on two-step verification.
          </p>
        )}
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1.25rem' }}>
        <button type="submit" disabled={busy} className="btn btn-primary" style={primaryButton}>{busy ? 'Sending…' : 'Send invitation'}</button>
        <button type="button" onClick={onClose} disabled={busy} style={{ ...primaryButton, background: 'white', border: '1.5px solid rgba(0,23,55,0.2)', borderRadius: '3px', color: 'var(--navy)', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
      </div>
      <InlineError message={error} />
    </form>
  )
}
