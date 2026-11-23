'use client'

import { useEffect, useRef, useState } from 'react'
import type { Pathway } from '@/lib/pathways'
import { OPEN_INQUIRY_EVENT, type OpenInquiryDetail } from './inquiry-events'
import s from './impact.module.css'

type Kind = 'organization' | 'individual'
type Errors = Partial<Record<'contact_name' | 'organization' | 'email' | 'pathways' | 'form', string>>

const ORG_TYPES = ['Corporate / private sector', 'Government agency', 'Educational institution', 'Nonprofit', 'Other']
const PARTICIPANTS = ['1–5', '6–15', '16–30', '31+', 'Not sure yet']
const TIMELINES = ['Within 3 months', '3–6 months', '6–12 months', 'Exploring options']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export default function InquiryForm({ pathways }: { pathways: Pathway[] }) {
  const [kind, setKind] = useState<Kind>('organization')
  const [selected, setSelected] = useState<string[]>([])
  const [errors, setErrors] = useState<Errors>({})
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  // Buttons elsewhere on the page open the form for an audience and, optionally, a pathway.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const { kind: k, pathway } = (e as CustomEvent<OpenInquiryDetail>).detail
      setKind(k)
      if (pathway) setSelected([pathway])
      setErrors({})
      setDone(null)
    }
    window.addEventListener(OPEN_INQUIRY_EVENT, onOpen)
    // Links from other pages (e.g. /register while enrollment is closed) preset the form:
    // /impact?inquire=individual&pathway=new-leaders#inquire
    const q = new URLSearchParams(window.location.search)
    const k = q.get('inquire')
    if (k === 'individual' || k === 'organization') {
      const p = q.get('pathway')
      window.setTimeout(() => setKind(k), 0)
      if (p && pathways.some(x => x.slug === p)) window.setTimeout(() => setSelected([p]), 0)
    }
    return () => window.removeEventListener(OPEN_INQUIRY_EVENT, onOpen)
  }, [pathways])

  const toggle = (slug: string) =>
    setSelected(prev => (prev.includes(slug) ? prev.filter(p => p !== slug) : [...prev, slug]))

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const data = {
      kind,
      contact_name: String(f.get('contact_name') ?? '').trim(),
      organization: String(f.get('organization') ?? '').trim(),
      email: String(f.get('email') ?? '').trim(),
      phone: String(f.get('phone') ?? '').trim(),
      organization_type: String(f.get('organization_type') ?? ''),
      participants_estimate: String(f.get('participants_estimate') ?? ''),
      timeline: String(f.get('timeline') ?? ''),
      message: String(f.get('message') ?? '').trim(),
      pathways: selected,
      website: String(f.get('website') ?? ''),
    }
    const next: Errors = {}
    if (!data.contact_name) next.contact_name = 'Enter the name of the person we should contact.'
    if (kind === 'organization' && !data.organization) next.organization = 'Enter your organization’s name.'
    if (!EMAIL_RE.test(data.email)) next.email = 'Enter a valid email address, like name@organization.org.'
    if (selected.length === 0) next.pathways = 'Choose at least one pathway, or “Not sure yet”.'
    setErrors(next)
    if (Object.keys(next).length) {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [data-group-error="true"] input')?.focus()
      return
    }

    setSending(true)
    try {
      const res = await fetch('/api/inquiries', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErrors({ ...(body.fields ?? {}), form: body.error ?? 'Something went wrong. Please try again.' })
      } else {
        setDone(data.contact_name.split(' ')[0])
        formRef.current?.reset()
        setSelected([])
      }
    } catch {
      setErrors({ form: 'We could not reach the server. Check your connection and try again.' })
    }
    setSending(false)
  }

  if (done !== null) {
    return (
      <div className={s.status} role="status" tabIndex={-1} ref={el => el?.focus()}>
        <strong>Inquiry received</strong>
        Thank you, {done}. Tramaine will follow up with you personally at the email you provided.
        <div style={{ marginTop: '1rem' }}>
          <button type="button" className={`${s.btn} ${s.btnGhostDark}`} onClick={() => setDone(null)}>Send another inquiry</button>
        </div>
      </div>
    )
  }

  const invalid = (k: keyof Errors) => (errors[k] ? { 'aria-invalid': true as const, 'aria-describedby': `e-${k}` } : {})

  return (
    <>
      <div className={s.kindSwitch} role="group" aria-label="Who is inquiring">
        <button type="button" aria-pressed={kind === 'organization'} onClick={() => setKind('organization')}>For my organization</button>
        <button type="button" aria-pressed={kind === 'individual'} onClick={() => setKind('individual')}>For myself</button>
      </div>
      <form ref={formRef} className={s.form} onSubmit={submit} noValidate>
        <div className={s.row}>
          <div className={s.field}>
            <label className={s.label} htmlFor="inq-name">Contact name</label>
            <input className={s.input} id="inq-name" name="contact_name" autoComplete="name" maxLength={120} {...invalid('contact_name')} />
            {errors.contact_name && <span className={s.err} id="e-contact_name">{errors.contact_name}</span>}
          </div>
          <div className={s.field}>
            <label className={s.label} htmlFor="inq-org">Organization name {kind === 'individual' && <span className={s.opt}>(optional)</span>}</label>
            <input className={s.input} id="inq-org" name="organization" autoComplete="organization" maxLength={160} {...invalid('organization')} />
            {errors.organization && <span className={s.err} id="e-organization">{errors.organization}</span>}
          </div>
        </div>
        <div className={s.row}>
          <div className={s.field}>
            <label className={s.label} htmlFor="inq-email">{kind === 'organization' ? 'Work email' : 'Email'}</label>
            <input className={s.input} id="inq-email" name="email" type="email" autoComplete="email" maxLength={254} {...invalid('email')} />
            {errors.email && <span className={s.err} id="e-email">{errors.email}</span>}
          </div>
          <div className={s.field}>
            <label className={s.label} htmlFor="inq-phone">Phone <span className={s.opt}>(optional)</span></label>
            <input className={s.input} id="inq-phone" name="phone" type="tel" autoComplete="tel" maxLength={40} />
          </div>
        </div>
        {kind === 'organization' && (
          <div className={s.row}>
            <div className={s.field}>
              <label className={s.label} htmlFor="inq-type">Organization type <span className={s.opt}>(optional)</span></label>
              <select className={s.input} id="inq-type" name="organization_type" defaultValue=""><option value="">Select one</option>{ORG_TYPES.map(o => <option key={o}>{o}</option>)}</select>
            </div>
            <div className={s.field}>
              <label className={s.label} htmlFor="inq-count">Estimated participants <span className={s.opt}>(optional)</span></label>
              <select className={s.input} id="inq-count" name="participants_estimate" defaultValue=""><option value="">Select a range</option>{PARTICIPANTS.map(o => <option key={o}>{o}</option>)}</select>
            </div>
          </div>
        )}
        <fieldset className={s.fieldset} aria-describedby={errors.pathways ? 'e-pathways' : undefined} data-group-error={errors.pathways ? 'true' : undefined}>
          <legend className={s.label}>Interested pathway(s)</legend>
          <div className={s.checks}>
            {[...pathways.map(p => ({ value: p.slug, label: p.name })), { value: 'unsure', label: 'Not sure yet' }].map(o => (
              <label key={o.value} className={s.check}>
                <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)} />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
          {errors.pathways && <span className={s.err} id="e-pathways">{errors.pathways}</span>}
        </fieldset>
        <div className={s.field}>
          <label className={s.label} htmlFor="inq-time">Desired timeline <span className={s.opt}>(optional)</span></label>
          <select className={s.input} id="inq-time" name="timeline" defaultValue=""><option value="">Select one</option>{TIMELINES.map(o => <option key={o}>{o}</option>)}</select>
        </div>
        <div className={s.field}>
          <label className={s.label} htmlFor="inq-msg">Additional information <span className={s.opt}>(optional)</span></label>
          <textarea className={s.input} id="inq-msg" name="message" maxLength={4000} />
        </div>
        <div className={s.hp} aria-hidden="true"><label htmlFor="inq-website">Website</label><input id="inq-website" name="website" tabIndex={-1} autoComplete="off" /></div>
        {errors.form && <div className={`${s.status} ${s.statusError}`} role="alert">{errors.form}</div>}
        <div className={s.formFoot}>
          <p className={s.privacy}>Your information is used only to respond to this inquiry and is never shared or sold.</p>
          <button className={`${s.btn} ${s.btnGold}`} type="submit" disabled={sending}>{sending ? 'Sending…' : 'Send Inquiry'} <span className={s.arrow} aria-hidden="true">&rarr;</span></button>
        </div>
      </form>
    </>
  )
}
