// Weekly reps for one cohort (Draft cohorts included). Reps with reflections are archived,
// never deleted, so participants' private reflections are kept.
import { useState } from 'react'
import { formatDateET } from '@/lib/business-time'
import type { WeeklyRep } from '@/types'
import type { RepInput } from '../../useAdminPanel'
import { InlineError } from '../feedback'
import { inputStyle, linkButtonStyle, dangerLinkStyle, secondaryButtonStyle, statusBadge } from '../shared'
import { FieldLabel, fullWidth, gridStyle, metaStyle, panelBoxStyle, plural, rowStyle, smallButtonStyle, subheadStyle, type CohortSectionProps } from './ui'

const emptyRep = (cohortId: string, week = ''): RepInput => ({ cohort_id: cohortId, week_number: week, title: '', instructions: '', why_it_matters: '', due_date: '' })
const repToInput = (r: WeeklyRep): RepInput => ({
  cohort_id: r.cohort_id, week_number: String(r.week_number ?? ''), title: r.title ?? '', instructions: r.instructions ?? '',
  why_it_matters: r.why_it_matters ?? '', due_date: r.due_date ?? '',
})

function RepForm({ idPrefix, initial, submitLabel, busyLabel, onSubmit, onCancel }: {
  idPrefix: string; initial: RepInput; submitLabel: string; busyLabel: string
  onSubmit: (r: RepInput) => Promise<string | null>; onCancel?: () => void
}) {
  const [rep, setRep] = useState<RepInput>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<RepInput>) => { setRep(r => ({ ...r, ...patch })); setError(null) }
  const fid = (f: string) => `${idPrefix}-${f}`

  const submit = async () => {
    setBusy(true)
    setError(null)
    const err = await onSubmit(rep)
    setBusy(false)
    if (err) setError(err)
    else if (!onCancel) setRep(emptyRep(initial.cohort_id))
  }

  return (
    <div>
      <div style={gridStyle}>
        <div>
          <FieldLabel htmlFor={fid('week')}>Week number</FieldLabel>
          <input id={fid('week')} type="number" inputMode="numeric" min={1} value={rep.week_number} placeholder="e.g. 1" onChange={e => set({ week_number: e.target.value })} style={inputStyle} />
        </div>
        <div>
          <FieldLabel htmlFor={fid('due')} hint="(optional)">Due date</FieldLabel>
          <input id={fid('due')} type="date" value={rep.due_date} onChange={e => set({ due_date: e.target.value })} style={inputStyle} />
        </div>
        <div style={fullWidth}>
          <FieldLabel htmlFor={fid('title')}>Title</FieldLabel>
          <input id={fid('title')} value={rep.title} placeholder="e.g. Ask for feedback" onChange={e => set({ title: e.target.value })} style={inputStyle} />
        </div>
        <div style={fullWidth}>
          <FieldLabel htmlFor={fid('instructions')} hint="(optional)">Instructions</FieldLabel>
          <textarea id={fid('instructions')} value={rep.instructions} rows={3} placeholder="What should participants do this week?" onChange={e => set({ instructions: e.target.value })} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>
        <div style={fullWidth}>
          <FieldLabel htmlFor={fid('why')} hint="(optional)">Why it matters</FieldLabel>
          <textarea id={fid('why')} value={rep.why_it_matters} rows={2} placeholder="Why is this rep important?" onChange={e => set({ why_it_matters: e.target.value })} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.9rem', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-primary" onClick={() => void submit()} disabled={busy} style={smallButtonStyle}>{busy ? busyLabel : submitLabel}</button>
        {onCancel && <button type="button" onClick={onCancel} disabled={busy} style={secondaryButtonStyle}>Cancel</button>}
      </div>
      <InlineError message={error} />
    </div>
  )
}

export default function CohortReps({ panel, cohort }: CohortSectionProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rowErrors, setRowErrors] = useState<Record<string, string | null>>({})

  const reps = panel.reps
    .filter(r => r.cohort_id === cohort.id)
    .sort((a, b) => Number(!!a.archived_at) - Number(!!b.archived_at) || a.week_number - b.week_number || a.title.localeCompare(b.title))
  const current = reps.filter(r => !r.archived_at)
  const nextWeek = current.reduce((m, r) => Math.max(m, r.week_number), 0) + 1

  const remove = async (rep: WeeklyRep) => {
    const n = panel.reflectionCounts[rep.id] ?? 0
    const ok = n > 0
      ? await panel.confirm({
        title: 'Archive this weekly rep?',
        message: `Participants have written ${plural(n, 'private reflection')} for “${rep.title}”.`,
        consequences: [
          `The ${plural(n, 'reflection')} ${n === 1 ? 'is' : 'are'} kept and stay private to the people who wrote them.`,
          'The rep leaves the current list. Participants who reflected on it can still see it with their reflection.',
          'You can restore it at any time.',
        ],
        confirmLabel: 'Archive',
        danger: true,
      })
      : await panel.confirm({
        title: 'Delete this weekly rep permanently?',
        message: `“${rep.title}” (week ${rep.week_number})`,
        consequences: ['No participant has written a reflection for it yet.', 'It is removed for good and cannot be restored.'],
        confirmLabel: 'Delete permanently',
        danger: true,
      })
    if (!ok) return
    setBusyId(rep.id)
    const err = await panel.handleRemoveRep(rep.id)
    setRowErrors(prev => ({ ...prev, [rep.id]: err }))
    setBusyId(null)
  }

  const restore = async (rep: WeeklyRep) => {
    setBusyId(rep.id)
    const err = await panel.handleRestoreRep(rep.id)
    setRowErrors(prev => ({ ...prev, [rep.id]: err }))
    setBusyId(null)
  }

  return (
    <div>
      {cohort.status === 'draft' && <p style={{ ...metaStyle, margin: '0 0 0.5rem' }}>This cohort is a draft: you can prepare its weekly reps now. Participants see them once they are enrolled.</p>}
      {reps.length === 0 ? (
        <p style={{ ...metaStyle, margin: '0 0 0.75rem' }}>No weekly reps yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {reps.map(rep => {
            const n = panel.reflectionCounts[rep.id] ?? 0
            const busy = busyId === rep.id
            if (editingId === rep.id) {
              return (
                <li key={rep.id} style={{ ...rowStyle, display: 'block' }}>
                  <h4 style={subheadStyle}>Edit week {rep.week_number}</h4>
                  <RepForm idPrefix={`rep-edit-${rep.id}`} initial={repToInput(rep)} submitLabel="Save changes" busyLabel="Saving…"
                    onSubmit={async r => { const err = await panel.handleUpdateRep(rep.id, r); if (!err) setEditingId(null); return err }}
                    onCancel={() => setEditingId(null)} />
                </li>
              )
            }
            return (
              <li key={rep.id} style={{ ...rowStyle, opacity: rep.archived_at ? 0.85 : 1 }}>
                <div style={{ minWidth: 0, flex: '1 1 240px' }}>
                  <span style={{ ...metaStyle, display: 'block', color: '#8a5a10', fontWeight: 600 }}>
                    Week {rep.week_number}{rep.due_date ? ` · Due ${formatDateET(rep.due_date)}` : ''}
                  </span>
                  <span style={{ display: 'block', fontWeight: 600, color: 'var(--navy)', fontSize: '0.95rem' }}>{rep.title}</span>
                  <span style={{ ...metaStyle, display: 'block', fontSize: '0.82rem' }}>
                    {rep.archived_at ? `Archived — ${plural(n, 'reflection')} kept` : n ? `${plural(n, 'reflection')} written` : 'No reflections yet'}
                  </span>
                  <InlineError message={rowErrors[rep.id]} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  {rep.archived_at ? (
                    <>
                      {statusBadge('archived')}
                      <button type="button" onClick={() => void restore(rep)} disabled={busy} style={{ ...linkButtonStyle, padding: '0.5rem 0' }}>{busy ? 'Restoring…' : 'Restore'}</button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => setEditingId(rep.id)} disabled={busy} style={{ ...linkButtonStyle, padding: '0.5rem 0' }}>Edit</button>
                      <button type="button" onClick={() => void remove(rep)} disabled={busy} style={{ ...dangerLinkStyle, padding: '0.5rem 0' }}>
                        {busy ? 'Removing…' : n > 0 ? 'Archive' : 'Delete'}
                      </button>
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <div style={panelBoxStyle}>
        <h4 style={subheadStyle}>Add a weekly rep</h4>
        <RepForm key={`${cohort.id}-${nextWeek}`} idPrefix={`rep-new-${cohort.id}`} initial={emptyRep(cohort.id, String(nextWeek))}
          submitLabel="Add weekly rep" busyLabel="Adding…" onSubmit={r => panel.handleCreateRep({ ...r, cohort_id: cohort.id })} />
      </div>
    </div>
  )
}
