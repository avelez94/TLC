'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

export default function Reset() {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

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

  return (
    <div style={{ minHeight: '100svh', background: 'var(--navy3)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'clamp(2rem, 5vw, 4rem)' }}>
      <Link href="/" style={{ marginBottom: '3rem' }}>
        <Image src="/images/tlc-logo.png" alt="TLC Leadership Consulting and Coaching" width={90} height={80} style={{ height: '80px', width: 'auto' }} />
      </Link>

      <div style={{ width: '100%', maxWidth: '440px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(200,136,32,0.15)', borderRadius: '6px', padding: 'clamp(2rem, 5vw, 3rem)' }}>

        {step === 1 && (
          <>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '0.75rem', display: 'block' }}>Password Reset</span>
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2.5rem', color: 'white', letterSpacing: '0.04em', lineHeight: 1, marginBottom: '0.5rem' }}>Forgot your password?</h1>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.88rem', marginBottom: '2rem', lineHeight: 1.6 }}>Enter your email address and we will send you a reset link.</p>
            <form onSubmit={e => { e.preventDefault(); setStep(2) }} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={labelStyle}>Email address</label>
                <input type="email" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
              </div>
              <button type="submit" style={{ width: '100%', padding: '0.95rem', background: 'var(--gold)', color: 'var(--navy)', border: 'none', borderRadius: '3px', fontFamily: "'Montserrat', sans-serif", fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
                Send Reset Link
              </button>
            </form>
            <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
              <Link href="/login" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem' }}>Back to login</Link>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(200,136,32,0.15)', border: '2px solid var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', fontSize: '1.5rem' }}>✉</div>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '0.75rem', display: 'block' }}>Check your email</span>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2rem', color: 'white', letterSpacing: '0.04em', lineHeight: 1, marginBottom: '0.75rem' }}>Reset link sent.</h2>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.88rem', lineHeight: 1.6 }}>We sent a password reset link to <strong style={{ color: 'white' }}>{email}</strong>. Check your inbox and click the link to continue.</p>
            </div>
            <button onClick={() => setStep(3)} style={{ width: '100%', padding: '0.95rem', background: 'var(--gold)', color: 'var(--navy)', border: 'none', borderRadius: '3px', fontFamily: "'Montserrat', sans-serif", fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', marginBottom: '1rem' }}>
              I clicked the link
            </button>
            <div style={{ textAlign: 'center' }}>
              <button onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem', cursor: 'pointer' }}>Resend email</button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '0.75rem', display: 'block' }}>Set new password</span>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2rem', color: 'white', letterSpacing: '0.04em', lineHeight: 1, marginBottom: '0.5rem' }}>Choose a new password.</h2>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.88rem', marginBottom: '2rem', lineHeight: 1.6 }}>Make it strong and something you will remember.</p>
            <form onSubmit={e => { e.preventDefault(); window.location.href = '/login' }} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={labelStyle}>New password</label>
                <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Confirm password</label>
                <input type="password" placeholder="••••••••" value={confirm} onChange={e => setConfirm(e.target.value)} required style={inputStyle} />
              </div>
              <button type="submit" style={{ width: '100%', padding: '0.95rem', background: 'var(--gold)', color: 'var(--navy)', border: 'none', borderRadius: '3px', fontFamily: "'Montserrat', sans-serif", fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
                Update Password
              </button>
            </form>
          </>
        )}
      </div>

      <style>{`
        input::placeholder { color: rgba(255,255,255,0.25); }
        input:focus { border-color: var(--gold) !important; }
      `}</style>
    </div>
  )
}
