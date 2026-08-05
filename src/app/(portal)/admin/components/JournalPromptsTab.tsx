import type { AdminPanel } from '../useAdminPanel'
import { cardStyle, inputStyle, labelStyle } from './shared'

type JournalPromptsTabProps = Pick<AdminPanel,
  'journalPrompts' | 'programs' |
  'showPromptForm' | 'setShowPromptForm' | 'newPrompt' | 'setNewPrompt' | 'handleCreatePrompt' | 'actionLoading' | 'handleDeletePrompt'
>

export default function JournalPromptsTab({ journalPrompts, programs, showPromptForm, setShowPromptForm, newPrompt, setNewPrompt, handleCreatePrompt, actionLoading, handleDeletePrompt }: JournalPromptsTabProps) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Journal Prompts</span>
          <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem' }}>Journal Prompts</h1>
        </div>
        <button onClick={() => setShowPromptForm(!showPromptForm)} className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.65rem 1.25rem' }}>
          {showPromptForm ? 'Cancel' : '+ New Prompt'}
        </button>
      </div>
      {showPromptForm && (
        <div style={{ ...cardStyle, borderTop: '3px solid var(--gold)', marginBottom: '1.5rem' }}>
          <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1.25rem' }}>Add a Journal Prompt</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Prompt</label>
              <textarea value={newPrompt.prompt} onChange={e => setNewPrompt({ ...newPrompt, prompt: e.target.value })} placeholder="What question should participants reflect on?" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Program</label>
                <select value={newPrompt.program_id} onChange={e => setNewPrompt({ ...newPrompt, program_id: e.target.value })} style={inputStyle}>
                  <option value="">All Programs</option>
                  {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Week Number</label>
                <input type="number" value={newPrompt.week_number} onChange={e => setNewPrompt({ ...newPrompt, week_number: e.target.value })} placeholder="Leave blank to rotate" style={inputStyle} min="1" />
              </div>
            </div>
            <button onClick={handleCreatePrompt} disabled={actionLoading} className="btn btn-primary" style={{ fontSize: '0.85rem', alignSelf: 'flex-start' }}>
              {actionLoading ? 'Adding...' : 'Add Prompt'}
            </button>
          </div>
        </div>
      )}
      {journalPrompts.length === 0 && !showPromptForm && (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--slate)', fontSize: '0.88rem', marginBottom: '1rem' }}>No journal prompts yet.</p>
          <button onClick={() => setShowPromptForm(true)} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>+ Add Prompt</button>
        </div>
      )}
      {journalPrompts.map(jp => (
        <div key={jp.id} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', color: 'var(--slate)' }}>{jp.programs?.name || 'All Programs'}</span>
              {jp.week_number != null && <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', color: 'var(--gold)', textTransform: 'uppercase' }}>Week {jp.week_number}</span>}
            </div>
            <p style={{ color: 'var(--ink)', fontSize: '0.9rem', lineHeight: 1.6 }}>{jp.prompt}</p>
          </div>
          <button onClick={() => handleDeletePrompt(jp.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,59,48,0.5)', fontSize: '0.75rem', cursor: 'pointer', flexShrink: 0 }}>Delete</button>
        </div>
      ))}
    </div>
  )
}
