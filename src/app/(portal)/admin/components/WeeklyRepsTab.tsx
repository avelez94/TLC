import { supabase } from '@/lib/supabase'
import type { AdminPanel } from '../useAdminPanel'
import { cardStyle, inputStyle, labelStyle } from './shared'

type WeeklyRepsTabProps = Pick<AdminPanel,
  'reps' | 'cohorts' |
  'showRepForm' | 'setShowRepForm' | 'newRep' | 'setNewRep' | 'handleCreateRep' | 'actionLoading' |
  'editingRepId' | 'setEditingRepId' | 'editRep' | 'setEditRep' | 'handleUpdateRep' | 'fetchAll' |
  'repsCohortFilter' | 'setRepsCohortFilter'
>

export default function WeeklyRepsTab({ reps, cohorts, showRepForm, setShowRepForm, newRep, setNewRep, handleCreateRep, actionLoading, editingRepId, setEditingRepId, editRep, setEditRep, handleUpdateRep, fetchAll, repsCohortFilter, setRepsCohortFilter }: WeeklyRepsTabProps) {
  const filteredReps = repsCohortFilter === 'all' ? reps : reps.filter(r => r.cohort_id === repsCohortFilter)
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Weekly Reps</span>
          <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem' }}>Weekly Reps</h1>
        </div>
        <button onClick={() => setShowRepForm(!showRepForm)} className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.65rem 1.25rem' }}>
          {showRepForm ? 'Cancel' : '+ New Rep'}
        </button>
      </div>
      {showRepForm && (
        <div style={{ ...cardStyle, borderTop: '3px solid var(--gold)', marginBottom: '1.5rem' }}>
          <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1.25rem' }}>Create a Weekly Rep</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Cohort</label>
              <select value={newRep.cohort_id} onChange={e => setNewRep({ ...newRep, cohort_id: e.target.value })} style={inputStyle} required>
                <option value="">Select a cohort...</option>
                {cohorts.filter(c => c.status === 'active' || c.status === 'upcoming').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Week Number</label>
              <input type="number" value={newRep.week_number} onChange={e => setNewRep({ ...newRep, week_number: e.target.value })} placeholder="e.g. 5" style={inputStyle} min="1" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Rep Title</label>
              <input value={newRep.title} onChange={e => setNewRep({ ...newRep, title: e.target.value })} placeholder="e.g. Ask for feedback" style={inputStyle} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Instructions</label>
              <textarea value={newRep.instructions} onChange={e => setNewRep({ ...newRep, instructions: e.target.value })} placeholder="What should participants do this week?" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Why it matters</label>
              <textarea value={newRep.why_it_matters} onChange={e => setNewRep({ ...newRep, why_it_matters: e.target.value })} placeholder="Why is this rep important?" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <div>
              <label style={labelStyle}>Due Date</label>
              <input type="date" value={newRep.due_date} onChange={e => setNewRep({ ...newRep, due_date: e.target.value })} style={inputStyle} />
            </div>
          </div>
          <button onClick={handleCreateRep} disabled={actionLoading} className="btn btn-primary" style={{ fontSize: '0.85rem', marginTop: '1rem' }}>
            {actionLoading ? 'Creating...' : 'Create Rep'}
          </button>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1.5rem 0 1.25rem', flexWrap: 'wrap' }}>
        <label style={{ ...labelStyle, marginBottom: 0 }}>Filter by Cohort</label>
        <select value={repsCohortFilter} onChange={e => setRepsCohortFilter(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
          <option value="all">All Cohorts</option>
          {cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      {filteredReps.length === 0 && !showRepForm && (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--slate)', fontSize: '0.88rem', marginBottom: '1rem' }}>No weekly reps yet.</p>
          <button onClick={() => setShowRepForm(true)} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>+ Create Rep</button>
        </div>
      )}
      {filteredReps.map(rep => (
        <div key={rep.id} style={cardStyle}>
          {editingRepId === rep.id ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>Cohort</label>
                  <select value={editRep.cohort_id} onChange={e => setEditRep({ ...editRep, cohort_id: e.target.value })} style={inputStyle}>
                    <option value="">Select a cohort...</option>
                    {cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Week Number</label>
                  <input type="number" value={editRep.week_number} onChange={e => setEditRep({ ...editRep, week_number: e.target.value })} style={inputStyle} min="1" />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Rep Title</label>
                  <input value={editRep.title} onChange={e => setEditRep({ ...editRep, title: e.target.value })} style={inputStyle} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Instructions</label>
                  <textarea value={editRep.instructions} onChange={e => setEditRep({ ...editRep, instructions: e.target.value })} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Why it matters</label>
                  <textarea value={editRep.why_it_matters} onChange={e => setEditRep({ ...editRep, why_it_matters: e.target.value })} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
                </div>
                <div>
                  <label style={labelStyle}>Due Date</label>
                  <input type="date" value={editRep.due_date} onChange={e => setEditRep({ ...editRep, due_date: e.target.value })} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                <button onClick={() => handleUpdateRep(rep.id)} disabled={actionLoading} className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.55rem 1.1rem' }}>
                  {actionLoading ? 'Saving...' : 'Save'}
                </button>
                <button onClick={() => setEditingRepId(null)} style={{ background: 'none', border: '1px solid rgba(0,23,55,0.15)', color: 'var(--navy)', borderRadius: '2px', padding: '0.55rem 1.1rem', fontSize: '0.8rem', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', color: 'var(--gold)', textTransform: 'uppercase' }}>Week {rep.week_number}</span>
                  <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', color: 'var(--slate)' }}>{(rep.cohorts as any)?.name}</span>
                  {rep.due_date && <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', color: 'var(--slate)' }}>Due {rep.due_date}</span>}
                </div>
                <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em' }}>{rep.title}</h3>
              </div>
              <div style={{ display: 'flex', gap: '1rem', flexShrink: 0 }}>
                <button onClick={() => {
                  setEditingRepId(rep.id)
                  setEditRep({
                    cohort_id: rep.cohort_id || '',
                    week_number: String(rep.week_number || ''),
                    title: rep.title || '',
                    instructions: (rep as any).instructions || '',
                    why_it_matters: (rep as any).why_it_matters || '',
                    due_date: (rep as any).due_date || '',
                  })
                }} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: '0.75rem', cursor: 'pointer' }}>Edit</button>
                <button onClick={async () => { await supabase.from('weekly_reps').delete().eq('id', rep.id); fetchAll() }} style={{ background: 'none', border: 'none', color: 'rgba(255,59,48,0.5)', fontSize: '0.75rem', cursor: 'pointer' }}>Delete</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
