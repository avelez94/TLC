import type { AdminPanel } from '../useAdminPanel'
import { cardStyle, inputStyle, labelStyle } from './shared'

type CommunityTabProps = Pick<AdminPanel,
  'communityPosts' | 'cohorts' |
  'newCommunityPost' | 'setNewCommunityPost' | 'handleCreateCommunityPost' | 'actionLoading' |
  'communityCohortFilter' | 'setCommunityCohortFilter' |
  'expandedComments' | 'toggleComments' | 'commentDrafts' | 'setCommentDrafts' | 'handleAddComment' | 'handleDeleteComment' | 'handleDeleteCommunityPost'
>

export default function CommunityTab({
  communityPosts, cohorts,
  newCommunityPost, setNewCommunityPost, handleCreateCommunityPost, actionLoading,
  communityCohortFilter, setCommunityCohortFilter,
  expandedComments, toggleComments, commentDrafts, setCommentDrafts, handleAddComment, handleDeleteComment, handleDeleteCommunityPost,
}: CommunityTabProps) {
  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Community</span>
        <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem' }}>Community Feed</h1>
      </div>

      <div style={{ ...cardStyle, borderTop: '3px solid var(--gold)' }}>
        <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1.25rem' }}>Post as Tramaine</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Cohort</label>
            <select value={newCommunityPost.cohort_id} onChange={e => setNewCommunityPost({ ...newCommunityPost, cohort_id: e.target.value })} style={inputStyle} required>
              <option value="">Select a cohort...</option>
              {cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Message</label>
            <textarea value={newCommunityPost.body} onChange={e => setNewCommunityPost({ ...newCommunityPost, body: e.target.value })} placeholder="Share something with this cohort..." rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <button onClick={handleCreateCommunityPost} disabled={actionLoading || !newCommunityPost.cohort_id || !newCommunityPost.body.trim()} className="btn btn-primary" style={{ fontSize: '0.85rem', alignSelf: 'flex-start' }}>
            {actionLoading ? 'Posting...' : 'Post'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1.5rem 0 1.25rem', flexWrap: 'wrap' }}>
        <label style={{ ...labelStyle, marginBottom: 0 }}>Filter by Cohort</label>
        <select value={communityCohortFilter} onChange={e => setCommunityCohortFilter(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
          <option value="all">All Cohorts</option>
          {cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {(() => {
        const filteredPosts = communityPosts.filter(p => communityCohortFilter === 'all' || p.cohort_id === communityCohortFilter)
        if (filteredPosts.length === 0) {
          return (
            <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem' }}>
              <p style={{ color: 'var(--slate)', fontSize: '0.88rem' }}>No posts yet.</p>
            </div>
          )
        }
        return filteredPosts.map(post => {
          const isAdmin = post.profiles?.role === 'admin'
          const comments = (post.community_comments || []).slice().sort((a: { created_at: string }, b: { created_at: string }) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          const commentsOpen = !!expandedComments[post.id]
          return (
            <div key={post.id} style={{ ...cardStyle, borderLeft: isAdmin ? '4px solid var(--gold)' : '1px solid rgba(0,23,55,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 600, color: isAdmin ? 'var(--gold)' : 'var(--navy)', fontSize: '0.88rem' }}>{post.profiles?.full_name || (isAdmin ? 'Tramaine' : 'Unknown')}</span>
                    {isAdmin && (
                      <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.55rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--navy)', background: 'rgba(200,136,32,0.15)', padding: '0.15rem 0.5rem', borderRadius: '2px' }}>Admin</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', color: 'var(--slate)' }}>{post.cohorts?.name || 'Unknown cohort'}</span>
                    <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', color: 'var(--slate)' }}>{new Date(post.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>
                <button onClick={() => handleDeleteCommunityPost(post.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,59,48,0.5)', fontSize: '0.75rem', cursor: 'pointer' }}>Delete</button>
              </div>
              <p style={{ color: 'var(--slate)', fontSize: '0.88rem', lineHeight: 1.7, marginBottom: '0.5rem' }}>{post.body}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: 'var(--slate)' }}>♡ {post.community_likes?.length || 0}</span>
                <button onClick={() => toggleComments(post.id)} style={{ background: 'none', border: 'none', color: 'var(--slate)', fontSize: '0.7rem', cursor: 'pointer', fontFamily: 'var(--font-jetbrains), monospace' }}>
                  {comments.length} comment{comments.length === 1 ? '' : 's'} {commentsOpen ? '▲' : '▼'}
                </button>
              </div>
              {commentsOpen && (
                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--mist)' }}>
                  {comments.length === 0 && <p style={{ color: 'var(--slate)', fontSize: '0.8rem' }}>No comments yet.</p>}
                  {comments.map((c: { id: string; body: string; created_at: string; profiles?: { full_name: string | null; role?: string } }) => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.6rem' }}>
                      <div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline' }}>
                          <span style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.78rem' }}>{c.profiles?.full_name || (c.profiles?.role === 'admin' ? 'Tramaine' : 'Unknown')}</span>
                          <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.55rem', color: 'var(--slate)' }}>{new Date(c.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                        <p style={{ color: 'var(--ink)', fontSize: '0.82rem', lineHeight: 1.6 }}>{c.body}</p>
                      </div>
                      <button onClick={() => handleDeleteComment(c.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,59,48,0.5)', fontSize: '0.7rem', cursor: 'pointer', flexShrink: 0 }}>Delete</button>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <textarea
                      value={commentDrafts[post.id] || ''}
                      onChange={e => setCommentDrafts(prev => ({ ...prev, [post.id]: e.target.value }))}
                      placeholder="Add a comment..."
                      rows={2}
                      style={{ ...inputStyle, flex: 1, resize: 'vertical' }}
                    />
                    <button onClick={() => handleAddComment(post.id)} disabled={actionLoading} className="btn btn-primary" style={{ fontSize: '0.78rem', padding: '0.5rem 1rem' }}>Send</button>
                  </div>
                </div>
              )}
            </div>
          )
        })
      })()}
    </div>
  )
}
