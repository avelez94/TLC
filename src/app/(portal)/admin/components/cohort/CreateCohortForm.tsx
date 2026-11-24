// "+ New cohort" form. New cohorts start as Draft so everything can be prepared first.
import { useState } from 'react'
import type { CohortStatus } from '@/types'
import type { AdminPanel } from '../../useAdminPanel'
import { InlineError } from '../feedback'
import { cardStyle, inputStyle, programChoices, secondaryButtonStyle, sectionTitleStyle } from '../shared'
import { FieldLabel, STATUS_OPTIONS, fullWidth, gridStyle, linkProblem, metaStyle, statusHelp } from './ui'

const EMPTY = { name: '', program_id: '', start_date: '', end_date: '', status: 'draft' as CohortStatus, capacity: '', zoom_link: '' }

export default function CreateCohortForm({ panel, onCreated, onCancel }: { panel: AdminPanel; onCreated: (name: string, status: CohortStatus) => void; onCancel: () => void }) {
  const [form, setForm] = useState(EMPTY)
  const [showHistorical, setShowHistorical] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<typeof EMPTY>) => { setForm(f => ({ ...f, ...patch })); setError(null) }

  const submit = async () => {
    const linkErr = linkProblem(form.zoom_link)
    if (linkErr) { setError(`Meeting link: ${linkErr}`); return }
    setBusy(true)
    setError(null)
    const err = await panel.handleCreateCohort(form)
    setBusy(false)
    if (err) { setError(err); return }
    const name = form.name.trim()
    setForm(EMPTY)
    onCreated(name, form.status)
  }

  const help = statusHelp(form.status, panel.checkoutEnabled)
  const f = (x: string) => `new-cohort-${x}`
  return (
    <div style={{ ...cardStyle, borderTop: '3px solid var(--gold)' }}>
      <h2 style={sectionTitleStyle}>Create a cohort</h2>
      <p style={{ ...metaStyle, margin: '0 0 1rem' }}>You can change all of this later. After creating it, the cohort’s setup checklist shows what is left: schedule, meeting link, weekly reps and content.</p>
      <div style={gridStyle}>
        <div style={fullWidth}>
          <FieldLabel htmlFor={f('name')}>Cohort name</FieldLabel>
          <input id={f('name')} value={form.name} placeholder="e.g. New Leaders — Spring 2027" onChange={e => set({ name: e.target.value })} style={inputStyle} />
        </div>
        <div style={fullWidth}>
          <FieldLabel htmlFor={f('program')}>Pathway</FieldLabel>
          <select id={f('program')} value={form.program_id} onChange={e => set({ program_id: e.target.value })} style={inputStyle}>
            <option value="">Choose a pathway…</option>
            {programChoices(panel.programs, showHistorical).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <label style={{ ...metaStyle, display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.5rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={showHistorical} onChange={e => setShowHistorical(e.target.checked)} /> Show historical programs
          </label>
        </div>
        <div>
          <FieldLabel htmlFor={f('start')}>Start date</FieldLabel>
          <input id={f('start')} type="date" value={form.start_date} onChange={e => set({ start_date: e.target.value })} style={inputStyle} />
        </div>
        <div>
          <FieldLabel htmlFor={f('end')}>End date</FieldLabel>
          <input id={f('end')} type="date" value={form.end_date} onChange={e => set({ end_date: e.target.value })} style={inputStyle} />
        </div>
        <div style={fullWidth}>
          <FieldLabel htmlFor={f('status')}>Status</FieldLabel>
          <select id={f('status')} value={form.status} onChange={e => set({ status: e.target.value as CohortStatus })} style={inputStyle}>
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {help && <p style={{ ...metaStyle, margin: '0.4rem 0 0' }}>{help}</p>}
        </div>
        <div>
          <FieldLabel htmlFor={f('capacity')}>Capacity (seats)</FieldLabel>
          <input id={f('capacity')} type="number" inputMode="numeric" min={1} max={500} value={form.capacity} placeholder="No limit" onChange={e => set({ capacity: e.target.value })} style={inputStyle} />
          <p style={{ ...metaStyle, margin: '0.4rem 0 0' }}>Leave empty for no limit.</p>
        </div>
        <div>
          <FieldLabel htmlFor={f('link')} hint="(optional)">Meeting link</FieldLabel>
          <input id={f('link')} type="url" value={form.zoom_link} placeholder="https://zoom.us/j/…" onChange={e => set({ zoom_link: e.target.value })} style={inputStyle} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.1rem', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-primary" onClick={() => void submit()} disabled={busy} style={{ fontSize: '0.85rem' }}>{busy ? 'Creating…' : 'Create cohort'}</button>
        <button type="button" onClick={onCancel} disabled={busy} style={secondaryButtonStyle}>Cancel</button>
      </div>
      <InlineError message={error} />
    </div>
  )
}
