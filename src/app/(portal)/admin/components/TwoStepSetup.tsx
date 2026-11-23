'use client'

// Adds an authenticator app to the signed-in administrator's account (TOTP). Used on the
// Security page and on the required-setup page, so it reports its own progress and errors.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function TwoStepSetup({ redirectTo, onDone, label = 'Turn on two-step verification' }: { redirectTo?: string; onDone?: () => void; label?: string }) {
  const router = useRouter()
  const [enrolling, setEnrolling] = useState<{ id: string; qr: string; secret: string } | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const start = async () => {
    setBusy(true); setError(null)
    const { data: list } = await supabase.auth.mfa.listFactors()
    // Clear any half-finished setup first.
    for (const f of (list?.all ?? []).filter(f => f.status !== 'verified')) await supabase.auth.mfa.unenroll({ factorId: f.id })
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}` })
    if (error || !data) setError(`Setup could not start: ${error?.message ?? 'unknown error'}. Please try again.`)
    else setEnrolling({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
    setBusy(false)
  }

  const finish = async () => {
    if (!enrolling) return
    setBusy(true); setError(null)
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrolling.id, code: code.replace(/\s/g, '') })
    if (error) {
      setError('That code did not work. Enter the 6-digit code your app shows right now (codes change every 30 seconds).')
      setBusy(false)
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (user) await supabase.from('admin_audit_log').insert({ actor_id: user.id, action: 'mfa.enroll', entity_type: 'person', entity_id: user.id, outcome: 'success', details: {} })
    setDone(true); setEnrolling(null); setCode(''); setBusy(false)
    onDone?.()
    if (redirectTo) router.push(redirectTo)
  }

  if (done) return <p role="status" style={{ color: '#14532d', fontWeight: 600, margin: '0.75rem 0 0' }}>Two-step verification is on. You will be asked for a code each time you sign in.</p>

  return (
    <div>
      {!enrolling && <button onClick={start} disabled={busy} className="btn btn-primary" style={{ fontSize: '0.82rem', maxWidth: '100%', whiteSpace: 'normal', textAlign: 'center' }}>{busy ? 'Starting…' : label}</button>}
      {enrolling && (
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enrolling.qr} alt="QR code to add TLC admin to your authenticator app" width={180} height={180} style={{ background: 'white', padding: '0.5rem', border: '1px solid var(--mist)' }} />
          <div style={{ flex: '1 1 240px' }}>
            <ol style={{ margin: '0 0 1rem', paddingLeft: '1.1rem', color: 'var(--ink)', fontSize: '0.92rem', lineHeight: 1.7 }}>
              <li>Open your authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…) and scan the code.</li>
              <li>Can&apos;t scan? Enter this setup key: <code style={{ wordBreak: 'break-all' }}>{enrolling.secret}</code></li>
              <li>Tip: add it to a second device or a password manager that syncs, so a lost phone does not lock you out.</li>
              <li>Type the 6-digit code the app shows.</li>
            </ol>
            <label htmlFor="mfa-setup-code" style={{ display: 'block', fontSize: '0.75rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--slate)', marginBottom: '0.35rem' }}>Code from the app</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <input id="mfa-setup-code" value={code} onChange={e => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={7}
                style={{ padding: '0.6rem 0.75rem', border: '1.5px solid var(--mist)', borderRadius: '3px', fontSize: '1.1rem', letterSpacing: '0.3em', width: '9rem' }} />
              <button onClick={finish} disabled={busy || code.replace(/\s/g, '').length < 6} className="btn btn-primary" style={{ fontSize: '0.82rem' }}>{busy ? 'Checking…' : 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}
      {error && <p role="alert" style={{ color: '#b3261e', fontSize: '0.88rem', margin: '0.75rem 0 0' }}>{error}</p>}
    </div>
  )
}
