'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { friendlyError } from '@/lib/admin-errors'
import { MAX_PROGRAM_PRICE_DOLLARS } from '@/lib/checkout-pricing'
import type { Program } from '@/types'
import type { AdminPanel } from '../useAdminPanel'
import { InlineError, SaveStatus, useSaveStates } from './feedback'
import { cardStyle, helpStyle, inputStyle, isPathway, labelStyle, pageTitleStyle, programChoices, secondaryButtonStyle, sectionTitleStyle, statusBadge } from './shared'

type TextKey = 'tagline' | 'opening_statement' | 'audience' | 'description' | 'leadership_goal' | 'keywords'

// Limits match the database constraint, so an edit cannot break the public layout.
const FIELDS: { key: TextKey; label: string; max: number; rows?: number; help?: string }[] = [
  { key: 'tagline', label: 'Tagline', max: 80, help: 'Short line under the name, for example “Prepare to Lead”.' },
  { key: 'opening_statement', label: 'Opening statement', max: 220, rows: 2 },
  { key: 'audience', label: 'Who it is for', max: 600, rows: 3 },
  { key: 'description', label: 'Description', max: 1500, rows: 5 },
  { key: 'leadership_goal', label: 'Development goal', max: 400, rows: 3 },
  { key: 'keywords', label: 'Focus areas (comma separated)', max: 160, help: 'Shown as tags, for example: Supervision, Communication, Feedback.' },
]
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const dollars = (n: number) => `$${n.toLocaleString('en-US')}`
const hhmm = (t: string | null | undefined) => (t ?? '').slice(0, 5)
const checkboxLabel = { display: 'flex', gap: '0.6rem', alignItems: 'center', fontSize: '0.95rem', fontWeight: 600, color: 'var(--navy)', cursor: 'pointer', minHeight: '44px' }
const checkboxInput = { width: '20px', height: '20px', accentColor: 'var(--navy)', cursor: 'pointer', flexShrink: 0 }

interface FormState {
  tagline: string; opening_statement: string; audience: string; description: string; leadership_goal: string; keywords: string
  price: string; session_day: string; session_time: string; duration_weeks: string
}

const formFrom = (p: Program): FormState => ({
  tagline: p.tagline ?? '', opening_statement: p.opening_statement ?? '', audience: p.audience ?? '',
  description: p.description ?? '', leadership_goal: p.leadership_goal ?? '', keywords: p.keywords ?? '',
  price: p.price == null ? '' : String(p.price), session_day: p.session_day ?? '', session_time: hhmm(p.session_time),
  duration_weeks: p.duration_weeks == null ? '' : String(p.duration_weeks),
})

/** The changed fields as a database patch, or an error message. */
function buildPatch(form: FormState, p: Program): { patch: Record<string, unknown>; error: string | null } {
  const patch: Record<string, unknown> = {}
  for (const f of FIELDS) {
    const next = form[f.key].trim()
    if (next.length > f.max) return { patch, error: `${f.label} is ${next.length} characters; the limit is ${f.max}.` }
    if ((next || null) !== ((p[f.key] as string | null | undefined)?.trim() || null)) patch[f.key] = next || null
  }

  const priceText = form.price.trim().replace(/[$,\s]/g, '')
  const storedPrice = p.price == null ? '' : String(p.price)
  if (priceText !== storedPrice) {
    if (priceText === '') { patch.price = null; patch.price_label = null }
    else {
      const n = Number(priceText)
      if (!/^\d+$/.test(priceText) || !Number.isInteger(n) || n < 0 || n > MAX_PROGRAM_PRICE_DOLLARS) {
        return { patch, error: `Enter the price as a whole number of dollars from 0 to ${MAX_PROGRAM_PRICE_DOLLARS.toLocaleString('en-US')}, or leave it empty.` }
      }
      patch.price = n
      patch.price_label = dollars(n)
    }
  }

  if ((form.session_day || null) !== (p.session_day || null)) patch.session_day = form.session_day || null
  if ((form.session_time || null) !== (hhmm(p.session_time) || null)) patch.session_time = form.session_time || null

  const weeksText = form.duration_weeks.trim()
  const storedWeeks = p.duration_weeks == null ? '' : String(p.duration_weeks)
  if (weeksText !== storedWeeks) {
    if (weeksText === '') patch.duration_weeks = null
    else {
      const w = Number(weeksText)
      if (!/^\d+$/.test(weeksText) || w < 1 || w > 52) return { patch, error: 'Length must be a whole number of weeks from 1 to 52, or empty.' }
      patch.duration_weeks = w
    }
  }
  return { patch, error: null }
}

function PathwayEditor({ panel, program }: { panel: AdminPanel; program: Program }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(() => formFrom(program))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)
  const [pending, setPending] = useState<{ is_public?: boolean; enrollment_open?: boolean }>({})
  const toggles = useSaveStates()

  const cohortCount = panel.cohorts.filter(c => c.program_id === program.id).length
  const isPublic = pending.is_public ?? !!program.is_public
  const enrollmentOpen = pending.enrollment_open ?? !!program.enrollment_open
  const liveOpen = !!program.enrollment_open && panel.checkoutEnabled
  const number = String(program.pathway_number ?? '').padStart(2, '0')
  const id = (k: string) => `pathway-${program.id}-${k}`

  const { patch, error: draftError } = buildPatch(form, program)
  const dirty = Object.keys(patch).length > 0 || !!draftError

  const set = (k: keyof FormState, v: string) => { setForm(f => ({ ...f, [k]: v })); setJustSaved(false) }

  // Price preview and stored-label check.
  const priceText = form.price.trim().replace(/[$,\s]/g, '')
  const priceChanged = priceText !== (program.price == null ? '' : String(program.price))
  const typedPrice = /^\d+$/.test(priceText) ? Number(priceText) : null
  const expectedLabel = program.price == null ? null : dollars(program.price)
  const storedLabel = program.price_label?.trim() || null
  const labelMismatch = storedLabel !== expectedLabel
  const visitorLabel = priceChanged ? (typedPrice != null ? dollars(typedPrice) : null) : storedLabel

  /** Saves one checkbox immediately, after a confirmation. */
  const saveToggle = async (field: 'is_public' | 'enrollment_open', value: boolean) => {
    if (field === 'is_public') {
      const ok = await panel.confirm(value ? {
        title: `Show ${program.name} on the Impact Lab page?`,
        message: 'This takes effect right away.',
        consequences: [
          'Visitors will see this pathway on the Impact Lab page, the registration page and the inquiry form.',
          liveOpen ? 'Enrollment is open, so visitors can register and see the price.' : 'Enrollment stays closed, so visitors are sent to the inquiry form and no price is shown.',
        ],
        confirmLabel: 'Show this pathway',
      } : {
        title: `Hide ${program.name}?`,
        message: 'This takes effect right away. Nothing is deleted.',
        consequences: [
          'The pathway is removed from the Impact Lab page, the registration page and the inquiry form.',
          'Its cohorts, participants, registrations and certificates are kept, and current participants keep their access.',
          'You can show it again at any time.',
        ],
        confirmLabel: 'Hide this pathway', danger: true,
      })
      if (!ok) return
    } else if (value) {
      const ok = await panel.confirm({
        title: `Open ${program.name} for enrollment?`,
        message: 'This takes effect right away.',
        consequences: panel.checkoutEnabled ? [
          `Visitors can register and pay online, and will see the price${storedLabel ? ` (${storedLabel})` : ''}.`,
          storedLabel ? 'Check that the price is correct before opening.' : 'No price is set yet. Set and save the price first.',
        ] : [
          'Online registration is currently off for the whole site, so visitors still see “enrollment closed” and are sent to the inquiry form.',
          'Once online registration is switched on, visitors will be able to register and see the price.',
        ],
        confirmLabel: 'Open for enrollment',
      })
      if (!ok) return
    }
    setPending(p => ({ ...p, [field]: value }))
    await toggles.track(field, async () => {
      const { error: dbError } = await supabase.from('programs').update({ [field]: value }).eq('id', program.id)
      if (dbError) {
        const msg = friendlyError(dbError)
        panel.fail(`${program.name} was not changed: ${msg}`)
        await panel.logFailure('program.update', 'program', program.id, program.name, msg)
        return msg
      }
      panel.ok(field === 'is_public'
        ? (value ? `${program.name} is now on the Impact Lab page.` : `${program.name} is hidden. Nothing was deleted.`)
        : (value ? `${program.name} is open for enrollment${panel.checkoutEnabled ? '' : ' (visitors still see “enrollment closed” until online registration is switched on)'}.` : `${program.name} is closed for enrollment.`))
      // Refresh site-wide pathway links (footer, contact form) right away.
      void fetch('/api/admin/revalidate-public', { method: 'POST' }).catch(() => {})
      await panel.fetchAll()
      return null
    })
    setPending(p => ({ ...p, [field]: undefined }))
  }

  const save = async () => {
    setError(null); setJustSaved(false)
    if (draftError) { setError(draftError); return }
    if (Object.keys(patch).length === 0) { setError('Nothing has changed yet.'); return }
    setSaving(true)
    let dbError: { message?: string; code?: string } | null = null
    try { ({ error: dbError } = await supabase.from('programs').update(patch).eq('id', program.id)) } catch (e) { dbError = { message: e instanceof Error ? e.message : String(e) } }
    if (dbError) {
      const msg = friendlyError(dbError)
      setError(`Not saved: ${msg}`)
      panel.fail(`${program.name} was not saved: ${msg}`)
      await panel.logFailure('program.update', 'program', program.id, program.name, msg)
      setSaving(false)
      return
    }
    // Show the saved (trimmed) values so the form matches what is stored.
    setForm(f => {
      const next = { ...f }
      for (const k of FIELDS.map(x => x.key)) if (k in patch) next[k] = (patch[k] as string | null) ?? ''
      if ('price' in patch) next.price = patch.price == null ? '' : String(patch.price)
      return next
    })
    panel.ok(isPublic ? `${program.name} saved. Changes appear on the Impact Lab page right away.` : `${program.name} saved. It is hidden, so visitors do not see it.`)
    void fetch('/api/admin/revalidate-public', { method: 'POST' }).catch(() => {})
    await panel.fetchAll()
    setSaving(false)
    setJustSaved(true)
  }

  return (
    <section style={{ ...cardStyle, borderTop: '3px solid var(--gold)', padding: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', padding: '1.1rem 1.25rem' }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.5rem', color: 'var(--navy)', letterSpacing: '0.04em', margin: '0 0 0.4rem' }}>
            <span style={{ color: '#8a5a10', marginRight: '0.5rem' }}>{number}</span>{program.name}
          </h2>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {program.is_public ? statusBadge('open', 'On the Impact Lab page') : statusBadge('draft', 'Hidden')}
            {liveOpen ? statusBadge('open', 'Open') : statusBadge('closed', 'Enrollment closed')}
            <span style={{ fontSize: '0.85rem', color: 'var(--slate)' }}>{cohortCount} cohort{cohortCount === 1 ? '' : 's'}</span>
          </div>
        </div>
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls={id('body')} style={{ ...secondaryButtonStyle, minHeight: '44px' }}>
          {open ? 'Close' : 'Edit pathway'} <span aria-hidden="true">{open ? '▲' : '▼'}</span>
        </button>
      </div>

      {open && (
        <div id={id('body')} style={{ padding: '0 1.25rem 1.25rem', borderTop: '1px solid var(--mist)' }}>
          <div style={{ display: 'grid', gap: '0.75rem', margin: '1rem 0 1.25rem' }}>
            <div>
              <label htmlFor={id('public')} style={checkboxLabel}>
                <input id={id('public')} type="checkbox" checked={isPublic} disabled={toggles.get('is_public').status === 'saving'} onChange={e => saveToggle('is_public', e.target.checked)} style={checkboxInput} />
                Show on the Impact Lab page
                <SaveStatus state={toggles.get('is_public')} />
              </label>
              <p style={{ ...helpStyle, margin: '0 0 0 1.85rem' }}>Hidden pathways are removed from the Impact Lab page, the registration page and the inquiry form. Nothing is deleted.</p>
            </div>
            <div>
              <label htmlFor={id('enroll')} style={checkboxLabel}>
                <input id={id('enroll')} type="checkbox" checked={enrollmentOpen} disabled={toggles.get('enrollment_open').status === 'saving'} onChange={e => saveToggle('enrollment_open', e.target.checked)} style={checkboxInput} />
                Open for enrollment
                <SaveStatus state={toggles.get('enrollment_open')} />
              </label>
              <p style={{ ...helpStyle, margin: '0 0 0 1.85rem' }}>
                Visitors can register and see the price only when this is on, the pathway has an Upcoming cohort that is fully set up, and online registration is on for the site.
                {!panel.checkoutEnabled && <> <strong style={{ color: 'var(--navy)' }}>Online registration is not on for the site yet, so visitors see “enrollment closed” and are sent to the inquiry form.</strong> <a href="/admin/launch" style={{ color: '#8a5a10', fontWeight: 600 }}>See what is missing in Launch readiness →</a></>}
              </p>
            </div>
          </div>

          <p style={helpStyle}>Wording below is saved when you press “Save pathway”. A field left empty shows the standard approved wording on the public page.</p>

          <div style={{ display: 'grid', gap: '1rem' }}>
            {FIELDS.map(f => {
              const value = form[f.key]
              const over = value.length > f.max
              return (
                <div key={f.key}>
                  <label htmlFor={id(f.key)} style={labelStyle}>
                    {f.label}{' '}
                    <span style={{ textTransform: 'none', letterSpacing: 0, color: value.length > f.max * 0.9 ? '#b3261e' : 'var(--slate)' }}>({value.length} of {f.max} characters)</span>
                  </label>
                  {f.rows
                    ? <textarea id={id(f.key)} rows={f.rows} maxLength={f.max} value={value} onChange={e => set(f.key, e.target.value)} aria-invalid={over} style={{ ...inputStyle, resize: 'vertical' }} />
                    : <input id={id(f.key)} maxLength={f.max} value={value} onChange={e => set(f.key, e.target.value)} aria-invalid={over} style={inputStyle} />}
                  {f.help && <p style={{ ...helpStyle, fontSize: '0.82rem', margin: '0.3rem 0 0' }}>{f.help}</p>}
                </div>
              )
            })}

            <div>
              <label htmlFor={id('price')} style={labelStyle}>Price per participant (US dollars, whole number)</label>
              <input id={id('price')} inputMode="numeric" value={form.price} onChange={e => set('price', e.target.value)} placeholder="Not set" style={{ ...inputStyle, maxWidth: '240px' }} />
              <p style={{ ...helpStyle, margin: '0.4rem 0 0' }}>
                {visitorLabel
                  ? <>Visitors will see: <strong style={{ color: 'var(--navy)' }}>{visitorLabel}</strong> — only while enrollment is open and online registration is on.</>
                  : <>No price is set, so visitors will not see a price.</>}
              </p>
              {labelMismatch && !priceChanged && (
                <p style={{ ...helpStyle, margin: '0.4rem 0 0', color: '#8a5a10' }}>
                  Currently stored label: <strong>{storedLabel ?? 'none'}</strong>. It does not match the price{expectedLabel ? ` (${expectedLabel})` : ''}. It is kept as it is unless you change the price above.
                </p>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              <div>
                <label htmlFor={id('day')} style={labelStyle}>Default session day</label>
                <select id={id('day')} value={form.session_day} onChange={e => set('session_day', e.target.value)} style={inputStyle}>
                  <option value="">Not set</option>
                  {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                  {form.session_day && !DAYS.includes(form.session_day) && <option value={form.session_day}>{form.session_day}</option>}
                </select>
              </div>
              <div>
                <label htmlFor={id('time')} style={labelStyle}>Default session time (ET)</label>
                <input id={id('time')} type="time" value={form.session_time} onChange={e => set('session_time', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label htmlFor={id('weeks')} style={labelStyle}>Length (weeks)</label>
                <input id={id('weeks')} type="number" inputMode="numeric" min={1} max={52} step={1} value={form.duration_weeks} onChange={e => set('duration_weeks', e.target.value)} placeholder="Not set" style={inputStyle} />
              </div>
            </div>
            <p style={{ ...helpStyle, margin: 0 }}>New cohorts of this pathway start with this day and time. Changing them does not change existing cohorts.</p>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="button" onClick={save} disabled={saving || !dirty} className="btn btn-primary" style={{ fontSize: '0.9rem', minHeight: '44px', opacity: saving || !dirty ? 0.6 : 1 }}>
                {saving ? 'Saving…' : 'Save pathway'}
              </button>
              {dirty && !saving && (
                <button type="button" onClick={() => { setForm(formFrom(program)); setError(null) }} style={{ ...secondaryButtonStyle, minHeight: '44px' }}>Discard changes</button>
              )}
              {dirty && !saving && <span style={{ fontSize: '0.85rem', color: '#8a5a10', fontWeight: 600 }}>You have unsaved changes.</span>}
              {!dirty && justSaved && <span role="status" style={{ fontSize: '0.85rem', color: '#14532d', fontWeight: 600 }}>Saved ✓</span>}
            </div>
            <InlineError message={error ?? (dirty ? draftError : null)} />
          </div>
        </div>
      )}
    </section>
  )
}

export default function ProgramsTab(panel: AdminPanel) {
  const { programs, cohorts, enrollments } = panel
  const pathways = programChoices(programs)
  const historical = programs.filter(p => !isPathway(p)).sort((a, b) => a.name.localeCompare(b.name))
  const [showHistory, setShowHistory] = useState(false)

  return (
    <div>
      <span style={labelStyle}>Programs</span>
      <h1 style={pageTitleStyle}>Pathways</h1>
      <p style={helpStyle}>
        The three Impact Lab pathways are independent: each participant chooses the one that fits their role. Edit each pathway&apos;s wording, whether it appears on the Impact Lab page, and its price here.
      </p>

      {pathways.length === 0 && <div style={{ ...cardStyle, color: 'var(--slate)' }}>The pathway records have not been added to the database yet. The public page is showing the approved default wording.</div>}
      {pathways.map(p => <PathwayEditor key={p.id} panel={panel} program={p} />)}

      {historical.length > 0 && (
        <section style={{ ...cardStyle, padding: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', padding: '1rem 1.25rem' }}>
            <div>
              <h2 style={{ ...sectionTitleStyle, margin: 0 }}>Historical programs (kept for records)</h2>
              <p style={{ ...helpStyle, margin: '0.25rem 0 0' }}>{historical.length} program{historical.length === 1 ? '' : 's'}. Not offered publicly.</p>
            </div>
            <button type="button" onClick={() => setShowHistory(s => !s)} aria-expanded={showHistory} aria-controls="historical-programs" style={{ ...secondaryButtonStyle, minHeight: '44px' }}>
              {showHistory ? 'Hide' : 'Show'} <span aria-hidden="true">{showHistory ? '▲' : '▼'}</span>
            </button>
          </div>
          {showHistory && (
            <div id="historical-programs" style={{ padding: '0 1.25rem 1rem', borderTop: '1px solid var(--mist)' }}>
              <p style={{ ...helpStyle, margin: '0.75rem 0' }}>
                These earlier programs are kept so past cohorts, registrations and certificates stay intact. They are not offered on the public site and cannot be edited here.
              </p>
              {historical.map(p => {
                const cohortIds = new Set(cohorts.filter(c => c.program_id === p.id).map(c => c.id))
                const enrollmentCount = enrollments.filter(e => cohortIds.has(e.cohort_id)).length
                return (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem 1rem', flexWrap: 'wrap', padding: '0.7rem 0', borderTop: '1px solid var(--mist)', fontSize: '0.92rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--navy)' }}>
                      {p.name} <span style={{ fontWeight: 400, color: 'var(--slate)' }}>· {p.type === 'coaching' ? 'Coaching' : 'Cohort program'}</span>
                    </span>
                    <span style={{ color: 'var(--slate)' }}>
                      {cohortIds.size} cohort{cohortIds.size === 1 ? '' : 's'} · {enrollmentCount} enrollment{enrollmentCount === 1 ? '' : 's'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
