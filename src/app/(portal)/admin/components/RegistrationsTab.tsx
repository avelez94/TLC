'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { friendlyError } from '@/lib/admin-errors'
import { formatDateET, formatDateTimeET } from '@/lib/business-time'
import {
  ENROLLMENT_ISSUE, PAYMENT_FILTERS, formatCents, issueIsOpen, paidCents, paymentAttentionItems, paymentState, stripeDashboardUrl,
  type PaymentRegistration, type PaymentTone,
} from '@/lib/payment-attention'
import type { AttentionItem } from '@/lib/attention-types'
import type { AdminPanel, RegistrationRow } from '../useAdminPanel'
import { InlineError } from './feedback'
import { cardStyle, helpStyle, inputStyle, labelStyle, linkButtonStyle, pageTitleStyle, secondaryButtonStyle, statusBadge } from './shared'
import { Detail, detailGrid, FilterBar, primaryButton } from './people/common'
import { postAdmin, usePaymentSettings, type PaymentSettings } from './payments/api'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Registration rows with the 2e payment columns (the admin list selects every column). */
type Reg = RegistrationRow & PaymentRegistration

const FILTERS = [
  { value: 'all', label: 'All' }, { value: 'pending', label: 'Pending' }, { value: 'confirmed', label: 'Confirmed' },
  { value: 'waitlist', label: 'Waitlist' }, { value: 'declined', label: 'Declined' },
]

const TONES: Record<PaymentTone | 'bad', React.CSSProperties> = {
  ok: { background: '#e8f5ec', color: '#14532d' },
  warn: { background: '#fff4e0', color: '#7a4a00', border: '1px solid #e8b860' },
  bad: { background: '#fdecea', color: '#8c1d18', border: '1px solid #f3b7b1' },
  muted: { background: 'rgba(0,23,55,0.06)', color: 'var(--slate)' },
}
const badge = (text: string, tone: PaymentTone) => (
  <span style={{ ...TONES[tone], fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '0.2rem 0.55rem', borderRadius: '2px', whiteSpace: 'nowrap' }}>{text}</span>
)

type Enrollment = { label: 'Enrolled' | 'Completed' | 'Withdrawn' | 'Not enrolled'; tone: PaymentTone }

export default function RegistrationsTab(panel: AdminPanel) {
  const { registrations: rawRegistrations, users, enrollments, cohorts, checkoutEnabled, paymentRequests } = panel
  const registrations = rawRegistrations as Reg[]
  const settings = usePaymentSettings()
  const [filter, setFilter] = useState('all')
  const [payFilter, setPayFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const accountFor = (reg: Reg) => {
    const email = reg.email.trim().toLowerCase()
    return users.find(u => (u.email ?? '').trim().toLowerCase() === email) ?? null
  }

  /** Whether the person is in the registration's cohort (independent of payment and of the registration's status). */
  const enrollmentOf = (reg: Reg): Enrollment => {
    const account = accountFor(reg)
    if (!account || !reg.cohort_id) return { label: 'Not enrolled', tone: 'muted' }
    const rows = enrollments.filter(e => e.user_id === account.id && e.cohort_id === reg.cohort_id)
    if (rows.some(e => e.status === 'active')) return { label: 'Enrolled', tone: 'ok' }
    if (rows.some(e => e.status === 'completed')) return { label: 'Completed', tone: 'ok' }
    if (rows.some(e => e.status === 'withdrawn')) return { label: 'Withdrawn', tone: 'warn' }
    return { label: 'Not enrolled', tone: 'muted' }
  }

  /** For a Confirmed registration: why the person has no current enrollment in its cohort (null when they do). */
  const accessProblem = (reg: Reg): string | null => {
    if (reg.status !== 'confirmed') return null
    if (!reg.cohort_id) return 'This registration is marked confirmed but has no cohort recorded, so there is no enrollment to match it to.'
    const account = accountFor(reg)
    if (!account) return 'No account uses this email address, so they are not enrolled in this cohort. They may have an account under a different email.'
    const rows = enrollments.filter(e => e.user_id === account.id && e.cohort_id === reg.cohort_id)
    if (rows.some(e => e.status !== 'withdrawn')) return null
    const who = account.full_name || account.email
    return rows.length
      ? `${who}'s account was withdrawn from this cohort, so they no longer have access to it.`
      : `${who} has an account, but it is not enrolled in this cohort.`
  }

  const attention = useMemo(() => {
    const items = paymentAttentionItems({ registrations, paymentRequests: [], cohorts, enrollments })
    const map = new Map<string, AttentionItem[]>()
    for (const it of items) {
      const id = it.href.split('id=')[1]
      if (id) map.set(id, [...(map.get(id) ?? []), it])
    }
    return map
  }, [registrations, cohorts, enrollments])
  const needsAttention = (r: Reg) => attention.has(r.id) || accessProblem(r) !== null

  // /admin/registrations?id=<registration id> opens that registration and scrolls to it.
  const linked = useRef<string | null>(null)
  useEffect(() => {
    if (panel.loading || linked.current) return
    const params = new URLSearchParams(window.location.search)
    // ?filter=review (from the dashboard) shows the registrations that need attention.
    if (params.get('filter') === 'review') {
      linked.current = 'filter'
      void Promise.resolve().then(() => { setFilter('all'); setPayFilter('attention') })
      return
    }
    const id = params.get('id')
    if (!id || !UUID_RE.test(id) || !registrations.some(r => r.id === id)) return
    linked.current = id
    void Promise.resolve().then(() => {
      setFilter('all'); setPayFilter('all'); setSearch(''); setExpanded(id)
      setTimeout(() => document.getElementById(`reg-row-${id}`)?.scrollIntoView({ block: 'start' }), 60)
    })
  }, [panel.loading, registrations])

  const flagged = registrations.filter(r => accessProblem(r) !== null).length
  const paymentFlagged = registrations.filter(r => attention.has(r.id)).length
  const q = search.trim().toLowerCase()
  const payTest = payFilter === 'all' ? null : payFilter === 'attention' ? needsAttention : PAYMENT_FILTERS.find(f => f.value === payFilter)?.test ?? null
  const visible = registrations
    .filter(r => filter === 'all' || r.status === filter)
    .filter(r => !payTest || payTest(r))
    .filter(r => !q || [r.full_name, r.email, r.organization ?? ''].some(v => (v ?? '').toLowerCase().includes(q)))
  const openRequests = paymentRequests.filter(p => ['open', 'partially_paid', 'failed'].includes(p.status)).length

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
      <p style={helpStyle}>
        Select a registration to see its details. Each one shows three separate things: the <strong>payment</strong> (what happened with money, recorded only from Stripe or by you),
        your <strong>decision</strong> (pending, confirmed, waitlist, declined) and whether they are <strong>enrolled</strong> in the cohort.
        Earlier programs were free, so those show “Free (no charge)”.
        {settings && checkoutEnabled && <> A payment {settings.enrollOnPayment === 'automatic' ? 'enrolls the person automatically when a seat is free' : 'does not enroll anyone: you confirm each paid registration'}.</>}
        {openRequests > 0 && <> Organization payment requests are on each inquiry ({openRequests} awaiting payment).</>}
      </p>
      {paymentFlagged > 0 && (
        <p role="status" style={{ ...helpStyle, color: '#8c1d18', fontWeight: 600 }}>
          {paymentFlagged} registration{paymentFlagged === 1 ? ' has a payment that needs' : 's have payments that need'} your attention. Use the “Needs attention” filter.
        </p>
      )}
      {flagged > 0 && (
        <p role="status" style={{ ...helpStyle, color: '#7a4a00', fontWeight: 600 }}>
          {flagged} confirmed registration{flagged === 1 ? ' needs' : 's need'} review: marked confirmed, but the person is not enrolled in that cohort. Look for “Confirmed, not enrolled”.
        </p>
      )}

      <FilterBar label="Show registrations" value={filter} onChange={setFilter}
        options={FILTERS.map(f => ({ value: f.value, label: `${f.label} (${f.value === 'all' ? registrations.length : registrations.filter(r => r.status === f.value).length})` }))} />
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <div style={{ flex: '1 1 260px', maxWidth: '420px' }}>
          <label htmlFor="reg-search" style={labelStyle}>Search by name, email or organization</label>
          <input id="reg-search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, email or organization" style={inputStyle} />
        </div>
        <div style={{ flex: '0 1 280px' }}>
          <label htmlFor="reg-pay" style={labelStyle}>Payment</label>
          <select id="reg-pay" value={payFilter} onChange={e => setPayFilter(e.target.value)} style={inputStyle}>
            <option value="all">All payments ({registrations.length})</option>
            <option value="attention">Needs attention ({registrations.filter(needsAttention).length})</option>
            {PAYMENT_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label} ({registrations.filter(f.test).length})</option>)}
          </select>
        </div>
      </div>

      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        {visible.length === 0 ? (
          <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--slate)', fontSize: '0.92rem', margin: 0 }}>
            {registrations.length === 0 ? 'No registrations on record.' : 'No registrations match this filter.'}
          </p>
        ) : visible.map(reg => {
          const open = expanded === reg.id
          const problem = accessProblem(reg)
          const pay = paymentState(reg)
          const enr = enrollmentOf(reg)
          const issues = attention.get(reg.id) ?? []
          return (
            <div key={reg.id} id={`reg-row-${reg.id}`} style={{ scrollMarginTop: '80px' }}>
              <button type="button" aria-expanded={open} aria-controls={`reg-${reg.id}`} onClick={() => setExpanded(open ? null : reg.id)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', padding: '1rem 1.25rem', background: open ? 'var(--paper)' : 'white', border: 'none', borderBottom: '1px solid var(--mist)', borderLeft: issues.some(i => i.severity === 'urgent') ? '4px solid #b3261e' : issues.length ? '4px solid var(--gold)' : '4px solid transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-montserrat), sans-serif' }}>
                <span style={{ minWidth: 0, flex: '1 1 220px' }}>
                  <span style={{ display: 'block', fontWeight: 600, color: 'var(--navy)', fontSize: '0.95rem' }}>{reg.full_name}</span>
                  <span style={{ display: 'block', color: 'var(--slate)', fontSize: '0.85rem' }}>
                    {[reg.programs?.name, reg.cohorts?.name].filter(Boolean).join(' — ') || 'No program recorded'} · {formatDateET(reg.created_at)}
                  </span>
                </span>
                <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  {issues.length > 0 && badge(issues[0].severity === 'urgent' ? 'Needs attention' : 'Action needed', issues[0].severity === 'urgent' ? 'bad' : 'warn')}
                  {problem && badge('Confirmed, not enrolled — review', 'warn')}
                  <span title="Payment">{badge(pay.label, pay.tone)}</span>
                  <span title="Decision">{statusBadge(reg.status)}</span>
                  {reg.cohort_id && <span title="Enrollment">{badge(enr.label, enr.tone)}</span>}
                  <span aria-hidden="true" style={{ color: 'var(--slate)', fontSize: '0.8rem' }}>{open ? '▲' : '▼'}</span>
                </span>
              </button>
              {open && <div id={`reg-${reg.id}`}><RegistrationDetail panel={panel} reg={reg} problem={problem} issues={issues} enrollment={enr} settings={settings} /></div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const ISSUE_CAN_BE_REVIEWED = new Set(['refund_review', 'amount_mismatch', 'enrollment_failed', 'cohort_full', 'cohort_unavailable'])

function RegistrationDetail({ panel, reg, problem, issues, enrollment, settings }: {
  panel: AdminPanel; reg: Reg; problem: string | null; issues: AttentionItem[]; enrollment: Enrollment; settings: PaymentSettings | null
}) {
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [compOpen, setCompOpen] = useState(false)
  const [reason, setReason] = useState('')
  const cohortName = reg.cohorts?.name ?? (reg.cohort_id ? panel.cohortName(reg.cohort_id) : null)
  const pay = paymentState(reg)
  const cents = paidCents(reg)
  const ps = reg.payment_status ?? 'unpaid'
  const mode = settings?.stripeMode ?? 'live'
  const approver = reg.complimentary_approved_by ? panel.users.find(u => u.id === reg.complimentary_approved_by) : null

  const act = async (key: string, body: Record<string, unknown>, after?: () => void) => {
    setError(null); setBusy(key)
    const r = await postAdmin(`/api/admin/registrations/${reg.id}`, body)
    setBusy(null)
    if (!r.ok) { setError(r.message); panel.fail(r.message); return false }
    panel.ok(r.message)
    after?.()
    await panel.fetchAll()
    return true
  }

  const confirmAndInvite = async () => {
    setError(null)
    const unpaid = ['unpaid', 'failed', 'expired', 'pending'].includes(ps) && !!reg.stripe_session_id
    const yes = await panel.confirm({
      title: `Confirm ${reg.full_name} and give access?`,
      message: `This gives ${reg.email} access to ${cohortName ?? 'the cohort'}.`,
      consequences: [
        `Payment on record: ${pay.label}.${unpaid ? ' They have NOT completed a payment; confirm only if that is intended (mark the place complimentary if it is free on purpose).' : ''}`,
        `If no account uses ${reg.email}, an account is created and they are emailed a link to set their password.`,
        'If they already have an account, it is enrolled in the cohort and they are emailed to sign in.',
        'The registration is then marked Confirmed. If the cohort is full, nothing changes.',
      ],
      confirmLabel: 'Confirm and give access',
    })
    if (!yes) return
    setBusy('confirm')
    const msg = await panel.handleConfirmAndInvite(reg)
    // A seat problem is settled once they are enrolled; refunds and amount checks stay open.
    if (!msg && reg.enrollment_issue && ['cohort_full', 'cohort_unavailable', 'enrollment_failed'].includes(reg.enrollment_issue)) {
      await postAdmin(`/api/admin/registrations/${reg.id}`, { action: 'resolve_issue', note: 'Settled by Confirm and give access' })
      await panel.fetchAll()
    }
    setBusy(null)
    if (msg) setError(msg)
  }

  const setStatus = async (status: 'waitlist' | 'declined') => {
    setError(null)
    const paid = ['paid', 'partially_refunded'].includes(ps) && (cents ?? 0) > 0
    const yes = await panel.confirm(status === 'waitlist'
      ? { title: `Move ${reg.full_name} to the waitlist?`, consequences: ['The registration is marked Waitlist.', 'No email is sent and no access is given.', 'You can confirm it later.', ...(paid ? ['Their payment is kept. Refund it in Stripe if they will not get a place.'] : [])], confirmLabel: 'Move to waitlist' }
      : { title: `Decline ${reg.full_name}'s registration?`, consequences: ['The registration is marked Declined and kept for your records.', 'No email is sent; let them know yourself if needed.', 'You can still confirm it later.', ...(paid ? [`They paid ${formatCents(cents)}. Declining does not refund it: refund it in Stripe.`] : [])], confirmLabel: 'Decline', danger: true })
    if (!yes) return
    setBusy(status)
    const msg = await panel.handleUpdateRegistrationStatus(reg.id, status)
    setBusy(null)
    if (msg) setError(msg)
  }

  const resolveIssue = async () => {
    const info = reg.enrollment_issue ? ENROLLMENT_ISSUE[reg.enrollment_issue] : null
    const yes = await panel.confirm({
      title: 'Mark this as reviewed?',
      message: info?.title,
      consequences: ['The flag is removed from this registration and from Needs your attention.', 'Nothing else changes: payment, decision and enrollment stay as they are.'],
      confirmLabel: 'Mark reviewed',
    })
    if (yes) await act('resolve', { action: 'resolve_issue' })
  }

  const markComplimentary = async () => {
    if (!reason.trim()) { setError('Give the reason for the complimentary place.'); return }
    await act('comp', { action: 'complimentary', reason: reason.trim() }, () => { setCompOpen(false); setReason('') })
  }

  const openIssue = issueIsOpen(reg) ? reg.enrollment_issue : null
  const canComp = ['unpaid', 'expired', 'failed'].includes(ps)
  // Re-reading Stripe helps when a payment is not (fully) recorded; not for settled or free history.
  const canSync = !!reg.stripe_session_id && (['unpaid', 'pending', 'failed', 'expired'].includes(ps) || (ps === 'paid' && (cents ?? 0) > 0 && !reg.receipt_url))

  return (
    <div style={{ padding: '1.25rem', background: 'var(--paper)', borderBottom: '1px solid var(--mist)' }}>
      {issues.map(it => (
        <div key={it.id} role="note" style={{ background: it.severity === 'urgent' ? '#fdecea' : '#fff4e0', border: `1px solid ${it.severity === 'urgent' ? '#f3b7b1' : '#e8b860'}`, borderRadius: '4px', padding: '0.85rem 1rem', marginBottom: '1rem', color: it.severity === 'urgent' ? '#6b1510' : '#5c3800', fontSize: '0.9rem', lineHeight: 1.6 }}>
          <strong>{it.title}.</strong> {it.detail}
          {openIssue && ISSUE_CAN_BE_REVIEWED.has(openIssue) && it.id.startsWith('payment-issue:') && (
            <div style={{ marginTop: '0.5rem' }}>
              <button type="button" onClick={resolveIssue} disabled={busy !== null} style={linkButtonStyle}>{busy === 'resolve' ? 'Saving…' : 'Mark reviewed'}</button>
            </div>
          )}
        </div>
      ))}
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
            <Detail label="Decision">{statusBadge(reg.status)}</Detail>
            <Detail label="Enrollment">{reg.cohort_id ? enrollment.label : 'No cohort'}</Detail>
          </div>

          <div style={{ background: 'white', border: '1px solid var(--mist)', borderRadius: '4px', padding: '1rem 1.1rem', marginBottom: '1.25rem' }}>
            <span style={labelStyle}>Payment</span>
            <div style={{ ...detailGrid, marginBottom: 0 }}>
              <Detail label="Status">{badge(pay.label, pay.tone)}</Detail>
              {reg.paid_at && <Detail label="Paid on">{formatDateTimeET(reg.paid_at)}</Detail>}
              {(reg.amount_refunded_cents ?? 0) > 0 && <Detail label="Refunded">{formatCents(reg.amount_refunded_cents, reg.currency ?? 'usd')}{reg.refunded_at ? ` · ${formatDateET(reg.refunded_at)}` : ''}</Detail>}
              {ps === 'complimentary' && <Detail label="Complimentary">{reg.complimentary_reason ?? 'No reason recorded'}{approver ? ` · approved by ${approver.full_name || approver.email}` : ''}</Detail>}
              {reg.payment_error && <Detail label="What Stripe said">{reg.payment_error}</Detail>}
              {(reg.receipt_url || reg.stripe_payment_intent_id) && (
                <Detail label="Records">
                  {reg.receipt_url && <><a href={reg.receipt_url} target="_blank" rel="noreferrer noopener" style={{ color: '#8a5a10' }}>Stripe receipt</a><br /></>}
                  {reg.stripe_payment_intent_id && <a href={stripeDashboardUrl('payment', reg.stripe_payment_intent_id, mode)} target="_blank" rel="noreferrer noopener" style={{ color: '#8a5a10' }}>Open in Stripe{mode === 'test' ? ' (test mode)' : ''}</a>}
                </Detail>
              )}
              {(reg.confirmation_email_sent_at || reg.owner_notified_at) && (
                <Detail label="Emails">
                  Their confirmation: {reg.confirmation_email_sent_at ? `sent ${formatDateTimeET(reg.confirmation_email_sent_at)}` : 'not recorded'}<br />
                  Your notification: {reg.owner_notified_at ? `sent ${formatDateTimeET(reg.owner_notified_at)}` : 'not recorded'}
                </Detail>
              )}
            </div>
            <p style={{ ...helpStyle, fontSize: '0.82rem', margin: '0.75rem 0 0' }}>
              Payments are recorded only from Stripe. Refunds are made in Stripe and recorded here automatically; a refund never removes anyone from a cohort.
            </p>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
              {canComp && !compOpen && <button type="button" onClick={() => { setError(null); setCompOpen(true) }} disabled={busy !== null} style={linkButtonStyle}>Mark as complimentary…</button>}
              {ps === 'complimentary' && <button type="button" disabled={busy !== null} style={linkButtonStyle}
                onClick={async () => { if (await panel.confirm({ title: 'Remove the complimentary status?', consequences: ['The payment shows “Not paid” again.', 'Their enrollment (if any) is not changed.'], confirmLabel: 'Remove' })) await act('uncomp', { action: 'remove_complimentary' }) }}>
                {busy === 'uncomp' ? 'Saving…' : 'Remove complimentary'}</button>}
              {canSync && <button type="button" onClick={() => act('sync', { action: 'sync' })} disabled={busy !== null} style={linkButtonStyle}>{busy === 'sync' ? 'Checking Stripe…' : 'Check payment in Stripe'}</button>}
            </div>
            {compOpen && (
              <div style={{ marginTop: '0.75rem', maxWidth: '520px' }}>
                <label htmlFor={`comp-${reg.id}`} style={labelStyle}>Reason for the complimentary place</label>
                <input id={`comp-${reg.id}`} value={reason} maxLength={300} onChange={e => setReason(e.target.value)} placeholder="For example: scholarship, partner organization, speaker" style={inputStyle} />
                <p style={{ ...helpStyle, fontSize: '0.82rem', margin: '0.4rem 0 0.6rem' }}>Records that the place is free on purpose, and that you approved it. It does not enroll them: confirm them as usual.</p>
                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <button type="button" onClick={markComplimentary} disabled={busy !== null} className="btn btn-primary" style={primaryButton}>{busy === 'comp' ? 'Saving…' : 'Mark complimentary'}</button>
                  <button type="button" onClick={() => { setCompOpen(false); setReason('') }} disabled={busy !== null} style={{ ...secondaryButtonStyle, fontSize: '0.85rem', minHeight: '44px' }}>Cancel</button>
                </div>
              </div>
            )}
          </div>

          {reg.why && <div style={{ marginBottom: '1.25rem' }}><Detail label="Why they want to join"><span style={{ whiteSpace: 'pre-wrap' }}>{reg.why}</span></Detail></div>}

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
