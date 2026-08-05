import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { AdminPanel } from '../useAdminPanel'
import { cardStyle, inputStyle, labelStyle, statusBadge } from './shared'

type CohortsTabProps = Pick<AdminPanel,
  'cohorts' | 'programs' | 'enrollments' | 'cohortSessions' | 'reps' |
  'showCohortForm' | 'setShowCohortForm' | 'newCohort' | 'setNewCohort' | 'handleCreateCohort' | 'actionLoading' |
  'expandedCohort' | 'setExpandedCohort' | 'handleUpdateCohortStatus' | 'fetchAll' |
  'handleGenerateSchedule' | 'handleAddSession' | 'handleDeleteSession' | 'newSession' | 'setNewSession'
>

type SectionKey = 'details' | 'content' | 'reading' | 'schedule' | 'participants'

function SectionHeader({ title, isOpen, onClick }: { title: string; isOpen: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '0.85rem 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
    >
      <span style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1rem', color: 'var(--navy)', letterSpacing: '0.06em' }}>{title}</span>
      <span style={{ color: 'var(--gold)', fontSize: '0.85rem', fontWeight: 700, width: '1rem', textAlign: 'center' }}>{isOpen ? '−' : '+'}</span>
    </button>
  )
}

export default function CohortsTab({
  cohorts, programs, enrollments, cohortSessions, reps,
  showCohortForm, setShowCohortForm, newCohort, setNewCohort, handleCreateCohort, actionLoading,
  expandedCohort, setExpandedCohort, handleUpdateCohortStatus, fetchAll,
  handleGenerateSchedule, handleAddSession, handleDeleteSession, newSession, setNewSession,
}: CohortsTabProps) {
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    details: true,
    content: false,
    reading: false,
    schedule: false,
    participants: false,
  })
  const toggleSection = (key: SectionKey) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))

  // Live preview of the book cover URL as the admin types, keyed by cohort id so
  // switching between expanded cohorts doesn't mix up previews. Separate from the
  // actual saved value — this only drives the preview; saving still happens onBlur.
  const [bookImagePreview, setBookImagePreview] = useState<Record<string, string>>({})
  const [bookImageError, setBookImageError] = useState<Record<string, boolean>>({})

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Cohorts</span>
          <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem' }}>All Cohorts</h1>
        </div>
        <button onClick={() => setShowCohortForm(!showCohortForm)} className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.65rem 1.25rem' }}>
          {showCohortForm ? 'Cancel' : '+ New Cohort'}
        </button>
      </div>
      {showCohortForm && (
        <div style={{ ...cardStyle, borderTop: '3px solid var(--gold)', marginBottom: '1.5rem' }}>
          <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1.25rem' }}>Create a Cohort</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Cohort Name</label>
              <input value={newCohort.name} onChange={e => setNewCohort({ ...newCohort, name: e.target.value })} placeholder="e.g. Impact Makers — Fall 2025" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Program</label>
              <select value={newCohort.program_id} onChange={e => setNewCohort({ ...newCohort, program_id: e.target.value })} style={inputStyle} required>
                <option value="">Select a program...</option>
                {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Start Date</label>
              <input type="date" value={newCohort.start_date} onChange={e => setNewCohort({ ...newCohort, start_date: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>End Date</label>
              <input type="date" value={newCohort.end_date} onChange={e => setNewCohort({ ...newCohort, end_date: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select value={newCohort.status} onChange={e => setNewCohort({ ...newCohort, status: e.target.value })} style={inputStyle}>
                <option value="upcoming">Upcoming</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Zoom Link</label>
              <input value={newCohort.zoom_link} onChange={e => setNewCohort({ ...newCohort, zoom_link: e.target.value })} placeholder="https://zoom.us/j/..." style={inputStyle} />
            </div>
          </div>
          <button onClick={handleCreateCohort} disabled={actionLoading} className="btn btn-primary" style={{ fontSize: '0.85rem', marginTop: '1rem' }}>
            {actionLoading ? 'Creating...' : 'Create Cohort'}
          </button>
        </div>
      )}
      {cohorts.length === 0 && !showCohortForm && (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--slate)', fontSize: '0.88rem', marginBottom: '1rem' }}>No cohorts yet. Create your first one.</p>
          <button onClick={() => setShowCohortForm(true)} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>+ Create Cohort</button>
        </div>
      )}
      {cohorts.map(c => (
        <div key={c.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', cursor: 'pointer' }} onClick={() => setExpandedCohort(expandedCohort === c.id ? null : c.id)}>
            <div>
              <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.15rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '0.35rem' }}>{c.name}</h3>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: 'var(--slate)' }}>{(c.programs as any)?.name || 'No program'}</span>
                {c.start_date && <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: 'var(--slate)' }}>{c.start_date} to {c.end_date}</span>}
                <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: 'var(--slate)' }}>{enrollments.filter(e => e.cohort_id === c.id && e.status === 'active').length} enrolled</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              {statusBadge(c.status)}
              <span style={{ color: 'var(--slate)', fontSize: '0.8rem' }}>{expandedCohort === c.id ? '▲' : '▼'}</span>
            </div>
          </div>
          {expandedCohort === c.id && (
            <div style={{ marginTop: '1.25rem', paddingTop: '0.25rem', borderTop: '1px solid var(--mist)' }}>

              {/* DETAILS */}
              <div style={{ borderBottom: '1px solid var(--mist)' }}>
                <SectionHeader title="Details" isOpen={openSections.details} onClick={() => toggleSection('details')} />
                {openSections.details && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', paddingBottom: '1.25rem' }}>
                    <div>
                      <label style={labelStyle}>Cohort Name</label>
                      <input defaultValue={c.name} style={inputStyle} onBlur={async e => { if (e.target.value !== c.name) { await supabase.from('cohorts').update({ name: e.target.value }).eq('id', c.id); fetchAll() } }} />
                    </div>
                    <div>
                      <label style={labelStyle}>Status</label>
                      <select value={c.status} onChange={e => handleUpdateCohortStatus(c.id, e.target.value)} style={inputStyle}>
                        <option value="upcoming">Upcoming</option>
                        <option value="active">Active</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Start Date</label>
                      <input type="date" defaultValue={c.start_date || ''} style={inputStyle} onBlur={async e => { await supabase.from('cohorts').update({ start_date: e.target.value || null }).eq('id', c.id); fetchAll() }} />
                    </div>
                    <div>
                      <label style={labelStyle}>End Date</label>
                      <input type="date" defaultValue={c.end_date || ''} style={inputStyle} onBlur={async e => { await supabase.from('cohorts').update({ end_date: e.target.value || null }).eq('id', c.id); fetchAll() }} />
                    </div>
                    <div>
                      <label style={labelStyle}>Session Day</label>
                      <select defaultValue={(c as any).session_day || ''} style={inputStyle} onChange={async e => { await supabase.from('cohorts').update({ session_day: e.target.value || null }).eq('id', c.id); fetchAll() }}>
                        <option value="">Select a day...</option>
                        {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Session Time</label>
                      <input type="time" defaultValue={(c as any).session_time || ''} style={inputStyle} onBlur={async e => { await supabase.from('cohorts').update({ session_time: e.target.value || null }).eq('id', c.id); fetchAll() }} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>Zoom Link</label>
                      <input defaultValue={c.zoom_link || ''} placeholder="https://zoom.us/j/..." style={inputStyle} onBlur={async e => { await supabase.from('cohorts').update({ zoom_link: e.target.value || null }).eq('id', c.id); fetchAll() }} />
                    </div>
                  </div>
                )}
              </div>

              {/* CONTENT */}
              <div style={{ borderBottom: '1px solid var(--mist)' }}>
                <SectionHeader title="Content" isOpen={openSections.content} onClick={() => toggleSection('content')} />
                {openSections.content && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '1.25rem' }}>
                    <div>
                      <label style={labelStyle}>Course Description <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.65rem', color: 'var(--slate)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>— shown on the Register page above What's Included</span></label>
                      <textarea
                        defaultValue={(c as any).description || ''}
                        placeholder="What will this cohort be about?"
                        rows={4}
                        style={{ ...inputStyle, resize: 'vertical' }}
                        onBlur={async e => { await supabase.from('cohorts').update({ description: e.target.value || null }).eq('id', c.id); fetchAll() }}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>What Is Included <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.65rem', color: 'var(--slate)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>— one item per line, shown on the Register page for this specific cohort.</span></label>
                      <textarea
                        defaultValue={(c as any).includes || 'Six live Zoom cohort sessions\nGuided discussion and facilitation\nWeekly reflection and application guide\nPractical action commitments between sessions\nCohort discussion community\nSession recordings (optional)\nCertificate of Completion'}
                        rows={7}
                        style={{ ...inputStyle, resize: 'vertical' }}
                        onBlur={async e => { await supabase.from('cohorts').update({ includes: e.target.value || null }).eq('id', c.id); fetchAll() }}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Expectations <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.65rem', color: 'var(--slate)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>— one item per line, shown on the Register page for this specific cohort.</span></label>
                      <textarea
                        defaultValue={(c as any).expectations || 'Read assigned chapters each week\nAttend live sessions\nParticipate in discussion\nComplete weekly reflection\nApply one idea between sessions'}
                        rows={5}
                        style={{ ...inputStyle, resize: 'vertical' }}
                        onBlur={async e => { await supabase.from('cohorts').update({ expectations: e.target.value || null }).eq('id', c.id); fetchAll() }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* READING */}
              <div style={{ borderBottom: '1px solid var(--mist)' }}>
                <SectionHeader title="Reading" isOpen={openSections.reading} onClick={() => toggleSection('reading')} />
                {openSections.reading && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', paddingBottom: '1.25rem' }}>
                    <div>
                      <label style={labelStyle}>Book Title</label>
                      <input defaultValue={(c as any).book_title || ''} placeholder="e.g. Atomic Habits" style={inputStyle} onBlur={async e => { await supabase.from('cohorts').update({ book_title: e.target.value || null }).eq('id', c.id); fetchAll() }} />
                    </div>
                    <div>
                      <label style={labelStyle}>Book Cover Image URL</label>
                      <input
                        defaultValue={(c as any).book_image_url || ''}
                        placeholder="https://..."
                        style={inputStyle}
                        onChange={e => {
                          setBookImagePreview(prev => ({ ...prev, [c.id]: e.target.value }))
                          setBookImageError(prev => ({ ...prev, [c.id]: false }))
                        }}
                        onBlur={async e => { await supabase.from('cohorts').update({ book_image_url: e.target.value || null }).eq('id', c.id); fetchAll() }}
                      />
                      {(() => {
                        const previewUrl = bookImagePreview[c.id] !== undefined ? bookImagePreview[c.id] : ((c as any).book_image_url || '')
                        if (!previewUrl.trim()) return null
                        if (bookImageError[c.id]) {
                          return (
                            <p style={{ color: '#ff6b6b', fontSize: '0.75rem', marginTop: '0.5rem' }}>Image failed to load. Check the URL.</p>
                          )
                        }
                        return (
                          <div style={{ marginTop: '0.5rem', width: '90px', aspectRatio: '2/3', borderRadius: '3px', overflow: 'hidden', background: 'var(--mist)', border: '1px solid rgba(0,23,55,0.1)' }}>
                            <img
                              src={previewUrl}
                              alt="Book cover preview"
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                              onError={() => setBookImageError(prev => ({ ...prev, [c.id]: true }))}
                            />
                          </div>
                        )
                      })()}
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>Purchase Link</label>
                      <input defaultValue={(c as any).book_purchase_url || ''} placeholder="https://amazon.com/..." style={inputStyle} onBlur={async e => { await supabase.from('cohorts').update({ book_purchase_url: e.target.value || null }).eq('id', c.id); fetchAll() }} />
                    </div>
                  </div>
                )}
              </div>

              {/* SCHEDULE */}
              <div style={{ borderBottom: '1px solid var(--mist)' }}>
                <SectionHeader title="Schedule" isOpen={openSections.schedule} onClick={() => toggleSection('schedule')} />
                {openSections.schedule && (
                  <div style={{ paddingBottom: '1.25rem' }}>
                    {cohortSessions.filter(s => s.cohort_id === c.id).length === 0 ? (
                      <p style={{ color: 'var(--slate)', fontSize: '0.85rem', marginBottom: '1rem' }}>No sessions added yet.</p>
                    ) : cohortSessions.filter(s => s.cohort_id === c.id).map(s => (
                      <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0', borderBottom: '1px solid var(--mist)', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', color: 'var(--gold)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>
                            Session {s.session_number}{s.session_date ? ' · ' + new Date(s.session_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : ''}
                          </span>
                          <input
                            defaultValue={s.title}
                            style={{ ...inputStyle, padding: '0.35rem 0.65rem', fontSize: '0.85rem', width: '100%' }}
                            onBlur={async e => {
                              if (e.target.value !== s.title) {
                                await supabase.from('cohort_sessions').update({ title: e.target.value }).eq('id', s.id)
                                fetchAll()
                              }
                            }}
                          />
                        </div>
                        <button onClick={() => handleDeleteSession(s.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,59,48,0.5)', fontSize: '0.75rem', cursor: 'pointer', flexShrink: 0 }}>Remove</button>
                      </div>
                    ))}
                    <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(200,136,32,0.05)', borderRadius: '4px', border: '1px solid rgba(200,136,32,0.2)', marginBottom: '0.75rem' }}>
                      <p style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.4rem' }}>Schedule Generator</p>
                      <p style={{ color: 'var(--slate)', fontSize: '0.8rem', lineHeight: 1.5, marginBottom: '0.75rem' }}>
                      Automatically generates one session per {(c as any).session_day || programs.find(p => p.id === c.program_id) && (programs.find(p => p.id === c.program_id) as any)?.session_day || 'session day'} between the start and end dates. Make sure the program has a session day set under Programs.
                    </p>
                      <button onClick={() => handleGenerateSchedule(c.id)} disabled={actionLoading} style={{ background: 'var(--gold)', border: 'none', color: 'var(--navy)', borderRadius: '2px', padding: '0.55rem 1.1rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-montserrat), sans-serif' }}>
                        {actionLoading ? 'Generating...' : 'Generate Schedule'}
                      </button>
                      <p style={{ color: 'var(--slate)', fontSize: '0.72rem', marginTop: '0.5rem' }}>Note: this will replace any existing sessions for this cohort.</p>
                    </div>
                    <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--paper)', borderRadius: '4px', border: '1px solid var(--mist)' }}>
                      <p style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>Add a Session</p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                        <div>
                          <label style={labelStyle}>Session Number</label>
                          <input type="number" value={newSession.cohort_id === c.id ? newSession.session_number : ''} onChange={e => setNewSession({ cohort_id: c.id, session_number: e.target.value, title: newSession.cohort_id === c.id ? newSession.title : '', session_date: newSession.cohort_id === c.id ? newSession.session_date : '' })} placeholder={String(cohortSessions.filter(s => s.cohort_id === c.id).length + 1)} min="1" style={inputStyle} />
                        </div>
                        <div>
                          <label style={labelStyle}>Date (optional)</label>
                          <input type="date" value={newSession.cohort_id === c.id ? newSession.session_date : ''} onChange={e => setNewSession({ cohort_id: c.id, session_number: newSession.cohort_id === c.id ? newSession.session_number : '', title: newSession.cohort_id === c.id ? newSession.title : '', session_date: e.target.value })} style={inputStyle} />
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={labelStyle}>Session Title</label>
                          <input value={newSession.cohort_id === c.id ? newSession.title : ''} onChange={e => setNewSession({ cohort_id: c.id, session_number: newSession.cohort_id === c.id ? newSession.session_number : '', title: e.target.value, session_date: newSession.cohort_id === c.id ? newSession.session_date : '' })} placeholder="e.g. Where do you want your impact?" style={inputStyle} />
                        </div>
                      </div>
                      <button onClick={() => { setNewSession(prev => ({ ...prev, cohort_id: c.id })); handleAddSession() }} disabled={actionLoading} className="btn btn-primary" style={{ fontSize: '0.78rem', padding: '0.5rem 1rem' }}>
                        {actionLoading ? 'Adding...' : '+ Add Session'}
                      </button>
                    </div>
                    <div style={{ marginTop: '1.5rem' }}>
                      <span style={labelStyle}>Weekly Reps in this cohort</span>
                      {reps.filter(r => r.cohort_id === c.id).length === 0 ? (
                        <p style={{ color: 'var(--slate)', fontSize: '0.85rem' }}>No reps yet.</p>
                      ) : reps.filter(r => r.cohort_id === c.id).map(r => (
                        <div key={r.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--mist)' }}>
                          <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', color: 'var(--gold)', textTransform: 'uppercase' }}>Week {r.week_number}</span>
                          <p style={{ color: 'var(--ink)', fontSize: '0.85rem', fontWeight: 500 }}>{r.title}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* PARTICIPANTS */}
              <div>
                <SectionHeader title="Participants" isOpen={openSections.participants} onClick={() => toggleSection('participants')} />
                {openSections.participants && (
                  <div style={{ paddingBottom: '0.5rem' }}>
                    {enrollments.filter(e => e.cohort_id === c.id).length === 0 ? (
                      <p style={{ color: 'var(--slate)', fontSize: '0.85rem' }}>No participants enrolled yet. Invite someone and assign them to this cohort.</p>
                    ) : enrollments.filter(e => e.cohort_id === c.id).map(e => (
                      <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0', borderBottom: '1px solid var(--mist)', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div>
                          <span style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.85rem' }}>{(e.profiles as any)?.full_name || 'Unknown'}</span>
                          <span style={{ display: 'block', color: 'var(--slate)', fontSize: '0.75rem' }}>{(e.profiles as any)?.email}</span>
                        </div>
                        {statusBadge(e.status)}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      ))}
    </div>
  )
}