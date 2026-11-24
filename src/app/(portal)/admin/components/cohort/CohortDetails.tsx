// Details of one cohort. Each field saves on its own when you leave it (or pick a value).
import { useState } from 'react'
import type { CohortStatus } from '@/types'
import { seatsTaken } from '@/lib/admin-metrics'
import { formatDateET, todayET } from '@/lib/business-time'
import { useSaveStates } from '../feedback'
import { inputStyle, linkButtonStyle, programChoices } from '../shared'
import { FieldLabel, LIFECYCLE_LABEL, STATUS_CONFIRM, STATUS_OPTIONS, WEEKDAYS, fullWidth, gridStyle, linkProblem, metaStyle, statusHelp, type CohortSectionProps } from './ui'
import { readinessFor } from './CohortReadiness'

export default function CohortDetails({ panel, cohort }: CohortSectionProps) {
  const { get, track } = useSaveStates()
  const [showHistorical, setShowHistorical] = useState(false)
  const id = cohort.id
  const fid = (f: string) => `cohort-${id}-${f}`
  const taken = seatsTaken(id, panel.enrollments)

  /** Saves one field when its value differs from what is stored. */
  const save = (field: string, next: unknown, current: unknown, problem: string | null = null) => {
    if ((next ?? null) === (current ?? null)) return
    void track(field, async () => problem ?? panel.handleUpdateCohortField(id, { [field]: next }))
  }

  const pathways = programChoices(panel.programs, showHistorical)
  const current = panel.programs.find(p => p.id === cohort.program_id)
  const pathwayOptions = current && !pathways.some(p => p.id === current.id) ? [...pathways, current] : pathways
  const help = statusHelp(cohort.status, panel.checkoutEnabled)

  const changeStatus = async (next: CohortStatus) => {
    if (next === cohort.status) return
    const c = STATUS_CONFIRM[next]
    let yes = true
    if (c) {
      yes = await panel.confirm({ title: c.title, message: `“${cohort.name}”`, consequences: c.consequences, confirmLabel: c.confirmLabel, danger: next !== 'completed' })
    } else if (next === 'upcoming' || next === 'active') {
      // The checklist never blocks a status change; it is only mentioned here.
      const r = readinessFor(panel, cohort)
      const missing = r.essentials.filter(i => !i.done)
      if (missing.length) {
        yes = await panel.confirm({
          title: `Set to ${LIFECYCLE_LABEL[next]} with setup still missing?`,
          message: `“${cohort.name}” still needs: ${missing.map(i => i.label.toLowerCase()).join(', ')}.`,
          consequences: [
            'You can change the status anyway and finish the setup afterwards.',
            next === 'upcoming' && !panel.checkoutEnabled
              ? 'Online registration is off, so it is not listed on the registration page. Nothing else changes automatically.'
              : 'Nothing else changes automatically.',
          ],
          confirmLabel: `Set to ${LIFECYCLE_LABEL[next]}`,
        })
      }
    }
    if (!yes) return
    void track('status', () => panel.handleUpdateCohortStatus(id, next))
  }

  const openUntil = cohort.activity_open_until ?? null
  const reopenedNow = !!openUntil && openUntil >= todayET()

  const capacityNote = cohort.capacity != null && taken > cohort.capacity
    ? `${taken} people are enrolled, more than this limit. Nobody is removed, but no one new can join until the limit is raised.`
    : `${taken} ${taken === 1 ? 'seat is' : 'seats are'} taken now. Leave empty for no limit.`

  return (
    <div style={gridStyle}>
      <div style={fullWidth}>
        <FieldLabel htmlFor={fid('status')} state={get('status')}>Status</FieldLabel>
        <select id={fid('status')} value={cohort.status} disabled={get('status').status === 'saving'}
          onChange={e => void changeStatus(e.target.value as CohortStatus)} style={inputStyle}>
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {help && <p style={{ ...metaStyle, margin: '0.4rem 0 0' }}>{help}</p>}
      </div>

      {cohort.status === 'completed' && (
        <div style={fullWidth}>
          <FieldLabel htmlFor={fid('activity_open_until')} state={get('activity_open_until')} hint="(optional)">Reopen participant activity until</FieldLabel>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input key={openUntil ?? 'none'} id={fid('activity_open_until')} type="date" defaultValue={openUntil ?? ''} min={todayET()} style={{ ...inputStyle, flex: '0 1 220px', width: 'auto' }}
              onBlur={e => save('activity_open_until', e.target.value || null, openUntil)} />
            {openUntil && (
              <button type="button" onClick={() => save('activity_open_until', null, openUntil)} style={{ ...linkButtonStyle, padding: '0.5rem 0' }}>
                Clear (close activity)
              </button>
            )}
          </div>
          <p style={{ ...metaStyle, margin: '0.4rem 0 0' }}>
            Lets participants submit late weekly reps and post in the community until this date (Eastern Time). Clear it to close activity again.
            {' '}{openUntil
              ? (reopenedNow ? `Activity is open until ${formatDateET(openUntil)}.` : `The date has passed (${formatDateET(openUntil)}), so activity is closed.`)
              : 'Activity is closed: participants have read-only access.'}
          </p>
        </div>
      )}

      <div style={fullWidth}>
        <FieldLabel htmlFor={fid('name')} state={get('name')}>Cohort name</FieldLabel>
        <input id={fid('name')} defaultValue={cohort.name} style={inputStyle}
          onBlur={e => save('name', e.target.value.trim(), cohort.name)} />
      </div>

      <div style={fullWidth}>
        <FieldLabel htmlFor={fid('program_id')} state={get('program_id')}>Pathway</FieldLabel>
        <select id={fid('program_id')} defaultValue={cohort.program_id} style={inputStyle}
          onChange={e => save('program_id', e.target.value, cohort.program_id)}>
          {pathwayOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <label style={{ ...metaStyle, display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.5rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={showHistorical} onChange={e => setShowHistorical(e.target.checked)} /> Show historical programs
        </label>
      </div>

      <div>
        <FieldLabel htmlFor={fid('start_date')} state={get('start_date')}>Start date</FieldLabel>
        <input id={fid('start_date')} type="date" defaultValue={cohort.start_date ?? ''} style={inputStyle}
          onBlur={e => save('start_date', e.target.value || null, cohort.start_date)} />
      </div>
      <div>
        <FieldLabel htmlFor={fid('end_date')} state={get('end_date')}>End date</FieldLabel>
        <input id={fid('end_date')} type="date" defaultValue={cohort.end_date ?? ''} style={inputStyle}
          onBlur={e => save('end_date', e.target.value || null, cohort.end_date)} />
      </div>

      <div>
        <FieldLabel htmlFor={fid('session_day')} state={get('session_day')}>Session day</FieldLabel>
        <select id={fid('session_day')} defaultValue={cohort.session_day ?? ''} style={inputStyle}
          onChange={e => save('session_day', e.target.value || null, cohort.session_day)}>
          <option value="">Not set</option>
          {WEEKDAYS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      <div>
        <FieldLabel htmlFor={fid('session_time')} state={get('session_time')} hint="(ET)">Session time</FieldLabel>
        <input id={fid('session_time')} type="time" defaultValue={(cohort.session_time ?? '').slice(0, 5)} style={inputStyle}
          onBlur={e => save('session_time', e.target.value || null, cohort.session_time ? cohort.session_time.slice(0, 5) : null)} />
      </div>

      <div>
        <FieldLabel htmlFor={fid('capacity')} state={get('capacity')}>Capacity (seats)</FieldLabel>
        <input id={fid('capacity')} type="number" inputMode="numeric" min={1} max={500} defaultValue={cohort.capacity ?? ''} placeholder="No limit" style={inputStyle}
          onBlur={e => {
            const raw = e.target.value.trim()
            save('capacity', raw === '' ? null : raw, cohort.capacity == null ? null : String(cohort.capacity))
          }} />
        <p style={{ ...metaStyle, margin: '0.4rem 0 0' }}>{capacityNote}</p>
      </div>

      <div>
        <FieldLabel htmlFor={fid('zoom_link')} state={get('zoom_link')}>Meeting link</FieldLabel>
        <input id={fid('zoom_link')} type="url" defaultValue={cohort.zoom_link ?? ''} placeholder="https://zoom.us/j/…" style={inputStyle}
          onBlur={e => { const v = e.target.value.trim(); save('zoom_link', v || null, cohort.zoom_link, linkProblem(v)) }} />
        <p style={{ ...metaStyle, margin: '0.4rem 0 0' }}>Only enrolled participants see this link, in their portal.</p>
      </div>
    </div>
  )
}
