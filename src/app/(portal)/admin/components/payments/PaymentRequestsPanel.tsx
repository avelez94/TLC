'use client'

// Payment requests for one inquiry (usually an organization paying for several seats).
// Three ways to be paid: a single-use Stripe payment link you send yourself, a Stripe invoice
// that Stripe emails to the payer, or an offline arrangement (check, bank transfer) you mark
// paid when it arrives. Amounts are typed by you; nothing is priced automatically. Paying a
// request never enrolls anyone: enroll their participants from the inquiry when ready.
import { useMemo, useState } from 'react'
import type { AdminPanel, PaymentRequestRow } from '../../useAdminPanel'
import { formatDateET, todayET } from '@/lib/business-time'
import {
  METHOD_LABEL, PAYMENT_REQUEST_LABEL, formatCents, isOverdue, outstandingCents, parseDollarsToCents, paymentRequestStripeKind, stripeDashboardUrl,
} from '@/lib/payment-attention'
import { InlineError } from '../feedback'
import { helpStyle, inputStyle, labelStyle, linkButtonStyle, secondaryButtonStyle, sectionTitleStyle } from '../shared'
import { primaryButton } from '../people/common'
import { postAdmin, usePaymentSettings } from './api'

export interface PaymentRequestsPanelProps {
  panel: AdminPanel
  inquiryId: string
  payerName: string
  payerEmail: string | null
  seatsHint?: string | null
}

type Method = 'payment_link' | 'invoice' | 'offline'
const METHOD_HELP: Record<Method, string> = {
  payment_link: 'Creates a single-use Stripe payment link. Nothing is emailed: copy the link and send it to the payer yourself.',
  invoice: 'Creates a Stripe invoice and Stripe emails it to the payer, with a page to pay by card or bank transfer. Needs their email and a due date.',
  offline: 'No Stripe. For a check or bank transfer arranged directly: mark it paid when the money arrives.',
}
const TONE: Record<string, React.CSSProperties> = {
  paid: { background: '#e8f5ec', color: '#14532d' },
  partially_paid: { background: '#fff4e0', color: '#7a4a00' },
  failed: { background: '#fdecea', color: '#8c1d18' },
  refunded: { background: '#fff4e0', color: '#7a4a00' },
  partially_refunded: { background: '#fff4e0', color: '#7a4a00' },
}
const pill = (status: string, label: string) => (
  <span style={{ ...(TONE[status] ?? { background: 'rgba(0,23,55,0.06)', color: 'var(--navy)' }), fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '0.2rem 0.55rem', borderRadius: '2px', whiteSpace: 'nowrap' }}>{label}</span>
)
const firstNumber = (s: string | null | undefined) => {
  const m = s?.match(/\d{1,3}/)
  const n = m ? Number(m[0]) : NaN
  return Number.isInteger(n) && n >= 1 && n <= 500 ? String(n) : ''
}

export default function PaymentRequestsPanel({ panel, inquiryId, payerName, payerEmail, seatsHint }: PaymentRequestsPanelProps) {
  const settings = usePaymentSettings()
  const rows = useMemo(() => panel.paymentRequests.filter(p => p.inquiry_id === inquiryId), [panel.paymentRequests, inquiryId])
  const [creating, setCreating] = useState(false)

  const owed = rows.reduce((n, r) => n + outstandingCents(r), 0)
  const collected = rows.reduce((n, r) => n + Math.max(0, r.amount_paid_cents - r.amount_refunded_cents), 0)

  return (
    <section aria-label="Payments" style={{ marginTop: '1rem' }}>
      <h3 style={{ ...sectionTitleStyle, fontSize: '1.1rem' }}>Payments</h3>
      {rows.length > 0 && (
        <p style={{ ...helpStyle, fontSize: '0.85rem', margin: '0 0 0.75rem' }}>
          {formatCents(collected)} received · {formatCents(owed)} outstanding. A payment does not enroll anyone: add their participants from this inquiry when you are ready.
        </p>
      )}
      {rows.length === 0 && !creating && <p style={{ ...helpStyle, fontSize: '0.85rem', margin: '0 0 0.75rem' }}>No payment requests for this inquiry yet.</p>}
      {rows.map(r => <RequestRow key={r.id} panel={panel} row={r} mode={settings?.stripeMode ?? 'live'} />)}
      {creating
        ? <CreateRequest panel={panel} inquiryId={inquiryId} payerName={payerName} payerEmail={payerEmail} seatsHint={seatsHint} stripeWrites={settings?.stripeWrites ?? false} onDone={() => setCreating(false)} />
        : <button type="button" onClick={() => setCreating(true)} style={{ ...secondaryButtonStyle, fontSize: '0.85rem', minHeight: '44px', marginTop: '0.25rem' }}>New payment request</button>}
      {settings?.stripeMode === 'test' && <p style={{ ...helpStyle, fontSize: '0.8rem', margin: '0.6rem 0 0' }}>Stripe is in test mode on this site: links and invoices are not real.</p>}
    </section>
  )
}

function RequestRow({ panel, row, mode }: { panel: AdminPanel; row: PaymentRequestRow; mode: 'test' | 'live' | 'unconfigured' }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [paying, setPaying] = useState(false)
  const [form, setForm] = useState({ amount: '', date: todayET(), note: '' })
  const kind = paymentRequestStripeKind(row.stripe_object_id)
  const overdue = isOverdue(row)
  const remaining = outstandingCents(row)
  const cohort = row.cohort_id ? panel.cohortName(row.cohort_id) : null
  const unpaid = ['draft', 'open', 'failed', 'expired'].includes(row.status)

  const act = async (key: string, body: Record<string, unknown>) => {
    setError(null); setBusy(key)
    const r = await postAdmin(`/api/admin/payment-requests/${row.id}`, body)
    setBusy(null)
    if (!r.ok) { setError(r.message); panel.fail(r.message); await panel.fetchAll(); return false }
    panel.ok(r.message)
    await panel.fetchAll()
    return true
  }

  const cancel = async () => {
    const yes = await panel.confirm({
      title: `Cancel this payment request?`, message: `${row.description} — ${formatCents(row.amount_cents, row.currency)}`,
      consequences: [
        row.method === 'invoice' && row.stripe_object_id ? 'The invoice is voided in Stripe; the payer can no longer pay it.' : row.method === 'payment_link' && row.stripe_object_id ? 'The payment link is switched off in Stripe.' : 'The request is marked cancelled.',
        'The record is kept for your history.', 'Nothing is refunded (nothing was paid).',
      ],
      confirmLabel: 'Cancel request', cancelLabel: 'Keep it', danger: true,
    })
    if (yes) await act('void', { action: 'void' })
  }

  const markPaid = async () => {
    const cents = form.amount.trim() ? parseDollarsToCents(form.amount) : remaining
    if (!cents) { setError('Enter the amount received, for example 1,250.00.'); return }
    if (!form.note.trim()) { setError('Add a note saying how it was paid (for example “Check #1042”).'); return }
    const yes = await panel.confirm({
      title: `Record ${formatCents(cents)} received?`, message: `${row.payer_name} — ${row.description}`,
      consequences: [`Recorded as paid on ${formatDateET(form.date)} with your note.`, cents < remaining ? `${formatCents(remaining - cents)} stays outstanding.` : 'The request is marked Paid.', 'Nothing is sent to the payer and nobody is enrolled.'],
      confirmLabel: 'Record payment',
    })
    if (yes && await act('paid', { action: 'mark_paid', amount_cents: cents, paid_on: form.date, note: form.note.trim() })) setPaying(false)
  }

  const copy = async () => {
    if (!row.stripe_url) return
    try { await navigator.clipboard.writeText(row.stripe_url); panel.ok('Payment link copied.') } catch { panel.fail('Could not copy; select the link and copy it yourself.') }
  }

  return (
    <div style={{ border: '1px solid var(--mist)', borderLeft: `4px solid ${row.status === 'failed' || overdue ? '#b3261e' : row.status === 'paid' ? '#2e7d4f' : 'var(--gold)'}`, borderRadius: '4px', padding: '0.85rem 1rem', marginBottom: '0.75rem', background: 'white' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
        <div style={{ minWidth: 0 }}>
          <strong style={{ color: 'var(--navy)' }}>{row.description}</strong>
          <div style={{ color: 'var(--slate)', fontSize: '0.85rem' }}>
            {formatCents(row.amount_cents, row.currency)} · {METHOD_LABEL[row.method] ?? row.method}{row.seats ? ` · ${row.seats} seat${row.seats === 1 ? '' : 's'}` : ''}{cohort ? ` · ${cohort}` : ''} · {row.payer_name}{row.payer_email ? ` (${row.payer_email})` : ''}
          </div>
        </div>
        <span style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {overdue && pill('failed', 'Overdue')}
          {pill(row.status, PAYMENT_REQUEST_LABEL[row.status] ?? row.status)}
        </span>
      </div>
      <div style={{ color: 'var(--ink)', fontSize: '0.85rem', marginTop: '0.4rem', lineHeight: 1.6 }}>
        {row.due_date && <>Due {formatDateET(row.due_date)}. </>}
        {row.amount_paid_cents > 0 && <>Received {formatCents(row.amount_paid_cents, row.currency)}{row.paid_at ? ` on ${formatDateET(row.paid_at)}` : ''}. </>}
        {row.amount_refunded_cents > 0 && <>Refunded {formatCents(row.amount_refunded_cents, row.currency)} (in Stripe). </>}
        {row.status === 'draft' && row.method !== 'offline' && <>Not sent: creating it in Stripe did not finish. </>}
        {row.status === 'failed' && <>The latest payment attempt failed{row.method === 'invoice' ? '; the invoice can still be paid' : ''}. Contact the payer. </>}
      </div>
      {row.notes && <p style={{ ...helpStyle, fontSize: '0.82rem', whiteSpace: 'pre-wrap', margin: '0.4rem 0 0' }}>{row.notes}</p>}

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.6rem', alignItems: 'center' }}>
        {row.stripe_url && unpaid && row.method === 'payment_link' && <button type="button" onClick={copy} style={linkButtonStyle}>Copy payment link</button>}
        {row.stripe_url && <a href={row.stripe_url} target="_blank" rel="noreferrer noopener" style={{ ...linkButtonStyle, display: 'inline' }}>{row.method === 'invoice' ? 'Invoice page' : 'Payment page'}</a>}
        {kind && row.stripe_object_id && <a href={stripeDashboardUrl(kind, row.stripe_object_id, mode)} target="_blank" rel="noreferrer noopener" style={{ ...linkButtonStyle, display: 'inline' }}>Open in Stripe{mode === 'test' ? ' (test)' : ''}</a>}
        {row.status === 'draft' && <button type="button" onClick={() => act('send', { action: 'send' })} disabled={busy !== null} style={linkButtonStyle}>{busy === 'send' ? 'Sending…' : row.method === 'invoice' ? 'Send invoice' : row.method === 'payment_link' ? 'Create link' : 'Open'}</button>}
        {row.stripe_object_id && row.status !== 'void' && <button type="button" onClick={() => act('refresh', { action: 'refresh' })} disabled={busy !== null} style={linkButtonStyle}>{busy === 'refresh' ? 'Checking Stripe…' : 'Refresh from Stripe'}</button>}
        {row.method === 'offline' && ['open', 'partially_paid', 'failed'].includes(row.status) && !paying && <button type="button" onClick={() => { setError(null); setPaying(true) }} disabled={busy !== null} style={linkButtonStyle}>Mark paid…</button>}
        {unpaid && <button type="button" onClick={cancel} disabled={busy !== null} style={{ ...linkButtonStyle, color: '#b3261e' }}>{busy === 'void' ? 'Cancelling…' : 'Cancel request'}</button>}
      </div>

      {paying && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginTop: '0.75rem' }}>
          <div>
            <label htmlFor={`pr-amt-${row.id}`} style={labelStyle}>Amount received ($)</label>
            <input id={`pr-amt-${row.id}`} inputMode="decimal" value={form.amount} placeholder={(remaining / 100).toFixed(2)} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label htmlFor={`pr-date-${row.id}`} style={labelStyle}>Received on</label>
            <input id={`pr-date-${row.id}`} type="date" value={form.date} max={todayET()} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label htmlFor={`pr-note-${row.id}`} style={labelStyle}>How it was paid</label>
            <input id={`pr-note-${row.id}`} value={form.note} maxLength={500} placeholder="For example: Check #1042 deposited" onChange={e => setForm(f => ({ ...f, note: e.target.value }))} style={inputStyle} />
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', gridColumn: '1 / -1' }}>
            <button type="button" onClick={markPaid} disabled={busy !== null} className="btn btn-primary" style={primaryButton}>{busy === 'paid' ? 'Saving…' : 'Record payment'}</button>
            <button type="button" onClick={() => setPaying(false)} disabled={busy !== null} style={{ ...secondaryButtonStyle, fontSize: '0.85rem', minHeight: '44px' }}>Cancel</button>
          </div>
        </div>
      )}
      <InlineError message={error} />
    </div>
  )
}

function CreateRequest({ panel, inquiryId, payerName, payerEmail, seatsHint, stripeWrites, onDone }: Omit<PaymentRequestsPanelProps, 'panel'> & { panel: AdminPanel; stripeWrites: boolean; onDone: () => void }) {
  const [form, setForm] = useState({
    method: (stripeWrites ? 'invoice' : 'offline') as Method, payer_name: payerName, payer_email: payerEmail ?? '', description: '', seats: firstNumber(seatsHint),
    amount: '', due_date: '', cohort_id: '', notes: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<typeof form>) => { setForm(f => ({ ...f, ...patch })); setError(null) }
  const cohorts = panel.cohorts.filter(c => ['draft', 'upcoming', 'active'].includes(c.status))

  const submit = async () => {
    const cents = parseDollarsToCents(form.amount)
    if (!form.payer_name.trim()) return setError('Enter who is paying.')
    if (!form.description.trim()) return setError('Enter what the payment is for (the payer sees this).')
    if (!cents || cents < 100) return setError('Enter the amount in dollars, for example 4,500.00.')
    if (form.seats && !/^\d+$/.test(form.seats)) return setError('Seats must be a whole number.')
    if (form.method === 'invoice' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.payer_email.trim())) return setError('An invoice is emailed by Stripe, so enter the payer’s email address.')
    if (form.method === 'invoice' && !form.due_date) return setError('Choose a due date for the invoice.')
    if (form.due_date && form.due_date < todayET()) return setError('The due date is in the past.')
    const yes = await panel.confirm({
      title: `${form.method === 'invoice' ? 'Send an invoice' : form.method === 'payment_link' ? 'Create a payment link' : 'Record an offline payment request'} for ${formatCents(cents)}?`,
      message: `${form.payer_name.trim()} — ${form.description.trim()}${form.seats ? ` (${form.seats} seats)` : ''}`,
      consequences: [
        form.method === 'invoice' ? `Stripe emails the invoice to ${form.payer_email.trim()} now${form.due_date ? `, due ${formatDateET(form.due_date)}` : ''}.`
          : form.method === 'payment_link' ? 'A single-use payment link is created in Stripe. Nothing is emailed: you send the link.'
          : 'Nothing is sent and Stripe is not used. Mark it paid when the money arrives.',
        'When it is paid, the payment is recorded here automatically (offline: by you). Nobody is enrolled automatically.',
        'Refunds, if ever needed, are made in Stripe.',
      ],
      confirmLabel: form.method === 'invoice' ? 'Send invoice' : form.method === 'payment_link' ? 'Create link' : 'Save',
    })
    if (!yes) return
    setBusy(true)
    const r = await postAdmin('/api/admin/payment-requests', {
      inquiry_id: inquiryId, method: form.method, payer_name: form.payer_name.trim(), payer_email: form.payer_email.trim() || null,
      description: form.description.trim(), seats: form.seats ? Number(form.seats) : null, amount_cents: cents,
      due_date: form.due_date || null, cohort_id: form.cohort_id || null, notes: form.notes.trim() || null,
    })
    setBusy(false)
    await panel.fetchAll()
    if (!r.ok) { setError(r.message); panel.fail(r.message); if ((r.data as { request?: unknown } | undefined)?.request) onDone(); return }
    panel.ok(r.message)
    onDone()
  }

  return (
    <div style={{ border: '1px solid var(--mist)', borderRadius: '4px', padding: '1rem', background: 'var(--paper)', marginTop: '0.25rem' }}>
      <fieldset style={{ border: 'none', padding: 0, margin: '0 0 0.75rem' }}>
        <legend style={labelStyle}>How will they pay?</legend>
        {!stripeWrites && <p style={{ ...helpStyle, fontSize: '0.84rem', margin: '0 0 0.6rem' }}>Stripe invoices and payment links are switched off while online payments are disabled, so nothing can be charged or invoiced from here. Offline payment requests still work.</p>}
        {(['invoice', 'payment_link', 'offline'] as Method[]).map(m => (
          <label key={m} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginBottom: '0.5rem', cursor: m === 'offline' || stripeWrites ? 'pointer' : 'not-allowed', fontSize: '0.9rem', color: 'var(--ink)', opacity: m === 'offline' || stripeWrites ? 1 : 0.55 }}>
            <input type="radio" name={`method-${inquiryId}`} checked={form.method === m} disabled={m !== 'offline' && !stripeWrites} onChange={() => set({ method: m })} style={{ marginTop: '0.25rem' }} />
            <span><strong>{METHOD_LABEL[m]}</strong><br /><span style={{ color: 'var(--slate)', fontSize: '0.84rem' }}>{METHOD_HELP[m]}</span></span>
          </label>
        ))}
      </fieldset>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
        <div>
          <label htmlFor={`prn-${inquiryId}`} style={labelStyle}>Payer (person or organization)</label>
          <input id={`prn-${inquiryId}`} value={form.payer_name} maxLength={160} onChange={e => set({ payer_name: e.target.value })} style={inputStyle} />
        </div>
        <div>
          <label htmlFor={`pre-${inquiryId}`} style={labelStyle}>Payer email{form.method === 'invoice' ? '' : ' (optional)'}</label>
          <input id={`pre-${inquiryId}`} type="email" value={form.payer_email} maxLength={254} onChange={e => set({ payer_email: e.target.value })} style={inputStyle} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label htmlFor={`prd-${inquiryId}`} style={labelStyle}>What it is for (the payer sees this)</label>
          <input id={`prd-${inquiryId}`} value={form.description} maxLength={300} placeholder="For example: The Impact Lab — New Leaders, Spring 2027" onChange={e => set({ description: e.target.value })} style={inputStyle} />
        </div>
        <div>
          <label htmlFor={`pra-${inquiryId}`} style={labelStyle}>Total amount ($)</label>
          <input id={`pra-${inquiryId}`} inputMode="decimal" value={form.amount} placeholder="0.00" onChange={e => set({ amount: e.target.value })} style={inputStyle} />
        </div>
        <div>
          <label htmlFor={`prs-${inquiryId}`} style={labelStyle}>Seats (optional)</label>
          <input id={`prs-${inquiryId}`} inputMode="numeric" value={form.seats} onChange={e => set({ seats: e.target.value })} style={inputStyle} />
        </div>
        <div>
          <label htmlFor={`prdue-${inquiryId}`} style={labelStyle}>Due date{form.method === 'invoice' ? '' : ' (optional)'}</label>
          <input id={`prdue-${inquiryId}`} type="date" min={todayET()} value={form.due_date} onChange={e => set({ due_date: e.target.value })} style={inputStyle} />
        </div>
        <div>
          <label htmlFor={`prc-${inquiryId}`} style={labelStyle}>Cohort (optional)</label>
          <select id={`prc-${inquiryId}`} value={form.cohort_id} onChange={e => set({ cohort_id: e.target.value })} style={inputStyle}>
            <option value="">Not decided</option>
            {cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label htmlFor={`prnotes-${inquiryId}`} style={labelStyle}>Private notes (optional)</label>
          <input id={`prnotes-${inquiryId}`} value={form.notes} maxLength={2000} onChange={e => set({ notes: e.target.value })} style={inputStyle} />
        </div>
      </div>
      <p style={{ ...helpStyle, fontSize: '0.82rem', margin: '0.6rem 0' }}>The amount is exactly what you type: there is no automatic pricing. Seats are for your records and appear on the payer’s description.</p>
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
        <button type="button" onClick={submit} disabled={busy} className="btn btn-primary" style={primaryButton}>{busy ? 'Working…' : form.method === 'invoice' ? 'Review and send invoice' : form.method === 'payment_link' ? 'Review and create link' : 'Review and save'}</button>
        <button type="button" onClick={onDone} disabled={busy} style={{ ...secondaryButtonStyle, fontSize: '0.85rem', minHeight: '44px' }}>Cancel</button>
      </div>
      <InlineError message={error} />
    </div>
  )
}
