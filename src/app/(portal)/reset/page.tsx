'use client'

import { useState, useEffect, Suspense } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function ResetContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [step, setStep] = useState<'request' | 'sent' | 'set' | 'done'>('request')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // If user arrives via reset link from email, go straight to set password step
  useEffect(() => {
    const type = searchParams.get('type')
    if (type === 'recovery') {
      setStep('set')
    }
  }, [searchParams])

  const inputStyle = {
    width: '100%', padding: '0.9rem 1rem',
    background: 'rgba(255,255,255,0.06)',
    border: '1.5px solid rgba(255,255,255,0.12)',
    borderRadius: '3px', color: 'white',
    fontFamily: "'Montserrat', sans-serif", fontSize: '0.94rem',
    outline: 'none', transition: 'border-color 0.15s',
  }

  const labelStyle = {
    fontSize: '0.7rem', fontFamily: "'JetBrains Mono', monospace",
    letterSpacing: '0.18em', textTransform: 'uppercase' as const,
    color: 'rgba(255,255,255,0.45)', marginBottom: '0.4rem', display: 'block'
  }

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset?type=recovery`,
    })
    if (error) {
      setError(error.message)
    } else {
      setStep('sent')
    }
    setLoading(false)
  }

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
    } else {
      setStep('done')
      setTimeout(() => router.push('/login'), 2500)
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100svh', background: 'var(--navy3)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'clamp(2rem, 5vw, 4rem)' }}>
      <Link href="/" style={{ marginBottom: '3rem' }}>
        <Image src="/images/tlc-logo.png" alt="TLC Leadership Consulting and Coaching" width={90} height={80} style={{ height: '80px', width: 'auto' }} />
      </Link>

      <div style={{ width: '100%', maxWidth: '440px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(200,136,32,0.15)', borderRadius: '6px', padding: 'clamp(2rem, 5vw, 3rem)' }}>

        {/* STEP 1 — REQUEST RESET */}
        {step === 'request' && (
          <>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '0.75rem', display: 'block' }}>Password Reset</span>
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2.5rem', color: 'white', letterSpacing: '0.04em', lineHeight: 1, marginBottom: '0.5rem' }}>Forgot your password?</h1>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.88rem', marginBottom: '2rem', lineHeight: 1.6 }}>Enter your email address and we will send you a reset link.</p>
            {error && <div style={{ background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.3)', borderRadius: '3px', padding: '0.75rem 1rem', marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>{error}</div>}
            <form onSubmit={handleRequestReset} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={labelStyle}>Email address</label>
                <input type="email" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
              </div>
              <button type="submit" disabled={loading} style={{ width: '100%', padding: '0.95rem', background: loading ? 'rgba(200,136,32,0.5)' : 'var(--gold)', color: 'var(--navy)', border: 'none', borderRadius: '3px', fontFamily: "'Montserrat', sans-serif", fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer' }}>
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
            <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
              <Link href="/login" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem' }}>Back to login</Link>
            </div>
          </>
        )}

        {/* STEP 2 — EMAIL SENT */}
        {step === 'sent' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(200,136,32,0.15)', border: '2px solid var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', fontSize: '1.5rem' }}>✉</div>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '0.75rem', display: 'block' }}>Check your email</span>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2rem', color: 'white', letterSpacing: '0.04em', lineHeight: 1, marginBottom: '0.75rem' }}>Reset link sent.</h2>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.88rem', lineHeight: 1.6 }}>We sent a password reset link to <strong style={{ color: 'white' }}>{email}</strong>. Check your inbox and click the link to set your new password.</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <button onClick={handleRequestReset} disabled={loading} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem', cursor: 'pointer' }}>
                {loading ? 'Sending...' : 'Resend email'}
              </button>
            </div>
          </>
        )}

        {/* STEP 3 — SET NEW PASSWORD */}
        {step === 'set' && (
          <>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '0.75rem', display: 'block' }}>Set new password</span>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2rem', color: 'white', letterSpacing: '0.04em', lineHeight: 1, marginBottom: '0.5rem' }}>Choose a new password.</h2>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.88rem', marginBottom: '2rem', lineHeight: 1.6 }}>Make it strong and something you will remember.</p>
            {error && <div style={{ background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.3)', borderRadius: '3px', padding: '0.75rem 1rem', marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>{error}</div>}
            <form onSubmit={handleSetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={labelStyle}>New password</label>
                <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Confirm password</label>
                <input type="password" placeholder="••••••••" value={confirm} onChange={e => setConfirm(e.target.value)} required style={inputStyle} />
              </div>
              <button type="submit" disabled={loading} style={{ width: '100%', padding: '0.95rem', background: loading ? 'rgba(200,136,32,0.5)' : 'var(--gold)', color: 'var(--navy)', border: 'none', borderRadius: '3px', fontFamily: "'Montserrat', sans-serif", fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer' }}>
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </>
        )}

        {/* STEP 4 — DONE */}
        {step === 'done' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(200,136,32,0.15)', border: '2px solid var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', fontSize: '1.5rem' }}>✓</div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '0.75rem', display: 'block' }}>All set</span>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2rem', color: 'white', letterSpacing: '0.04em', lineHeight: 1, marginBottom: '0.75rem' }}>Password updated.</h2>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.88rem', lineHeight: 1.6 }}>Redirecting you to login...</p>
          </div>
        )}
      </div>

      <style>{`
        input::placeholder { color: rgba(255,255,255,0.25); }
        input:focus { border-color: var(--gold) !important; }
      `}</style>
    </div>
  )
}

export default function Reset() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100svh', background: 'var(--navy3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', color: 'white', letterSpacing: '0.08em' }}>Loading...</div>
      </div>
    }>
      <ResetContent />
    </Suspense>
  )
}