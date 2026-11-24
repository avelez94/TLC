'use client'

import { useState } from 'react'
import { formatDateET } from '@/lib/business-time'
import { initialsOf } from './logic'
import { cardStyle, inputStyle, mutedText, smallButtonStyle, srOnly } from './ui'
import type { PostActions, PostRow } from './types'

/** A cohort's community posts. Composers and edit controls appear only when canWrite. */
export function CommunityPosts({ posts, profileId, canWrite, actions, busy, emptyText }: {
  posts: PostRow[]
  profileId: string | null
  canWrite: boolean
  actions: PostActions
  busy: boolean
  emptyText: string
}) {
  const [newPost, setNewPost] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  const create = async () => {
    if (!newPost.trim()) return
    if (await actions.create(newPost.trim())) setNewPost('')
  }
  const saveEdit = async (id: string) => {
    if (!editBody.trim()) return
    if (await actions.edit(id, editBody.trim())) { setEditingId(null); setEditBody('') }
  }
  const remove = async (id: string) => {
    if (!window.confirm('Delete this post? This cannot be undone.')) return
    await actions.remove(id)
  }
  const comment = async (id: string) => {
    const body = (drafts[id] || '').trim()
    if (!body) return
    if (await actions.comment(id, body)) setDrafts(prev => ({ ...prev, [id]: '' }))
  }

  return (
    <>
      {canWrite && (
        <div style={cardStyle}>
          <label htmlFor="new-post" style={srOnly}>New post</label>
          <textarea id="new-post" value={newPost} onChange={e => setNewPost(e.target.value)} placeholder="Share a win, ask a question, or encourage someone..." rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          <button type="button" onClick={create} disabled={busy || !newPost.trim()} className="btn btn-primary" style={{ marginTop: '0.75rem', fontSize: '0.8rem', padding: '0.65rem 1.25rem' }}>Post</button>
        </div>
      )}
      {posts.length === 0 && <p style={{ ...mutedText, textAlign: 'center', padding: '2rem' }}>{emptyText}</p>}
      {posts.map(post => {
        const likes = post.community_likes ?? []
        const liked = likes.some(l => l.user_id === profileId)
        const isOwn = post.user_id === profileId
        const isEditing = editingId === post.id
        const comments = (post.community_comments ?? []).slice().sort((a, b) => a.created_at.localeCompare(b.created_at))
        const open = !!expanded[post.id]
        const author = post.profiles?.full_name || 'Participant'
        return (
          <article key={post.id} style={cardStyle} aria-label={`Post by ${author}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                <div aria-hidden="true" style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--navy)', fontWeight: 700, fontSize: '0.75rem', flexShrink: 0 }}>{initialsOf(author)}</div>
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.85rem' }}>{author}{isOwn ? ' (you)' : ''}</span>
                  <span style={{ display: 'block', fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', color: 'var(--slate)', letterSpacing: '0.08em' }}>{formatDateET(post.created_at, 'long')}</span>
                </div>
              </div>
              {canWrite && isOwn && !isEditing && (
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  <button type="button" onClick={() => { setEditingId(post.id); setEditBody(post.body) }} style={{ ...smallButtonStyle, border: 'none' }}>Edit</button>
                  <button type="button" onClick={() => remove(post.id)} style={{ ...smallButtonStyle, border: 'none', color: '#8E1F1F' }}>Delete</button>
                </div>
              )}
            </div>

            {isEditing ? (
              <div style={{ marginBottom: '0.75rem' }}>
                <label htmlFor={`edit-post-${post.id}`} style={srOnly}>Edit your post</label>
                <textarea id={`edit-post-${post.id}`} value={editBody} onChange={e => setEditBody(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => saveEdit(post.id)} disabled={busy || !editBody.trim()} className="btn btn-primary" style={{ fontSize: '0.78rem', padding: '0.45rem 1rem' }}>{busy ? 'Saving...' : 'Save'}</button>
                  <button type="button" onClick={() => { setEditingId(null); setEditBody('') }} style={smallButtonStyle}>Cancel</button>
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--ink)', fontSize: '0.88rem', lineHeight: 1.7, marginBottom: '0.75rem', whiteSpace: 'pre-wrap' }}>{post.body}</p>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              {canWrite ? (
                <button type="button" onClick={() => actions.like(post.id, liked)} aria-pressed={liked} aria-label={`${liked ? 'Unlike' : 'Like'} this post (${likes.length} like${likes.length === 1 ? '' : 's'})`} style={{ ...smallButtonStyle, border: 'none', padding: '0.45rem 0.25rem', color: liked ? 'var(--gold)' : 'var(--slate)' }}>
                  <span aria-hidden="true">{liked ? '♥' : '♡'} {likes.length}</span>
                </button>
              ) : (
                <span style={{ color: 'var(--slate)', fontSize: '0.78rem' }}>{likes.length} like{likes.length === 1 ? '' : 's'}</span>
              )}
              <button type="button" onClick={() => setExpanded(prev => ({ ...prev, [post.id]: !open }))} aria-expanded={open} aria-controls={`comments-${post.id}`} style={{ ...smallButtonStyle, border: 'none', padding: '0.45rem 0.25rem' }}>
                {comments.length} comment{comments.length === 1 ? '' : 's'} <span aria-hidden="true">{open ? '▲' : '▼'}</span>
              </button>
            </div>

            {open && (
              <div id={`comments-${post.id}`} style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--mist)' }}>
                {comments.length === 0 && <p style={{ color: 'var(--slate)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>No comments yet.</p>}
                {comments.map(c => (
                  <div key={c.id} style={{ marginBottom: '0.6rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.78rem' }}>{c.profiles?.full_name || (c.profiles?.role === 'admin' ? 'Tramaine' : 'Participant')}</span>
                      <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.55rem', color: 'var(--slate)' }}>{formatDateET(c.created_at, 'long')}</span>
                    </div>
                    <p style={{ color: 'var(--ink)', fontSize: '0.82rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{c.body}</p>
                  </div>
                ))}
                {canWrite && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <label htmlFor={`comment-${post.id}`} style={srOnly}>Add a comment</label>
                    <input id={`comment-${post.id}`} value={drafts[post.id] || ''} onChange={e => setDrafts(prev => ({ ...prev, [post.id]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); comment(post.id) } }} placeholder="Add a comment..." style={{ ...inputStyle, flex: 1, minWidth: 0 }} />
                    <button type="button" onClick={() => comment(post.id)} disabled={busy || !(drafts[post.id] || '').trim()} className="btn btn-primary" style={{ fontSize: '0.78rem', padding: '0.5rem 1rem', flexShrink: 0 }}>Send</button>
                  </div>
                )}
              </div>
            )}
          </article>
        )
      })}
    </>
  )
}
