import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { AdminPanel } from '../useAdminPanel'
import { cardStyle, inputStyle, labelStyle, statusBadge } from './shared'

type ProgramsTabProps = Pick<AdminPanel,
  'programs' | 'cohorts' | 'enrollments' | 'expandedProgram' | 'setExpandedProgram' |
  'actionLoading' | 'setActionLoading' | 'fetchAll' | 'showSuccess' | 'newCohort' | 'setNewCohort' | 'setShowCohortForm'
>

export default function ProgramsTab({ programs, cohorts, enrollments, expandedProgram, setExpandedProgram, actionLoading, setActionLoading, fetchAll, showSuccess, newCohort, setNewCohort, setShowCohortForm }: ProgramsTabProps) {
  const router = useRouter()
  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Programs</span>
        <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem' }}>Your Programs</h1>
        <p style={{ color: 'var(--slate)', fontSize: '0.85rem', marginTop: '0.35rem' }}>Click any program to edit its details and manage its cohorts.</p>
      </div>

      {programs.map(p => (
        <div key={p.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', cursor: 'pointer' }} onClick={() => setExpandedProgram(expandedProgram === p.id ? null : p.id)}>
            <div>
              <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.25rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>{p.name}</h3>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: 'var(--slate)', textTransform: 'uppercase' }}>{p.type}</span>
                <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: 'var(--slate)' }}>{cohorts.filter(c => c.program_id === p.id).length} cohorts</span>
                <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: 'var(--slate)' }}>{enrollments.filter(e => cohorts.find(c => c.program_id === p.id && c.id === e.cohort_id)).length} participants</span>
              </div>
            </div>
            <span style={{ color: 'var(--slate)', fontSize: '0.8rem' }}>{expandedProgram === p.id ? '▲' : '▼'}</span>
          </div>
          {expandedProgram === p.id && (
            <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--mist)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                {/* COACHING PROGRAM — focus areas only */}
                {p.type === 'coaching' && (
                  <>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>Focus Areas <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.65rem', color: 'var(--slate)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>— shown as cards on the Coaching page. Format each line as: Title | Description</span></label>
                      <textarea id={`focus-${p.id}`} defaultValue={(p as any).focus_areas || ''} rows={8} placeholder="Leadership | How you show up for and develop the people around you.&#10;Performance | Habits and behaviors that drive consistent results.&#10;Communication | Clarity, confidence, and presence when it matters." style={{ ...inputStyle, resize: 'vertical' }} />
                      <p style={{ color: 'var(--slate)', fontSize: '0.75rem', marginTop: '0.5rem', lineHeight: 1.5 }}>Each line becomes one card. Use a pipe character ( | ) to separate the title from the description.</p>
                    </div>
                  </>
                )}
                {/* COHORT PROGRAMS — full set of fields */}
                {p.type === 'cohort' && (
                  <>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>Motto <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.65rem', color: 'var(--slate)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>— shown in italics under the program name on the Impact Lab page</span></label>
                      <input id={`motto-${p.id}`} defaultValue={(p as any).motto || ''} placeholder='"Before you build anything, you have to see clearly."' style={inputStyle} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>Keywords <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.65rem', color: 'var(--slate)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>— shown as tags on the Impact Lab page, separated by commas</span></label>
                      <input id={`keywords-${p.id}`} defaultValue={(p as any).keywords || ''} placeholder="Clarity, Direction, Purpose" style={inputStyle} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>Program Description <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.65rem', color: 'var(--slate)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>— shown on the Impact Lab page and the Register page</span></label>
                      <textarea id={`desc-${p.id}`} defaultValue={p.description || ''} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>Development Goal <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.65rem', color: 'var(--slate)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>— shown on the Impact Lab page next to the description</span></label>
                      <textarea id={`goal-${p.id}`} defaultValue={(p as any).leadership_goal || ''} rows={2} placeholder="e.g. Get clear on where you want your impact and what is standing between you and it." style={{ ...inputStyle, resize: 'vertical' }} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>Focus Areas <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.65rem', color: 'var(--slate)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>— shown as bullet points on the Impact Lab page, one item per line</span></label>
                      <textarea id={`focus-${p.id}`} defaultValue={(p as any).focus_areas || ''} rows={6} placeholder="Clarity on your impact&#10;Identifying what matters most&#10;Removing what is in the way&#10;Direction and next steps" style={{ ...inputStyle, resize: 'vertical' }} />
                    </div>
                    <div>
                      <label style={labelStyle}>Session Day <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.65rem', color: 'var(--slate)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>— shown on the Register page</span></label>
                      <select id={`day-${p.id}`} defaultValue={(p as any).session_day || ''} style={inputStyle}>
                        <option value="">Select a day...</option>
                        {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Session Time <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.65rem', color: 'var(--slate)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>— shown on the Register page</span></label>
                      <input type="time" id={`time-${p.id}`} defaultValue={(p as any).session_time || ''} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Duration (weeks) <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.65rem', color: 'var(--slate)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>— shown on the Register page</span></label>
                      <input type="number" id={`duration-${p.id}`} defaultValue={(p as any).duration_weeks || ''} placeholder="e.g. 4" min="1" style={inputStyle} />
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={async () => {
                  setActionLoading(true)
                  const desc = (document.getElementById(`desc-${p.id}`) as HTMLTextAreaElement)?.value
                  const goal = (document.getElementById(`goal-${p.id}`) as HTMLTextAreaElement)?.value
                  const focus = (document.getElementById(`focus-${p.id}`) as HTMLTextAreaElement)?.value
                  const day = (document.getElementById(`day-${p.id}`) as HTMLSelectElement)?.value
                  const time = (document.getElementById(`time-${p.id}`) as HTMLInputElement)?.value
                  const duration = (document.getElementById(`duration-${p.id}`) as HTMLInputElement)?.value
                  const motto = (document.getElementById(`motto-${p.id}`) as HTMLInputElement)?.value
                  const keywords = (document.getElementById(`keywords-${p.id}`) as HTMLInputElement)?.value
                  await supabase.from('programs').update({
                    description: desc || null,
                    motto: motto || null,
                    keywords: keywords || null,
                    leadership_goal: goal || null,
                    focus_areas: focus || null,
                    session_day: day || null,
                    session_time: time || null,
                    duration_weeks: duration ? parseInt(duration) : null,
                  }).eq('id', p.id)
                  showSuccess(`${p.name} updated.`)
                  setExpandedProgram(null)
                  fetchAll()
                  setActionLoading(false)
                }}
                disabled={actionLoading}
                className="btn btn-primary"
                style={{ fontSize: '0.85rem', marginBottom: '1.5rem' }}
              >
                {actionLoading ? 'Saving...' : 'Save Changes'}
              </button>
              <span style={labelStyle}>Cohorts in this program</span>
              {cohorts.filter(c => c.program_id === p.id).length === 0 ? (
                <p style={{ color: 'var(--slate)', fontSize: '0.85rem', marginBottom: '1rem' }}>No cohorts yet. Create one in the Cohorts section.</p>
              ) : cohorts.filter(c => c.program_id === p.id).map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0', borderBottom: '1px solid var(--mist)', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span style={{ color: 'var(--ink)', fontSize: '0.85rem', fontWeight: 500 }}>{c.name}</span>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', color: 'var(--slate)' }}>{enrollments.filter(e => e.cohort_id === c.id).length} enrolled</span>
                    {statusBadge(c.status)}
                  </div>
                </div>
              ))}
              <button onClick={() => { router.push('/admin/cohorts'); setNewCohort({ ...newCohort, program_id: p.id }); setShowCohortForm(true) }} className="btn btn-ghost-dark" style={{ fontSize: '0.78rem', padding: '0.5rem 1rem', marginTop: '1rem' }}>+ Add Cohort</button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
