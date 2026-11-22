import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { AdminPanel } from '../useAdminPanel'
import { cardStyle, inputStyle, labelStyle } from './shared'
import { displayedDollars } from '@/lib/checkout-pricing'

type ProgramRow = {
  id: string; name: string; type: string | null; slug?: string | null; pathway_number?: number | null
  tagline?: string | null; opening_statement?: string | null; audience?: string | null; description: string | null
  leadership_goal?: string | null; keywords?: string | null; price?: number | null; price_label?: string | null
  is_public?: boolean; enrollment_open?: boolean; session_day?: string | null; session_time?: string | null; duration_weeks?: number | null
}

// Limits match the database constraint (2c), so the public layout cannot be broken by an edit.
const FIELDS: { key: keyof ProgramRow; label: string; max: number; rows?: number; help?: string }[] = [
  { key: 'tagline', label: 'Tagline', max: 80, help: 'Short line under the name, e.g. “Prepare to Lead”.' },
  { key: 'opening_statement', label: 'Opening statement', max: 220, rows: 2 },
  { key: 'audience', label: 'Who it is for', max: 600, rows: 3 },
  { key: 'description', label: 'Description', max: 1500, rows: 4 },
  { key: 'leadership_goal', label: 'Development goal', max: 400, rows: 3 },
  { key: 'keywords', label: 'Focus areas (comma separated)', max: 160, help: 'Shown as tags, e.g. Supervision, Communication.' },
]
const DAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function PathwayEditor({ program, cohortCount, onSaved, showSuccess, logAction }: {
  program: ProgramRow; cohortCount: number; onSaved: () => void
  showSuccess: (m: string) => void; logAction: AdminPanel['logAction']
}) {
  const [form, setForm] = useState<ProgramRow>(program)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = <K extends keyof ProgramRow>(k: K, v: ProgramRow[K]) => setForm(f => ({ ...f, [k]: v }))

  const label = form.price_label?.trim() || ''
  const shown = displayedDollars(label)
  const mismatch = form.price != null && shown !== null && shown !== form.price

  const save = async () => {
    setError('')
    if (form.price != null && (!Number.isInteger(form.price) || form.price < 0 || form.price > 10000)) {
      setError('Price must be a whole-dollar amount between 0 and 10,000, or empty.')
      return
    }
    if (mismatch) {
      setError(`The price label shows $${shown} but the price is $${form.price}. Make them match; checkout refuses mismatched prices.`)
      return
    }
    setSaving(true)
    const patch = {
      tagline: form.tagline?.trim() || null, opening_statement: form.opening_statement?.trim() || null,
      audience: form.audience?.trim() || null, description: form.description?.trim() || null,
      leadership_goal: form.leadership_goal?.trim() || null, keywords: form.keywords?.trim() || null,
      price: form.price ?? null, price_label: label || null, is_public: !!form.is_public, enrollment_open: !!form.enrollment_open,
      session_day: form.session_day || null, session_time: form.session_time || null, duration_weeks: form.duration_weeks ?? null,
    }
    const { error: dbError } = await supabase.from('programs').update(patch).eq('id', program.id)
    if (dbError) setError(`Not saved: ${dbError.message}`)
    else {
      showSuccess(`${program.name} saved. Changes appear on the Impact Lab page right away.`)
      await logAction('program.update', 'program', program.id, { price: patch.price, price_label: patch.price_label, is_public: patch.is_public, enrollment_open: patch.enrollment_open })
      onSaved()
    }
    setSaving(false)
  }

  return (
    <div style={{ ...cardStyle, borderTop: '3px solid var(--gold)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'baseline', marginBottom: '1rem' }}>
        <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.5rem', color: 'var(--navy)', letterSpacing: '0.04em', margin: 0 }}>
          <span style={{ color: 'var(--gold)', marginRight: '0.5rem' }}>{String(program.pathway_number ?? '').padStart(2, '0')}</span>{program.name}
        </h3>
        <span style={{ fontSize: '0.75rem', color: 'var(--slate)' }}>{cohortCount} cohort{cohortCount === 1 ? '' : 's'} · page address /impact#{program.slug}</span>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.88rem', color: 'var(--ink)' }}>
          <input type="checkbox" checked={!!form.is_public} onChange={e => set('is_public', e.target.checked)} /> Show on the Impact Lab page
        </label>
        <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.88rem', color: 'var(--ink)' }}>
          <input type="checkbox" checked={!!form.enrollment_open} onChange={e => set('enrollment_open', e.target.checked)} /> Open for enrollment (shows the price label)
        </label>
      </div>

      <div style={{ display: 'grid', gap: '0.9rem' }}>
        {FIELDS.map(f => {
          const value = (form[f.key] as string | null | undefined) ?? ''
          return (
            <div key={f.key}>
              <label htmlFor={`${program.id}-${f.key}`} style={labelStyle}>{f.label} <span style={{ textTransform: 'none', letterSpacing: 0, color: value.length > f.max * 0.9 ? '#b3261e' : 'var(--slate)' }}>({value.length}/{f.max})</span></label>
              {f.rows
                ? <textarea id={`${program.id}-${f.key}`} rows={f.rows} maxLength={f.max} value={value} onChange={e => set(f.key, e.target.value as never)} style={{ ...inputStyle, resize: 'vertical' }} />
                : <input id={`${program.id}-${f.key}`} maxLength={f.max} value={value} onChange={e => set(f.key, e.target.value as never)} style={inputStyle} />}
              {f.help && <span style={{ fontSize: '0.72rem', color: 'var(--slate)' }}>{f.help}</span>}
            </div>
          )
        })}

        <div className="two-col-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.9rem' }}>
          <div>
            <label htmlFor={`${program.id}-price`} style={labelStyle}>Price charged (whole dollars)</label>
            <input id={`${program.id}-price`} type="number" min={0} max={10000} step={1} value={form.price ?? ''} onChange={e => set('price', e.target.value === '' ? null : Number(e.target.value))} placeholder="Not set" style={inputStyle} />
          </div>
          <div>
            <label htmlFor={`${program.id}-label`} style={labelStyle}>Price label shown to visitors</label>
            <input id={`${program.id}-label`} maxLength={60} value={label} onChange={e => set('price_label', e.target.value)} placeholder='e.g. "$450 per participant"' style={inputStyle} />
          </div>
          <div>
            <label htmlFor={`${program.id}-day`} style={labelStyle}>Default session day</label>
            <select id={`${program.id}-day`} value={form.session_day ?? ''} onChange={e => set('session_day', e.target.value)} style={inputStyle}>{DAYS.map(d => <option key={d} value={d}>{d || 'Not set'}</option>)}</select>
          </div>
          <div>
            <label htmlFor={`${program.id}-time`} style={labelStyle}>Default session time (ET)</label>
            <input id={`${program.id}-time`} type="time" value={form.session_time ?? ''} onChange={e => set('session_time', e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label htmlFor={`${program.id}-weeks`} style={labelStyle}>Length (weeks)</label>
            <input id={`${program.id}-weeks`} type="number" min={1} max={52} value={form.duration_weeks ?? ''} onChange={e => set('duration_weeks', e.target.value === '' ? null : Number(e.target.value))} style={inputStyle} />
          </div>
        </div>
        {mismatch && <p role="alert" style={{ color: '#b3261e', fontSize: '0.82rem', margin: 0 }}>The label shows ${shown} but the price is ${form.price}.</p>}
        <p style={{ fontSize: '0.75rem', color: 'var(--slate)', margin: 0 }}>Online payment stays closed until it is switched on for the site. Prices are never shown publicly unless “Open for enrollment” is checked.</p>
        {error && <p role="alert" style={{ color: '#b3261e', fontSize: '0.85rem', fontWeight: 600, margin: 0 }}>{error}</p>}
        <div><button onClick={save} disabled={saving} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>{saving ? 'Saving…' : 'Save pathway'}</button></div>
      </div>
    </div>
  )
}

export default function ProgramsTab({ programs, cohorts, enrollments, fetchAll, showSuccess, logAction }: AdminPanel) {
  const rows = programs as unknown as ProgramRow[]
  const pathways = rows.filter(p => p.slug).sort((a, b) => (a.pathway_number ?? 0) - (b.pathway_number ?? 0))
  const historical = rows.filter(p => !p.slug)
  const cohortCount = (id: string) => cohorts.filter(c => c.program_id === id).length

  return (
    <div>
      <span style={labelStyle}>Programs</span>
      <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', margin: '0.25rem 0 0.5rem' }}>Pathways &amp; Programs</h1>
      <p style={{ color: 'var(--slate)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>The three Impact Lab pathways are independent; participants choose the one that fits their role. Edit their wording, pricing and visibility here.</p>

      {pathways.length === 0 && <div style={{ ...cardStyle, color: 'var(--slate)' }}>The pathway records have not been added to the database yet. The public page is showing the approved default wording.</div>}
      {pathways.map(p => <PathwayEditor key={p.id} program={p} cohortCount={cohortCount(p.id)} onSaved={fetchAll} showSuccess={showSuccess} logAction={logAction} />)}

      {historical.length > 0 && (
        <div style={cardStyle}>
          <h2 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.3rem', color: 'var(--navy)', letterSpacing: '0.04em', margin: '0 0 0.5rem' }}>Historical programs</h2>
          <p style={{ color: 'var(--slate)', fontSize: '0.85rem', margin: '0 0 0.75rem' }}>Kept for past cohorts, registrations and certificates. Not offered on the public site.</p>
          {historical.map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', padding: '0.6rem 0', borderTop: '1px solid var(--mist)', fontSize: '0.88rem' }}>
              <span style={{ fontWeight: 600, color: 'var(--navy)' }}>{p.name} <span style={{ fontWeight: 400, color: 'var(--slate)' }}>· {p.type === 'coaching' ? 'Coaching' : 'Cohort program'}</span></span>
              <span style={{ color: 'var(--slate)' }}>{cohortCount(p.id)} cohorts · {enrollments.filter(e => cohorts.some(c => c.id === e.cohort_id && c.program_id === p.id)).length} enrollments</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
