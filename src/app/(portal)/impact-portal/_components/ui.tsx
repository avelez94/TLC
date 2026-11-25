import type { CSSProperties, ReactNode } from 'react'
import { formatDateET } from '@/lib/business-time'
import { CONTACT_EMAIL, type RepStateKind } from './logic'
import type { Membership } from './types'

export const cardStyle: CSSProperties = { background: 'white', borderRadius: '6px', border: '1px solid rgba(0,23,55,0.08)', padding: '1.5rem', marginBottom: '1.25rem' }
export const inputStyle: CSSProperties = { width: '100%', padding: '0.75rem 1rem', border: '1.5px solid rgba(0,23,55,0.15)', borderRadius: '4px', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.9rem', color: 'var(--ink)', background: 'white', outline: 'none' }
export const labelStyle: CSSProperties = { fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#8a5a10', display: 'block', marginBottom: '0.5rem' }
export const eyebrowStyle: CSSProperties = { fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#8a5a10' }
export const h1Style: CSSProperties = { fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '1.5rem' }
export const h2Style: CSSProperties = { fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1rem' }
export const h3Style: CSSProperties = { fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.15rem', color: 'var(--navy)', letterSpacing: '0.04em' }
export const mutedText: CSSProperties = { color: 'var(--slate)', fontSize: '0.85rem', lineHeight: 1.7 }
export const monoMeta: CSSProperties = { fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8a5a10' }
export const linkButtonStyle: CSSProperties = { background: 'none', border: 'none', color: '#8a5a10', fontSize: '0.85rem', cursor: 'pointer', padding: '0.5rem 0', minHeight: '44px', fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, textAlign: 'left' }
export const smallButtonStyle: CSSProperties = { background: 'none', border: '1.5px solid rgba(0,23,55,0.15)', borderRadius: '4px', padding: '0.45rem 1rem', minHeight: '44px', color: 'var(--slate)', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'var(--font-montserrat), sans-serif' }
export const outlineLinkStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: '44px', border: '1px solid var(--gold)', color: '#8a5a10', borderRadius: '2px', padding: '0.3rem 0.9rem', fontSize: '0.75rem', fontWeight: 600, textDecoration: 'none', flexShrink: 0 }

/** Visually hidden but read by screen readers (labels for fields that show a placeholder). */
export const srOnly: CSSProperties = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }

export function PageHeader({ eyebrow, title, intro }: { eyebrow: string; title: string; intro?: ReactNode }) {
  return (
    <header>
      <span style={eyebrowStyle}>{eyebrow}</span>
      <h1 style={{ ...h1Style, marginBottom: intro ? '0.5rem' : '1.5rem' }}>{title}</h1>
      {intro && <p style={{ color: 'var(--slate)', fontSize: '0.9rem', lineHeight: 1.7, marginBottom: '1.5rem' }}>{intro}</p>}
    </header>
  )
}

export function EmptyState({ children, compact }: { children: ReactNode; compact?: boolean }) {
  return (
    <div style={{ ...cardStyle, textAlign: 'center', padding: compact ? '1.5rem' : '2.5rem 1.5rem' }}>
      <div style={{ color: 'var(--slate)', fontSize: '0.88rem', lineHeight: 1.7 }}>{children}</div>
    </div>
  )
}

export function ContactLink() {
  return <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: '#8a5a10', fontWeight: 600 }}>{CONTACT_EMAIL}</a>
}

const badgeTones: Record<RepStateKind | 'info', { bg: string; fg: string; mark: string }> = {
  submitted: { bg: 'rgba(200,136,32,0.12)', fg: '#8A5A0C', mark: '✓' },
  due: { bg: 'var(--mist)', fg: 'var(--slate)', mark: '○' },
  open: { bg: 'var(--mist)', fg: 'var(--slate)', mark: '○' },
  overdue: { bg: 'rgba(176,32,32,0.1)', fg: '#8E1F1F', mark: '!' },
  'not-submitted': { bg: 'var(--mist)', fg: 'var(--slate)', mark: '–' },
  info: { bg: 'var(--mist)', fg: 'var(--navy)', mark: '' },
}

/** Status shown as text plus a mark, never by colour alone. */
export function StatusBadge({ kind, children }: { kind: RepStateKind | 'info'; children: ReactNode }) {
  const t = badgeTones[kind]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.25rem 0.65rem', borderRadius: '2px', fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase', background: t.bg, color: t.fg, whiteSpace: 'nowrap' }}>
      {t.mark && <span aria-hidden="true">{t.mark}</span>}{children}
    </span>
  )
}

/** The read-only / reopened note for a program that has ended. */
export function FinishedNote({ membership }: { membership: Membership }) {
  if (membership.isCurrent) {
    if (membership.canWrite) return null
    return (
      <div role="note" style={{ ...cardStyle, borderLeft: '4px solid var(--navy)', padding: '1rem 1.25rem' }}>
        <p style={{ color: 'var(--ink)', fontSize: '0.88rem', lineHeight: 1.6 }}>Posting and rep submissions open when the program starts.</p>
      </div>
    )
  }
  if (membership.canWrite && membership.reopenedUntil) {
    return (
      <div role="note" style={{ ...cardStyle, borderLeft: '4px solid var(--gold)', padding: '1rem 1.25rem' }}>
        <p style={{ color: 'var(--ink)', fontSize: '0.88rem', lineHeight: 1.6 }}>
          <strong>Tramaine reopened activity until {formatDateET(membership.reopenedUntil, 'long')}.</strong> You can submit weekly reps and post in this program&rsquo;s community until then.
        </p>
      </div>
    )
  }
  return (
    <div role="note" style={{ ...cardStyle, borderLeft: '4px solid var(--navy)', padding: '1rem 1.25rem' }}>
      <p style={{ color: 'var(--ink)', fontSize: '0.88rem', lineHeight: 1.6 }}>
        <strong>This program has ended. Your work is saved here and is read-only.</strong>
      </p>
    </div>
  )
}

export interface NoticeState { kind: 'success' | 'error'; text: string }

export function Notice({ notice, onDismiss }: { notice: NoticeState | null; onDismiss: () => void }) {
  return (
    <div role={notice?.kind === 'error' ? 'alert' : 'status'} aria-live={notice?.kind === 'error' ? 'assertive' : 'polite'}>
      {notice && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', borderRadius: '4px', padding: '0.85rem 1rem', marginBottom: '1.25rem', fontSize: '0.85rem', lineHeight: 1.6,
          background: notice.kind === 'error' ? 'rgba(176,32,32,0.07)' : 'rgba(200,136,32,0.1)',
          border: `1px solid ${notice.kind === 'error' ? 'rgba(176,32,32,0.35)' : 'rgba(200,136,32,0.3)'}`,
          color: notice.kind === 'error' ? '#8E1F1F' : '#8A5A0C',
        }}>
          <p><strong>{notice.kind === 'error' ? 'Not saved: ' : 'Done: '}</strong>{notice.text}</p>
          <button type="button" onClick={onDismiss} aria-label="Dismiss message" style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1rem', minWidth: '44px', minHeight: '44px', margin: '-0.75rem -0.5rem -0.75rem 0' }}>×</button>
        </div>
      )}
    </div>
  )
}
