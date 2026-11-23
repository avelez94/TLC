'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { friendlyError } from '@/lib/admin-errors'
import { formatDateTimeET } from '@/lib/business-time'
import type { AdminPanel } from '../useAdminPanel'
import { InlineError } from './feedback'
import { cardStyle, dangerLinkStyle, helpStyle, inputStyle, labelStyle, pageTitleStyle, sectionTitleStyle } from './shared'

type View = 'posts' | 'chat'
interface Person { full_name: string | null; role?: string | null }
interface Comment { id: string; body: string; created_at: string; user_id: string; profiles?: Person | null }
interface Post {
  id: string; body: string; created_at: string; user_id: string; cohort_id: string
  profiles?: Person | null; cohorts?: { name: string } | null
  community_likes?: { user_id: string }[]; community_comments?: Comment[]
}
interface ChatMessage { id: string; content: string; created_at: string; user_id: string; cohort_id: string; profiles?: { full_name: string | null } | null; cohorts?: { name: string } | null }

const POST_MAX = 2000
const CHAT_MAX = 1000

const adminBadge = (
  <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--navy)', background: 'rgba(200,136,32,0.15)', padding: '0.15rem 0.5rem', borderRadius: '2px' }}>Admin</span>
)
const metaStyle = { fontSize: '0.82rem', color: 'var(--slate)' }

export default function CommunityTab(panel: AdminPanel) {
  const { me, cohorts } = panel
  const posts = panel.communityPosts as Post[]
  const [view, setView] = useState<View>('posts')

  // Cohorts that can receive new posts and messages.
  const liveCohorts = cohorts.filter(c => c.status !== 'archived' && c.status !== 'cancelled')
  const authorName = (userId: string, p?: Person | null) =>
    userId === me.id ? me.name : p?.full_name || panel.users.find(u => u.id === userId)?.full_name || 'A former member'
  const isAdminAuthor = (userId: string, p?: Person | null) => userId === me.id || p?.role === 'admin'

  // ---------------------------------------------------------------- posts
  const [newPost, setNewPost] = useState({ cohort_id: '', body: '' })
  const [posting, setPosting] = useState(false)
  const [postError, setPostError] = useState<string | null>(null)
  const [postFilter, setPostFilter] = useState('all')
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({})
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null) // id of the post/comment/message being changed
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({})
  const [likeOverrides, setLikeOverrides] = useState<Record<string, { liked: boolean; count: number }>>({})

  const setItemError = (id: string, msg: string | null) => setItemErrors(e => {
    const n = { ...e }
    if (msg) n[id] = msg; else delete n[id]
    return n
  })

  const createPost = async () => {
    setPostError(null)
    if (!newPost.cohort_id) { setPostError('Choose a cohort.'); return }
    if (!newPost.body.trim()) { setPostError('Write a message first.'); return }
    setPosting(true)
    const err = await panel.handleCreateCommunityPost(newPost.cohort_id, newPost.body)
    setPosting(false)
    if (err) { setPostError(err); return }
    setNewPost(p => ({ ...p, body: '' }))
  }

  const deletePost = async (post: Post) => {
    const ok = await panel.confirm({
      title: 'Delete this post?',
      message: 'This cannot be undone.',
      consequences: [
        `The post by ${authorName(post.user_id, post.profiles)} is removed for everyone in ${post.cohorts?.name ?? panel.cohortName(post.cohort_id)}.`,
        'Its comments are deleted too.',
      ],
      confirmLabel: 'Delete post', danger: true,
    })
    if (!ok) return
    setBusy(post.id); setItemError(post.id, null)
    const err = await panel.handleDeleteCommunityPost(post.id)
    setBusy(null)
    if (err) setItemError(post.id, err)
  }

  const addComment = async (postId: string) => {
    const body = commentDrafts[postId] ?? ''
    setItemError(`c-${postId}`, null)
    if (!body.trim()) { setItemError(`c-${postId}`, 'Write a comment first.'); return }
    setBusy(`c-${postId}`)
    const err = await panel.handleAddComment(postId, body)
    setBusy(null)
    if (err) { setItemError(`c-${postId}`, err); return }
    setCommentDrafts(d => ({ ...d, [postId]: '' }))
  }

  const deleteComment = async (c: Comment) => {
    const ok = await panel.confirm({
      title: 'Delete this comment?',
      message: 'This cannot be undone.',
      consequences: [`The comment by ${authorName(c.user_id, c.profiles)} is removed for everyone in the cohort.`],
      confirmLabel: 'Delete comment', danger: true,
    })
    if (!ok) return
    setBusy(c.id); setItemError(c.id, null)
    const err = await panel.handleDeleteComment(c.id)
    setBusy(null)
    if (err) setItemError(c.id, err)
  }

  const likeState = (post: Post) => likeOverrides[post.id] ?? {
    liked: !!post.community_likes?.some(l => l.user_id === me.id),
    count: post.community_likes?.length ?? 0,
  }

  const toggleLike = async (post: Post) => {
    const current = likeState(post)
    setItemError(post.id, null)
    setLikeOverrides(prev => ({ ...prev, [post.id]: { liked: !current.liked, count: current.count + (current.liked ? -1 : 1) } }))
    const { error } = current.liked
      ? await supabase.from('community_likes').delete().eq('post_id', post.id).eq('user_id', me.id)
      : await supabase.from('community_likes').insert({ post_id: post.id, user_id: me.id })
    if (error) {
      const msg = friendlyError(error)
      setLikeOverrides(prev => ({ ...prev, [post.id]: current }))
      setItemError(post.id, `The like was not saved: ${msg}`)
      await panel.logFailure(current.liked ? 'community_like.delete' : 'community_like.create', 'community_post', post.id, null, msg)
    }
  }

  // ---------------------------------------------------------------- chats
  const [chatCohort, setChatCohort] = useState('all')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [chatLoadError, setChatLoadError] = useState<string | null>(null)
  const [chatDraft, setChatDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  const fetchMessages = useCallback(async () => {
    setChatLoading(true)
    let query = supabase.from('cohort_messages').select('*, profiles(full_name), cohorts(name)').order('created_at', { ascending: false })
    if (chatCohort !== 'all') query = query.eq('cohort_id', chatCohort)
    const { data, error } = await query
    if (error) setChatLoadError(`Messages could not be loaded: ${friendlyError(error)}`)
    else { setChatLoadError(null); setMessages((data ?? []) as ChatMessage[]) }
    setChatLoading(false)
  }, [chatCohort])

  useEffect(() => {
    if (view === 'chat') void Promise.resolve().then(fetchMessages)
  }, [view, fetchMessages])

  const sendMessage = async () => {
    setSendError(null)
    if (chatCohort === 'all') { setSendError('Choose a cohort first.'); return }
    const content = chatDraft.trim()
    if (!content) { setSendError('Write a message first.'); return }
    setSending(true)
    const { error } = await supabase.from('cohort_messages').insert({ cohort_id: chatCohort, user_id: me.id, content })
    if (error) {
      const msg = friendlyError(error)
      setSendError(`Not sent: ${msg}`)
      panel.fail(`Your message was not sent: ${msg}`)
      await panel.logFailure('chat_message.create', 'chat_message', null, panel.cohortName(chatCohort), msg)
    } else {
      setChatDraft('')
      await fetchMessages()
    }
    setSending(false)
  }

  const deleteMessage = async (m: ChatMessage) => {
    const ok = await panel.confirm({
      title: 'Delete this chat message?',
      message: 'This cannot be undone.',
      consequences: [`The message by ${authorName(m.user_id, m.profiles)} is removed from the ${m.cohorts?.name ?? panel.cohortName(m.cohort_id)} chat for everyone.`],
      confirmLabel: 'Delete message', danger: true,
    })
    if (!ok) return
    setBusy(m.id); setItemError(m.id, null)
    const { error } = await supabase.from('cohort_messages').delete().eq('id', m.id)
    if (error) {
      const msg = friendlyError(error)
      setItemError(m.id, msg)
      panel.fail(`The message was not deleted: ${msg}`)
      await panel.logFailure('chat_message.delete', 'chat_message', m.id, m.cohorts?.name ?? null, msg)
    } else {
      panel.ok('Message deleted.')
      await fetchMessages()
    }
    setBusy(null)
  }

  // ---------------------------------------------------------------- render
  const tabButton = (id: View, label: string) => (
    <button key={id} type="button" onClick={() => setView(id)} aria-pressed={view === id} style={{
      padding: '0.75rem 1.1rem', minHeight: '44px', background: 'none', border: 'none', borderBottom: `3px solid ${view === id ? 'var(--gold)' : 'transparent'}`,
      color: view === id ? 'var(--navy)' : 'var(--slate)', fontWeight: view === id ? 700 : 500, fontSize: '0.92rem', cursor: 'pointer',
      fontFamily: 'var(--font-montserrat), sans-serif', marginBottom: '-1px',
    }}>{label}</button>
  )

  const cohortFilter = (idFor: string, value: string, onChange: (v: string) => void) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0 0 1.25rem', flexWrap: 'wrap' }}>
      <label htmlFor={idFor} style={{ ...labelStyle, marginBottom: 0 }}>Show cohort</label>
      <select id={idFor} value={value} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, width: 'auto', maxWidth: '100%' }}>
        <option value="all">All cohorts</option>
        {cohorts.map(c => <option key={c.id} value={c.id}>{c.name}{c.status === 'archived' ? ' (archived)' : c.status === 'cancelled' ? ' (cancelled)' : ''}</option>)}
      </select>
    </div>
  )

  const filteredPosts = posts.filter(p => postFilter === 'all' || p.cohort_id === postFilter)

  return (
    <div>
      <span style={labelStyle}>Participant experience</span>
      <h1 style={pageTitleStyle}>Community</h1>
      <p style={{ ...helpStyle, maxWidth: '760px' }}>
        Each cohort has its own community. <strong>Posts</strong> are updates that members can like and comment on; <strong>cohort chats</strong> are each cohort&apos;s group conversation.
        Both are visible only to members of that cohort (and administrators). They are not public.
      </p>

      <div role="group" aria-label="Community view" style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--mist)', flexWrap: 'wrap' }}>
        {tabButton('posts', 'Posts')}
        {tabButton('chat', 'Cohort chats')}
      </div>

      {view === 'posts' && (
        <>
          <section style={{ ...cardStyle, borderTop: '3px solid var(--gold)' }} aria-labelledby="post-form-title">
            <h2 id="post-form-title" style={sectionTitleStyle}>Post as {me.name}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label htmlFor="post-cohort" style={labelStyle}>Cohort</label>
                <select id="post-cohort" required value={newPost.cohort_id} onChange={e => { setNewPost(p => ({ ...p, cohort_id: e.target.value })); setPostError(null) }} style={inputStyle}>
                  <option value="" disabled>Choose a cohort…</option>
                  {liveCohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <p style={{ ...helpStyle, fontSize: '0.82rem', margin: '0.3rem 0 0' }}>Only members of this cohort will see the post.</p>
              </div>
              <div>
                <label htmlFor="post-body" style={labelStyle}>
                  Message <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--slate)' }}>({newPost.body.length} of {POST_MAX} characters)</span>
                </label>
                <textarea id="post-body" rows={3} maxLength={POST_MAX} value={newPost.body} onChange={e => { setNewPost(p => ({ ...p, body: e.target.value })); setPostError(null) }} placeholder="Share something with this cohort…" style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
              <div>
                <button type="button" onClick={createPost} disabled={posting} className="btn btn-primary" style={{ fontSize: '0.9rem', minHeight: '44px', opacity: posting ? 0.6 : 1 }}>
                  {posting ? 'Posting…' : 'Post'}
                </button>
                <InlineError message={postError} />
              </div>
            </div>
          </section>

          {cohortFilter('post-filter', postFilter, setPostFilter)}

          {filteredPosts.length === 0 && (
            <div style={{ ...cardStyle, textAlign: 'center', padding: '2.5rem 1rem' }}>
              <p style={{ color: 'var(--slate)', fontSize: '0.92rem', margin: 0 }}>No posts yet.</p>
            </div>
          )}

          {filteredPosts.map(post => {
            const fromAdmin = isAdminAuthor(post.user_id, post.profiles)
            const comments = (post.community_comments ?? []).slice().sort((a, b) => a.created_at.localeCompare(b.created_at))
            const commentsOpen = !!openComments[post.id]
            const { liked, count } = likeState(post)
            return (
              <article key={post.id} style={{ ...cardStyle, borderLeft: fromAdmin ? '4px solid var(--gold)' : cardStyle.border }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, color: fromAdmin ? '#8a5a10' : 'var(--navy)', fontSize: '0.95rem' }}>{authorName(post.user_id, post.profiles)}</span>
                      {fromAdmin && adminBadge}
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem 1rem', flexWrap: 'wrap', ...metaStyle }}>
                      <span>{post.cohorts?.name ?? panel.cohortName(post.cohort_id)}</span>
                      <span>{formatDateTimeET(post.created_at)}</span>
                    </div>
                  </div>
                  <button type="button" onClick={() => deletePost(post)} disabled={busy === post.id} style={{ ...dangerLinkStyle, fontSize: '0.88rem', minHeight: '32px' }}>
                    {busy === post.id ? 'Deleting…' : 'Delete post'}
                  </button>
                </div>
                <p style={{ color: 'var(--ink)', fontSize: '0.92rem', lineHeight: 1.7, margin: '0 0 0.5rem', whiteSpace: 'pre-wrap' }}>{post.body}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => toggleLike(post)} aria-pressed={liked} aria-label={`${liked ? 'Unlike' : 'Like'} this post (${count} like${count === 1 ? '' : 's'})`}
                    style={{ background: 'none', border: 'none', color: liked ? '#8a5a10' : 'var(--slate)', fontSize: '0.9rem', cursor: 'pointer', minHeight: '36px', padding: 0, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span aria-hidden="true">{liked ? '♥' : '♡'}</span> {count}
                  </button>
                  <button type="button" onClick={() => setOpenComments(o => ({ ...o, [post.id]: !o[post.id] }))} aria-expanded={commentsOpen} aria-controls={`comments-${post.id}`}
                    style={{ background: 'none', border: 'none', color: 'var(--slate)', fontSize: '0.9rem', cursor: 'pointer', minHeight: '36px', padding: 0 }}>
                    {comments.length} comment{comments.length === 1 ? '' : 's'} <span aria-hidden="true">{commentsOpen ? '▲' : '▼'}</span>
                  </button>
                </div>
                <InlineError message={itemErrors[post.id]} />

                {commentsOpen && (
                  <div id={`comments-${post.id}`} style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--mist)' }}>
                    {comments.length === 0 && <p style={{ ...metaStyle, margin: '0 0 0.5rem' }}>No comments yet.</p>}
                    {comments.map(c => (
                      <div key={c.id} style={{ marginBottom: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.88rem' }}>{authorName(c.user_id, c.profiles)}</span>
                              {isAdminAuthor(c.user_id, c.profiles) && adminBadge}
                              <span style={metaStyle}>{formatDateTimeET(c.created_at)}</span>
                            </div>
                            <p style={{ color: 'var(--ink)', fontSize: '0.9rem', lineHeight: 1.6, margin: '0.15rem 0 0', whiteSpace: 'pre-wrap' }}>{c.body}</p>
                          </div>
                          <button type="button" onClick={() => deleteComment(c)} disabled={busy === c.id} style={{ ...dangerLinkStyle, fontSize: '0.85rem', flexShrink: 0, minHeight: '32px' }}>
                            {busy === c.id ? 'Deleting…' : 'Delete'}
                          </button>
                        </div>
                        <InlineError message={itemErrors[c.id]} />
                      </div>
                    ))}
                    <label htmlFor={`comment-${post.id}`} style={{ ...labelStyle, marginTop: '0.5rem' }}>Comment as {me.name}</label>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <textarea id={`comment-${post.id}`} rows={2} maxLength={POST_MAX} value={commentDrafts[post.id] ?? ''}
                        onChange={e => { const v = e.target.value; setCommentDrafts(d => ({ ...d, [post.id]: v })); setItemError(`c-${post.id}`, null) }}
                        placeholder="Add a comment…" style={{ ...inputStyle, flex: '1 1 220px', resize: 'vertical' }} />
                      <button type="button" onClick={() => addComment(post.id)} disabled={busy === `c-${post.id}`} className="btn btn-primary" style={{ fontSize: '0.85rem', minHeight: '44px', alignSelf: 'flex-start' }}>
                        {busy === `c-${post.id}` ? 'Sending…' : 'Send comment'}
                      </button>
                    </div>
                    <InlineError message={itemErrors[`c-${post.id}`]} />
                  </div>
                )}
              </article>
            )
          })}
        </>
      )}

      {view === 'chat' && (
        <>
          {cohortFilter('chat-filter', chatCohort, v => { setChatCohort(v); setSendError(null) })}

          {chatCohort !== 'all' ? (
            <section style={cardStyle} aria-labelledby="chat-send-title">
              <label id="chat-send-title" htmlFor="chat-message" style={labelStyle}>Message {panel.cohortName(chatCohort)} as {me.name}</label>
              {!liveCohorts.some(c => c.id === chatCohort) && <p style={{ ...helpStyle, fontSize: '0.85rem', margin: '0 0 0.5rem' }}>This cohort is archived or cancelled; its members may no longer be reading the chat.</p>}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <input id="chat-message" value={chatDraft} maxLength={CHAT_MAX} onChange={e => { setChatDraft(e.target.value); setSendError(null) }}
                  onKeyDown={e => { if (e.key === 'Enter' && !sending) { e.preventDefault(); void sendMessage() } }}
                  placeholder="Send a message to this cohort's chat…" style={{ ...inputStyle, flex: '1 1 220px' }} />
                <button type="button" onClick={sendMessage} disabled={sending} className="btn btn-primary" style={{ fontSize: '0.85rem', minHeight: '44px', flexShrink: 0, opacity: sending ? 0.6 : 1 }}>
                  {sending ? 'Sending…' : 'Send'}
                </button>
              </div>
              <InlineError message={sendError} />
            </section>
          ) : (
            <p style={{ ...helpStyle, fontSize: '0.88rem' }}>Choose one cohort above to send a message into its chat.</p>
          )}

          <InlineError message={chatLoadError} />
          {chatLoading && messages.length === 0 ? (
            <p role="status" style={{ color: 'var(--slate)', fontSize: '0.9rem' }}>Loading messages…</p>
          ) : messages.length === 0 && !chatLoadError ? (
            <div style={{ ...cardStyle, textAlign: 'center', padding: '2.5rem 1rem' }}>
              <p style={{ color: 'var(--slate)', fontSize: '0.92rem', margin: 0 }}>No messages yet.</p>
            </div>
          ) : messages.length > 0 && (
            <div style={{ ...cardStyle, padding: 0, overflow: 'hidden', opacity: chatLoading ? 0.6 : 1 }} aria-busy={chatLoading}>
              {messages.map(m => {
                const mine = m.user_id === me.id
                return (
                  <div key={m.id} style={{ padding: '0.9rem 1.25rem', borderBottom: '1px solid var(--mist)', background: mine ? 'rgba(200,136,32,0.05)' : 'transparent' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: '0.25rem 0.75rem', alignItems: 'center', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, color: mine ? '#8a5a10' : 'var(--navy)', fontSize: '0.9rem' }}>{authorName(m.user_id, m.profiles)}</span>
                          {mine && adminBadge}
                          <span style={{ ...metaStyle, color: '#8a5a10' }}>{m.cohorts?.name ?? panel.cohortName(m.cohort_id)}</span>
                          <span style={metaStyle}>{formatDateTimeET(m.created_at)}</span>
                        </div>
                        <p style={{ color: 'var(--ink)', fontSize: '0.92rem', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.content}</p>
                      </div>
                      <button type="button" onClick={() => deleteMessage(m)} disabled={busy === m.id} style={{ ...dangerLinkStyle, fontSize: '0.85rem', flexShrink: 0, minHeight: '32px' }}>
                        {busy === m.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                    <InlineError message={itemErrors[m.id]} />
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
