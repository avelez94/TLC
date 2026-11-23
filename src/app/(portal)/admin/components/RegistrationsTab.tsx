'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { friendlyError } from '@/lib/admin-errors'
import { formatDateET, formatDateTimeET } from '@/lib/business-time'
import type { AdminPanel, RegistrationRow } from '../useAdminPanel'
import { InlineError } from './feedback'
import { cardStyle, helpStyle, inputStyle, labelStyle, pageTitleStyle, secondaryButtonStyle, statusBadge } from './shared'
import { Detail, detailGrid, FilterBar, primaryButton } from './people/common'

const FILTERS = [
  { value: 'all', label: 'All' }, { value: 'pending', label: 'Pending' }, { value: 'confirmed', label: 'Confirmed' },
  { value: 'waitlist', label: 'Waitlist' }, { value: 'declined', label: 'Declined' },
]

const badge = (text: string, tone: 'ok' | 'muted' | 'warn') => {
  const s = tone === 'ok' ? { background: '#e8f5ec', color: '#14532d' } : tone === 'warn' ? { background: '#fff4e0', color: '#7a4a00', border: '1px solid #e8b860' } : { background: 'rgba(0,23,55,0.06)', color: 'var(--slate)' }
  return <span style={{ ...s, fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '0.2rem 0.55rem', borderRadius: '2px', whiteSpace: 'nowrap' }}>{text}</span>
}

export default function RegistrationsTab(panel: AdminPanel) {
  const { registrations, users, enrollments, checkoutEnabled } = panel
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  /** For a Confirmed registration: why the person has no current enrollment in its cohort (null when they do). */
  const accessProblem = (reg: RegistrationRow): string | null => {
    if (reg.status !== 'confirmed') return null
    if (!reg.cohort_id) return 'This registration is marked confirmed but has no cohort recorded, so there is no enrollment to match it to.'
    const email = reg.email.trim().toLowerCase()
    const account = users.find(u => (u.email ?? '').trim().toLowerCase() === email)
    if (!account) return 'No account uses this email address, so they are not enrolled in this cohort. They may have an account under a different email.'
    const rows = enrollments.filter(e => e.user_id === account.id && e.cohort_id === reg.cohort_id)
    if (rows.some(e => e.status !== 'withdrawn')) return null
    const who = account.full_name || account.email
    return rows.length
      ? `${who}'s account was withdrawn from this cohort, so they no longer have access to it.`
      : `${who} has an account, but it is not enrolled in this cohort.`
  }

  const flagged = registrations.filter(r => accessProblem(r) !== null).length
  const q = search.trim().toLowerCase()
  const visible = registrations
    .filter(r => filter === 'all' || r.status === filter)
    .filter(r => !q || [r.full_name, r.email, r.organization ?? ''].some(v => (v ?? '').toLowerCase().includes(q)))

  return (
    <div>
      <span style={labelStyle}>People</span>
      <h1 style={pageTitleStyle}>Registration history</h1>
      {!checkoutEnabled && (
        <div style={{ ...cardStyle, borderLeft: '4px solid var(--gold)', padding: '1rem 1.25rem' }}>
          <p style={{ margin: 0, color: 'var(--ink)', fontSize: '0.92rem', lineHeight: 1.6 }}>
            Online registration is off, so no new registrations arrive here. New interest comes in through{' '}
            <Link href="/admin/inquiries" style={{ color: '#8a5a10', fontWeight: 600 }}>Inquiries</Link>. These are past registrations, kept for your records.
          </p>
        </div>
      )}
      <p style={helpStyle}>Select a registration to see its details. Earlier programs were free, so checkout shows whether the person finished the sign-up steps, not a payment.</p>
      {flagged > 0 && (
        <p role="status" style={{ ...helpStyle, color: '#7a4a00', fontWeight: 600 }}>
          {flagged} confirmed registration{flagged === 1 ? ' needs' : 's need'} review: marked confirmed, but the person is not enrolled in that cohort. Look for “Confirmed, not enrolled”.
        </p>
      )}

      <FilterBar label="Show registrations" value={filter} onChange={setFilter}
        options={FILTERS.map(f => ({ value: f.value, label: `${f.label} (${f.value === 'all' ? registrations.length : registrations.filter(r => r.status === f.value).length})` }))} />
      <div style={{ marginBottom: '1.25rem', maxWidth: '420px' }}>
        <label htmlFor="reg-search" style={labelStyle}>Search by name, email or organization</label>
        <input id="reg-search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, email or organization" style={inputStyle} />
      </div>

      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        {visible.length === 0 ? (
          <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--slate)', fontSize: '0.92rem', margin: 0 }}>
            {registrations.length === 0 ? 'No registrations on record.' : 'No registrations match this filter.'}
          </p>
        ) : visible.map(reg => {
          const open = expanded === reg.id
          const problem = accessProblem(reg)
          return (
            <div key={reg.id}>
              <button type="button" aria-expanded={open} aria-controls={`reg-${reg.id}`} onClick={() => setExpanded(open ? null : reg.id)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', padding: '1rem 1.25rem', background: open ? 'var(--paper)' : 'white', border: 'none', borderBottom: '1px solid var(--mist)', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-montserrat), sans-serif' }}>
                <span style={{ minWidth: 0, flex: '1 1 220px' }}>
                  <span style={{ display: 'block', fontWeight: 600, color: 'var(--navy)', fontSize: '0.95rem' }}>{reg.full_name}</span>
                  <span style={{ display: 'block', color: 'var(--slate)', fontSize: '0.85rem' }}>
                    {[reg.programs?.name, reg.cohorts?.name].filter(Boolean).join(' — ') || 'No program recorded'} · {formatDateET(reg.created_at)}
                  </span>
                </span>
                <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  {problem && badge('Confirmed, not enrolled — review', 'warn')}
                  {reg.payment_status === 'paid' ? badge('Checkout completed', 'ok') : badge('Checkout not completed', 'muted')}
                  {statusBadge(reg.status)}
                  <span aria-hidden="true" style={{ color: 'var(--slate)', fontSize: '0.8rem' }}>{open ? '▲' : '▼'}</span>
                </span>
              </button>
              {open && <div id={`reg-${reg.id}`}><RegistrationDetail panel={panel} reg={reg} problem={problem} /></div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RegistrationDetail({ panel, reg, problem }: { panel: AdminPanel; reg: RegistrationRow; problem: string | null }) {
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const cohortName = reg.cohorts?.name ?? (reg.cohort_id ? panel.cohortName(reg.cohort_id) : null)

  const confirmAndInvite = async () => {
    setError(null)
    const yes = await panel.confirm({
      title: `Confirm ${reg.full_name} and give access?`,
      message: `This gives ${reg.email} access to ${cohortName ?? 'the cohort'}.`,
      consequences: [
        `If no account uses ${reg.email}, an account is created and they are emailed a link to set their password.`,
        'If they already have an account, it is enrolled in the cohort and they are emailed to sign in.',
        'The registration is then marked Confirmed. If the cohort is full, nothing changes.',
      ],
      confirmLabel: 'Confirm and give access',
    })
    if (!yes) return
    setBusy('confirm')
    const msg = await panel.handleConfirmAndInvite(reg)
    setBusy(null)
    if (msg) setError(msg)
  }

  const setStatus = async (status: 'waitlist' | 'declined') => {
    setError(null)
    const yes = await panel.confirm(status === 'waitlist'
      ? { title: `Move ${reg.full_name} to the waitlist?`, consequences: ['The registration is marked Waitlist.', 'No email is sent and no access is given.', 'You can confirm it later.'], confirmLabel: 'Move to waitlist' }
      : { title: `Decline ${reg.full_name}'s registration?`, consequences: ['The registration is marked Declined and kept for your records.', 'No email is sent; let them know yourself if needed.', 'You can still confirm it later.'], confirmLabel: 'Decline', danger: true })
    if (!yes) return
    setBusy(status)
    const msg = await panel.handleUpdateRegistrationStatus(reg.id, status)
    setBusy(null)
    if (msg) setError(msg)
  }

  return (
    <div style={{ padding: '1.25rem', background: 'var(--paper)', borderBottom: '1px solid var(--mist)' }}>
      {problem && (
        <div role="note" style={{ background: '#fff4e0', border: '1px solid #e8b860', borderRadius: '4px', padding: '0.85rem 1rem', marginBottom: '1.25rem', color: '#5c3800', fontSize: '0.9rem', lineHeight: 1.6 }}>
          <strong>Confirmed, not enrolled — review.</strong> {problem} Nothing has been changed automatically. Check with the person; to give them access, enroll them from{' '}
          <Link href="/admin/users" style={{ color: '#7a4a00', fontWeight: 600 }}>Participants</Link>.
        </div>
      )}

      {editing ? (
        <EditRegistration panel={panel} reg={reg} onDone={() => setEditing(false)} />
      ) : (
        <>
          <div style={detailGrid}>
            <Detail label="Email"><a href={`mailto:${reg.email}`} style={{ color: '#8a5a10' }}>{reg.email}</a></Detail>
            {reg.phone && <Detail label="Phone"><a href={`tel:${reg.phone}`} style={{ color: '#8a5a10' }}>{reg.phone}</a></Detail>}
            {reg.organization && <Detail label="Organization">{reg.organization}</Detail>}
            <Detail label="Program">{reg.programs?.name ?? 'Not recorded'}</Detail>
            <Detail label="Cohort">{cohortName ?? 'Not recorded'}</Detail>
            <Detail label="Submitted">{formatDateTimeET(reg.created_at)}</Detail>
            <Detail label="Checkout">{reg.payment_status === 'paid' ? 'Completed' : 'Not completed'}</Detail>
            {reg.amount_paid != null && <Detail label="Amount recorded">${Number(reg.amount_paid).toFixed(2)}</Detail>}
            {(reg.confirmation_email_sent_at || reg.owner_notified_at) && (
              <Detail label="Emails">
                Their confirmation: {reg.confirmation_email_sent_at ? `sent ${formatDateTimeET(reg.confirmation_email_sent_at)}` : 'not recorded'}<br />
                Your notification: {reg.owner_notified_at ? `sent ${formatDateTimeET(reg.owner_notified_at)}` : 'not recorded'}
              </Detail>
            )}
            {reg.why && <div style={{ gridColumn: '1 / -1' }}><Detail label="Why they want to join"><span style={{ whiteSpace: 'pre-wrap' }}>{reg.why}</span></Detail></div>}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {reg.status !== 'confirmed' && (
              <button type="button" onClick={confirmAndInvite} disabled={busy !== null || !reg.cohort_id} className="btn btn-primary" style={primaryButton}>
                {busy === 'confirm' ? 'Confirming…' : 'Confirm and give access'}
              </button>
            )}
            {reg.status !== 'confirmed' && reg.status !== 'waitlist' && (
              <button type="button" onClick={() => setStatus('waitlist')} disabled={busy !== null} style={{ ...secondaryButtonStyle, fontSize: '0.85rem', minHeight: '44px' }}>
                {busy === 'waitlist' ? 'Saving…' : 'Waitlist'}
              </button>
            )}
            {reg.status !== 'confirmed' && reg.status !== 'declined' && (
              <button type="button" onClick={() => setStatus('declined')} disabled={busy !== null} style={{ ...secondaryButtonStyle, fontSize: '0.85rem', minHeight: '44px', color: '#b3261e', borderColor: 'rgba(179,38,30,0.35)' }}>
                {busy === 'declined' ? 'Saving…' : 'Decline'}
              </button>
            )}
            <button type="button" onClick={() => { setError(null); setEditing(true) }} disabled={busy !== null} style={{ ...secondaryButtonStyle, fontSize: '0.85rem', minHeight: '44px' }}>Edit details</button>
          </div>
          {reg.status !== 'confirmed' && !reg.cohort_id && (
            <p style={{ ...helpStyle, fontSize: '0.85rem', margin: '0.6rem 0 0' }}>This registration has no cohort. Choose one with Edit details before confirming.</p>
          )}
          {reg.status === 'confirmed' && (
            <p style={{ ...helpStyle, fontSize: '0.85rem', margin: '0.6rem 0 0' }}>This registration is confirmed. To change their access, use their record in Participants (enroll or withdraw).</p>
          )}
          <InlineError message={error} />
        </>
      )}
    </div>
  )
}

function EditRegistration({ panel, reg, onDone }: { panel: AdminPanel; reg: RegistrationRow; onDone: () => void }) {
  const [form, setForm] = useState({ full_name: reg.full_name ?? '', email: reg.email ?? '', phone: reg.phone ?? '', organization: reg.organization ?? '', cohort_id: reg.cohort_id ?? '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cohortOptions = panel.cohorts.filter(c => !reg.program_id || c.program_id === reg.program_id || c.id === reg.cohort_id)
  const set = (patch: Partial<typeof form>) => { setForm(f => ({ ...f, ...patch })); setError(null) }

  const save = async () => {
    setError(null)
    const next = {
      full_name: form.full_name.trim(), email: form.email.trim().toLowerCase(),
      phone: form.phone.trim() || null, organization: form.organization.trim() || null, cohort_id: form.cohort_id || null,
    }
    if (!next.full_name) { setError('The name cannot be empty.'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.email)) { setError('Enter a valid email address.'); return }
    const patch: Record<string, string | null> = {}
    if (next.full_name !== reg.full_name) patch.full_name = next.full_name
    if (next.email !== (reg.email ?? '').trim().toLowerCase()) patch.email = next.email
    if (next.phone !== (reg.phone ?? null)) patch.phone = next.phone
    if (next.organization !== (reg.organization ?? null)) patch.organization = next.organization
    if (next.cohort_id !== (reg.cohort_id ?? null)) patch.cohort_id = next.cohort_id
    if (Object.keys(patch).length === 0) { onDone(); return }
    setSaving(true)
    let msg: string | null = null
    try {
      const { error: dbError } = await supabase.from('registrations').update(patch).eq('id', reg.id)
      if (dbError) msg = friendlyError(dbError)
    } catch (e) { msg = friendlyError({ message: e instanceof Error ? e.message : String(e) }) }
    if (msg) {
      setSaving(false)
      setError(msg)
      panel.fail(`The registration was not saved: ${msg}`)
      await panel.logFailure('registration.update', 'registration', reg.id, reg.full_name, msg)
      return
    }
    panel.ok('Registration details saved.')
    await panel.fetchAll()
    setSaving(false)
    onDone()
  }

  const field = (key: 'full_name' | 'email' | 'phone' | 'organization', label: string, type = 'text') => (
    <div>
      <label htmlFor={`reg-${reg.id}-${key}`} style={labelStyle}>{label}</label>
      <input id={`reg-${reg.id}-${key}`} type={type} value={form[key]} onChange={e => set({ [key]: e.target.value })} style={inputStyle} />
    </div>
  )

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
        {field('full_name', 'Name')}
        {field('email', 'Email', 'email')}
        {field('phone', 'Phone', 'tel')}
        {field('organization', 'Organization')}
        <div style={{ gridColumn: '1 / -1' }}>
          <label htmlFor={`reg-${reg.id}-cohort`} style={labelStyle}>Cohort</label>
          <select id={`reg-${reg.id}-cohort`} value={form.cohort_id} onChange={e => set({ cohort_id: e.target.value })} style={inputStyle}>
            <option value="">No cohort</option>
            {cohortOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <p style={{ ...helpStyle, fontSize: '0.85rem', margin: '0.4rem 0 0' }}>This changes the record only. It does not enroll or withdraw anyone.</p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button type="button" onClick={save} disabled={saving} className="btn btn-primary" style={primaryButton}>{saving ? 'Saving…' : 'Save changes'}</button>
        <button type="button" onClick={onDone} disabled={saving} style={{ ...secondaryButtonStyle, fontSize: '0.85rem', minHeight: '44px' }}>Cancel</button>
      </div>
      <InlineError message={error} />
    </div>
  )
}
