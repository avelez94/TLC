import Link from 'next/link'
import { formatDateET } from '@/lib/business-time'
import { safeHref } from '@/lib/sanitize-html'
import { nextSession, programName, programStateLabel, repState, thisWeeksRep } from './logic'
import { cardStyle, ContactLink, h1Style, h2Style, linkButtonStyle, mutedText, StatusBadge } from './ui'
import type { Membership, Page, Rep, SessionRow, Submission } from './types'

const statLabel = { fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.55rem', letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: 'var(--gold)', display: 'block', marginBottom: '0.5rem' }

export function Dashboard({ firstName, current, otherCurrent, pastCount, certificateCount, reps, submissions, sessions, announcementCount, today, showStartHere, onDismissStartHere, navigate, openRep, selectCurrent }: {
  firstName: string
  current: Membership | null
  otherCurrent: Membership[]
  pastCount: number
  certificateCount: number
  /** Assigned (non-archived) reps of the current cohort. */
  reps: Rep[]
  submissions: Map<string, Submission>
  sessions: SessionRow[]
  /** Announcements for the current cohort or addressed to this participant. */
  announcementCount: number
  today: string
  showStartHere: boolean
  onDismissStartHere: () => void
  navigate: (p: Page) => void
  openRep: (repId: string) => void
  selectCurrent: (cohortId: string) => void
}) {
  const submittedIds = new Set(submissions.keys())
  const submittedCount = reps.filter(r => submittedIds.has(r.id)).length
  const overdueCount = current ? reps.filter(r => repState(r, submittedIds.has(r.id), current.canWrite, today).kind === 'overdue').length : 0
  const focus = current ? thisWeeksRep(reps, submittedIds, today) : null
  const upcoming = current ? nextSession(sessions, today) : null
  const join = current ? safeHref(current.zoomLink) : undefined

  return (
    <div>
      <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Dashboard</span>
      <h1 style={h1Style}>Welcome back, {firstName}.</h1>

      {showStartHere && current && (
        <section aria-labelledby="start-here" style={{ ...cardStyle, borderLeft: '4px solid var(--gold)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
            <h2 id="start-here" style={h2Style}>Start here</h2>
            <button type="button" onClick={onDismissStartHere} style={{ ...linkButtonStyle, padding: '0 0.25rem', color: 'var(--slate)', fontWeight: 500, fontSize: '0.78rem' }}>Hide this guide</button>
          </div>
          <ul style={{ ...mutedText, paddingLeft: '1.1rem', margin: 0 }}>
            <li><strong>Current Program</strong> — your session dates, times and meeting link.</li>
            <li><strong>Weekly Reps</strong> — one practice each week; open it and submit a short reflection.</li>
            <li><strong>Reflection Journal</strong> — private notes only you can see.</li>
            <li><strong>Resource Library</strong> — readings and handouts from Tramaine.</li>
            <li><strong>My Certificates</strong> — your certificate appears here after Tramaine records your completion.</li>
          </ul>
        </section>
      )}

      {!current && (
        <section aria-labelledby="not-enrolled" style={cardStyle}>
          <h2 id="not-enrolled" style={h2Style}>You&rsquo;re not in a current program</h2>
          <p style={{ ...mutedText, marginBottom: '0.75rem' }}>
            To join another program, see the upcoming cohorts on the <Link href="/impact" style={{ color: 'var(--gold)', fontWeight: 600 }}>Impact Lab page</Link>, or email Tramaine at <ContactLink /> for help getting enrolled.
          </p>
          <p style={mutedText}>Programs you finished stay in <strong>My Completed Programs</strong>, and any certificates you earned are in <strong>My Certificates</strong>.</p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
            <button type="button" onClick={() => navigate('completed')} className="btn btn-ghost-dark" style={{ fontSize: '0.8rem', padding: '0.65rem 1.25rem' }}>My Completed Programs</button>
            <button type="button" onClick={() => navigate('certificates')} className="btn btn-ghost-dark" style={{ fontSize: '0.8rem', padding: '0.65rem 1.25rem' }}>My Certificates</button>
          </div>
        </section>
      )}

      {current && (
        <>
          <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ ...cardStyle, marginBottom: 0 }}>
              <span style={statLabel}>Current Program</span>
              <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '0.88rem', lineHeight: 1.4, marginBottom: '0.25rem' }}>{programName(current)}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--slate)' }}>{current.cohort.name} · {programStateLabel(current, today)}</div>
            </div>
            <div style={{ ...cardStyle, marginBottom: 0 }}>
              <span style={statLabel}>Weekly Reps</span>
              <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '0.88rem', lineHeight: 1.4, marginBottom: '0.25rem' }}>{reps.length === 0 ? 'None assigned yet' : `${submittedCount} of ${reps.length} submitted`}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--slate)' }}>{overdueCount > 0 ? `${overdueCount} overdue` : reps.length > 0 ? 'Nothing overdue' : 'Reps appear as the program runs'}</div>
            </div>
            <div style={{ ...cardStyle, marginBottom: 0 }}>
              <span style={statLabel}>From Tramaine</span>
              <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '0.88rem', lineHeight: 1.4, marginBottom: '0.25rem' }}>{announcementCount} announcement{announcementCount === 1 ? '' : 's'}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--slate)' }}>For your cohort or just for you</div>
            </div>
          </div>

          <div className="two-col-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <section aria-labelledby="this-week" style={cardStyle}>
              <h2 id="this-week" style={h2Style}>This Week</h2>
              {focus ? (
                <div style={{ background: 'var(--navy)', borderRadius: '4px', padding: '1.25rem', marginBottom: '1rem' }}>
                  <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '0.4rem' }}>
                    {focus.rep.week_number != null ? `Week ${focus.rep.week_number} rep` : 'Weekly rep'}
                  </span>
                  <p style={{ color: 'white', fontSize: '0.92rem', fontWeight: 600, marginBottom: '0.5rem' }}>{focus.rep.title}</p>
                  <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.78rem', marginBottom: '0.75rem' }}>
                    {focus.overdue
                      ? <><strong style={{ color: '#F2B8B8' }}>Overdue</strong> — was due {formatDateET(focus.rep.due_date, 'long')}</>
                      : focus.rep.due_date ? `Due ${formatDateET(focus.rep.due_date, 'long')}` : 'Open — no due date'}
                  </p>
                  <button type="button" onClick={() => openRep(focus.rep.id)} className="btn btn-primary" style={{ fontSize: '0.78rem', padding: '0.6rem 1.1rem' }}>Open this rep</button>
                </div>
              ) : (
                <p style={{ ...mutedText, marginBottom: '1rem' }}>{reps.length === 0 ? 'No weekly reps have been posted yet. Tramaine posts each rep during the program.' : 'All caught up — every rep is submitted.'}</p>
              )}
              <div style={{ borderTop: '1px solid var(--mist)', paddingTop: '0.75rem', marginBottom: '1rem' }}>
                <span style={statLabel}>Next session</span>
                {upcoming ? (
                  <p style={{ color: 'var(--ink)', fontSize: '0.85rem', lineHeight: 1.6 }}>
                    {formatDateET(upcoming.session_date, 'long')}{upcoming.session_date === today ? ' (today)' : ''} — {upcoming.title || `Session ${upcoming.session_number}`}
                    {join && <><br /><a href={join} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', minHeight: '44px' }}>Join session (opens in a new tab)</a></>}
                  </p>
                ) : (
                  <p style={mutedText}>{sessions.length === 0 ? 'Tramaine will post the session dates before the program starts.' : 'No more sessions are scheduled.'}</p>
                )}
              </div>
              <button type="button" onClick={() => navigate('reps')} className="btn btn-ghost-dark" style={{ fontSize: '0.8rem', padding: '0.65rem 1.25rem' }}>View all reps</button>
            </section>

            <section aria-labelledby="quick-links" style={cardStyle}>
              <h2 id="quick-links" style={h2Style}>Quick Links</h2>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {([
                  ['current', 'Current Program', '📅'], ['reps', 'Weekly Reps', '⚡'], ['journal', 'Reflection Journal', '📓'],
                  ['announcements', 'Announcements', '📢'], ['library', 'Resource Library', '📚'],
                ] as [Page, string, string][]).map(([id, label, icon]) => (
                  <li key={id}>
                    <button type="button" onClick={() => navigate(id)} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', width: '100%', padding: '0.6rem 0', minHeight: '44px', background: 'none', border: 'none', borderBottom: '1px solid var(--mist)', color: 'var(--navy)', fontSize: '0.85rem', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-montserrat), sans-serif' }}>
                      <span aria-hidden="true">{icon}</span>{label}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {otherCurrent.length > 0 && (
            <section aria-labelledby="also-enrolled" style={cardStyle}>
              <h2 id="also-enrolled" style={h2Style}>Your other current programs</h2>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {otherCurrent.map(m => (
                  <li key={m.cohort.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', padding: '0.5rem 0', borderBottom: '1px solid var(--mist)' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--ink)' }}><strong>{programName(m)}</strong> · {m.cohort.name} <StatusBadge kind="info">{programStateLabel(m, today)}</StatusBadge></span>
                    <button type="button" onClick={() => selectCurrent(m.cohort.id)} style={linkButtonStyle}>Switch to this program</button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {(pastCount > 0 || certificateCount > 0) && (
        <section aria-labelledby="past-programs" style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h2 id="past-programs" style={{ ...h2Style, marginBottom: '0.25rem' }}>Past programs</h2>
            <p style={mutedText}>
              {pastCount} completed program{pastCount === 1 ? '' : 's'} · {certificateCount} certificate{certificateCount === 1 ? '' : 's'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem 1.25rem', flexWrap: 'wrap' }}>
            {pastCount > 0 && <button type="button" onClick={() => navigate('completed')} style={linkButtonStyle}>Open past programs</button>}
            {certificateCount > 0 && <button type="button" onClick={() => navigate('certificates')} style={linkButtonStyle}>View certificates</button>}
          </div>
        </section>
      )}
    </div>
  )
}
