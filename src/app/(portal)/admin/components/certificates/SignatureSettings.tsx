'use client'

// Certificate signature (Certificates → Signature). The stylized signature is set in a script
// typeface from the text typed here; it is not a reproduction of anyone's handwriting. It applies
// only to certificates issued after it is approved: each certificate keeps the signature it was
// issued with, so changing or approving the design never alters certificates already issued.
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { AdminPanel } from '../../useAdminPanel'
import { InlineError } from '../feedback'
import { cardStyle, helpStyle, inputStyle, labelStyle, secondaryButtonStyle } from '../shared'

export const SIGNATURE_STYLES = [
  { value: 'great-vibes', label: 'Great Vibes (classic)' },
  { value: 'pinyon-script', label: 'Pinyon Script (formal)' },
  { value: 'alex-brush', label: 'Alex Brush (easiest to read)' },
] as const

export interface CertificateSignature {
  approved: boolean
  signature_text: string
  signer_name: string
  signer_title: string | null
  font: string
  updated_at?: string
}

/** Reads the signature setting (administrators only). `null` while loading or if it cannot be read. */
export function useCertificateSignature() {
  const [value, setValue] = useState<CertificateSignature | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    const { data, error: e } = await supabase.rpc('admin_certificate_signature')
    if (e) { setError('The certificate signature setting could not be loaded.'); return }
    setError(null)
    setValue(data as CertificateSignature)
  }, [])
  useEffect(() => { void Promise.resolve().then(load) }, [load])
  return { value, error, reload: load, setValue }
}

/** One line for the cohort completion section: what new certificates will carry. */
export function SignatureNote({ signature }: { signature: CertificateSignature | null }) {
  if (!signature) return null
  return (
    <p style={{ ...helpStyle, fontSize: '0.84rem', margin: '0.5rem 0' }}>
      {signature.approved
        ? <>New certificates carry the approved signature of <strong>{signature.signer_name}</strong>{signature.signer_title ? `, ${signature.signer_title}` : ''}. </>
        : <>New certificates use the current design without a signature until the signature design is approved. </>}
      <Link href="/admin/certificates#signature" style={{ color: '#8a5a10', fontWeight: 600 }}>Certificate signature settings</Link>
    </p>
  )
}

const previewHref = (f: { signature_text: string; signer_name: string; signer_title: string; font: string }) =>
  `/api/admin/certificate-preview?${new URLSearchParams({ text: f.signature_text, name: f.signer_name, title: f.signer_title, font: f.font })}`

export default function SignatureSettings({ panel }: { panel: AdminPanel }) {
  const { value, error: loadError, setValue } = useCertificateSignature()
  const [form, setForm] = useState<{ signature_text: string; signer_name: string; signer_title: string; font: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const current = form ?? (value ? { signature_text: value.signature_text, signer_name: value.signer_name, signer_title: value.signer_title ?? '', font: value.font } : null)
  const dirty = !!(form && value && (form.signature_text !== value.signature_text || form.signer_name !== value.signer_name || form.signer_title !== (value.signer_title ?? '') || form.font !== value.font))

  const save = async (approved: boolean) => {
    if (!current) return
    setError(null)
    if (approved && !value?.approved) {
      const yes = await panel.confirm({
        title: 'Use this signature on new certificates?',
        message: `${current.signature_text} · ${current.signer_name}${current.signer_title ? `, ${current.signer_title}` : ''}`,
        consequences: [
          'Only do this after Tramaine has approved the design.',
          'Every certificate issued from now on carries this signature.',
          'Certificates already issued keep the design they were issued with.',
        ],
        confirmLabel: 'Tramaine approved it: use it',
      })
      if (!yes) return
    }
    if (!approved && value?.approved) {
      const yes = await panel.confirm({
        title: 'Stop using the signature on new certificates?',
        consequences: ['New certificates go back to the design without a signature.', 'Certificates already issued do not change.'],
        confirmLabel: 'Stop using it',
      })
      if (!yes) return
    }
    setBusy(true)
    const { data, error: e } = await supabase.rpc('admin_set_certificate_signature', {
      p_signature_text: current.signature_text, p_signer_name: current.signer_name, p_signer_title: current.signer_title,
      p_font: current.font, p_approved: approved,
    })
    setBusy(false)
    if (e) { setError(e.message || 'The signature could not be saved.'); return }
    setValue(data as CertificateSignature)
    setForm(null)
    panel.ok(approved ? (value?.approved ? 'Signature saved. New certificates use it.' : 'Signature approved. New certificates use it from now on.') : 'Signature saved. New certificates do not use it until it is approved.')
  }

  const field = (key: 'signature_text' | 'signer_name' | 'signer_title', label: string, hint: string, max: number) => (
    <div>
      <label htmlFor={`sig-${key}`} style={labelStyle}>{label}</label>
      <input id={`sig-${key}`} value={current?.[key] ?? ''} maxLength={max} aria-describedby={`sig-${key}-hint`}
        onChange={e => setForm({ ...current!, [key]: e.target.value })} style={inputStyle} disabled={!current} />
      <p id={`sig-${key}-hint`} style={{ ...helpStyle, fontSize: '0.78rem', margin: '0.25rem 0 0' }}>{hint}</p>
    </div>
  )

  return (
    <section id="signature" aria-labelledby="signature-title" style={{ ...cardStyle, marginBottom: '1.5rem', scrollMarginTop: '1rem' }}>
      <h2 id="signature-title" style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.4rem', letterSpacing: '0.04em', color: 'var(--navy)', margin: '0 0 0.35rem' }}>Certificate signature</h2>
      <p style={{ ...helpStyle, margin: '0 0 0.75rem' }}>
        The signature is the name below set in a script typeface, not a copy of a handwritten signature.
        Status: <strong style={{ color: value?.approved ? '#14532d' : '#8a5a10' }}>{value ? (value.approved ? 'Approved: used on new certificates' : 'Not approved yet: new certificates have no signature') : 'Loading…'}</strong>.
        Certificates already issued never change.
      </p>
      <InlineError message={loadError} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '0.85rem' }}>
        {field('signature_text', 'Signature (script)', 'Shown in the script typeface above the line.', 80)}
        {field('signer_name', 'Printed name', 'Printed under the line.', 120)}
        {field('signer_title', 'Title', 'Printed under the name.', 160)}
        <div>
          <label htmlFor="sig-font" style={labelStyle}>Signature style</label>
          <select id="sig-font" value={current?.font ?? 'great-vibes'} disabled={!current} onChange={e => setForm({ ...current!, font: e.target.value })} style={inputStyle}>
            {SIGNATURE_STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>
      <InlineError message={error} />
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '1rem' }}>
        {current && (
          <a href={previewHref(current)} target="_blank" rel="noopener" style={{ ...secondaryButtonStyle, minHeight: '44px', display: 'inline-flex', alignItems: 'center', textDecoration: 'none', whiteSpace: 'normal' }}>
            Preview certificate (PDF)
          </a>
        )}
        {value?.approved
          ? <>
              <button type="button" className="btn btn-primary" disabled={busy || !dirty} onClick={() => void save(true)} style={{ minHeight: '44px', whiteSpace: 'normal' }}>Save changes</button>
              <button type="button" disabled={busy} onClick={() => void save(false)} style={{ ...secondaryButtonStyle, minHeight: '44px' }}>Stop using the signature</button>
            </>
          : <>
              <button type="button" disabled={busy || !dirty} onClick={() => void save(false)} style={{ ...secondaryButtonStyle, minHeight: '44px' }}>Save draft</button>
              <button type="button" className="btn btn-primary" disabled={busy || !current} onClick={() => void save(true)} style={{ minHeight: '44px', whiteSpace: 'normal', lineHeight: 1.3, textAlign: 'center' }}>Tramaine approved it: use it</button>
            </>}
      </div>
      <p style={{ ...helpStyle, fontSize: '0.8rem', margin: '0.6rem 0 0' }}>The preview uses a sample participant. Changes are recorded in Security &amp; activity.</p>
    </section>
  )
}
