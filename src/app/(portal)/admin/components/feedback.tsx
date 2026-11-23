'use client'

// Feedback for every admin action:
//  - notify(): messages in a fixed corner that is visible wherever you are on the page.
//    Successes fade after a few seconds; errors stay until dismissed.
//  - confirm(): a dialog that states the consequences before a sensitive action.
//  - useSaveStates() + <SaveStatus>: "Saving… / Saved ✓ / Not saved" next to auto-saved fields.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

export type NoticeKind = 'success' | 'error' | 'info'
interface Notice { id: number; kind: NoticeKind; text: string }

export interface ConfirmOptions {
  title: string
  message?: string
  consequences?: string[]
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  /** The person must type this word to confirm (for permanent deletions). */
  requireText?: string
}

interface FeedbackApi {
  notify: (kind: NoticeKind, text: string) => void
  confirm: (opts: ConfirmOptions) => Promise<boolean>
}

const FeedbackContext = createContext<FeedbackApi | null>(null)

export function useFeedback(): FeedbackApi {
  const ctx = useContext(FeedbackContext)
  if (!ctx) throw new Error('useFeedback must be used inside FeedbackProvider')
  return ctx
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([])
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null)
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setNotices(n => n.filter(x => x.id !== id)), [])
  const notify = useCallback((kind: NoticeKind, text: string) => {
    const id = nextId.current++
    setNotices(n => [...n.slice(-3), { id, kind, text }])
    if (kind !== 'error') setTimeout(() => dismiss(id), 7000)
  }, [dismiss])
  const confirm = useCallback((opts: ConfirmOptions) => new Promise<boolean>(resolve => setDialog({ ...opts, resolve })), [])

  return (
    <FeedbackContext.Provider value={{ notify, confirm }}>
      {children}
      <div aria-live="polite" style={{ position: 'fixed', right: '1rem', bottom: '1rem', zIndex: 400, display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 'min(420px, calc(100vw - 2rem))' }}>
        {notices.map(n => (
          <div key={n.id} role={n.kind === 'error' ? 'alert' : 'status'} style={{
            display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '0.85rem 1rem', borderRadius: '6px', fontSize: '0.9rem', lineHeight: 1.5,
            boxShadow: '0 6px 24px rgba(0,23,55,0.18)', background: n.kind === 'error' ? '#fdecea' : n.kind === 'success' ? '#e8f5ec' : 'white',
            color: n.kind === 'error' ? '#8c1d18' : n.kind === 'success' ? '#14532d' : 'var(--navy)',
            border: `1px solid ${n.kind === 'error' ? '#f3b7b1' : n.kind === 'success' ? '#a7d7b5' : 'var(--mist)'}`,
          }}>
            <span aria-hidden="true" style={{ fontWeight: 700 }}>{n.kind === 'error' ? '!' : n.kind === 'success' ? '✓' : 'i'}</span>
            <span style={{ flex: 1 }}>{n.text}</span>
            <button onClick={() => dismiss(n.id)} aria-label="Dismiss message" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '1.1rem', lineHeight: 1, padding: 0 }}>×</button>
          </div>
        ))}
      </div>
      {dialog && <ConfirmDialog {...dialog} onDone={ok => { dialog.resolve(ok); setDialog(null) }} />}
    </FeedbackContext.Provider>
  )
}

function ConfirmDialog({ title, message, consequences, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger, requireText, onDone }: ConfirmOptions & { onDone: (ok: boolean) => void }) {
  const [typed, setTyped] = useState('')
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onDone(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDone])
  const ready = !requireText || typed.trim().toUpperCase() === requireText.toUpperCase()
  return (
    <div onClick={() => onDone(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,23,55,0.55)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" onClick={e => e.stopPropagation()}
        style={{ background: 'white', borderRadius: '8px', maxWidth: '480px', width: '100%', padding: '1.5rem', borderTop: `4px solid ${danger ? '#b3261e' : 'var(--gold)'}`, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <h2 id="confirm-title" style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.5rem', letterSpacing: '0.04em', color: 'var(--navy)', margin: '0 0 0.75rem' }}>{title}</h2>
        {message && <p style={{ color: 'var(--ink)', fontSize: '0.95rem', lineHeight: 1.6, margin: '0 0 0.75rem' }}>{message}</p>}
        {consequences && consequences.length > 0 && (
          <ul style={{ margin: '0 0 1rem', paddingLeft: '1.2rem', color: 'var(--ink)', fontSize: '0.92rem', lineHeight: 1.6 }}>
            {consequences.map(c => <li key={c}>{c}</li>)}
          </ul>
        )}
        {requireText && (
          <label style={{ display: 'block', fontSize: '0.88rem', color: 'var(--slate)', marginBottom: '1rem' }}>
            Type <strong style={{ color: '#b3261e' }}>{requireText}</strong> to confirm
            <input value={typed} onChange={e => setTyped(e.target.value)} autoComplete="off" style={{ display: 'block', width: '100%', marginTop: '0.4rem', padding: '0.6rem 0.75rem', border: '1.5px solid var(--mist)', borderRadius: '3px', fontSize: '0.95rem' }} />
          </label>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button ref={cancelRef} onClick={() => onDone(false)} style={{ padding: '0.65rem 1.1rem', background: 'white', border: '1.5px solid var(--mist)', borderRadius: '3px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', color: 'var(--navy)' }}>{cancelLabel}</button>
          <button onClick={() => onDone(true)} disabled={!ready} style={{ padding: '0.65rem 1.1rem', background: danger ? '#b3261e' : 'var(--gold)', color: danger ? 'white' : 'var(--navy)', border: 'none', borderRadius: '3px', cursor: ready ? 'pointer' : 'not-allowed', opacity: ready ? 1 : 0.5, fontWeight: 700, fontSize: '0.85rem' }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

export type SaveState = { status: 'idle' | 'saving' | 'saved' | 'error'; message?: string }

/** Tracks the save state of auto-saved fields, keyed by field. */
export function useSaveStates() {
  const [states, setStates] = useState<Record<string, SaveState>>({})
  const set = useCallback((key: string, s: SaveState) => setStates(prev => ({ ...prev, [key]: s })), [])
  /** Runs `save`; it returns an error message, or null on success. */
  const track = useCallback(async (key: string, save: () => Promise<string | null>) => {
    set(key, { status: 'saving' })
    const error = await save()
    set(key, error ? { status: 'error', message: error } : { status: 'saved' })
    return !error
  }, [set])
  return { states, track, get: (key: string): SaveState => states[key] ?? { status: 'idle' } }
}

export function SaveStatus({ state }: { state: SaveState }) {
  if (state.status === 'idle') return null
  const style = { fontSize: '0.78rem', fontWeight: 600, marginLeft: '0.5rem', textTransform: 'none' as const, letterSpacing: 0, fontFamily: 'var(--font-montserrat), sans-serif' }
  if (state.status === 'saving') return <span role="status" style={{ ...style, color: 'var(--slate)' }}>Saving…</span>
  if (state.status === 'saved') return <span role="status" style={{ ...style, color: '#14532d' }}>Saved ✓</span>
  return <span role="alert" style={{ ...style, color: '#b3261e' }}>Not saved: {state.message}</span>
}

/** An error shown right next to the control that caused it. */
export function InlineError({ message }: { message?: string | null }) {
  if (!message) return null
  return <p role="alert" style={{ color: '#b3261e', fontSize: '0.85rem', margin: '0.5rem 0 0', lineHeight: 1.5 }}>{message}</p>
}
