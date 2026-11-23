'use client'

import { useState } from 'react'
import type { Profile } from '@/types'
import type { AdminPanel } from '../../useAdminPanel'
import { InlineError, SaveStatus, useSaveStates } from '../feedback'
import { helpStyle, inputStyle, labelStyle, sectionTitleStyle, secondaryButtonStyle } from '../shared'
import { primaryButton } from './common'

type ClientType = 'new' | 'existing'

/** Hourly rate (auto-saved) and the payment request for a coaching client. */
export default function CoachingBilling({ panel, user }: { panel: AdminPanel; user: Profile }) {
  const saves = useSaveStates()
  const [rate, setRate] = useState(user.hourly_rate != null ? String(user.hourly_rate) : '')
  const [clientType, setClientType] = useState<ClientType>('existing')
  const [hours, setHours] = useState('')
  const [sessions, setSessions] = useState('')
  const [minutes, setMinutes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paymentUrl, setPaymentUrl] = useState('')

  const saveRate = async () => {
    const saved = user.hourly_rate != null ? String(user.hourly_rate) : ''
    if (rate.trim() === saved) return
    await saves.track('rate', () => panel.handleUpdateHourlyRate(user.id, rate))
  }

  const isNew = clientType === 'new'
  const rateNum = parseFloat(rate) || 0
  const sessionsNum = parseInt(sessions, 10) || 0
  const minutesNum = parseInt(minutes, 10) || 0
  const hoursNum = parseFloat(hours) || 0
  const totalHours = isNew ? (sessionsNum * minutesNum) / 60 : hoursNum
  const amount = Math.round(rateNum * totalHours * 100) / 100

  const send = async () => {
    setError(null)
    if (!user.email) { setError('This person has no email address, so a payment request cannot be sent.'); return }
    if (!(rateNum > 0)) { setError('Enter the hourly rate first.'); return }
    if (isNew && (!(sessionsNum > 0) || !(minutesNum > 0))) { setError('Enter the number of sessions and the minutes per session.'); return }
    if (!isNew && !(hoursNum > 0)) { setError('Enter the hours to bill.'); return }
    const yes = await panel.confirm({
      title: 'Send this payment request?',
      message: `A request for $${amount.toFixed(2)} will be emailed to ${user.email}.`,
      consequences: [
        isNew ? `${sessionsNum} session${sessionsNum === 1 ? '' : 's'} of ${minutesNum} minutes at $${rateNum.toFixed(2)} per hour (first invoice).` : `${hoursNum} hour${hoursNum === 1 ? '' : 's'} at $${rateNum.toFixed(2)} per hour (follow-up invoice).`,
        'They receive an email with a secure payment link.',
        'The link is also shown here so you can copy it.',
      ],
      confirmLabel: 'Send payment request',
    })
    if (!yes) return
    setBusy(true)
    setPaymentUrl('')
    const url = await panel.handleSendPaymentRequest(user, {
      amount, client_type: clientType,
      ...(isNew ? { sessions: sessionsNum, minutes_per_session: minutesNum } : { hours: hoursNum }),
    })
    setBusy(false)
    if (!url) { setError('The payment request was not sent. Check the amounts and try again.'); return }
    setPaymentUrl(url)
    setHours(''); setSessions(''); setMinutes('')
  }

  const copy = async () => {
    try { await navigator.clipboard.writeText(paymentUrl); panel.ok('Payment link copied.') }
    catch { panel.fail('The link could not be copied. Select it and copy it by hand.') }
  }

  return (
    <section style={{ background: 'white', border: '1px solid var(--mist)', borderRadius: '6px', padding: '1.25rem', marginBottom: '1.25rem' }}>
      <h3 style={sectionTitleStyle}>Coaching billing</h3>
      <div style={{ marginBottom: '1rem', maxWidth: '260px' }}>
        <label htmlFor={`rate-${user.id}`} style={labelStyle}>Hourly rate ($)<SaveStatus state={saves.get('rate')} /></label>
        <input id={`rate-${user.id}`} type="number" inputMode="decimal" min="0" step="0.01" value={rate} onChange={e => setRate(e.target.value)} onBlur={saveRate} placeholder="e.g. 150" style={inputStyle} />
        <p style={{ ...helpStyle, fontSize: '0.85rem', margin: '0.4rem 0 0' }}>Saved automatically when you leave the field.</p>
      </div>

      <span style={labelStyle}>Payment request</span>
      <div role="group" aria-label="Invoice type" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {([{ value: 'new', label: 'New client — first invoice' }, { value: 'existing', label: 'Existing client — follow-up invoice' }] as const).map(o => (
          <button key={o.value} type="button" aria-pressed={clientType === o.value} onClick={() => { setClientType(o.value); setError(null) }}
            style={{ ...secondaryButtonStyle, fontSize: '0.85rem', minHeight: '40px', background: clientType === o.value ? 'var(--navy)' : 'white', color: clientType === o.value ? 'white' : 'var(--navy)' }}>
            {o.label}
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
        {isNew ? (
          <>
            <div>
              <label htmlFor={`sessions-${user.id}`} style={labelStyle}>Number of sessions</label>
              <input id={`sessions-${user.id}`} type="number" inputMode="numeric" min="1" step="1" value={sessions} onChange={e => setSessions(e.target.value)} placeholder="e.g. 3" style={inputStyle} />
            </div>
            <div>
              <label htmlFor={`minutes-${user.id}`} style={labelStyle}>Minutes per session</label>
              <input id={`minutes-${user.id}`} type="number" inputMode="numeric" min="1" step="1" value={minutes} onChange={e => setMinutes(e.target.value)} placeholder="e.g. 60" style={inputStyle} />
            </div>
          </>
        ) : (
          <div>
            <label htmlFor={`hours-${user.id}`} style={labelStyle}>Hours to bill</label>
            <input id={`hours-${user.id}`} type="number" inputMode="decimal" min="0" step="0.25" value={hours} onChange={e => setHours(e.target.value)} placeholder="e.g. 2" style={inputStyle} />
          </div>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span style={labelStyle}>Total</span>
          <p style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.6rem', color: 'var(--navy)', letterSpacing: '0.04em', margin: 0 }}>${amount.toFixed(2)}</p>
        </div>
        <button type="button" onClick={send} disabled={busy} className="btn btn-primary" style={primaryButton}>{busy ? 'Sending…' : 'Send payment request'}</button>
      </div>
      <InlineError message={error} />
      {paymentUrl && (
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--mist)' }}>
          <span style={labelStyle}>Payment link (sent to {user.email})</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <a href={paymentUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#8a5a10', fontSize: '0.9rem', wordBreak: 'break-all' }}>{paymentUrl}</a>
            <button type="button" onClick={copy} style={secondaryButtonStyle}>Copy link</button>
          </div>
        </div>
      )}
    </section>
  )
}
