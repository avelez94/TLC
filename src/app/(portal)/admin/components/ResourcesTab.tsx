'use client'

import { useEffect, useRef, useState } from 'react'
import { STORAGE_PREFIX, resourceOpenHref } from '@/lib/resource-links'
import { supabase } from '@/lib/supabase'
import { friendlyError } from '@/lib/admin-errors'
import { formatDateET } from '@/lib/business-time'
import type { Resource } from '@/types'
import type { AdminPanel } from '../useAdminPanel'
import { InlineError } from './feedback'
import { cardStyle, dangerLinkStyle, helpStyle, inputStyle, labelStyle, pageTitleStyle, programChoices, secondaryButtonStyle, sectionTitleStyle, tdStyle, thStyle } from './shared'

const TYPES: { value: string; label: string }[] = [
  { value: 'pdf', label: 'PDF' }, { value: 'video', label: 'Video' }, { value: 'article', label: 'Article' },
  { value: 'worksheet', label: 'Worksheet' }, { value: 'template', label: 'Template' }, { value: 'book', label: 'Book' },
  { value: 'recording', label: 'Recording' },
]
const typeLabel = (t: string | null) => TYPES.find(x => x.value === t)?.label ?? (t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Other')

const PORTALS: { value: string; label: string }[] = [
  { value: 'impact', label: 'Impact Lab' }, { value: 'coaching', label: 'Coaching' }, { value: 'both', label: 'Both' },
]

const MAX_BYTES = 25 * 1024 * 1024
const ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.mp4,.mov,.mp3,.png,.jpg,.jpeg'
const ALLOWED_TYPES = new Set([
  'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'video/mp4', 'video/quicktime', 'audio/mpeg', 'image/png', 'image/jpeg',
])
/** A unique storage name; the list strips the leading timestamp to show the original name. */
const storagePath = (name: string) => `${Date.now()}-${name.replace(/[^A-Za-z0-9._-]+/g, '-')}`
const sizeText = (bytes: number) => bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`

interface Draft { title: string; type: string; topic: string; description: string; portal_type: string; program_id: string; cohort_id: string; link: string }
const EMPTY: Draft = { title: '', type: 'pdf', topic: '', description: '', portal_type: 'impact', program_id: '', cohort_id: '', link: '' }

type Lookups = { programName: (id: string) => string; cohortName: (id: string) => string }

/** A sentence that matches the database rule for who can open a resource. */
function accessSentence(portal: string, programId: string | null, cohortId: string | null, l: Lookups): string {
  const tail = ' Participants who withdraw lose access. Administrators can open everything.'
  if (cohortId) {
    return `Only members of ${l.cohortName(cohortId)} (an active or completed enrollment in that cohort) can open it.${portal !== 'impact' ? ' Coaching clients cannot open it unless they are members of that cohort.' : ''}${tail}`
  }
  const impact = programId
    ? `Impact Lab participants with an active or completed enrollment in a ${l.programName(programId)} cohort`
    : 'Impact Lab participants with an active or completed enrollment in any cohort'
  if (portal === 'coaching') return 'All coaching clients can open it. Impact Lab participants cannot. Administrators can open everything.'
  if (portal === 'both') return `All coaching clients can open it, and so can ${impact}.${tail}`
  return `${impact} can open it. Coaching clients cannot.${tail}`
}

/** A short summary for the list. */
function accessSummary(r: Resource, l: Lookups): string {
  if (r.cohort_id) return `Members of ${l.cohortName(r.cohort_id)} only`
  const portal = r.portal_type ?? 'impact'
  const impact = r.program_id ? `Impact Lab: ${l.programName(r.program_id)}` : 'Impact Lab: all pathways'
  if (portal === 'coaching') return 'Coaching clients'
  if (portal === 'both') return `Coaching clients and ${impact}`
  return impact
}

export default function ResourcesTab(panel: AdminPanel) {
  const { resources, programs, cohorts } = panel
  const [showForm, setShowForm] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [source, setSource] = useState<'file' | 'link'>('file')
  const [showHistorical, setShowHistorical] = useState(false)
  const [uploaded, setUploaded] = useState<{ path: string; name: string; size: number } | null>(null)
  const [uploading, setUploading] = useState<{ name: string; size: number } | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})

  // /admin/resources?cohort=<id> (from a cohort's checklist) opens the form for that cohort.
  const prefilled = useRef(false)
  useEffect(() => {
    if (prefilled.current || panel.loading) return
    const id = new URLSearchParams(window.location.search).get('cohort')
    const c = id ? panel.cohorts.find(x => x.id === id) : undefined
    if (!c) return
    prefilled.current = true
    void Promise.resolve().then(() => { setDraft({ ...EMPTY, program_id: c.program_id, cohort_id: c.id }); setShowForm(true) })
  }, [panel.loading, panel.cohorts])
  const fileInput = useRef<HTMLInputElement>(null)
  const orphan = useRef<string | null>(null) // uploaded but not yet saved as a resource

  const lookups: Lookups = {
    programName: id => programs.find(p => p.id === id)?.name ?? 'an earlier program',
    cohortName: id => cohorts.find(c => c.id === id)?.name ?? 'one cohort',
  }
  const set = (patch: Partial<Draft>) => { setDraft(d => ({ ...d, ...patch })); setFormError(null) }

  /** Deletes an uploaded file that never became a resource (best effort, failures are logged). */
  const discardUpload = async (path: string | null) => {
    if (!path) return
    if (orphan.current === path) orphan.current = null
    const { error } = await supabase.storage.from('resources').remove([path])
    if (error) await panel.logFailure('resource.file_delete', 'resource', null, path, friendlyError(error))
  }

  // Leaving the page with an unsaved upload: remove the file so nothing is left behind.
  useEffect(() => () => {
    const path = orphan.current
    if (path) void supabase.storage.from('resources').remove([path])
  }, [])

  const clearFile = async () => {
    const path = uploaded?.path ?? null
    setUploaded(null)
    setUploadError(null)
    if (fileInput.current) fileInput.current.value = ''
    await discardUpload(path)
  }

  const onFile = async (file: File | undefined) => {
    setUploadError(null); setFormError(null)
    if (!file) return
    if (file.size > MAX_BYTES) { setUploadError(`${file.name} is ${sizeText(file.size)}. The limit is 25 MB. Upload a smaller file, or put it online and paste a link instead.`); return }
    if (file.type && !ALLOWED_TYPES.has(file.type)) { setUploadError('That kind of file cannot be uploaded. Use a PDF, Word, PowerPoint or Excel file, an MP4 or MOV video, an MP3, or a PNG or JPG image.'); return }
    const previous = uploaded?.path ?? null
    setUploading({ name: file.name, size: file.size })
    const path = storagePath(file.name)
    let errorMsg: string | null = null
    try {
      const { data, error } = await supabase.storage.from('resources').upload(path, file, { contentType: file.type || undefined, upsert: false })
      if (error || !data) errorMsg = friendlyError(error ?? { message: 'The upload did not finish.' })
      else {
        orphan.current = data.path
        setUploaded({ path: data.path, name: file.name, size: file.size })
        await discardUpload(previous) // the replaced file was never saved as a resource
      }
    } catch (e) { errorMsg = friendlyError({ message: e instanceof Error ? e.message : String(e) }) }
    setUploading(null)
    if (errorMsg) {
      setUploadError(`${file.name} was not uploaded: ${errorMsg}`)
      await panel.logFailure('resource.file_upload', 'resource', null, file.name, errorMsg)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const chooseSource = async (next: 'file' | 'link') => {
    if (next === source) return
    setSource(next); setFormError(null)
    if (next === 'link') await clearFile()
    else set({ link: '' })
  }

  const resetForm = () => {
    setDraft(EMPTY); setSource('file'); setUploaded(null); setUploadError(null); setFormError(null)
    if (fileInput.current) fileInput.current.value = ''
  }

  const cancel = async () => {
    const path = uploaded?.path ?? null
    resetForm(); setShowForm(false)
    await discardUpload(path)
  }

  const portal = draft.portal_type
  const pathwayOptions = programChoices(programs, showHistorical)
  const cohortOptions = cohorts
    .filter(c => !draft.program_id || c.program_id === draft.program_id)
    .filter(c => c.status !== 'cancelled' || c.id === draft.cohort_id)
  const selectedCohort = cohorts.find(c => c.id === draft.cohort_id)
  const programForSave = portal === 'coaching' ? '' : (draft.program_id || selectedCohort?.program_id || '')

  const save = async () => {
    setFormError(null)
    if (!draft.title.trim()) { setFormError('Give the resource a title.'); return }
    if (uploading) { setFormError('Wait for the upload to finish.'); return }
    let url = ''
    if (source === 'file') {
      if (!uploaded) { setFormError('Upload a file, or choose “Paste a link” instead.'); return }
      url = `${STORAGE_PREFIX}${uploaded.path}`
    } else {
      url = draft.link.trim()
      if (!/^https?:\/\/\S+\.\S+/i.test(url)) { setFormError('Paste the full web address, starting with https://'); return }
    }
    setSaving(true)
    const err = await panel.handleCreateResource({
      title: draft.title, description: draft.description, type: draft.type, url,
      program_id: programForSave, cohort_id: portal === 'coaching' ? '' : draft.cohort_id,
      topic: draft.topic, portal_type: portal,
    })
    setSaving(false)
    if (err) { setFormError(err); return }
    orphan.current = null // the file now belongs to the saved resource
    resetForm(); setShowForm(false)
  }

  const remove = async (r: Resource) => {
    const stored = !!r.url?.startsWith(STORAGE_PREFIX)
    const ok = await panel.confirm({
      title: `Remove “${r.title}”?`,
      message: 'This cannot be undone.',
      consequences: [
        'Participants will no longer see it or be able to open it.',
        stored ? 'The uploaded file is deleted from storage.' : 'The outside link itself is not affected.',
      ],
      confirmLabel: 'Remove resource', danger: true,
    })
    if (!ok) return
    setRemoving(r.id)
    setRowErrors(e => { const n = { ...e }; delete n[r.id]; return n })
    const err = await panel.handleDeleteResource(r.id)
    setRemoving(null)
    if (err) setRowErrors(e => ({ ...e, [r.id]: err }))
  }

  const fid = (k: string) => `resource-${k}`
  const radio = (value: 'file' | 'link', text: string) => (
    <label htmlFor={fid(`source-${value}`)} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.95rem', color: 'var(--navy)', fontWeight: 600, cursor: 'pointer', minHeight: '44px' }}>
      <input id={fid(`source-${value}`)} type="radio" name="resource-source" checked={source === value} onChange={() => chooseSource(value)} style={{ width: '18px', height: '18px', accentColor: 'var(--navy)' }} />
      {text}
    </label>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span style={labelStyle}>Participant experience</span>
          <h1 style={pageTitleStyle}>Resources</h1>
          <p style={{ ...helpStyle, maxWidth: '720px' }}>Files and links participants open from their portal. Uploaded files are stored privately: people open them through a secure link that expires, and only if they are allowed.</p>
        </div>
        {!showForm && (
          <button type="button" onClick={() => setShowForm(true)} className="btn btn-primary" style={{ fontSize: '0.85rem', minHeight: '44px' }}>+ Add resource</button>
        )}
      </div>

      {showForm && (
        <section style={{ ...cardStyle, borderTop: '3px solid var(--gold)' }} aria-labelledby={fid('form-title')}>
          <h2 id={fid('form-title')} style={sectionTitleStyle}>Add a resource</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label htmlFor={fid('title')} style={labelStyle}>Title</label>
              <input id={fid('title')} value={draft.title} maxLength={200} onChange={e => set({ title: e.target.value })} placeholder="For example: Week 1 worksheet" style={inputStyle} />
            </div>
            <div>
              <label htmlFor={fid('type')} style={labelStyle}>Type</label>
              <select id={fid('type')} value={draft.type} onChange={e => set({ type: e.target.value })} style={inputStyle}>
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor={fid('topic')} style={labelStyle}>Topic (optional)</label>
              <input id={fid('topic')} value={draft.topic} maxLength={100} onChange={e => set({ topic: e.target.value })} placeholder="For example: Session recordings" style={inputStyle} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label htmlFor={fid('description')} style={labelStyle}>Description (optional)</label>
              <textarea id={fid('description')} rows={2} maxLength={500} value={draft.description} onChange={e => set({ description: e.target.value })} placeholder="One or two sentences about what it is" style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
          </div>

          <h3 style={{ ...sectionTitleStyle, fontSize: '1.1rem', marginTop: '1.5rem' }}>Who can open it</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div>
              <label htmlFor={fid('portal')} style={labelStyle}>Portal</label>
              <select id={fid('portal')} value={portal} onChange={e => set({ portal_type: e.target.value, ...(e.target.value === 'coaching' ? { program_id: '', cohort_id: '' } : {}) })} style={inputStyle}>
                {PORTALS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor={fid('pathway')} style={labelStyle}>Pathway</label>
              <select id={fid('pathway')} value={draft.program_id} disabled={portal === 'coaching'} onChange={e => set({ program_id: e.target.value, cohort_id: '' })} style={{ ...inputStyle, opacity: portal === 'coaching' ? 0.5 : 1 }}>
                <option value="">All Impact Lab pathways</option>
                {pathwayOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <label htmlFor={fid('historical')} style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', fontSize: '0.85rem', color: 'var(--slate)', marginTop: '0.4rem', cursor: 'pointer', minHeight: '32px' }}>
                <input id={fid('historical')} type="checkbox" checked={showHistorical} disabled={portal === 'coaching'} onChange={e => { setShowHistorical(e.target.checked); if (!e.target.checked && draft.program_id && !programChoices(programs).some(p => p.id === draft.program_id)) set({ program_id: '', cohort_id: '' }) }} />
                Show historical programs
              </label>
            </div>
            <div>
              <label htmlFor={fid('cohort')} style={labelStyle}>Cohort (optional)</label>
              <select id={fid('cohort')} value={draft.cohort_id} disabled={portal === 'coaching'} onChange={e => set({ cohort_id: e.target.value })} style={{ ...inputStyle, opacity: portal === 'coaching' ? 0.5 : 1 }}>
                <option value="">Not limited to one cohort</option>
                {cohortOptions.map(c => <option key={c.id} value={c.id}>{c.name}{c.status === 'archived' ? ' (archived)' : ''}</option>)}
              </select>
              <p style={{ ...helpStyle, fontSize: '0.82rem', margin: '0.3rem 0 0' }}>Choose a cohort to share it only with that cohort&apos;s members.</p>
            </div>
          </div>
          <p role="status" style={{ background: 'rgba(200,136,32,0.07)', border: '1px solid rgba(200,136,32,0.25)', borderRadius: '4px', padding: '0.75rem 1rem', fontSize: '0.92rem', lineHeight: 1.6, color: 'var(--ink)', margin: '1rem 0 0' }}>
            {accessSentence(portal, programForSave || null, portal === 'coaching' ? null : draft.cohort_id || null, lookups)}
          </p>

          <h3 style={{ ...sectionTitleStyle, fontSize: '1.1rem', marginTop: '1.5rem' }}>File or link</h3>
          <div role="radiogroup" aria-label="File or link" style={{ display: 'flex', gap: '0.25rem 1.5rem', flexWrap: 'wrap' }}>
            {radio('file', 'Upload a file')}
            {radio('link', 'Paste a link')}
          </div>

          {source === 'file' ? (
            <div style={{ marginTop: '0.5rem' }}>
              <label htmlFor={fid('file')} style={labelStyle}>File (25 MB at most)</label>
              <input ref={fileInput} id={fid('file')} type="file" accept={ACCEPT} disabled={!!uploading || saving}
                onChange={e => onFile(e.target.files?.[0])}
                style={{ ...inputStyle, padding: '0.6rem 0.75rem', cursor: 'pointer' }} />
              <p style={{ ...helpStyle, fontSize: '0.82rem', margin: '0.3rem 0 0' }}>PDF, Word, PowerPoint, Excel, MP4 or MOV video, MP3, PNG or JPG.</p>
              {uploading && (
                <div role="status" style={{ marginTop: '0.6rem', fontSize: '0.9rem', color: 'var(--navy)' }}>
                  Uploading {uploading.name} ({sizeText(uploading.size)})… Please keep this page open.
                  <div aria-hidden="true" style={{ height: '6px', background: 'var(--mist)', borderRadius: '3px', marginTop: '0.4rem', overflow: 'hidden' }}>
                    <div style={{ width: '40%', height: '100%', background: 'var(--gold)', animation: 'resource-upload 1.2s ease-in-out infinite' }} />
                  </div>
                  <style>{'@keyframes resource-upload { 0% { transform: translateX(-100%) } 100% { transform: translateX(250%) } }'}</style>
                </div>
              )}
              {uploaded && !uploading && (
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.6rem', background: '#e8f5ec', border: '1px solid #a7d7b5', borderRadius: '4px', padding: '0.6rem 0.9rem', fontSize: '0.9rem', color: '#14532d' }}>
                  <span style={{ wordBreak: 'break-all' }}>✓ Uploaded: <strong>{uploaded.name}</strong> ({sizeText(uploaded.size)}). Stored privately. Choose another file to replace it.</span>
                  <button type="button" onClick={clearFile} style={{ ...dangerLinkStyle, fontSize: '0.88rem', minHeight: '32px' }}>Remove file</button>
                </div>
              )}
              <InlineError message={uploadError} />
            </div>
          ) : (
            <div style={{ marginTop: '0.5rem' }}>
              <label htmlFor={fid('link')} style={labelStyle}>Web address</label>
              <input id={fid('link')} type="url" inputMode="url" value={draft.link} onChange={e => set({ link: e.target.value })} placeholder="https://…" style={inputStyle} />
              <p style={{ ...helpStyle, fontSize: '0.82rem', margin: '0.3rem 0 0' }}>For a video or article that lives on another site. Anyone with the link itself can open it there.</p>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1.25rem' }}>
            <button type="button" onClick={save} disabled={saving || !!uploading} className="btn btn-primary" style={{ fontSize: '0.9rem', minHeight: '44px', opacity: saving || uploading ? 0.6 : 1 }}>
              {saving ? 'Adding…' : 'Add resource'}
            </button>
            <button type="button" onClick={cancel} disabled={saving || !!uploading} style={{ ...secondaryButtonStyle, minHeight: '44px' }}>Cancel</button>
          </div>
          <InlineError message={formError} />
        </section>
      )}

      {resources.length === 0 ? (
        !showForm && (
          <div style={{ ...cardStyle, textAlign: 'center', padding: '2.5rem 1rem' }}>
            <p style={{ color: 'var(--slate)', fontSize: '0.92rem', marginBottom: '1rem' }}>No resources yet.</p>
            <button type="button" onClick={() => setShowForm(true)} className="btn btn-primary" style={{ fontSize: '0.85rem', minHeight: '44px' }}>+ Add resource</button>
          </div>
        )
      ) : (
        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '640px' }}>
              <caption style={{ textAlign: 'left', padding: '0.75rem 1rem', color: 'var(--slate)', fontSize: '0.85rem' }}>{resources.length} resource{resources.length === 1 ? '' : 's'}</caption>
              <thead><tr>{['Title', 'Type', 'Who can open it', 'Added', 'Actions'].map(h => <th key={h} scope="col" style={thStyle}>{h}</th>)}</tr></thead>
              <tbody>
                {resources.map(r => {
                  const href = resourceOpenHref(r)
                  return (
                    <tr key={r.id}>
                      <td style={tdStyle}>
                        <span style={{ fontWeight: 600, color: 'var(--navy)' }}>{r.title}</span>
                        {r.topic && <span style={{ display: 'block', color: '#8a5a10', fontSize: '0.8rem' }}>{r.topic}</span>}
                        {r.description && <span style={{ display: 'block', color: 'var(--slate)', fontSize: '0.82rem' }}>{r.description}</span>}
                      </td>
                      <td style={tdStyle}>{typeLabel(r.type)}{r.url?.startsWith(STORAGE_PREFIX) ? <span style={{ display: 'block', color: 'var(--slate)', fontSize: '0.78rem' }}>Uploaded file</span> : r.url ? <span style={{ display: 'block', color: 'var(--slate)', fontSize: '0.78rem' }}>Link</span> : null}</td>
                      <td style={tdStyle}>{accessSummary(r, lookups)}</td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{formatDateET(r.created_at)}</td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                          {href && <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`Open ${r.title} (opens in a new tab)`} style={{ color: 'var(--navy)', fontSize: '0.88rem', fontWeight: 600 }}>Open</a>}
                          <button type="button" onClick={() => remove(r)} disabled={removing === r.id} aria-label={`Remove ${r.title}`} style={{ ...dangerLinkStyle, fontSize: '0.88rem', minHeight: '32px' }}>
                            {removing === r.id ? 'Removing…' : 'Remove'}
                          </button>
                        </div>
                        <InlineError message={rowErrors[r.id]} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
