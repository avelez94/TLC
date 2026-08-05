import { supabase } from '@/lib/supabase'
import type { AdminPanel } from '../useAdminPanel'
import { cardStyle, inputStyle, labelStyle, thStyle, tdStyle } from './shared'

type ResourcesTabProps = Pick<AdminPanel,
  'resources' | 'programs' |
  'showResourceForm' | 'setShowResourceForm' | 'newResource' | 'setNewResource' |
  'handleCreateResource' | 'actionLoading' | 'setActionLoading' | 'handleDeleteResource' | 'showSuccess'
>

export default function ResourcesTab({ resources, programs, showResourceForm, setShowResourceForm, newResource, setNewResource, handleCreateResource, actionLoading, setActionLoading, handleDeleteResource, showSuccess }: ResourcesTabProps) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Resources</span>
          <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem' }}>Resource Library</h1>
        </div>
        <button onClick={() => setShowResourceForm(!showResourceForm)} className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.65rem 1.25rem' }}>
          {showResourceForm ? 'Cancel' : '+ Add Resource'}
        </button>
      </div>
      {showResourceForm && (
        <div style={{ ...cardStyle, borderTop: '3px solid var(--gold)', marginBottom: '1.5rem' }}>
          <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1.25rem' }}>Add a Resource</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Title</label>
              <input value={newResource.title} onChange={e => setNewResource({ ...newResource, title: e.target.value })} placeholder="Resource title" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Type</label>
              <select value={newResource.type} onChange={e => setNewResource({ ...newResource, type: e.target.value })} style={inputStyle}>
                {['pdf', 'video', 'article', 'worksheet', 'template', 'book', 'recording'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Portal</label>
              <select value={newResource.portal_type} onChange={e => setNewResource({ ...newResource, portal_type: e.target.value, program_id: '' })} style={inputStyle}>
                <option value="impact">Impact Lab</option>
                <option value="coaching">Coaching Portal</option>
                <option value="both">Both Portals</option>
              </select>
            </div>
            <div style={{ opacity: newResource.portal_type === 'coaching' ? 0.4 : 1, pointerEvents: newResource.portal_type === 'coaching' ? 'none' : 'auto' }}>
              <label style={labelStyle}>
                Program
                {newResource.portal_type === 'coaching' && <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.65rem', color: 'var(--slate)', textTransform: 'none', letterSpacing: 0, fontWeight: 400, marginLeft: '0.5rem' }}>not applicable for coaching</span>}
              </label>
              <select
                value={newResource.program_id}
                onChange={e => setNewResource({ ...newResource, program_id: e.target.value })}
                disabled={newResource.portal_type === 'coaching'}
                style={inputStyle}
              >
                <option value="">All Impact Lab programs</option>
                {programs.filter(p => p.type === 'cohort').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Topic</label>
              <input value={newResource.topic} onChange={e => setNewResource({ ...newResource, topic: e.target.value })} placeholder="e.g. Session recordings" style={inputStyle} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Description</label>
              <input value={newResource.description} onChange={e => setNewResource({ ...newResource, description: e.target.value })} placeholder="Brief description" style={inputStyle} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>File Upload <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.65rem', color: 'var(--slate)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>upload a file from your computer</span></label>
              <input
                type="file"
                id="resource-file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.mp4,.mov,.mp3,.png,.jpg,.jpeg"
                style={{ ...inputStyle, padding: '0.5rem 1rem', cursor: 'pointer' }}
                onChange={async e => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setActionLoading(true)
                  const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`
                  const { data, error } = await supabase.storage.from('resources').upload(fileName, file)
                  if (!error && data) {
                    const { data: urlData } = supabase.storage.from('resources').getPublicUrl(fileName)
                    setNewResource({ ...newResource, url: urlData.publicUrl })
                    showSuccess(`File uploaded: ${file.name}`)
                  } else {
                    showSuccess('Upload failed. Try again.')
                  }
                  setActionLoading(false)
                }}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Or paste a URL <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.65rem', color: 'var(--slate)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>link to an external resource</span></label>
              <input value={newResource.url} onChange={e => setNewResource({ ...newResource, url: e.target.value })} placeholder="https://..." style={inputStyle} />
            </div>
            {newResource.url && (
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ background: 'rgba(200,136,32,0.06)', border: '1px solid rgba(200,136,32,0.2)', borderRadius: '4px', padding: '0.75rem 1rem', fontSize: '0.82rem', color: 'var(--slate)' }}>
                  Ready to save: <a href={newResource.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold)', wordBreak: 'break-all' }}>{newResource.url}</a>
                </div>
              </div>
            )}
          </div>
          <button onClick={handleCreateResource} disabled={actionLoading} className="btn btn-primary" style={{ fontSize: '0.85rem', marginTop: '1rem' }}>
            {actionLoading ? 'Adding...' : 'Add Resource'}
          </button>
        </div>
      )}
      {resources.length === 0 && !showResourceForm && (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--slate)', fontSize: '0.88rem', marginBottom: '1rem' }}>No resources yet.</p>
          <button onClick={() => setShowResourceForm(true)} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>+ Add Resource</button>
        </div>
      )}
      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        {resources.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Title', 'Type', 'Program', 'Portal', 'Actions'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
              <tbody>
                {resources.map(r => (
                  <tr key={r.id}>
                    <td style={tdStyle}><span style={{ fontWeight: 600, color: 'var(--navy)' }}>{r.title}</span>{r.description && <span style={{ display: 'block', color: 'var(--slate)', fontSize: '0.75rem' }}>{r.description}</span>}</td>
                    <td style={tdStyle}><span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.65rem', color: 'var(--slate)', textTransform: 'uppercase' }}>{r.type}</span></td>
                    <td style={tdStyle}>{(r.programs as any)?.name || 'All'}</td>
                    <td style={tdStyle}><span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.65rem', color: 'var(--gold)', textTransform: 'uppercase' }}>{r.portal_type}</span></td>
                    <td style={tdStyle}><button onClick={() => handleDeleteResource(r.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,59,48,0.6)', fontSize: '0.75rem', cursor: 'pointer' }}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
