import { programName, programStateLabel, repState } from './logic'
import { cardStyle, EmptyState, h2Style, labelStyle, mutedText, PageHeader, StatusBadge } from './ui'
import type { AttendanceRow, Membership, Rep, Submission } from './types'

/** Progress = the current cohort's assigned (non-archived) weekly reps, counted as they are. */
export function ProgressView({ current, reps, submissions, attendance, journalCount, today, onOpenRep }: {
  current: Membership | null
  reps: Rep[]
  submissions: Map<string, Submission>
  attendance: AttendanceRow[]
  journalCount: number
  today: string
  onOpenRep: (repId: string) => void
}) {
  if (!current) {
    return (
      <div>
        <PageHeader eyebrow="My Progress" title="Your Progress" />
        <EmptyState>Progress is shown for a current program. Your finished programs, with the reps you submitted, are in My Completed Programs.</EmptyState>
      </div>
    )
  }
  const states = reps.map(r => ({ rep: r, state: repState(r, submissions.has(r.id), current.canWrite, today) }))
  const count = (k: string) => states.filter(s => s.state.kind === k).length
  const submitted = count('submitted')
  const overdue = count('overdue')
  const remaining = reps.length - submitted - overdue
  const mine = attendance.filter(a => a.cohort_id === current.cohort.id)

  return (
    <div>
      <PageHeader eyebrow="My Progress" title="Your Progress" intro={<>{programName(current)} · {current.cohort.name} — <strong>{programStateLabel(current, today)}</strong></>} />

      <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ ...cardStyle, marginBottom: 0 }}>
          <span style={labelStyle}>Reps submitted</span>
          <div style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '2.25rem', color: 'var(--navy)', letterSpacing: '0.04em', lineHeight: 1 }}>{submitted} of {reps.length}</div>
          <p style={{ ...mutedText, fontSize: '0.75rem', marginTop: '0.35rem' }}>Assigned weekly reps in this cohort</p>
        </div>
        <div style={{ ...cardStyle, marginBottom: 0 }}>
          <span style={labelStyle}>Still open</span>
          <div style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '2.25rem', color: 'var(--navy)', letterSpacing: '0.04em', lineHeight: 1 }}>{remaining}</div>
          <p style={{ ...mutedText, fontSize: '0.75rem', marginTop: '0.35rem' }}>{overdue > 0 ? `Plus ${overdue} overdue` : 'Nothing overdue'}</p>
        </div>
        <div style={{ ...cardStyle, marginBottom: 0 }}>
          <span style={labelStyle}>Journal entries</span>
          <div style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '2.25rem', color: 'var(--navy)', letterSpacing: '0.04em', lineHeight: 1 }}>{journalCount}</div>
          <p style={{ ...mutedText, fontSize: '0.75rem', marginTop: '0.35rem' }}>Written so far (private to you)</p>
        </div>
      </div>

      {mine.length > 0 && (
        <section aria-labelledby="progress-attendance" style={cardStyle}>
          <h2 id="progress-attendance" style={h2Style}>Attendance</h2>
          <p style={mutedText}>You attended {mine.filter(a => a.attended).length} of {mine.length} session{mine.length === 1 ? '' : 's'} Tramaine has recorded so far.</p>
        </section>
      )}

      <section aria-labelledby="progress-reps" style={cardStyle}>
        <h2 id="progress-reps" style={h2Style}>Weekly reps</h2>
        {reps.length === 0 ? (
          <p style={mutedText}>No weekly reps have been assigned yet. Tramaine posts each rep during the program.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {states.map(({ rep, state }) => (
              <li key={rep.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem 1rem', flexWrap: 'wrap', padding: '0.4rem 0', borderBottom: '1px solid var(--mist)' }}>
                <button type="button" onClick={() => onOpenRep(rep.id)} style={{ background: 'none', border: 'none', padding: '0.5rem 0', minHeight: '44px', cursor: 'pointer', textAlign: 'left', color: 'var(--ink)', fontSize: '0.86rem', fontFamily: 'var(--font-montserrat), sans-serif', flex: '1 1 200px', minWidth: 0 }}>
                  {rep.week_number != null && <span style={{ color: 'var(--slate)' }}>Week {rep.week_number} · </span>}{rep.title}
                </button>
                <StatusBadge kind={state.kind}>{state.label}</StatusBadge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
