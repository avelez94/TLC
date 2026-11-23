// The cohort's sessions: edit titles and dates, remove, add one, or generate a weekly schedule.
import { useState } from 'react'
import { formatDateET } from '@/lib/business-time'
import { InlineError, useSaveStates } from '../feedback'
import { dangerLinkStyle, inputStyle } from '../shared'
import { FieldLabel, gridStyle, fullWidth, metaStyle, panelBoxStyle, plural, rowStyle, smallButtonStyle, subheadStyle, type CohortSectionProps } from './ui'

export default function CohortSchedule({ panel, cohort }: CohortSectionProps) {
  const { get, track } = useSaveStates()
  const [removing, setRemoving] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [form, setForm] = useState({ session_number: '', title: '', session_date: '' })
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const sessions = panel.cohortSessions
    .filter(s => s.cohort_id === cohort.id)
    .sort((a, b) => a.session_number - b.session_number || (a.session_date ?? '').localeCompare(b.session_date ?? ''))
  const nextNumber = sessions.reduce((m, s) => Math.max(m, s.session_number), 0) + 1

  const program = panel.programs.find(p => p.id === cohort.program_id)
  const day = cohort.session_day || program?.session_day || ''
  const { dates, problem } = panel.scheduleDates(cohort.id)
  const preview = dates.length
    ? `${plural(dates.length, 'session')} on ${day}s, ${formatDateET(dates[0])} – ${formatDateET(dates[dates.length - 1])}${!cohort.session_day && program?.session_day ? ' (using the pathway’s session day)' : ''}.`
    : null

  const remove = async (id: string, n: number, title: string) => {
    if (!(await panel.confirm({
      title: `Remove session ${n}?`,
      message: `“${title}”`,
      consequences: ['It is removed from this cohort’s schedule, which participants and the registration page show.', 'The other sessions keep their numbers.'],
      confirmLabel: 'Remove session',
      danger: true,
    }))) return
    setRemoving(id)
    await panel.handleDeleteSession(id)
    setRemoving(null)
  }

  const generate = async () => {
    if (problem) { setGenerateError(problem); return }
    if (sessions.length > 0 && !(await panel.confirm({
      title: 'Replace the schedule?',
      message: `Replace the ${sessions.length} existing sessions with ${dates.length} new ones? Session titles you edited will be lost.`,
      consequences: [`New sessions are named “Session 1”, “Session 2” and so on, one per ${day}.`, 'You can rename each session afterwards.'],
      confirmLabel: 'Replace schedule',
      danger: true,
    }))) return
    setGenerating(true)
    setGenerateError(null)
    setGenerateError(await panel.handleGenerateSchedule(cohort.id))
    setGenerating(false)
  }

  const add = async () => {
    setAdding(true)
    setAddError(null)
    const err = await panel.handleAddSession(cohort.id, { ...form, session_number: form.session_number || String(nextNumber) })
    setAdding(false)
    if (err) setAddError(err)
    else setForm({ session_number: '', title: '', session_date: '' })
  }

  const fid = (f: string) => `session-${cohort.id}-${f}`
  return (
    <div>
      {sessions.length === 0 ? (
        <p style={{ ...metaStyle, margin: '0 0 0.75rem' }}>No sessions yet. Generate a weekly schedule or add sessions one at a time.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {sessions.map(s => {
            const tKey = `title-${s.id}`, dKey = `date-${s.id}`
            return (
              <li key={s.id} style={{ ...rowStyle, alignItems: 'flex-end' }}>
                <div style={{ flex: '0 1 170px', minWidth: '150px' }}>
                  <FieldLabel htmlFor={dKey} state={get(dKey)}>Session {s.session_number}</FieldLabel>
                  <input id={dKey} type="date" defaultValue={s.session_date ?? ''} style={inputStyle}
                    onBlur={e => { const v = e.target.value || null; if (v !== (s.session_date ?? null)) void track(dKey, () => panel.handleUpdateSession(s.id, { session_date: v })) }} />
                </div>
                <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                  <FieldLabel htmlFor={tKey} state={get(tKey)}>Title</FieldLabel>
                  <input id={tKey} defaultValue={s.title} style={inputStyle}
                    onBlur={e => { const v = e.target.value.trim(); if (v !== s.title) void track(tKey, () => panel.handleUpdateSession(s.id, { title: v })) }} />
                </div>
                <button type="button" onClick={() => void remove(s.id, s.session_number, s.title)} disabled={removing === s.id} style={{ ...dangerLinkStyle, padding: '0.75rem 0' }}>
                  {removing === s.id ? 'Removing…' : 'Remove'}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div style={{ ...panelBoxStyle, background: 'rgba(200,136,32,0.05)', border: '1px solid rgba(200,136,32,0.25)' }}>
        <h4 style={subheadStyle}>Generate weekly schedule</h4>
        <p style={{ ...metaStyle, margin: '0 0 0.75rem' }}>
          Creates one session per week on the session day, from the start date to the end date.
        </p>
        <p style={{ ...metaStyle, color: preview ? 'var(--ink)' : '#8c1d18', fontWeight: 600, margin: '0 0 0.75rem' }}>
          {preview ?? problem}
        </p>
        <button type="button" className="btn btn-primary" onClick={() => void generate()} disabled={generating || !!problem} style={smallButtonStyle}>
          {generating ? 'Generating…' : sessions.length ? 'Replace with weekly schedule' : 'Generate schedule'}
        </button>
        <InlineError message={generateError} />
      </div>

      <div style={panelBoxStyle}>
        <h4 style={subheadStyle}>Add a session</h4>
        <div style={gridStyle}>
          <div>
            <FieldLabel htmlFor={fid('number')}>Session number</FieldLabel>
            <input id={fid('number')} type="number" inputMode="numeric" min={1} value={form.session_number} placeholder={String(nextNumber)}
              onChange={e => setForm({ ...form, session_number: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <FieldLabel htmlFor={fid('date')} hint="(optional)">Date</FieldLabel>
            <input id={fid('date')} type="date" value={form.session_date} onChange={e => setForm({ ...form, session_date: e.target.value })} style={inputStyle} />
          </div>
          <div style={fullWidth}>
            <FieldLabel htmlFor={fid('title')}>Title</FieldLabel>
            <input id={fid('title')} value={form.title} placeholder="e.g. Where do you want your impact?" onChange={e => setForm({ ...form, title: e.target.value })} style={inputStyle} />
          </div>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => void add()} disabled={adding} style={{ ...smallButtonStyle, marginTop: '0.9rem' }}>
          {adding ? 'Adding…' : 'Add session'}
        </button>
        <InlineError message={addError} />
      </div>
    </div>
  )
}
