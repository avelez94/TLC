import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { AdminPanel } from '../useAdminPanel'
import { cardStyle, inputStyle, labelStyle, thStyle, tdStyle } from './shared'

interface Factor { id: string; friendly_name?: string; status: string; created_at: string }
interface AuditRow { id: number; actor_id: string | null; action: string; entity_type: string | null; created_at: string }
interface EmailRow { id: number; template: string; recipient: string; subject: string | null; status: string; error: string | null; created_at: string }

const when = (d: string) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
const ACTIONS: Record<string, string> = {
  'user.invite': 'Invited a user', 'user.role_change': 'Changed a role', 'enrollment.create': 'Enrolled a participant',
  'enrollment.reactivate': 'Reactivated an enrollment', 'enrollment.withdraw': 'Withdrew an enrollment', 'enrollment.returning': 'Enrolled a returning participant',
  'cohort.status': 'Changed a cohort status', 'cohort.delete': 'Deleted an empty cohort', 'payment_link.create': 'Sent a payment link',
  'inquiry.update': 'Updated an inquiry', 'program.update': 'Edited a program or pathway', 'mfa.enroll': 'Turned on two-step verification', 'mfa.remove': 'Removed an authenticator',
}

export default function SecurityTab({ users, showSuccess, logAction }: AdminPanel) {
  const [factors, setFactors] = useState<Factor[]>([])
  const [enrolling, setEnrolling] = useState<{ id: string; qr: string; secret: string } | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [audit, setAudit] = useState<AuditRow[]>([])
  const [emails, setEmails] = useState<EmailRow[]>([])

  const load = useCallback(async () => {
    const { data } = await supabase.auth.mfa.listFactors()
    setFactors(((data?.totp ?? []) as Factor[]))
    const [{ data: a }, { data: e }] = await Promise.all([
      supabase.from('admin_audit_log').select('id, actor_id, action, entity_type, created_at').order('created_at', { ascending: false }).limit(50),
      supabase.from('email_log').select('id, template, recipient, subject, status, error, created_at').order('created_at', { ascending: false }).limit(50),
    ])
    setAudit((a as AuditRow[]) ?? [])
    setEmails((e as EmailRow[]) ?? [])
  }, [])
  useEffect(() => { void Promise.resolve().then(load) }, [load])

  const verified = factors.filter(f => f.status === 'verified')

  const startEnroll = async () => {
    setBusy(true)
    // clear any half-finished setup first
    for (const f of factors.filter(f => f.status !== 'verified')) await supabase.auth.mfa.unenroll({ factorId: f.id })
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}` })
    if (error || !data) showSuccess(`Could not start setup: ${error?.message ?? 'unknown error'}`)
    else setEnrolling({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
    setBusy(false)
  }

  const finishEnroll = async () => {
    if (!enrolling) return
    setBusy(true)
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrolling.id, code: code.replace(/\s/g, '') })
    if (error) showSuccess('That code did not work. Enter the current 6-digit code shown in your authenticator app.')
    else {
      showSuccess('Two-step verification is on. You will be asked for a code each time you sign in.')
      await logAction('mfa.enroll', 'auth', null)
      setEnrolling(null); setCode(''); await load()
    }
    setBusy(false)
  }

  const remove = async (f: Factor) => {
    if (verified.length === 1 && !window.confirm('Removing your only authenticator turns two-step verification off for your account. Continue?')) return
    setBusy(true)
    const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id })
    if (error) showSuccess(`Could not remove it: ${error.message}`)
    else { showSuccess('Authenticator removed.'); await logAction('mfa.remove', 'auth', null); await load() }
    setBusy(false)
  }

  const name = (id: string | null) => users.find(u => u.id === id)?.full_name ?? 'System'

  return (
    <div>
      <span style={labelStyle}>Settings</span>
      <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', margin: '0.25rem 0 1.25rem' }}>Security</h1>

      <div style={cardStyle}>
        <h2 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.3rem', color: 'var(--navy)', letterSpacing: '0.04em', margin: '0 0 0.5rem' }}>Two-step verification</h2>
        <p style={{ color: 'var(--slate)', fontSize: '0.88rem', lineHeight: 1.6, margin: '0 0 1rem' }}>
          {verified.length ? 'On. Signing in to the admin panel requires a code from your authenticator app.' : 'Off. Protect the admin panel with a code from an authenticator app (Google Authenticator, 1Password, Microsoft Authenticator). Strongly recommended for every admin.'}
        </p>
        {verified.map(f => (
          <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderTop: '1px solid var(--mist)', fontSize: '0.85rem' }}>
            <span>{f.friendly_name ?? 'Authenticator'} · added {when(f.created_at)}</span>
            <button onClick={() => remove(f)} disabled={busy} style={{ background: 'none', border: 'none', color: '#b3261e', cursor: 'pointer', fontSize: '0.78rem' }}>Remove</button>
          </div>
        ))}
        {!enrolling && <button onClick={startEnroll} disabled={busy} className="btn btn-primary" style={{ fontSize: '0.82rem', marginTop: '0.75rem' }}>{verified.length ? 'Add another authenticator' : 'Turn on two-step verification'}</button>}
        {enrolling && (
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start', marginTop: '1rem' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={enrolling.qr} alt="QR code to add TLC admin to your authenticator app" width={180} height={180} style={{ background: 'white', padding: '0.5rem', border: '1px solid var(--mist)' }} />
            <div style={{ flex: '1 1 240px' }}>
              <ol style={{ margin: '0 0 1rem', paddingLeft: '1.1rem', color: 'var(--ink)', fontSize: '0.88rem', lineHeight: 1.7 }}>
                <li>Open your authenticator app and scan the code.</li>
                <li>Can&apos;t scan? Enter this key: <code style={{ wordBreak: 'break-all' }}>{enrolling.secret}</code></li>
                <li>Type the 6-digit code it shows.</li>
              </ol>
              <label htmlFor="mfa-new-code" style={labelStyle}>Code from the app</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input id="mfa-new-code" value={code} onChange={e => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={7} style={{ ...inputStyle, maxWidth: '10rem', letterSpacing: '0.2em' }} />
                <button onClick={finishEnroll} disabled={busy || code.replace(/\s/g, '').length < 6} className="btn btn-primary" style={{ fontSize: '0.8rem' }}>Confirm</button>
                <button onClick={() => { setEnrolling(null); setCode('') }} style={{ background: 'none', border: 'none', color: 'var(--slate)', cursor: 'pointer', fontSize: '0.8rem' }}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={cardStyle}>
        <h2 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.3rem', color: 'var(--navy)', letterSpacing: '0.04em', margin: '0 0 0.75rem' }}>Recent admin activity</h2>
        {audit.length === 0 ? <p style={{ color: 'var(--slate)', fontSize: '0.85rem' }}>No recorded activity yet.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={thStyle}>When</th><th style={thStyle}>Who</th><th style={thStyle}>What</th></tr></thead>
              <tbody>{audit.map(a => <tr key={a.id}><td style={tdStyle}>{when(a.created_at)}</td><td style={tdStyle}>{name(a.actor_id)}</td><td style={tdStyle}>{ACTIONS[a.action] ?? a.action}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </div>

      <div style={cardStyle}>
        <h2 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.3rem', color: 'var(--navy)', letterSpacing: '0.04em', margin: '0 0 0.75rem' }}>Email delivery</h2>
        <p style={{ color: 'var(--slate)', fontSize: '0.85rem', margin: '0 0 0.75rem' }}>The last 50 emails the platform tried to send. A failed confirmation email for a payment is retried automatically.</p>
        {emails.length === 0 ? <p style={{ color: 'var(--slate)', fontSize: '0.85rem' }}>No emails recorded yet.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={thStyle}>When</th><th style={thStyle}>Email</th><th style={thStyle}>To</th><th style={thStyle}>Result</th></tr></thead>
              <tbody>{emails.map(e => (
                <tr key={e.id}>
                  <td style={tdStyle}>{when(e.created_at)}</td>
                  <td style={tdStyle}>{e.subject ?? e.template}</td>
                  <td style={tdStyle}>{e.recipient}</td>
                  <td style={{ ...tdStyle, color: e.status === 'failed' ? '#b3261e' : 'var(--ink)', fontWeight: e.status === 'failed' ? 700 : 400 }} title={e.error ?? undefined}>{e.status === 'sent' ? 'Sent' : e.status === 'failed' ? 'Failed' : 'Skipped (test)'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
