// Participation: who has submitted each weekly rep (and when), and who has not yet. Only the
// fact and date of a submission are shown, never what anyone wrote. Informational: it does
// not decide completion.
import { useState } from 'react'
import { formatDateET, todayET } from '@/lib/business-time'
import { linkButtonStyle, secondaryButtonStyle } from '../shared'
import { metaStyle, plural, rowStyle, subheadStyle, type CohortSectionProps, type OpenSection } from './ui'
import { assignedParticipants, currentReps, personParticipation, repParticipation } from './participation'
import { useCohortParticipation } from './useParticipation'

const nameListStyle = { listStyle: 'none', margin: '0.35rem 0 0', padding: 0, fontSize: '0.86rem', color: 'var(--ink)', lineHeight: 1.7 }

export default function CohortParticipation({ panel, cohort, onOpen }: CohortSectionProps & { onOpen: OpenSection }) {
  const { rows, loading, error, reload } = useCohortParticipation(cohort.id)
  const [openRep, setOpenRep] = useState<Record<string, boolean>>({})
  const [showPeople, setShowPeople] = useState(false)

  const today = todayET()
  const participants = assignedParticipants(cohort.id, panel.enrollments, panel.users)
  const reps = currentReps(cohort.id, panel.reps)
  const perRep = rows ? repParticipation(reps, participants, rows, today) : []
  const perPerson = rows ? personParticipation(participants, reps, rows, today) : []

  if (reps.length === 0) {
    return (
      <p style={{ ...metaStyle, margin: 0 }}>
        No weekly reps yet.{' '}
        <button type="button" onClick={() => onOpen('reps', `rep-new-${cohort.id}-title`)} style={{ ...linkButtonStyle, fontSize: '0.85rem' }}>Add a weekly rep</button>
      </p>
    )
  }

  return (
    <div>
      <p style={{ ...metaStyle, margin: '0 0 0.75rem' }}>
        Use this to check in with participants. It shows who has submitted each weekly rep and when, never what they wrote.
        {' '}Counts include {plural(participants.length, 'enrolled participant')} (people who withdrew are not counted).
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        <button type="button" onClick={() => void reload()} disabled={loading} style={secondaryButtonStyle}>{loading ? 'Loading…' : 'Refresh'}</button>
        {loading && <span role="status" style={metaStyle}>Loading participation…</span>}
      </div>
      {error && (
        <div role="alert" style={{ padding: '0.75rem 1rem', background: '#fdecea', border: '1px solid #f3b7b1', borderRadius: '4px', color: '#8c1d18', fontSize: '0.88rem', marginBottom: '0.75rem' }}>
          Participation could not be loaded: {error}{' '}
          <button type="button" onClick={() => void reload()} style={{ ...linkButtonStyle, color: '#8c1d18' }}>Try again</button>
        </div>
      )}

      {rows && (
        <>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {perRep.map(r => {
              const open = !!openRep[r.rep.id]
              const panelId = `participation-${cohort.id}-${r.rep.id}`
              return (
                <li key={r.rep.id} style={{ borderBottom: '1px solid var(--mist)' }}>
                  <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpenRep(p => ({ ...p, [r.rep.id]: !open }))}
                    style={{ ...rowStyle, width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-montserrat), sans-serif', minHeight: '44px' }}>
                    <span style={{ minWidth: 0, flex: '1 1 220px' }}>
                      <span style={{ ...metaStyle, display: 'block', color: '#8a5a10', fontWeight: 600 }}>
                        Week {r.rep.week_number}{r.rep.due_date ? ` · Due ${formatDateET(r.rep.due_date)}` : ''}
                      </span>
                      <span style={{ display: 'block', fontWeight: 600, color: 'var(--navy)', fontSize: '0.93rem', overflowWrap: 'anywhere' }}>{r.rep.title}</span>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.86rem', color: 'var(--ink)' }}>
                        <strong>{r.submitted.length} of {r.assigned}</strong> submitted
                        {r.outstanding.length > 0 && <> · {r.outstanding.length} not yet</>}
                        {r.overdue > 0 && <> · <span style={{ color: '#8c1d18' }}>{r.overdue} past the due date</span></>}
                      </span>
                      <span aria-hidden="true" style={{ color: '#8a5a10', fontWeight: 700 }}>{open ? '−' : '+'}</span>
                    </span>
                  </button>
                  {open && (
                    <div id={panelId} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '0.75rem 1.5rem', padding: '0 0 1rem' }}>
                      <div>
                        <h5 style={{ ...subheadStyle, fontSize: '0.95rem', margin: 0 }}>Submitted ({r.submitted.length})</h5>
                        {r.submitted.length === 0 ? <p style={{ ...metaStyle, margin: '0.35rem 0 0' }}>Nobody yet.</p> : (
                          <ul style={nameListStyle}>
                            {r.submitted.map(p => <li key={p.userId}>✓ {p.name}{p.at ? <span style={{ color: 'var(--slate)' }}> · {formatDateET(p.at)}</span> : null}</li>)}
                          </ul>
                        )}
                      </div>
                      <div>
                        <h5 style={{ ...subheadStyle, fontSize: '0.95rem', margin: 0 }}>Not submitted yet ({r.outstanding.length})</h5>
                        {r.outstanding.length === 0 ? <p style={{ ...metaStyle, margin: '0.35rem 0 0' }}>Everyone has submitted.</p> : (
                          <ul style={nameListStyle}>
                            {r.outstanding.map(p => <li key={p.userId}>○ {p.name}{p.overdue && <span style={{ color: '#8c1d18' }}> · past the due date</span>}</li>)}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>

          <div style={{ marginTop: '1rem' }}>
            <button type="button" aria-expanded={showPeople} aria-controls={`participation-${cohort.id}-people`} onClick={() => setShowPeople(v => !v)} style={secondaryButtonStyle}>
              {showPeople ? 'Hide' : 'Show'} each participant’s total
            </button>
            {showPeople && (
              <div id={`participation-${cohort.id}-people`} style={{ marginTop: '0.5rem' }}>
                {perPerson.length === 0 ? <p style={metaStyle}>Nobody is enrolled yet.</p> : (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {perPerson.map(p => (
                      <li key={p.userId} style={{ ...rowStyle, padding: '0.55rem 0' }}>
                        <span style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.9rem', overflowWrap: 'anywhere', minWidth: 0 }}>{p.name}</span>
                        <span style={{ fontSize: '0.86rem', color: 'var(--ink)' }}>
                          {p.submitted} of {plural(p.total, 'rep')} submitted
                          {p.overdue > 0 && <span style={{ color: '#8c1d18' }}> · {p.overdue} past the due date</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
