'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

type Portal = null | 'coaching' | 'impact'

export default function Login() {
  const [portal, setPortal] = useState<Portal>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)

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

  const destination = portal === 'coaching' ? '/coaching-portal' : '/impact-portal'

  return (
    <div style={{ minHeight: '100svh', background: 'var(--navy3)', display: 'flex', flexDirection: 'column' }}>
      {/* Logo bar */}
      <div style={{ padding: '1.5rem clamp(1.25rem, 5vw, 2.75rem)', borderBottom: '1px solid rgba(200,136,32,0.15)' }}>
        <Link href="/">
          <Image src="/images/tlc-logo.png" alt="TLC Leadership Consulting and Coaching" width={90} height={80} style={{ height: '80px', width: 'auto' }} />
        </Link>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(2rem, 5vw, 4rem)' }}>
        <div style={{ width: '100%', maxWidth: '480px' }}>

          {/* STEP 1 — Choose portal */}
          {portal === null && (
            <>
              <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '0.75rem', display: 'block' }}>Welcome back</span>
                <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(2rem, 5vw, 3rem)', color: 'white', letterSpacing: '0.04em', lineHeight: 1, marginBottom: '0.5rem' }}>Where are you signing in?</h1>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.88rem', lineHeight: 1.6 }}>Choose the portal you want to access.</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Coaching Portal option */}
                <button
                  onClick={() => setPortal('coaching')}
                  style={{ width: '100%', padding: '1.75rem', background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(200,136,32,0.2)', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s, background 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--gold)'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(200,136,32,0.06)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(200,136,32,0.2)'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.4rem', color: 'white', letterSpacing: '0.04em' }}>Coaching Portal</span>
                    <span style={{ color: 'var(--gold)', fontSize: '1.1rem' }}>&#8594;</span>
                  </div>
                  <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem', lineHeight: 1.6, margin: 0 }}>Sign in to access your coaching dashboard, sessions, and action plan.</p>
                </button>

                {/* Impact Lab Portal option */}
                <button
                  onClick={() => setPortal('impact')}
                  style={{ width: '100%', padding: '1.75rem', background: 'rgba(10,37,71,0.5)', border: '1.5px solid rgba(200,136,32,0.2)', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s, background 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--gold)'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(200,136,32,0.06)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(200,136,32,0.2)'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(10,37,71,0.5)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <Image src="/images/impact-lab-logo.png" alt="The Impact Lab" width={180} height={50} style={{ width: '180px', height: 'auto' }} />
                    <span style={{ color: 'var(--gold)', fontSize: '1.1rem' }}>&#8594;</span>
                  </div>
                  <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem', lineHeight: 1.6, margin: 0 }}>Sign in to access your cohort materials, weekly reps, and reflection journal.</p>
                </button>
              </div>

              <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                <Link href="/register" style={{ color: 'var(--gold)', fontSize: '0.85rem' }}>Join a cohort &#8594;</Link>
              </div>
            </>
          )}

          {/* STEP 2 — Login form */}
          {portal !== null && (
            <>
              <button onClick={() => { setPortal(null); setEmail(''); setPassword('') }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem', cursor: 'pointer', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontFamily: "'Montserrat', sans-serif' " }}>
                &#8592; Back
              </button>

              <div style={{ marginBottom: '2rem' }}>
                {portal === 'impact' ? (
                  <Image src="/images/impact-lab-logo.png" alt="The Impact Lab" width={240} height={68} style={{ width: '240px', height: 'auto', marginBottom: '1rem' }} />
                ) : (
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '0.75rem', display: 'block' }}>Coaching Portal</span>
                )}
                <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(2rem, 5vw, 2.75rem)', color: 'white', letterSpacing: '0.04em', lineHeight: 1, marginBottom: '0.5rem' }}>Welcome back.</h2>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.88rem', lineHeight: 1.6 }}>
                  {portal === 'coaching' ? 'Sign in to access your coaching dashboard, sessions, and action plan.' : 'Sign in to access your cohort materials, weekly reps, and reflection journal.'}
                </p>
              </div>

              <form onSubmit={e => { e.preventDefault(); window.location.href = destination }} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input type="email" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Password</label>
                  <div style={{ position: 'relative' }}>
                    <input type={showPw ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle} />
                    <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '0.8rem', fontFamily: "'Montserrat', sans-serif" }}>
                      {showPw ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
                <button type="submit" style={{ width: '100%', padding: '0.95rem', background: 'var(--gold)', color: 'var(--navy)', border: 'none', borderRadius: '3px', fontFamily: "'Montserrat', sans-serif", fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', transition: 'background 0.15s' }}>
                  Sign In
                </button>
              </form>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.25rem' }}>
                <Link href="/reset" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem' }}>Forgot password?</Link>
                {portal === 'impact' && <Link href="/register" style={{ color: 'var(--gold)', fontSize: '0.82rem' }}>Join a cohort</Link>}
                {portal === 'coaching' && <Link href="/contact" style={{ color: 'var(--gold)', fontSize: '0.82rem' }}>Need access?</Link>}
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ padding: '1.5rem clamp(1.25rem, 5vw, 2.75rem)', borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.75rem' }}>&copy; 2025 TLC Leadership Consulting &amp; Coaching. All rights reserved.</p>
      </div>

      <style>{`
        input::placeholder { color: rgba(255,255,255,0.25); }
        input:focus { border-color: var(--gold) !important; }
      `}</style>
    </div>
  )
}