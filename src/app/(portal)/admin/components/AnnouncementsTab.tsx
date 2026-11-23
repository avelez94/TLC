'use client'

import { useState } from 'react'
import { formatDateTimeET } from '@/lib/business-time'
import type { Announcement } from '@/types'
import type { AdminPanel } from '../useAdminPanel'
import { InlineError } from './feedback'
import { cardStyle, dangerLinkStyle, helpStyle, inputStyle, labelStyle, pageTitleStyle, secondaryButtonStyle, sectionTitleStyle } from './shared'

const TITLE_MAX = 150
const BODY_MAX = 4000
const EMPTY = { audience: '', title: '', body: '' }

export default function AnnouncementsTab(panel: AdminPanel) {
  const { announcements, cohorts } = panel
  const [showForm, setShowForm] = useState(false)
  const [draft, setDraft] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})

  const audienceCohorts = cohorts.filter(c => c.status !== 'archived' && c.status !== 'cancelled')
  const audienceLabel = (a: Announcement) => a.cohort_id ? `${a.cohorts?.name ?? panel.cohortName(a.cohort_id)} only` : 'Everyone in the Impact Lab portal'
  const set = (patch: Partial<typeof EMPTY>) => { setDraft(d => ({ ...d, ...patch })); setFormError(null) }

  const post = async () => {
    setFormError(null)
    if (!draft.audience) { setFormError('Choose who should see this announcement.'); return }
    if (!draft.title.trim()) { setFormError('Give the announcement a title.'); return }
    setSaving(true)
    const err = await panel.handleCreateAnnouncement(draft)
    setSaving(false)
    if (err) { setFormError(err); return }
    setDraft(EMPTY); setShowForm(false)
  }

  const remove = async (a: Announcement) => {
    const ok = await panel.confirm({
      title: `Delete “${a.title}”?`,
      message: 'This cannot be undone.',
      consequences: [`It disappears from the participant portal for ${a.cohort_id ? `members of ${a.cohorts?.name ?? panel.cohortName(a.cohort_id)}` : 'everyone'}.`],
      confirmLabel: 'Delete announcement', danger: true,
    })
    if (!ok) return
    setDeleting(a.id)
    setRowErrors(e => { const n = { ...e }; delete n[a.id]; return n })
    const err = await panel.handleDeleteAnnouncement(a.id)
    setDeleting(null)
    if (err) setRowErrors(e => ({ ...e, [a.id]: err }))
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span style={labelStyle}>Participant experience</span>
          <h1 style={pageTitleStyle}>Announcements</h1>
          <p style={{ ...helpStyle, maxWidth: '720px' }}>Announcements appear in the participant portal. No email is sent.</p>
        </div>
        {!showForm && <button type="button" onClick={() => setShowForm(true)} className="btn btn-primary" style={{ fontSize: '0.85rem', minHeight: '44px' }}>+ New announcement</button>}
      </div>

      {showForm && (
        <section style={{ ...cardStyle, borderTop: '3px solid var(--gold)' }} aria-labelledby="ann-form-title">
          <h2 id="ann-form-title" style={sectionTitleStyle}>Post an announcement</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label htmlFor="ann-audience" style={labelStyle}>Who sees this</label>
              <select id="ann-audience" required value={draft.audience} onChange={e => set({ audience: e.target.value })} style={inputStyle}>
                <option value="" disabled>Choose who sees this…</option>
                <option value="all">Everyone in the Impact Lab portal</option>
                {audienceCohorts.length > 0 && (
                  <optgroup label="Only one cohort">
                    {audienceCohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </optgroup>
                )}
              </select>
            </div>
            <div>
              <label htmlFor="ann-title" style={labelStyle}>
                Title <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--slate)' }}>({draft.title.length} of {TITLE_MAX} characters)</span>
              </label>
              <input id="ann-title" maxLength={TITLE_MAX} value={draft.title} onChange={e => set({ title: e.target.value })} placeholder="For example: No session next Tuesday" style={inputStyle} />
            </div>
            <div>
              <label htmlFor="ann-body" style={labelStyle}>
                Message <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--slate)' }}>({draft.body.length} of {BODY_MAX} characters)</span>
              </label>
              <textarea id="ann-body" rows={5} maxLength={BODY_MAX} value={draft.body} onChange={e => set({ body: e.target.value })} placeholder="Write your announcement here…" style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button type="button" onClick={post} disabled={saving} className="btn btn-primary" style={{ fontSize: '0.9rem', minHeight: '44px', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Posting…' : 'Post announcement'}
              </button>
              <button type="button" onClick={() => { setDraft(EMPTY); setFormError(null); setShowForm(false) }} disabled={saving} style={{ ...secondaryButtonStyle, minHeight: '44px' }}>Cancel</button>
            </div>
            <InlineError message={formError} />
          </div>
        </section>
      )}

      {announcements.length === 0 && !showForm && (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '2.5rem 1rem' }}>
          <p style={{ color: 'var(--slate)', fontSize: '0.92rem', margin: 0 }}>No announcements yet.</p>
        </div>
      )}

      {announcements.map(a => (
        <article key={a.id} style={{ ...cardStyle, borderLeft: '4px solid var(--gold)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.2rem', color: 'var(--navy)', letterSpacing: '0.04em', margin: 0 }}>{a.title}</h2>
              <div style={{ display: 'flex', gap: '0.4rem 1rem', marginTop: '0.3rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
                <span style={{ color: '#8a5a10', fontWeight: 600 }}>{audienceLabel(a)}</span>
                <span style={{ color: 'var(--slate)' }}>{formatDateTimeET(a.created_at)}</span>
              </div>
            </div>
            <button type="button" onClick={() => remove(a)} disabled={deleting === a.id} aria-label={`Delete announcement ${a.title}`} style={{ ...dangerLinkStyle, fontSize: '0.88rem', minHeight: '32px' }}>
              {deleting === a.id ? 'Deleting…' : 'Delete'}
            </button>
          </div>
          {a.body && <p style={{ color: 'var(--ink)', fontSize: '0.92rem', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{a.body}</p>}
          <InlineError message={rowErrors[a.id]} />
        </article>
      ))}
    </div>
  )
}
