import type { AdminPanel } from '../useAdminPanel'
import { cardStyle, inputStyle, labelStyle } from './shared'

type AnnouncementsTabProps = Pick<AdminPanel,
  'announcements' | 'cohorts' |
  'showAnnouncementForm' | 'setShowAnnouncementForm' | 'newAnnouncement' | 'setNewAnnouncement' |
  'handleCreateAnnouncement' | 'actionLoading' | 'handleDeleteAnnouncement'
>

export default function AnnouncementsTab({ announcements, cohorts, showAnnouncementForm, setShowAnnouncementForm, newAnnouncement, setNewAnnouncement, handleCreateAnnouncement, actionLoading, handleDeleteAnnouncement }: AnnouncementsTabProps) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Announcements</span>
          <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem' }}>Announcements</h1>
        </div>
        <button onClick={() => setShowAnnouncementForm(!showAnnouncementForm)} className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.65rem 1.25rem' }}>
          {showAnnouncementForm ? 'Cancel' : '+ New Announcement'}
        </button>
      </div>
      {showAnnouncementForm && (
        <div style={{ ...cardStyle, borderTop: '3px solid var(--gold)', marginBottom: '1.5rem' }}>
          <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1.25rem' }}>Post an Announcement</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Send to</label>
              <select value={newAnnouncement.cohort_id} onChange={e => setNewAnnouncement({ ...newAnnouncement, cohort_id: e.target.value })} style={inputStyle}>
                <option value="">All Participants</option>
                {cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Title</label>
              <input value={newAnnouncement.title} onChange={e => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })} placeholder="Announcement title" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Message</label>
              <textarea value={newAnnouncement.body} onChange={e => setNewAnnouncement({ ...newAnnouncement, body: e.target.value })} placeholder="Write your announcement here..." rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <button onClick={handleCreateAnnouncement} disabled={actionLoading} className="btn btn-primary" style={{ fontSize: '0.85rem', alignSelf: 'flex-start' }}>
              {actionLoading ? 'Posting...' : 'Post Announcement'}
            </button>
          </div>
        </div>
      )}
      {announcements.length === 0 && !showAnnouncementForm && (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--slate)', fontSize: '0.88rem' }}>No announcements yet.</p>
        </div>
      )}
      {announcements.map(ann => (
        <div key={ann.id} style={{ ...cardStyle, borderLeft: '4px solid var(--gold)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <div>
              <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em' }}>{ann.title}</h3>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', color: 'var(--gold)', textTransform: 'uppercase' }}>{new Date(ann.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', color: 'var(--slate)' }}>{(ann.cohorts as any)?.name || 'All Participants'}</span>
              </div>
            </div>
            <button onClick={() => handleDeleteAnnouncement(ann.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,59,48,0.5)', fontSize: '0.75rem', cursor: 'pointer' }}>Delete</button>
          </div>
          <p style={{ color: 'var(--slate)', fontSize: '0.88rem', lineHeight: 1.7 }}>{ann.body}</p>
        </div>
      ))}
    </div>
  )
}
