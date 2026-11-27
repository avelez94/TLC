'use client'

// Admin → Policies & legal. Tramaine writes, previews and publishes the Privacy Policy, Terms &
// Conditions and Refund & Cancellation Policy himself. Drafts save automatically; "Save draft"
// also keeps a version. Publishing needs an explicit approval and complete wording.
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import PolicyDocument from '@/components/PolicyDocument'
import { EMPTY_POLICY, isPolicySlug, POLICY_META, POLICY_SLUGS, policyDate, publishProblems, stableJson, type Block, type PolicyContent, type PolicySection, type PolicySlug } from '@/lib/policies'
import { blocksToHtml, cleanPaste, domToBlocks } from '@/lib/policy-editor'
import { formatDateTimeET } from '@/lib/business-time'
import { useAdminPanelContext } from '../AdminPanelContext'
import { cardStyle, helpStyle, inputStyle, labelStyle, pageTitleStyle, secondaryButtonStyle, sectionTitleStyle } from '../components/shared'

interface Summary { slug: PolicySlug; name: string; path: string; status: 'draft' | 'published'; published_version: number | null; published_at: string | null; draft_updated_at: string | null; unpublished_changes: boolean; has_draft: boolean }
interface Version { id: string; version_number: number; kind: 'saved' | 'published'; note: string | null; created_at: string; created_by: string | null; live: boolean }
interface Detail {
  slug: PolicySlug; name: string; path: string; draft: PolicyContent; draft_updated_at: string | null; draft_updated_by: string | null
  published: { id: string; version_number: number; published_at: string; published_by: string | null } | null
  unpublished_changes: boolean; versions: Version[]
}

const tool = { background: 'white', border: '1px solid rgba(0,23,55,0.2)', borderRadius: '3px', padding: '0.4rem 0.7rem', minHeight: '36px', minWidth: '36px', fontSize: '0.85rem', cursor: 'pointer', color: 'var(--navy)', fontFamily: 'var(--font-montserrat), sans-serif' } as const
const newId = () => `s-${Math.random().toString(36).slice(2, 9)}`
const chip = (text: string, tone: 'ok' | 'todo' | 'info') => {
  const c = tone === 'ok' ? { bg: '#e8f5ec', fg: '#14532d' } : tone === 'todo' ? { bg: '#fdf3e1', fg: '#7a4a06' } : { bg: 'rgba(0,23,55,0.06)', fg: 'var(--navy)' }
  return <span style={{ display: 'inline-block', fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.2rem 0.55rem', borderRadius: '3px', background: c.bg, color: c.fg, whiteSpace: 'nowrap' }}>{text}</span>
}

/** Rich text: paragraphs, bulleted and numbered lists, bold, italic, underline, links. */
function RichText({ id, initial, onChange, label, placeholder }: { id: string; initial: Block[]; onChange: (b: Block[]) => void; label: string; placeholder: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [html] = useState(() => blocksToHtml(initial))
  const [empty, setEmpty] = useState(initial.length === 0)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const saved = useRef<Range | null>(null)
  const emit = () => { const el = ref.current; if (!el) return; setEmpty(!(el.textContent ?? '').trim()); onChange(domToBlocks(el)) }
  const exec = (cmd: string, value?: string) => { ref.current?.focus(); document.execCommand(cmd, false, value); emit() }
  const openLink = () => {
    const sel = window.getSelection()
    saved.current = sel && sel.rangeCount && ref.current?.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null
    setLinkUrl(''); setLinkOpen(true)
  }
  const applyLink = () => {
    const url = linkUrl.trim()
    const href = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(url) ? `mailto:${url}` : /^https?:\/\//i.test(url) || /^(mailto|tel):/i.test(url) ? url : `https://${url}`
    ref.current?.focus()
    if (saved.current) { const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(saved.current) }
    if (saved.current && !saved.current.collapsed) document.execCommand('createLink', false, href)
    else document.execCommand('insertHTML', false, `<a href="${href.replace(/"/g, '&quot;')}">${url.replace(/</g, '&lt;')}</a>`)
    setLinkOpen(false); emit()
  }
  return (
    <div>
      <div role="toolbar" aria-label={`${label} formatting`} style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
        <button type="button" aria-label="Bold" onMouseDown={e => e.preventDefault()} onClick={() => exec('bold')} style={{ ...tool, fontWeight: 700 }}>B</button>
        <button type="button" aria-label="Italic" onMouseDown={e => e.preventDefault()} onClick={() => exec('italic')} style={{ ...tool, fontStyle: 'italic' }}>I</button>
        <button type="button" aria-label="Underline" onMouseDown={e => e.preventDefault()} onClick={() => exec('underline')} style={{ ...tool, textDecoration: 'underline' }}>U</button>
        <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => exec('insertUnorderedList')} style={tool}>• List</button>
        <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => exec('insertOrderedList')} style={tool}>1. List</button>
        <button type="button" aria-expanded={linkOpen} onMouseDown={e => e.preventDefault()} onClick={openLink} style={tool}>Link</button>
        <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => exec('unlink')} style={tool}>Remove link</button>
        <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => exec('removeFormat')} style={tool}>Clear formatting</button>
      </div>
      {linkOpen && (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
          <label htmlFor={`${id}-link`} className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Link address</label>
          <input id={`${id}-link`} autoFocus value={linkUrl} onChange={e => setLinkUrl(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyLink() } if (e.key === 'Escape') setLinkOpen(false) }} placeholder="https://… or an email address" style={{ ...inputStyle, flex: '1 1 240px', width: 'auto' }} />
          <button type="button" onClick={applyLink} disabled={!linkUrl.trim()} style={tool}>Add link</button>
          <button type="button" onClick={() => setLinkOpen(false)} style={tool}>Cancel</button>
        </div>
      )}
      <div style={{ position: 'relative' }}>
        {empty && <span aria-hidden="true" style={{ position: 'absolute', top: '0.75rem', left: '1rem', right: '1rem', color: 'var(--slate)', opacity: 0.75, fontSize: '0.9rem', pointerEvents: 'none' }}>{placeholder}</span>}
        <div
          id={id} ref={ref} role="textbox" aria-multiline="true" aria-label={label} contentEditable suppressContentEditableWarning
          className="policy-rich"
          onInput={emit}
          onPaste={e => { e.preventDefault(); document.execCommand('insertHTML', false, cleanPaste(e.clipboardData.getData('text/html') || null, e.clipboardData.getData('text/plain'))); emit() }}
          dangerouslySetInnerHTML={{ __html: html }}
          style={{ ...inputStyle, minHeight: '120px', padding: '0.75rem 1rem', lineHeight: 1.65, cursor: 'text' }}
        />
      </div>
    </div>
  )
}

function Editor({ slug, onChanged }: { slug: PolicySlug; onChanged: () => void }) {
  const panel = useAdminPanelContext()
  const [detail, setDetail] = useState<Detail | null>(null)
  const [content, setContent] = useState<PolicyContent>(EMPTY_POLICY)
  const [editorKey, setEditorKey] = useState(0)
  const [savedJson, setSavedJson] = useState('')
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error' | 'conflict'>('idle')
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [approve, setApprove] = useState(false)
  const [busy, setBusy] = useState(false)
  const [versionPreview, setVersionPreview] = useState<{ number: number; content: PolicyContent } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirty = stableJson(content) !== savedJson

  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/policies/${slug}`, { cache: 'no-store' })
    if (!r.ok) { setState('error'); return }
    const d = (await r.json()) as Detail
    setDetail(d); setContent(d.draft); setSavedJson(stableJson(d.draft)); setUpdatedAt(d.draft_updated_at)
    setEditorKey(k => k + 1); setState('idle'); setApprove(false); setVersionPreview(null)
  }, [slug])
  useEffect(() => { void Promise.resolve().then(load) }, [load])

  // Returns the draft's new timestamp, or null when it was not saved.
  const save = useCallback(async (version: boolean): Promise<string | null> => {
    setState('saving')
    const body = { content, version, expected_updated_at: updatedAt }
    const r = await fetch(`/api/admin/policies/${slug}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const j = await r.json().catch(() => ({}))
    if (r.status === 409) { setState('conflict'); panel.fail(j.error); return null }
    if (!r.ok) { setState('error'); panel.fail(j.error ?? 'The draft could not be saved. Your changes are still on this page; try again.'); return null }
    setUpdatedAt(j.draft_updated_at); setSavedJson(stableJson(content)); setSavedAt(j.draft_updated_at); setState('saved')
    if (version) { panel.ok(`Draft saved as version ${j.version.version_number}.`); await load(); onChanged() }
    return j.draft_updated_at as string
  }, [content, updatedAt, slug, panel, load, onChanged])

  // Autosave a few seconds after the last change (no version; "Save draft" keeps a version).
  useEffect(() => {
    if (!dirty || state === 'conflict' || state === 'saving') return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { void save(false) }, 2500)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [dirty, content, state, save])
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const setSection = (i: number, patch: Partial<PolicySection>) => setContent(c => ({ ...c, sections: c.sections.map((s, j) => j === i ? { ...s, ...patch } : s) }))
  const move = (i: number, d: -1 | 1) => { setContent(c => { const s = [...c.sections]; const [x] = s.splice(i, 1); s.splice(i + d, 0, x); return { ...c, sections: s } }); setEditorKey(k => k + 1) }
  const remove = async (i: number) => {
    const s = content.sections[i]
    const yes = await panel.confirm({ title: `Delete section ${i + 1}${s.heading ? ` (“${s.heading}”)` : ''}?`, message: 'The section is removed from the draft. Earlier saved versions keep it, so you can restore it from the history.', confirmLabel: 'Delete section', danger: true })
    if (!yes) return
    setContent(c => ({ ...c, sections: c.sections.filter((_, j) => j !== i) })); setEditorKey(k => k + 1)
  }

  const problems = useMemo(() => publishProblems(content), [content])
  const publish = async () => {
    if (!approve || problems.length) return
    setBusy(true)
    let reviewedAt = updatedAt
    if (dirty) {
      const at = await save(false)
      if (!at) { setBusy(false); return }
      reviewedAt = at
    }
    const r = await fetch(`/api/admin/policies/${slug}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'publish', approve: true, expected_updated_at: reviewedAt }) })
    const j = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { panel.fail([j.error, ...(j.problems ?? [])].filter(Boolean).join(' ')); return }
    panel.ok(`${POLICY_META[slug].name} published (version ${j.version_number}). It is now live at ${POLICY_META[slug].path}.`)
    await load(); onChanged()
  }
  const unpublish = async () => {
    const yes = await panel.confirm({ title: `Unpublish the ${POLICY_META[slug].name}?`, message: `${POLICY_META[slug].path} will say the policy is being prepared, and the footer link disappears.`, consequences: ['Online payments stop for every cohort until it is published again.', 'Participants who already accepted it keep their record of the version they accepted.'], confirmLabel: 'Unpublish', danger: true })
    if (!yes) return
    const r = await fetch(`/api/admin/policies/${slug}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'unpublish' }) })
    if (!r.ok) { panel.fail('The policy could not be unpublished. Try again.'); return }
    panel.ok(`${POLICY_META[slug].name} unpublished. Online payments are blocked until it is published again.`)
    await load(); onChanged()
  }
  const previewVersion = async (v: Version) => {
    const r = await fetch(`/api/admin/policies/${slug}?version=${v.id}`, { cache: 'no-store' })
    const j = await r.json().catch(() => ({}))
    if (r.ok && j.version?.content) setVersionPreview({ number: v.version_number, content: j.version.content })
  }
  const restore = async (v: Version) => {
    const yes = await panel.confirm({ title: `Restore version ${v.version_number} into the draft?`, message: 'The draft is replaced by that version. Nothing is published until you publish again; the current draft stays in the history.', confirmLabel: 'Restore into draft' })
    if (!yes) return
    if (dirty) await save(true)
    const r = await fetch(`/api/admin/policies/${slug}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'restore', version_id: v.id }) })
    if (!r.ok) { panel.fail('That version could not be restored.'); return }
    panel.ok(`Version ${v.version_number} restored into the draft.`)
    await load(); onChanged()
  }

  if (!detail) return <p style={helpStyle}>{state === 'error' ? 'This policy could not be loaded. Reload the page.' : 'Loading…'}</p>
  const statusText = state === 'saving' ? 'Saving…' : state === 'conflict' ? 'Not saved: changed elsewhere' : state === 'error' ? 'Not saved' : dirty ? 'Unsaved changes' : savedAt ? `Draft saved ${formatDateTimeET(savedAt)}` : updatedAt ? `Draft saved ${formatDateTimeET(updatedAt)}` : 'No draft yet'

  return (
    <div>
      <div style={{ ...cardStyle, display: 'flex', gap: '0.75rem 1.25rem', flexWrap: 'wrap', alignItems: 'center', position: 'sticky', top: '64px', zIndex: 5, padding: '0.9rem 1.25rem' }}>
        <div style={{ flex: '1 1 240px', minWidth: 0 }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {detail.published ? chip(`Published · version ${detail.published.version_number}`, 'ok') : chip('Draft · not published', 'todo')}
            {detail.published && detail.unpublished_changes && chip('Draft has unpublished changes', 'info')}
          </div>
          <p role="status" aria-live="polite" style={{ margin: '0.35rem 0 0', fontSize: '0.82rem', color: state === 'error' || state === 'conflict' ? '#B3261E' : 'var(--slate)' }}>
            {statusText}{detail.published ? ` · Live version last updated ${policyDate(detail.published.published_at)}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {state === 'conflict' && <button type="button" onClick={() => void load()} style={{ ...secondaryButtonStyle, minHeight: '44px' }}>Reload latest</button>}
          <button type="button" onClick={() => setMode(m => m === 'edit' ? 'preview' : 'edit')} style={{ ...secondaryButtonStyle, minHeight: '44px' }}>{mode === 'edit' ? 'Preview' : 'Back to editing'}</button>
          <button type="button" onClick={() => void save(true)} disabled={state === 'saving' || state === 'conflict'} style={{ ...secondaryButtonStyle, minHeight: '44px' }}>Save draft</button>
          {detail.published && <a href={detail.path} target="_blank" rel="noopener noreferrer" style={{ ...secondaryButtonStyle, minHeight: '44px', display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>View live page ↗</a>}
        </div>
      </div>

      {mode === 'preview' ? (
        <div style={{ ...cardStyle, padding: 'clamp(1.25rem, 4vw, 2.5rem)' }}>
          <p style={{ background: '#fdf3e1', color: '#7a4a06', borderRadius: '4px', padding: '0.6rem 0.9rem', fontSize: '0.85rem', fontWeight: 600, margin: '0 0 1.5rem' }}>Preview of the draft. This is not published and visitors cannot see it.</p>
          {content.title || content.sections.length ? <PolicyDocument content={content} updated={policyDate(new Date().toISOString())} /> : <p style={helpStyle}>Nothing written yet.</p>}
        </div>
      ) : (
        <div style={cardStyle} key={editorKey}>
          <label htmlFor={`${slug}-title`} style={labelStyle}>Page title</label>
          <input id={`${slug}-title`} value={content.title} maxLength={120} onChange={e => setContent(c => ({ ...c, title: e.target.value }))} placeholder={POLICY_META[slug].name} style={{ ...inputStyle, marginBottom: '1.25rem' }} />
          <p style={labelStyle} id={`${slug}-intro-label`}>Introduction</p>
          <RichText id={`${slug}-intro`} label="Introduction" initial={content.intro} onChange={intro => setContent(c => ({ ...c, intro }))} placeholder="A short opening paragraph (optional)." />

          <h2 style={{ ...sectionTitleStyle, margin: '1.75rem 0 0.75rem' }}>Sections</h2>
          {content.sections.length === 0 && <p style={helpStyle}>No sections yet. Add the first one below.</p>}
          {content.sections.map((s, i) => (
            <div key={s.id} style={{ border: '1px solid rgba(0,23,55,0.12)', borderRadius: '6px', padding: '1rem', marginBottom: '1rem', background: 'var(--paper)' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                <div style={{ flex: '1 1 260px' }}>
                  <label htmlFor={`${slug}-${s.id}-heading`} style={labelStyle}>Section {i + 1} heading</label>
                  <input id={`${slug}-${s.id}-heading`} value={s.heading} maxLength={160} onChange={e => setSection(i, { heading: e.target.value })} placeholder="e.g. Cancellations" style={inputStyle} />
                </div>
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <button type="button" aria-label={`Move section ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)} style={tool}>↑</button>
                  <button type="button" aria-label={`Move section ${i + 1} down`} disabled={i === content.sections.length - 1} onClick={() => move(i, 1)} style={tool}>↓</button>
                  <button type="button" onClick={() => void remove(i)} style={{ ...tool, color: '#B3261E' }}>Delete</button>
                </div>
              </div>
              <RichText id={`${slug}-${s.id}-body`} label={`Section ${i + 1} wording`} initial={s.body} onChange={body => setSection(i, { body })} placeholder="The wording for this section." />
            </div>
          ))}
          <button type="button" onClick={() => setContent(c => ({ ...c, sections: [...c.sections, { id: newId(), heading: '', body: [] }] }))} style={{ ...secondaryButtonStyle, minHeight: '44px' }}>+ Add section</button>
        </div>
      )}

      <section aria-labelledby={`${slug}-publish`} style={cardStyle}>
        <h2 id={`${slug}-publish`} style={sectionTitleStyle}>{detail.published ? 'Publish changes' : 'Publish'}</h2>
        {problems.length > 0 ? (
          <>
            <p style={helpStyle}>Before this can be published:</p>
            <ul style={{ margin: '0 0 1rem', paddingLeft: '1.2rem', color: 'var(--navy)', fontSize: '0.9rem', lineHeight: 1.7 }}>{problems.map(p => <li key={p}>{p}</li>)}</ul>
          </>
        ) : (
          <p style={helpStyle}>Publishing makes this wording the official {POLICY_META[slug].name} at {POLICY_META[slug].path}, with today as the last-updated date. Participants accept the published version before paying.</p>
        )}
        <label htmlFor={`${slug}-approve`} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', fontSize: '0.9rem', color: 'var(--navy)', marginBottom: '1rem', lineHeight: 1.5 }}>
          <input id={`${slug}-approve`} type="checkbox" checked={approve} disabled={problems.length > 0} onChange={e => setApprove(e.target.checked)} style={{ width: '20px', height: '20px', marginTop: '1px', flexShrink: 0 }} />
          I have reviewed this wording and approve it as the official {POLICY_META[slug].name}.
        </label>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary" onClick={() => void publish()} disabled={!approve || problems.length > 0 || busy} style={{ fontSize: '0.8rem', minHeight: '44px', opacity: !approve || problems.length > 0 ? 0.55 : 1 }}>{busy ? 'Publishing…' : detail.published ? 'Publish changes' : 'Publish'}</button>
          {detail.published && <button type="button" onClick={() => void unpublish()} style={{ ...secondaryButtonStyle, minHeight: '44px', color: '#B3261E' }}>Unpublish</button>}
        </div>
      </section>

      <section aria-labelledby={`${slug}-history`} style={cardStyle}>
        <h2 id={`${slug}-history`} style={sectionTitleStyle}>Version history</h2>
        {detail.versions.length === 0 ? <p style={helpStyle}>No versions yet. “Save draft” and every publish add one.</p> : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {detail.versions.map(v => (
              <li key={v.id} style={{ display: 'flex', gap: '0.5rem 1rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.6rem 0', borderBottom: '1px solid var(--mist)' }}>
                <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.75rem', color: '#8a5a10', width: '3.5rem' }}>v{v.version_number}</span>
                <span style={{ flex: '1 1 260px', fontSize: '0.88rem', color: 'var(--navy)' }}>
                  {v.kind === 'published' ? 'Published' : 'Saved draft'}{v.live ? ' (live now)' : ''}{v.note && v.note !== 'Published' ? ` · ${v.note}` : ''}
                  <span style={{ display: 'block', color: 'var(--slate)', fontSize: '0.8rem' }}>{formatDateTimeET(v.created_at)}{v.created_by ? ` · ${v.created_by}` : ''}</span>
                </span>
                <button type="button" onClick={() => void previewVersion(v)} style={tool}>View</button>
                <button type="button" onClick={() => void restore(v)} style={tool}>Restore into draft</button>
              </li>
            ))}
          </ul>
        )}
        {versionPreview && (
          <div style={{ marginTop: '1rem', border: '1px solid rgba(0,23,55,0.12)', borderRadius: '6px', padding: '1.25rem', background: 'var(--paper)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
              <strong style={{ color: 'var(--navy)' }}>Version {versionPreview.number}</strong>
              <button type="button" onClick={() => setVersionPreview(null)} style={tool}>Close</button>
            </div>
            <PolicyDocument content={versionPreview.content} compact headingLevel={2} />
          </div>
        )}
      </section>
    </div>
  )
}

function PoliciesContent() {
  const router = useRouter()
  const params = useSearchParams()
  const q = params.get('policy')
  const selected: PolicySlug = isPolicySlug(q) ? q : 'privacy'
  const [list, setList] = useState<Summary[] | null>(null)
  const loadList = useCallback(async () => {
    const r = await fetch('/api/admin/policies', { cache: 'no-store' })
    if (r.ok) setList((await r.json()).policies)
  }, [])
  useEffect(() => { void Promise.resolve().then(loadList) }, [loadList])

  return (
    <div style={{ maxWidth: '980px' }}>
      <h1 style={pageTitleStyle}>Policies &amp; legal</h1>
      <p style={helpStyle}>
        Write and publish the site’s Privacy Policy, Terms &amp; Conditions and Refund &amp; Cancellation Policy. Visitors only ever see the published version. All three must be published before online payments can open (see <Link href="/admin/launch" style={{ color: '#8a5a10', fontWeight: 600 }}>Launch readiness</Link>).
      </p>
      <div role="tablist" aria-label="Policies" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {POLICY_SLUGS.map(slug => {
          const s = list?.find(x => x.slug === slug)
          const active = slug === selected
          return (
            <button key={slug} id={`policy-tab-${slug}`} role="tab" aria-selected={active} type="button" onClick={() => router.replace(`/admin/policies?policy=${slug}`, { scroll: false })}
              style={{ textAlign: 'left', background: 'white', border: `2px solid ${active ? 'var(--gold)' : 'rgba(0,23,55,0.1)'}`, borderRadius: '6px', padding: '0.9rem 1rem', cursor: 'pointer', fontFamily: 'var(--font-montserrat), sans-serif', minHeight: '44px' }}>
              <strong style={{ display: 'block', color: 'var(--navy)', fontSize: '0.95rem', marginBottom: '0.4rem' }}>{POLICY_META[slug].name}</strong>
              {s ? (s.status === 'published' ? chip(`Published · v${s.published_version}`, 'ok') : chip('Draft', 'todo')) : chip('…', 'info')}
              {s?.unpublished_changes && <span style={{ marginLeft: '0.4rem' }}>{chip('Unpublished changes', 'info')}</span>}
              <span style={{ display: 'block', color: 'var(--slate)', fontSize: '0.78rem', marginTop: '0.4rem' }}>{s?.published_at ? `Last updated ${policyDate(s.published_at)}` : s?.has_draft ? 'Draft started' : 'Not started'}</span>
            </button>
          )
        })}
      </div>
      <Editor key={selected} slug={selected} onChanged={loadList} />
      <style>{`.policy-rich p { margin: 0 0 0.75rem } .policy-rich ul, .policy-rich ol { margin: 0 0 0.75rem; padding-left: 1.4rem } .policy-rich ul { list-style: disc } .policy-rich ol { list-style: decimal } .policy-rich a { color: #8a5a10; text-decoration: underline }`}</style>
    </div>
  )
}

export default function PoliciesPage() {
  return <Suspense fallback={<p style={helpStyle}>Loading…</p>}><PoliciesContent /></Suspense>
}
