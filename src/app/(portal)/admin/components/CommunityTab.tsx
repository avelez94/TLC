import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { AdminPanel } from '../useAdminPanel'
import { cardStyle, inputStyle, labelStyle } from './shared'

type CommunityTabProps = Pick<AdminPanel,
  'communityPosts' | 'cohorts' |
  'newCommunityPost' | 'setNewCommunityPost' | 'handleCreateCommunityPost' | 'actionLoading' |
  'communityCohortFilter' | 'setCommunityCohortFilter' |
  'expandedComments' | 'toggleComments' | 'commentDrafts' | 'setCommentDrafts' | 'handleAddComment' | 'handleDeleteComment' | 'handleDeleteCommunityPost'
>

type AdminView = 'posts' | 'chat'

export default function CommunityTab({
  communityPosts, cohorts,
  newCommunityPost, setNewCommunityPost, handleCreateCommunityPost, actionLoading,
  communityCohortFilter, setCommunityCohortFilter,
  expandedComments, toggleComments, commentDrafts, setCommentDrafts, handleAddComment, handleDeleteComment, handleDeleteCommunityPost,
}: CommunityTabProps) {
  const [view, setView] = useState<AdminView>('posts')
  const [chatCohortFilter, setChatCohortFilter] = useState<string>('all')
  const [chatMessages, setChatMessages] = useState<any[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null)
  const [adminId, setAdminId] = useState<string | null>(null)
  const [newChatMessage, setNewChatMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [likeOverrides, setLikeOverrides] = useState<Record<string, { liked: boolean; count: number }>>({})

  // Need the admin's own profile id so "like as Tramaine" and "chat as Tramaine"
  // actually attribute actions to him, same as any other participant would be.
  useEffect(() => {
    const getAdminId = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setAdminId(user.id)
    }
    getAdminId()
  }, [])

  const fetchChatMessages = useCallback(async () => {
    setChatLoading(true)
    let query = supabase
      .from('cohort_messages')
      .select('*, profiles(full_name), cohorts(name)')
      .order('created_at', { ascending: false })

    if (chatCohortFilter !== 'all') {
      query = query.eq('cohort_id', chatCohortFilter)
    }

    const { data } = await query
    if (data) setChatMessages(data)
    setChatLoading(false)
  }, [chatCohortFilter])

  useEffect(() => {
    if (view === 'chat') fetchChatMessages()
  }, [view, fetchChatMessages])

  const handleDeleteMessage = async (messageId: string) => {
    setDeletingMessageId(messageId)
    await supabase.from('cohort_messages').delete().eq('id', messageId)
    await fetchChatMessages()
    setDeletingMessageId(null)
  }

  const handleSendChatMessage = async () => {
    if (!newChatMessage.trim() || !adminId || chatCohortFilter === 'all') return
    setSendingMessage(true)
    await supabase.from('cohort_messages').insert({
      cohort_id: chatCohortFilter,
      user_id: adminId,
      content: newChatMessage,
    })
    setNewChatMessage('')
    await fetchChatMessages()
    setSendingMessage(false)
  }

  const getLikeState = (post: any) => {
    if (likeOverrides[post.id]) return likeOverrides[post.id]
    const liked = post.community_likes?.some((l: any) => l.user_id === adminId) || false
    return { liked, count: post.community_likes?.length || 0 }
  }

  const handleToggleLike = async (post: any) => {
    if (!adminId) return
    const current = getLikeState(post)
    // Optimistically flip the like state so it feels instant, same as the participant portal
    setLikeOverrides(prev => ({ ...prev, [post.id]: { liked: !current.liked, count: current.liked ? current.count - 1 : current.count + 1 } }))
    if (current.liked) {
      await supabase.from('community_likes').delete().eq('post_id', post.id).eq('user_id', adminId)
    } else {
      await supabase.from('community_likes').insert({ post_id: post.id, user_id: adminId })
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Community</span>
        <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem' }}>Community Feed</h1>
        <p style={{ color: 'var(--slate)', fontSize: '0.85rem', lineHeight: 1.6, marginTop: '0.5rem', fontStyle: 'italic' }}>
          <strong>Posts</strong> — the public feed where members share updates that others can like and comment on. <strong>Cohort Chats</strong> — the live group conversation for each cohort, where you can view, delete, and send messages as yourself.
        </p>
      </div>

      {/* View toggle: Posts vs Chat moderation */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--mist)' }}>
        {([
          { id: 'posts', label: 'Posts' },
          { id: 'chat', label: 'Cohort Chats' },
        ] as { id: AdminView; label: string }[]).map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            style={{
              padding: '0.65rem 1.1rem',
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${view === id ? 'var(--gold)' : 'transparent'}`,
              color: view === id ? 'var(--navy)' : 'var(--slate)',
              fontWeight: view === id ? 700 : 500,
              fontSize: '0.85rem',
              cursor: 'pointer',
              fontFamily: 'var(--font-montserrat), sans-serif',
              marginBottom: '-1px',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'posts' && (
        <>
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
                    {(() => {
                      const { liked, count } = getLikeState(post)
                      return (
                        <button onClick={() => handleToggleLike(post)} style={{ background: 'none', border: 'none', color: liked ? 'var(--gold)' : 'var(--slate)', fontSize: '0.7rem', cursor: 'pointer', fontFamily: 'var(--font-jetbrains), monospace', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          {liked ? '♥' : '♡'} {count}
                        </button>
                      )
                    })()}
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
        </>
      )}

      {view === 'chat' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Filter by Cohort</label>
            <select value={chatCohortFilter} onChange={e => setChatCohortFilter(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
              <option value="all">All Cohorts</option>
              {cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {chatCohortFilter !== 'all' && (
            <div style={{ ...cardStyle, marginBottom: '1.25rem' }}>
              <label style={labelStyle}>Message this cohort as Tramaine</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  value={newChatMessage}
                  onChange={e => setNewChatMessage(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSendChatMessage() } }}
                  placeholder="Send a message to this cohort's chat..."
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button onClick={handleSendChatMessage} disabled={sendingMessage || !newChatMessage.trim()} className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.65rem 1.25rem', flexShrink: 0 }}>
                  {sendingMessage ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          )}
          {chatCohortFilter === 'all' && (
            <p style={{ color: 'var(--slate)', fontSize: '0.8rem', marginBottom: '1.25rem', fontStyle: 'italic' }}>Select a specific cohort above to send a message into its chat.</p>
          )}

          {chatLoading ? (
            <p style={{ color: 'var(--slate)', fontSize: '0.85rem' }}>Loading messages...</p>
          ) : chatMessages.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem' }}>
              <p style={{ color: 'var(--slate)', fontSize: '0.88rem' }}>No messages yet.</p>
            </div>
          ) : (
            <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
              {chatMessages.map(msg => {
                const isAdminMsg = msg.user_id === adminId
                return (
                <div key={msg.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', padding: '0.9rem 1.25rem', borderBottom: '1px solid var(--mist)', background: isAdminMsg ? 'rgba(200,136,32,0.05)' : 'transparent' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, color: isAdminMsg ? 'var(--gold)' : 'var(--navy)', fontSize: '0.85rem' }}>{msg.profiles?.full_name || (isAdminMsg ? 'Tramaine' : 'Unknown')}</span>
                      {isAdminMsg && (
                        <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.55rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--navy)', background: 'rgba(200,136,32,0.15)', padding: '0.15rem 0.5rem', borderRadius: '2px' }}>Admin</span>
                      )}
                      <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{msg.cohorts?.name || 'Unknown cohort'}</span>
                      <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', color: 'var(--slate)' }}>{new Date(msg.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                    </div>
                    <p style={{ color: 'var(--ink)', fontSize: '0.86rem', lineHeight: 1.6 }}>{msg.content}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteMessage(msg.id)}
                    disabled={deletingMessageId === msg.id}
                    style={{ background: 'none', border: 'none', color: 'rgba(255,59,48,0.5)', fontSize: '0.75rem', cursor: 'pointer', flexShrink: 0 }}
                  >
                    {deletingMessageId === msg.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}