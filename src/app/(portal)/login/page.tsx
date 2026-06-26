'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Portal = null | 'coaching' | 'impact'

export default function Login() {
  const router = useRouter()
  const [portal, setPortal] = useState<Portal>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const inputStyle = {
    width: '100%', padding: '0.9rem 1rem',
    background: 'rgba(255,255,255,0.06)',
    border: '1.5px solid rgba(255,255,255,0.12)',
    borderRadius: '3px', color: 'white',
    fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.94rem',
    outline: 'none', transition: 'border-color 0.15s',
  }

  const labelStyle = {
    fontSize: '0.7rem', fontFamily: 'var(--font-jetbrains), monospace',
    letterSpacing: '0.18em', textTransform: 'uppercase' as const,
    color: 'rgba(255,255,255,0.45)', marginBottom: '0.4rem', display: 'block'
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    if (data.user) {
      // Read role from user metadata — no database round trip, works on all devices
      const role = data.user.user_metadata?.role || 'impact_participant'

      if (role === 'admin') {
        router.push('/admin')
        return
      }

      if (portal === 'impact' && role === 'coaching_client') {
        await supabase.auth.signOut()
        setError('This account does not have access to The Impact Lab. Please sign in through the Coaching Portal.')
        setLoading(false)
        return
      }

      if (portal === 'coaching' && role === 'impact_participant') {
        await supabase.auth.signOut()
        setError('This account does not have access to the Coaching Portal. Please sign in through The Impact Lab.')
        setLoading(false)
        return
      }

      if (role === 'coaching_client') {
        router.push('/coaching-portal')
      } else {
        router.push('/impact-portal')
      }
    }

    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100svh', background: 'var(--navy3)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '1.5rem clamp(1.25rem, 5vw, 2.75rem)', borderBottom: '1px solid rgba(200,136,32,0.15)' }}>
        <Link href="/">
          <Image src="/images/tlc-logo.png" alt="TLC Leadership Consulting and Coaching" width={90} height={80} style={{ height: '80px', width: 'auto' }} />
        </Link>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(2rem, 5vw, 4rem)' }}>
        <div style={{ width: '100%', maxWidth: '480px' }}>

          {portal === null && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.62rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '0.75rem', display: 'block' }}>Welcome back</span>
                <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(2rem, 5vw, 3rem)', color: 'white', letterSpacing: '0.04em', lineHeight: 1, marginBottom: '0.5rem' }}>Where are you signing in?</h1>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.88rem', lineHeight: 1.6 }}>Choose the portal you want to access.</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <button
                  onClick={() => setPortal('coaching')}
                  style={{ width: '100%', padding: '1.75rem', background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(200,136,32,0.2)', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s, background 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--gold)'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(200,136,32,0.06)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(200,136,32,0.2)'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.4rem', color: 'white', letterSpacing: '0.04em' }}>Coaching Portal</span>
                    <span style={{ color: 'var(--gold)', fontSize: '1.1rem' }}>&#8594;</span>
                  </div>
                  <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem', lineHeight: 1.6, margin: 0 }}>Sign in to access your coaching dashboard, sessions, and action plan.</p>
                </button>

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
            </div>
          )}

          {portal !== null && (
            <div>
              <button
                onClick={() => { setPortal(null); setEmail(''); setPassword(''); setError('') }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem', cursor: 'pointer', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontFamily: 'var(--font-montserrat), sans-serif' }}
              >
                &#8592; Back
              </button>

              <div style={{ marginBottom: '2rem' }}>
                {portal === 'impact' ? (
                  <Image src="/images/impact-lab-logo.png" alt="The Impact Lab" width={240} height={68} style={{ width: '240px', height: 'auto', marginBottom: '1rem' }} />
                ) : (
                  <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.62rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '0.75rem', display: 'block' }}>Coaching Portal</span>
                )}
                <h2 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(2rem, 5vw, 2.75rem)', color: 'white', letterSpacing: '0.04em', lineHeight: 1, marginBottom: '0.5rem' }}>Welcome back.</h2>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.88rem', lineHeight: 1.6 }}>
                  {portal === 'coaching' ? 'Sign in to access your coaching dashboard, sessions, and action plan.' : 'Sign in to access your cohort materials, weekly reps, and reflection journal.'}
                </p>
              </div>

              {error && (
                <div style={{ background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.3)', borderRadius: '4px', padding: '0.85rem 1rem', marginBottom: '1.25rem', color: '#ff6b6b', fontSize: '0.85rem', lineHeight: 1.5 }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input type="email" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Password</label>
                  <div style={{ position: 'relative' }}>
                    <input type={showPw ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle} />
                    <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'var(--font-montserrat), sans-serif' }}>
                      {showPw ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  style={{ width: '100%', padding: '0.95rem', background: loading ? 'rgba(200,136,32,0.5)' : 'var(--gold)', color: 'var(--navy)', border: 'none', borderRadius: '3px', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 0.15s' }}
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.25rem' }}>
                <Link href="/reset" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem' }}>Forgot password?</Link>
                {portal === 'impact' && <Link href="/register" style={{ color: 'var(--gold)', fontSize: '0.82rem' }}>Join a cohort</Link>}
                {portal === 'coaching' && <Link href="/contact" style={{ color: 'var(--gold)', fontSize: '0.82rem' }}>Need access?</Link>}
              </div>
            </div>
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