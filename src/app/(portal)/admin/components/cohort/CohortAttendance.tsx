// Attendance (optional): who attended each session. Each tick saves immediately. It is for
// Tramaine's records only and never decides completion.
import { useState } from 'react'
import { formatDateET } from '@/lib/business-time'
import { SaveStatus, type SaveState } from '../feedback'
import { linkButtonStyle } from '../shared'
import { metaStyle, plural, type CohortSectionProps, type OpenSection } from './ui'
import { assignedParticipants, personAttendance } from './participation'

const cell = { padding: '0.5rem 0.6rem', borderBottom: '1px solid var(--mist)', fontSize: '0.85rem', textAlign: 'center' as const, verticalAlign: 'middle' as const }
const headCell = { ...cell, fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--slate)', background: 'var(--paper)', fontWeight: 600 }
const nameCell = { ...cell, textAlign: 'left' as const, position: 'sticky' as const, left: 0, background: 'white', fontWeight: 600, color: 'var(--navy)', minWidth: '140px', maxWidth: '200px', overflowWrap: 'anywhere' as const, zIndex: 1 }

export default function CohortAttendance({ panel, cohort, onOpen }: CohortSectionProps & { onOpen: OpenSection }) {
  // Ticks shown right away while they save; removed again if the save fails.
  const [pending, setPending] = useState<Record<string, boolean>>({})
  const [save, setSave] = useState<{ state: SaveState; what: string }>({ state: { status: 'idle' }, what: '' })

  const sessions = panel.cohortSessions
    .filter(s => s.cohort_id === cohort.id)
    .sort((a, b) => a.session_number - b.session_number)
  const people = assignedParticipants(cohort.id, panel.enrollments, panel.users)
  const stored = new Map(panel.attendance.filter(a => a.cohort_id === cohort.id).map(a => [`${a.session_number}:${a.user_id}`, a.attended]))
  const checked = (n: number, userId: string) => pending[`${n}:${userId}`] ?? stored.get(`${n}:${userId}`) ?? false

  if (sessions.length === 0) {
    return (
      <p style={{ ...metaStyle, margin: 0 }}>
        There are no sessions yet.{' '}
        <button type="button" onClick={() => onOpen('schedule', `session-${cohort.id}-generate`)} style={{ ...linkButtonStyle, fontSize: '0.85rem' }}>Set up the schedule</button>
        {' '}to record attendance.
      </p>
    )
  }
  if (people.length === 0) return <p style={{ ...metaStyle, margin: 0 }}>Nobody is enrolled yet.</p>

  const toggle = async (n: number, userId: string, name: string, value: boolean) => {
    const key = `${n}:${userId}`
    const what = `${name}, Session ${n}`
    setPending(p => ({ ...p, [key]: value }))
    setSave({ state: { status: 'saving' }, what })
    const err = await panel.handleSetAttendance(cohort.id, n, userId, value)
    setPending(p => { const next = { ...p }; delete next[key]; return next })
    setSave({ state: err ? { status: 'error', message: err } : { status: 'saved' }, what })
  }

  return (
    <div>
      <p style={{ ...metaStyle, margin: '0 0 0.5rem' }}>
        Attendance is for your records. It does not decide completion. Tick who attended; each change saves right away.
        A session counts as recorded once you tick anyone for it.
      </p>
      <p style={{ ...metaStyle, margin: '0 0 0.75rem', minHeight: '1.4em' }} aria-live="polite">
        {save.state.status !== 'idle' && <>{save.what}: <SaveStatus state={save.state} /></>}
      </p>
      <div role="region" aria-label={`Attendance for ${cohort.name}`} tabIndex={0}
        style={{ overflowX: 'auto', maxWidth: '100%', border: '1px solid var(--mist)', borderRadius: '4px' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%' }}>
          <caption style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: 'var(--slate)', fontSize: '0.8rem' }}>
            {plural(people.length, 'participant')} × {plural(sessions.length, 'session')}. Scroll sideways for more sessions.
          </caption>
          <thead>
            <tr>
              <th scope="col" style={{ ...headCell, ...nameCell, background: 'var(--paper)', fontWeight: 600, color: 'var(--slate)' }}>Participant</th>
              {sessions.map(s => (
                <th key={s.id} scope="col" style={{ ...headCell, minWidth: '74px' }}>
                  S{s.session_number}
                  {s.session_date && <span style={{ display: 'block', textTransform: 'none', letterSpacing: 0, fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 400 }}>{formatDateET(s.session_date).replace(/, \d{4}$/, '')}</span>}
                </th>
              ))}
              <th scope="col" style={{ ...headCell, minWidth: '110px' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {people.map(p => {
              const total = personAttendance(cohort.id, p.userId, panel.attendance)
              return (
                <tr key={p.userId}>
                  <th scope="row" style={nameCell}>{p.name}</th>
                  {sessions.map(s => (
                    <td key={s.id} style={cell}>
                      <input type="checkbox" checked={checked(s.session_number, p.userId)}
                        aria-label={`${p.name} attended Session ${s.session_number}`}
                        onChange={e => void toggle(s.session_number, p.userId, p.name, e.target.checked)}
                        style={{ width: '22px', height: '22px', cursor: 'pointer' }} />
                    </td>
                  ))}
                  <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                    {total.recorded ? `${total.attended} of ${plural(total.recorded, 'recorded session')}` : 'None recorded'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
