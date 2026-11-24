'use client'

// Failed or bounced emails that still need attention, with a safe Resend (fresh link) for
// account emails and "Mark as handled" for everything else.
import { useState } from 'react'
import type { AdminPanel } from '../../useAdminPanel'
import { formatDateTimeET } from '@/lib/business-time'
import { emailState, RESENDABLE, templateLabel } from '@/lib/email-status'
import { secondaryButtonStyle, linkButtonStyle, statusBadge } from '../shared'

export default function EmailProblems({ panel, userId, highlightId }: { panel: AdminPanel; userId?: string; highlightId?: number | null }) {
  const [busy, setBusy] = useState<number | null>(null)
  const rows = panel.emailProblems.filter(e => !userId || e.related_user_id === userId)
  if (rows.length === 0) return null

  const resend = async (id: number) => { setBusy(id); await panel.handleResendEmail(id); setBusy(null) }
  const resolve = async (id: number) => {
    const yes = await panel.confirm({ title: 'Mark this email as handled?', message: 'Use this after you have reached the person another way or fixed the address.', consequences: ['It stays in the email history.', 'It no longer appears in Needs your attention.'], confirmLabel: 'Mark as handled' })
    if (!yes) return
    setBusy(id); await panel.handleResolveEmail(id); setBusy(null)
  }

  return (
    <div role="region" aria-label="Emails that did not reach them" style={{ border: '1px solid #f0c9c5', background: '#fdf3f2', borderRadius: '6px', padding: '0.9rem 1rem', marginBottom: '1.25rem' }}>
      <strong style={{ color: '#8c1d18', fontSize: '0.92rem' }}>{rows.length === 1 ? 'An email did not reach them' : `${rows.length} emails did not reach them`}</strong>
      <ul style={{ listStyle: 'none', margin: '0.5rem 0 0', padding: 0 }}>
        {rows.map(e => {
          const st = emailState(e)
          return (
            <li key={e.id} id={`email-${e.id}`} style={{ display: 'flex', gap: '0.5rem 1rem', flexWrap: 'wrap', alignItems: 'center', padding: '0.5rem 0', borderTop: '1px solid #f0c9c5', outline: highlightId === e.id ? '2px solid #b3261e' : undefined }}>
              <span style={{ flex: '1 1 240px', fontSize: '0.88rem', color: 'var(--ink)', overflowWrap: 'anywhere' }}>
                {statusBadge(st.badge, st.label)} <strong>{templateLabel(e.template)}</strong> to {e.recipient} · {formatDateTimeET(e.created_at)}
                {e.error && <span style={{ display: 'block', color: '#8c1d18', fontSize: '0.8rem', marginTop: '0.2rem' }}>{e.error}</span>}
              </span>
              <span style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                {RESENDABLE.has(e.template) && e.related_user_id && (
                  <button type="button" onClick={() => void resend(e.id)} disabled={busy !== null} style={{ ...secondaryButtonStyle, minHeight: '40px' }}>
                    {busy === e.id ? 'Sending…' : 'Resend with a new link'}
                  </button>
                )}
                <button type="button" onClick={() => void resolve(e.id)} disabled={busy !== null} style={{ ...linkButtonStyle, minHeight: '40px' }}>Mark as handled</button>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
