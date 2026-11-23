// What the registration page shows for this cohort: description, what is included,
// expectations, and the book. Empty fields show hints only; nothing is pre-filled, so
// nothing is saved unless you type it.
import { useRef, useState } from 'react'
import { sanitizeRichText } from '@/lib/sanitize-html'
import { useSaveStates } from '../feedback'
import { inputStyle } from '../shared'
import { FieldLabel, fullWidth, gridStyle, linkProblem, metaStyle, type CohortSectionProps } from './ui'

const RICH_TEXT_COLORS = [
  { value: '#001737', name: 'Navy' }, { value: '#C88820', name: 'Gold' }, { value: '#1C2430', name: 'Charcoal' },
  { value: '#4A5260', name: 'Slate' }, { value: '#B02A2A', name: 'Red' }, { value: '#1E6B3A', name: 'Green' },
]

const toolStyle = {
  background: 'white', border: '1px solid rgba(0,23,55,0.2)', borderRadius: '3px', padding: '0.45rem 0.75rem', minHeight: '36px',
  fontSize: '0.9rem', cursor: 'pointer', color: 'var(--navy)', fontFamily: 'var(--font-montserrat), sans-serif',
}

/** Rich text (bold, italic, underline, colour) saved as sanitized HTML when you click away. */
function DescriptionEditor({ id, initialValue, onSave, labelledBy }: { id: string; initialValue: string; onSave: (html: string | null) => void; labelledBy: string }) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [initialHtml] = useState(() => sanitizeRichText(initialValue))
  const [empty, setEmpty] = useState(() => !initialValue.replace(/<[^>]*>/g, '').trim())
  const [showColors, setShowColors] = useState(false)

  const exec = (command: string, value?: string) => {
    editorRef.current?.focus()
    document.execCommand(command, false, value)
  }
  const isEmpty = (el: HTMLDivElement) => !(el.textContent ?? '').trim()

  return (
    <div>
      <div role="toolbar" aria-label="Text formatting" style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem', flexWrap: 'wrap', alignItems: 'center', position: 'relative' }}>
        <button type="button" aria-label="Bold" onMouseDown={e => e.preventDefault()} onClick={() => exec('bold')} style={{ ...toolStyle, fontWeight: 700 }}>B</button>
        <button type="button" aria-label="Italic" onMouseDown={e => e.preventDefault()} onClick={() => exec('italic')} style={{ ...toolStyle, fontStyle: 'italic' }}>I</button>
        <button type="button" aria-label="Underline" onMouseDown={e => e.preventDefault()} onClick={() => exec('underline')} style={{ ...toolStyle, textDecoration: 'underline' }}>U</button>
        <button type="button" aria-expanded={showColors} onMouseDown={e => e.preventDefault()} onClick={() => setShowColors(v => !v)} style={toolStyle}>
          Colour <span aria-hidden="true" style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '2px', background: 'var(--gold)', marginLeft: '0.3rem', verticalAlign: 'middle' }} />
        </button>
        <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => exec('removeFormat')} style={toolStyle}>Clear formatting</button>
        {showColors && (
          <div style={{ position: 'absolute', top: '110%', left: 0, background: 'white', border: '1px solid rgba(0,23,55,0.15)', borderRadius: '4px', padding: '0.5rem', display: 'flex', gap: '0.5rem', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            {RICH_TEXT_COLORS.map(c => (
              <button key={c.value} type="button" aria-label={c.name} title={c.name} onMouseDown={e => e.preventDefault()}
                onClick={() => { exec('foreColor', c.value); setShowColors(false) }}
                style={{ width: '30px', height: '30px', borderRadius: '50%', background: c.value, border: '1px solid rgba(0,23,55,0.2)', cursor: 'pointer', padding: 0 }} />
            ))}
          </div>
        )}
      </div>
      <div style={{ position: 'relative' }}>
        {empty && (
          <span aria-hidden="true" style={{ position: 'absolute', top: '0.75rem', left: '1rem', right: '1rem', color: 'var(--slate)', opacity: 0.8, fontSize: '0.9rem', pointerEvents: 'none', lineHeight: 1.6 }}>
            A short description of this cohort for the registration page. Leave empty to show none.
          </span>
        )}
        <div
          id={id}
          ref={editorRef}
          role="textbox"
          aria-multiline="true"
          aria-labelledby={labelledBy}
          contentEditable
          suppressContentEditableWarning
          onInput={e => setEmpty(isEmpty(e.currentTarget))}
          onBlur={e => {
            setShowColors(false)
            const el = e.currentTarget
            onSave(isEmpty(el) ? null : sanitizeRichText(el.innerHTML))
          }}
          dangerouslySetInnerHTML={{ __html: initialHtml }}
          style={{ ...inputStyle, minHeight: '110px', padding: '0.75rem 1rem', lineHeight: 1.6, cursor: 'text', whiteSpace: 'pre-wrap' }}
        />
      </div>
      <p style={{ ...metaStyle, fontSize: '0.82rem', margin: '0.4rem 0 0' }}>Select text to format it. Saves automatically when you click away.</p>
    </div>
  )
}

export function CohortContent({ panel, cohort }: CohortSectionProps) {
  const { get, track } = useSaveStates()
  const id = cohort.id
  const fid = (f: string) => `cohort-${id}-${f}`
  const save = (field: 'description' | 'includes' | 'expectations', next: string | null) => {
    const current = (field === 'description' ? (cohort.description ? sanitizeRichText(cohort.description) : null) : cohort[field]) ?? null
    if (next === current) return
    void track(field, () => panel.handleUpdateCohortField(id, { [field]: next }))
  }
  /** One item per line; blank lines removed; empty means "use the standard list". */
  const lines = (v: string) => v.split('\n').map(s => s.trim()).filter(Boolean).join('\n') || null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <p style={{ ...metaStyle, margin: 0 }}>Shown on the registration page while the cohort is Upcoming.</p>
      <div>
        <span id={fid('description-label')} style={{ display: 'block' }}>
          <FieldLabel htmlFor={fid('description')} state={get('description')}>Description</FieldLabel>
        </span>
        <DescriptionEditor id={fid('description')} labelledBy={fid('description-label')} initialValue={cohort.description ?? ''} onSave={html => save('description', html)} />
      </div>
      <div>
        <FieldLabel htmlFor={fid('includes')} state={get('includes')} hint="— one item per line">What is included</FieldLabel>
        <textarea id={fid('includes')} defaultValue={cohort.includes ?? ''} rows={6} style={{ ...inputStyle, resize: 'vertical' }}
          placeholder={'e.g.\nSix live Zoom sessions\nWeekly reflection guide\nCertificate of completion\n\nLeave empty to show the pathway’s standard list.'}
          onBlur={e => save('includes', lines(e.target.value))} />
      </div>
      <div>
        <FieldLabel htmlFor={fid('expectations')} state={get('expectations')} hint="— one item per line">Expectations</FieldLabel>
        <textarea id={fid('expectations')} defaultValue={cohort.expectations ?? ''} rows={5} style={{ ...inputStyle, resize: 'vertical' }}
          placeholder={'e.g.\nAttend live sessions\nComplete the weekly reflection\n\nLeave empty to show the standard expectations.'}
          onBlur={e => save('expectations', lines(e.target.value))} />
      </div>
    </div>
  )
}

export function CohortReading({ panel, cohort }: CohortSectionProps) {
  const { get, track } = useSaveStates()
  const id = cohort.id
  const fid = (f: string) => `cohort-${id}-${f}`
  const [preview, setPreview] = useState(cohort.book_image_url ?? '')
  const [previewFailed, setPreviewFailed] = useState(false)

  const save = (field: 'book_title' | 'book_image_url' | 'book_purchase_url', raw: string, problem: string | null = null) => {
    const next = raw.trim() || null
    if (next === (cohort[field] ?? null)) return
    void track(field, async () => problem ?? panel.handleUpdateCohortField(id, { [field]: next }))
  }
  const previewOk = !!preview.trim() && !linkProblem(preview, true)

  return (
    <div style={gridStyle}>
      <p style={{ ...metaStyle, margin: 0, ...fullWidth }}>The book shown with this cohort on the registration page. Leave the title empty if there is no book.</p>
      <div style={fullWidth}>
        <FieldLabel htmlFor={fid('book_title')} state={get('book_title')}>Book title</FieldLabel>
        <input id={fid('book_title')} defaultValue={cohort.book_title ?? ''} placeholder="e.g. Atomic Habits" style={inputStyle}
          onBlur={e => save('book_title', e.target.value)} />
      </div>
      <div>
        <FieldLabel htmlFor={fid('book_image_url')} state={get('book_image_url')}>Cover image link</FieldLabel>
        <input id={fid('book_image_url')} type="url" defaultValue={cohort.book_image_url ?? ''} placeholder="https://…" style={inputStyle}
          onChange={e => { setPreview(e.target.value); setPreviewFailed(false) }}
          onBlur={e => save('book_image_url', e.target.value, linkProblem(e.target.value, true))} />
        {previewOk && (previewFailed
          ? <p style={{ color: '#b3261e', fontSize: '0.85rem', margin: '0.5rem 0 0' }}>The image could not be loaded. Check the link.</p>
          : (
            <div style={{ marginTop: '0.5rem', width: '90px', aspectRatio: '2/3', borderRadius: '3px', overflow: 'hidden', background: 'var(--mist)', border: '1px solid rgba(0,23,55,0.1)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- live preview of an arbitrary link the owner is typing */}
              <img src={preview.trim()} alt="Book cover preview" onError={() => setPreviewFailed(true)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
          ))}
      </div>
      <div>
        <FieldLabel htmlFor={fid('book_purchase_url')} state={get('book_purchase_url')}>Where to buy it</FieldLabel>
        <input id={fid('book_purchase_url')} type="url" defaultValue={cohort.book_purchase_url ?? ''} placeholder="https://…" style={inputStyle}
          onBlur={e => save('book_purchase_url', e.target.value, linkProblem(e.target.value))} />
      </div>
    </div>
  )
}
