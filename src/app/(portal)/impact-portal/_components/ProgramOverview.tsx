import { formatDateET } from '@/lib/business-time'
import { safeHref } from '@/lib/sanitize-html'
import { programName, programStateLabel, sessionTimeLabel } from './logic'
import { cardStyle, h2Style, labelStyle, mutedText, StatusBadge } from './ui'
import type { AttendanceRow, Membership, SessionRow } from './types'

/** Program details and session schedule (with the participant's own attendance, if recorded). */
export function ProgramOverview({ membership, sessions, attendance, today }: {
  membership: Membership
  sessions: SessionRow[]
  attendance: AttendanceRow[]
  today: string
}) {
  const c = membership.cohort
  const time = sessionTimeLabel(c.session_day, c.session_time)
  const join = membership.isCurrent ? safeHref(membership.zoomLink) : undefined
  const bookHref = safeHref(c.book_purchase_url)
  const attended = new Map(attendance.filter(a => a.cohort_id === c.id).map(a => [a.session_number, a.attended]))
  const hasAttendance = attended.size > 0
  const attendedCount = [...attended.values()].filter(Boolean).length

  return (
    <>
      <section style={cardStyle} aria-labelledby={`overview-${c.id}`}>
        <h2 id={`overview-${c.id}`} style={h2Style}>Program details</h2>
        <div className="two-col-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div><span style={labelStyle}>Pathway</span><p style={{ color: 'var(--ink)', fontSize: '0.88rem' }}>{programName(membership)}</p></div>
          <div><span style={labelStyle}>Cohort</span><p style={{ color: 'var(--ink)', fontSize: '0.88rem' }}>{c.name}</p></div>
          <div><span style={labelStyle}>Status</span><p style={{ color: 'var(--ink)', fontSize: '0.88rem' }}>{programStateLabel(membership, today)}</p></div>
          {(c.start_date || c.end_date) && (
            <div><span style={labelStyle}>Dates</span><p style={{ color: 'var(--ink)', fontSize: '0.88rem' }}>
              {c.start_date ? formatDateET(c.start_date, 'long') : 'Start date to be announced'}
              {c.end_date ? ` – ${formatDateET(c.end_date, 'long')}` : ''}
            </p></div>
          )}
          {time && <div><span style={labelStyle}>Sessions</span><p style={{ color: 'var(--ink)', fontSize: '0.88rem' }}>{time}</p></div>}
          {join && <div><span style={labelStyle}>Meeting link</span><a href={join} target="_blank" rel="noopener noreferrer" style={{ color: '#8a5a10', fontSize: '0.88rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', minHeight: '44px' }}>Join session (opens in a new tab)</a></div>}
          {c.book_title && (
            <div><span style={labelStyle}>Program book</span><p style={{ color: 'var(--ink)', fontSize: '0.88rem' }}>
              {bookHref ? <a href={bookHref} target="_blank" rel="noopener noreferrer" style={{ color: '#8a5a10' }}>{c.book_title}</a> : c.book_title}
            </p></div>
          )}
        </div>
        {c.description && <p style={{ ...mutedText, marginTop: '1rem', whiteSpace: 'pre-wrap' }}>{c.description}</p>}
      </section>

      <section style={cardStyle} aria-labelledby={`schedule-${c.id}`}>
        <h2 id={`schedule-${c.id}`} style={h2Style}>Session schedule</h2>
        {hasAttendance && <p style={{ ...mutedText, marginBottom: '0.75rem' }}>Your attendance: {attendedCount} of {attended.size} recorded session{attended.size === 1 ? '' : 's'}.</p>}
        {sessions.length === 0 ? (
          <p style={mutedText}>
            {membership.isCurrent ? 'Tramaine will post the session dates before the program starts.' : 'No session dates were recorded for this program.'}
          </p>
        ) : (
          <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {sessions.map(s => {
              const att = attended.get(s.session_number)
              const isPast = s.session_date ? s.session_date < today : false
              return (
                <li key={s.id} style={{ display: 'flex', gap: '0.75rem 1rem', padding: '0.75rem 0', borderBottom: '1px solid var(--mist)', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: '#8a5a10', textTransform: 'uppercase', letterSpacing: '0.1em', minWidth: '96px' }}>
                    {s.session_date ? formatDateET(s.session_date) : `Session ${s.session_number}`}
                  </span>
                  <span style={{ color: 'var(--ink)', fontSize: '0.88rem', fontWeight: 500, flex: '1 1 160px', minWidth: 0 }}>
                    {s.title || `Session ${s.session_number}`}
                    {s.description && <span style={{ display: 'block', color: 'var(--slate)', fontSize: '0.78rem', fontWeight: 400 }}>{s.description}</span>}
                  </span>
                  {att !== undefined && <StatusBadge kind={att ? 'submitted' : 'not-submitted'}>{att ? 'Attended' : 'Absent'}</StatusBadge>}
                  {att === undefined && hasAttendance && isPast && <StatusBadge kind="info">Not recorded</StatusBadge>}
                </li>
              )
            })}
          </ol>
        )}
      </section>
    </>
  )
}
