'use client'

import { useEffect, useState } from 'react'
import { formatDateET } from '@/lib/business-time'
import { repState } from './logic'
import { cardStyle, h3Style, inputStyle, labelStyle, mutedText, StatusBadge } from './ui'
import type { Membership, Rep, Submission } from './types'

/**
 * A cohort's weekly reps. Each rep opens in place; the reflection box appears only when the
 * database would accept a submission (membership.canWrite). Reflections shown are the
 * participant's own (weekly_rep_submissions is own-rows-only).
 */
export function RepsSection({ membership, reps, submissions, today, onSubmit, busy, initialOpenId, emptyText, headingLevel = 'h2' }: {
  membership: Membership
  reps: Rep[]
  submissions: Map<string, Submission>
  today: string
  onSubmit: (repId: string, reflection: string) => Promise<boolean>
  busy: boolean
  initialOpenId?: string | null
  emptyText: string
  headingLevel?: 'h2' | 'h3'
}) {
  const [openId, setOpenId] = useState<string | null>(initialOpenId ?? null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const Title = headingLevel

  // Opened from the dashboard or progress page: bring that rep into view once.
  useEffect(() => {
    if (initialOpenId) document.getElementById(`rep-item-${initialOpenId}`)?.scrollIntoView({ block: 'start' })
  }, [initialOpenId])

  if (reps.length === 0) {
    return <div style={{ ...cardStyle, textAlign: 'center', padding: '2rem 1.5rem' }}><p style={mutedText}>{emptyText}</p></div>
  }

  const submit = async (repId: string) => {
    const text = (drafts[repId] || '').trim()
    if (!text) return
    if (await onSubmit(repId, text)) setDrafts(prev => ({ ...prev, [repId]: '' }))
  }

  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {reps.map(rep => {
        const sub = submissions.get(rep.id)
        const state = repState(rep, !!sub, membership.canWrite, today)
        const open = openId === rep.id
        const panelId = `rep-panel-${rep.id}`
        const fieldId = `rep-reflection-${rep.id}`
        return (
          <li key={rep.id} id={`rep-item-${rep.id}`} style={{ ...cardStyle, padding: 0, scrollMarginTop: '80px', borderLeft: `4px solid ${sub ? 'var(--gold)' : 'var(--mist)'}` }}>
            <Title style={{ margin: 0 }}>
            <button
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => setOpenId(open ? null : rep.id)}
              style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem 1rem', flexWrap: 'wrap', padding: '1.25rem 1.5rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-montserrat), sans-serif', minHeight: '44px' }}
            >
              <span style={{ flex: '1 1 200px', minWidth: 0 }}>
                <span style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                  {rep.week_number != null && <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--gold)' }}>Week {rep.week_number}</span>}
                  {rep.due_date && state.kind !== 'due' && <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', color: 'var(--slate)' }}>Due {formatDateET(rep.due_date, 'long')}</span>}
                </span>
                <span style={{ ...h3Style, display: 'block' }}>{rep.title}</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <StatusBadge kind={state.kind}>{state.label}</StatusBadge>
                <span aria-hidden="true" style={{ color: 'var(--slate)', fontSize: '0.75rem' }}>{open ? '▲' : '▼'}</span>
              </span>
            </button>
            </Title>
            {open && (
              <div id={panelId} style={{ padding: '0 1.5rem 1.5rem' }}>
                {rep.instructions && <div style={{ marginBottom: '1rem' }}><span style={labelStyle}>The rep</span><p style={{ color: 'var(--ink)', fontSize: '0.92rem', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{rep.instructions}</p></div>}
                {rep.why_it_matters && <div style={{ background: 'var(--navy)', borderRadius: '4px', padding: '1rem 1.25rem', marginBottom: '1rem' }}><span style={labelStyle}>Why it matters</span><p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{rep.why_it_matters}</p></div>}
                {sub ? (
                  <div>
                    <span style={labelStyle}>Your reflection</span>
                    <p style={{ color: 'var(--ink)', fontSize: '0.9rem', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{sub.reflection || '(No reflection text)'}</p>
                    {sub.completed_at && <p style={{ color: 'var(--slate)', fontSize: '0.78rem', marginTop: '0.5rem', fontFamily: 'var(--font-jetbrains), monospace', letterSpacing: '0.05em' }}>Submitted {formatDateET(sub.completed_at, 'long')}</p>}
                  </div>
                ) : membership.canWrite ? (
                  <div>
                    <label htmlFor={fieldId} style={labelStyle}>Reflection — what happened when you did this rep?</label>
                    <textarea id={fieldId} value={drafts[rep.id] || ''} onChange={e => setDrafts(prev => ({ ...prev, [rep.id]: e.target.value }))} placeholder="Write your reflection here..." rows={5} style={{ ...inputStyle, resize: 'vertical' }} />
                    <button type="button" onClick={() => submit(rep.id)} disabled={busy || !(drafts[rep.id] || '').trim()} className="btn btn-primary" style={{ marginTop: '1rem', fontSize: '0.85rem' }}>{busy ? 'Submitting...' : 'Submit rep'}</button>
                  </div>
                ) : (
                  <p style={mutedText}>You did not submit a reflection for this rep. This program is read-only now.</p>
                )}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
