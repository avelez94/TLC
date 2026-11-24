'use client'

import { useEffect, useRef, useState } from 'react'
import { initialsOf, timeET } from './logic'
import { CommunityPosts } from './CommunityPosts'
import { cardStyle, FinishedNote, h2Style, inputStyle, mutedText, PageHeader, srOnly } from './ui'
import type { CommunityTab, MemberRow, Membership, MessageRow, PostActions, PostRow } from './types'

export function CommunityView({ membership, tab, onTab, posts, members, messages, profileId, postActions, onSendMessage, busy }: {
  membership: Membership
  tab: CommunityTab
  onTab: (t: CommunityTab) => void
  posts: PostRow[]
  members: MemberRow[]
  messages: MessageRow[]
  profileId: string | null
  postActions: PostActions
  onSendMessage: (content: string) => Promise<boolean>
  busy: boolean
}) {
  const [draft, setDraft] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Keep the newest chat message in view when messages arrive or the tab opens.
  useEffect(() => {
    if (tab === 'chat') chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages, tab])

  const send = async () => {
    if (!draft.trim()) return
    if (await onSendMessage(draft.trim())) setDraft('')
  }

  return (
    <div>
      <PageHeader eyebrow="Community" title="Cohort Community" intro="Share wins, ask questions, and encourage one another. This is your cohort space." />
      <FinishedNote membership={membership} />
      <p style={{ color: 'var(--slate)', fontSize: '0.8rem', lineHeight: 1.6, marginBottom: '1.5rem', fontStyle: 'italic' }}>
        <strong>Posts</strong> — share something the whole cohort can like and comment on, whenever they see it. <strong>Members</strong> — see who is in your cohort. <strong>Chat</strong> — a live group conversation with everyone in your cohort.
      </p>

      <div role="group" aria-label="Community sections" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--mist)', flexWrap: 'wrap' }}>
        {([['posts', 'Posts'], ['members', 'Members'], ['chat', 'Chat']] as [CommunityTab, string][]).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={tab === id}
            onClick={() => onTab(id)}
            style={{ padding: '0.65rem 1.1rem', minHeight: '44px', background: 'none', border: 'none', borderBottom: `2px solid ${tab === id ? 'var(--gold)' : 'transparent'}`, color: tab === id ? 'var(--navy)' : 'var(--slate)', fontWeight: tab === id ? 700 : 500, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'var(--font-montserrat), sans-serif', marginBottom: '-1px' }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'posts' && (
        <CommunityPosts posts={posts} profileId={profileId} canWrite={membership.canWrite} actions={postActions} busy={busy} emptyText={membership.canWrite ? 'No posts yet. Be the first to share something.' : 'No posts in this cohort.'} />
      )}

      {tab === 'members' && (
        <section aria-labelledby="members-heading" style={cardStyle}>
          <h2 id="members-heading" style={h2Style}>Your Cohort ({members.length})</h2>
          {members.length === 0 ? (
            <p style={mutedText}>No other members found yet. Cohort-mates appear here once they are enrolled.</p>
          ) : (
            <ul style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.85rem', listStyle: 'none', padding: 0, margin: 0 }}>
              {members.map(m => {
                const name = m.profiles?.full_name || 'Participant'
                return (
                  <li key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.6rem 0.75rem', background: 'var(--paper)', borderRadius: '4px', minWidth: 0 }}>
                    <div aria-hidden="true" style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--navy)', fontWeight: 700, fontSize: '0.75rem', flexShrink: 0 }}>{initialsOf(name)}</div>
                    <span style={{ color: 'var(--ink)', fontSize: '0.85rem', fontWeight: 500, minWidth: 0 }}>{name}{m.user_id === profileId ? ' (you)' : ''}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      {tab === 'chat' && (
        <section aria-label="Cohort chat" style={{ ...cardStyle, display: 'flex', flexDirection: 'column', height: 'min(520px, 70vh)', padding: 0 }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }} aria-live="polite">
            {messages.length === 0 ? (
              <p style={{ ...mutedText, textAlign: 'center', padding: '2rem 0' }}>{membership.canWrite ? 'No messages yet. Say hello to your cohort.' : 'No messages in this chat.'}</p>
            ) : messages.map(msg => {
              const isYou = msg.user_id === profileId
              return (
                <div key={msg.id} style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', alignItems: isYou ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '85%', minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', marginBottom: '0.25rem', justifyContent: isYou ? 'flex-end' : 'flex-start', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.75rem' }}>{isYou ? 'You' : msg.profiles?.full_name || 'Participant'}</span>
                      <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.55rem', color: 'var(--slate)' }}>{timeET(msg.created_at)}</span>
                    </div>
                    <div style={{ background: isYou ? 'var(--gold)' : 'var(--paper)', color: isYou ? 'var(--navy)' : 'var(--ink)', borderRadius: '10px', padding: '0.6rem 0.9rem', fontSize: '0.85rem', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                  </div>
                </div>
              )
            })}
            <div ref={chatEndRef} />
          </div>
          {membership.canWrite ? (
            <div style={{ display: 'flex', gap: '0.5rem', padding: '1rem 1.25rem', borderTop: '1px solid var(--mist)' }}>
              <label htmlFor="chat-input" style={srOnly}>Message your cohort</label>
              <input id="chat-input" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} placeholder="Message your cohort..." style={{ ...inputStyle, flex: 1, minWidth: 0 }} />
              <button type="button" onClick={send} disabled={busy || !draft.trim()} className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.6rem 1.25rem', flexShrink: 0 }}>Send</button>
            </div>
          ) : (
            <p style={{ ...mutedText, padding: '1rem 1.25rem', borderTop: '1px solid var(--mist)' }}>The chat is read-only for this program.</p>
          )}
        </section>
      )}
    </div>
  )
}
