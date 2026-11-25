'use client'

import { useState } from 'react'
import { formatDateET } from '@/lib/business-time'
import { cardStyle, EmptyState, h2Style, inputStyle, labelStyle, mutedText, PageHeader, smallButtonStyle, StatusBadge } from './ui'
import type { JournalEntryRow } from './types'

/** The participant's own journal. Entries from finished programs are shown read-only. */
export function JournalView({ entries, prompt, canCompose, isEditable, programLabel, onSave, onEdit, busy, onOpenHistory }: {
  entries: JournalEntryRow[]
  prompt: string
  canCompose: boolean
  isEditable: (entry: JournalEntryRow) => boolean
  programLabel: (programId: string | null) => string | null
  onSave: (body: string) => Promise<boolean>
  onEdit: (id: string, body: string) => Promise<boolean>
  busy: boolean
  onOpenHistory: () => void
}) {
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')

  const save = async () => {
    if (!draft.trim()) return
    if (await onSave(draft.trim())) setDraft('')
  }
  const saveEdit = async (id: string) => {
    if (!editBody.trim()) return
    if (await onEdit(id, editBody.trim())) { setEditingId(null); setEditBody('') }
  }

  return (
    <div>
      <PageHeader eyebrow="Reflection Journal" title="Your Journal" intro="Your journal is private: only you can read these entries." />
      {canCompose ? (
        <section aria-labelledby="new-entry" style={cardStyle}>
          <h2 id="new-entry" style={{ ...h2Style, marginBottom: '0.5rem' }}>New Entry</h2>
          <p style={{ color: 'var(--slate)', fontSize: '0.82rem', marginBottom: '1rem' }}>This week&rsquo;s prompt: <em>{prompt}</em></p>
          <label htmlFor="journal-new" style={labelStyle}>Your reflection</label>
          <textarea id="journal-new" value={draft} onChange={e => setDraft(e.target.value)} placeholder="Write your reflection here..." rows={5} style={{ ...inputStyle, resize: 'vertical' }} />
          <button type="button" onClick={save} disabled={busy || !draft.trim()} className="btn btn-primary" style={{ marginTop: '1rem', fontSize: '0.8rem', padding: '0.65rem 1.5rem' }}>{busy ? 'Saving...' : 'Save Entry'}</button>
        </section>
      ) : (
        <div role="note" style={{ ...cardStyle, borderLeft: '4px solid var(--navy)', padding: '1rem 1.25rem' }}>
          <p style={{ color: 'var(--ink)', fontSize: '0.88rem', lineHeight: 1.6 }}>New journal entries open when you are in a current program. Your past entries are saved below and are read-only.</p>
        </div>
      )}

      {entries.length === 0 && (
        <EmptyState compact>{canCompose ? 'No journal entries yet. Write your first one above.' : 'You have no journal entries yet.'}</EmptyState>
      )}
      {entries.length > 0 && (
        <p style={{ ...mutedText, marginBottom: '1rem' }}>
          {entries.length} entr{entries.length === 1 ? 'y' : 'ies'}. Looking for your weekly rep reflections too? <button type="button" onClick={onOpenHistory} style={{ background: 'none', border: 'none', padding: 0, color: '#8a5a10', fontWeight: 600, cursor: 'pointer', fontSize: 'inherit', fontFamily: 'inherit' }}>See My Learning History</button>.
        </p>
      )}
      {entries.map(entry => {
        const editable = isEditable(entry)
        const program = programLabel(entry.program_id)
        return (
          <article key={entry.id} style={{ ...cardStyle, borderLeft: '3px solid var(--gold)' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.1em', color: '#8a5a10', textTransform: 'uppercase' }}>{formatDateET(entry.created_at, 'long')}</span>
              {program && <span style={{ fontSize: '0.72rem', color: 'var(--slate)' }}>{program}</span>}
              {!editable && <StatusBadge kind="info">Read-only</StatusBadge>}
            </div>
            {entry.title && <h2 style={{ ...h2Style, marginBottom: '0.35rem' }}>{entry.title}</h2>}
            {entry.prompt_used && <p style={{ color: 'var(--slate)', fontSize: '0.8rem', fontStyle: 'italic', marginBottom: '0.5rem' }}>{entry.prompt_used}</p>}
            {editingId === entry.id ? (
              <div>
                <label htmlFor={`edit-${entry.id}`} style={labelStyle}>Edit entry</label>
                <textarea id={`edit-${entry.id}`} value={editBody} onChange={e => setEditBody(e.target.value)} rows={5} style={{ ...inputStyle, resize: 'vertical' }} />
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => saveEdit(entry.id)} disabled={busy || !editBody.trim()} className="btn btn-primary" style={{ fontSize: '0.78rem', padding: '0.45rem 1rem' }}>{busy ? 'Saving...' : 'Save changes'}</button>
                  <button type="button" onClick={() => { setEditingId(null); setEditBody('') }} style={smallButtonStyle}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <p style={{ color: 'var(--ink)', fontSize: '0.88rem', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{entry.body}</p>
                {editable && (
                  <button type="button" onClick={() => { setEditingId(entry.id); setEditBody(entry.body ?? '') }} aria-label={`Edit entry from ${formatDateET(entry.created_at, 'long')}`} style={{ ...smallButtonStyle, border: 'none', padding: '0.45rem 0', marginTop: '0.25rem' }}>Edit</button>
                )}
              </>
            )}
          </article>
        )
      })}
    </div>
  )
}
