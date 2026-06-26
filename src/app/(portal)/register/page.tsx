'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

const cohorts = [
  {
    id: 'finders-spring-2025',
    program: 'Impact Finders',
    tag: 'Program 01',
    status: 'active',
    dates: 'March 4 – March 25, 2025',
    sessions: ['Session 1: March 4 — Where do you want your impact?', 'Session 2: March 11 — What matters most?', 'Session 3: March 18 — What is getting in the way?', 'Session 4: March 25 — Your direction forward'],
    includes: ['4 live group sessions via Zoom', 'Reflection workbook', 'Private cohort community', 'Session recordings'],
    cost: 'Free',
    spots: '8 spots remaining',
    dark: false,
  },
  {
    id: 'makers-spring-2025',
    program: 'Impact Makers',
    tag: 'Program 02',
    status: 'active',
    dates: 'April 1 – May 13, 2025',
    sessions: ['Session 1: April 1 — The gap between effort and contribution', 'Session 2: April 8 — Reading the real job to be done', 'Session 3: April 15 — Stepping up without being asked', 'Application period: April 22 – May 6', 'Session 4: May 6 — What you applied and what you learned', 'Session 5: May 13 — Integration and next steps'],
    includes: ['5 live sessions via Zoom', 'Four-week application period', 'Weekly rep assignments', 'Reflection journal', 'Session recordings', 'Private cohort community'],
    cost: '$297',
    spots: '6 spots remaining',
    dark: true,
  },
  {
    id: 'finders-summer-2025',
    program: 'Impact Finders',
    tag: 'Program 01',
    status: 'upcoming',
    dates: 'June 3 – June 24, 2025',
    sessions: ['Session 1: June 3', 'Session 2: June 10', 'Session 3: June 17', 'Session 4: June 24'],
    includes: ['4 live group sessions via Zoom', 'Reflection workbook', 'Private cohort community', 'Session recordings'],
    cost: 'Free',
    spots: 'Opening soon',
    dark: false,
  },
]

export default function Register() {
  const [selected, setSelected] = useState<string | null>(null)
  const [step, setStep] = useState<'browse' | 'form' | 'confirm'>('browse')
  const [form, setForm] = useState({ name: '', email: '', phone: '', org: '', password: '', confirm: '' })

  const selectedCohort = cohorts.find(c => c.id === selected)

  const inputStyle = {
    width: '100%', padding: '0.8rem 1rem',
    border: '1.5px solid rgba(0,23,55,0.18)',
    borderRadius: '3px', color: 'var(--ink)',
    fontFamily: "'Montserrat', sans-serif", fontSize: '0.94rem',
    background: 'white', outline: 'none',
  }

  const labelStyle = {
    fontSize: '0.72rem', fontWeight: 600 as const,
    color: 'var(--ink)', letterSpacing: '0.04em',
    textTransform: 'uppercase' as const, marginBottom: '0.4rem', display: 'block'
  }

  if (step === 'confirm') return (
    <div style={{ minHeight: '100svh', background: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ textAlign: 'center', maxWidth: '480px' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', fontSize: '1.75rem', color: 'var(--navy)' }}>&#10003;</div>
        <span className="eyebrow" style={{ marginBottom: '0.75rem', display: 'block' }}>Registration complete</span>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(2rem, 5vw, 3rem)', color: 'var(--navy)', letterSpacing: '0.04em', lineHeight: 1, marginBottom: '1rem' }}>You are in.</h1>
        <p style={{ color: 'var(--slate)', fontSize: '0.95rem', lineHeight: 1.75, marginBottom: '2rem' }}>Welcome to <strong>{selectedCohort?.program}</strong>. Check your email for confirmation and next steps. Your portal access will be active shortly.</p>
        <Link href="/login" className="btn btn-primary">Go to your portal</Link>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100svh', background: 'var(--paper)' }}>
      {/* Header */}
      <div style={{ background: 'var(--navy)', padding: 'calc(115px + 2rem) 0 2rem', textAlign: 'center' }}>
        <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Image src="/images/impact-lab-logo.png" alt="The Impact Lab" width={480} height={135} style={{ width: '100%', maxWidth: '480px', height: 'auto', marginBottom: '1rem' }} />
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 'clamp(0.95rem, 2vw, 1.05rem)', maxWidth: '520px', lineHeight: 1.8, textAlign: 'center' }}>Choose the cohort that fits where you are right now. Every program listed below is open for enrollment.</p>
        </div>
      </div>

      {step === 'browse' && (
        <section style={{ padding: 'clamp(3rem, 6vw, 5rem) 0' }}>
          <div className="container">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }} className="cohort-grid">
              {cohorts.map(cohort => (
                <div key={cohort.id} style={{ background: cohort.dark ? 'var(--navy)' : 'white', border: `2px solid ${selected === cohort.id ? 'var(--gold)' : 'rgba(0,23,55,0.1)'}`, borderRadius: '4px', overflow: 'hidden', transition: 'border-color 0.15s', cursor: cohort.status === 'upcoming' ? 'default' : 'pointer' }} onClick={() => cohort.status !== 'upcoming' && setSelected(cohort.id === selected ? null : cohort.id)}>
                  <div style={{ padding: '1.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>{cohort.tag}</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '0.25rem 0.6rem', borderRadius: '2px', background: cohort.status === 'active' ? 'rgba(200,136,32,0.15)' : 'rgba(255,255,255,0.08)', color: cohort.status === 'active' ? 'var(--gold)' : 'rgba(255,255,255,0.4)' }}>{cohort.status === 'active' ? 'Open' : 'Coming soon'}</span>
                    </div>
                    <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(1.5rem, 3vw, 2rem)', color: cohort.dark ? 'white' : 'var(--navy)', letterSpacing: '0.04em', lineHeight: 1, marginBottom: '0.5rem' }}>{cohort.program}</h3>
                    <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.1em', color: cohort.dark ? 'rgba(255,255,255,0.45)' : 'var(--slate)', marginBottom: '1.5rem' }}>{cohort.dates}</p>

                    <div style={{ marginBottom: '1.25rem' }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '0.6rem' }}>Sessions</span>
                      {cohort.sessions.map(s => (
                        <p key={s} style={{ fontSize: '0.82rem', color: cohort.dark ? 'rgba(255,255,255,0.55)' : 'var(--slate)', lineHeight: 1.5, marginBottom: '0.3rem' }}>{s}</p>
                      ))}
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '0.6rem' }}>What is included</span>
                      {cohort.includes.map(i => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: cohort.dark ? 'rgba(255,255,255,0.55)' : 'var(--slate)', marginBottom: '0.3rem' }}>
                          <span style={{ color: 'var(--gold)', fontSize: '0.7rem' }}>&#10003;</span>{i}
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 0', borderTop: `1px solid ${cohort.dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,23,55,0.08)'}` }}>
                      <div>
                        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.75rem', color: cohort.dark ? 'white' : 'var(--navy)', letterSpacing: '0.04em' }}>{cohort.cost}</span>
                        <span style={{ display: 'block', fontSize: '0.72rem', color: cohort.dark ? 'rgba(255,255,255,0.35)' : 'var(--slate)', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em' }}>{cohort.spots}</span>
                      </div>
                      {cohort.status !== 'upcoming' && (
                        <button onClick={() => setSelected(cohort.id === selected ? null : cohort.id)} style={{ padding: '0.65rem 1.25rem', background: selected === cohort.id ? 'var(--gold)' : 'transparent', color: selected === cohort.id ? 'var(--navy)' : 'var(--gold)', border: '2px solid var(--gold)', borderRadius: '2px', fontFamily: "'Montserrat', sans-serif", fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.15s' }}>
                          {selected === cohort.id ? 'Selected ✓' : 'Select'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {selected && (
              <div style={{ marginTop: '2.5rem', textAlign: 'center' }}>
                <p style={{ color: 'var(--slate)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>You selected <strong style={{ color: 'var(--navy)' }}>{selectedCohort?.program} — {selectedCohort?.dates}</strong></p>
                <button onClick={() => setStep('form')} className="btn btn-primary" style={{ fontSize: '1rem', padding: '1rem 2.5rem' }}>
                  Continue to Registration
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {step === 'form' && selectedCohort && (
        <section style={{ padding: 'clamp(3rem, 6vw, 5rem) 0' }}>
          <div className="container" style={{ maxWidth: '640px' }}>
            <button onClick={() => setStep('browse')} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: '0.85rem', cursor: 'pointer', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}>
              &#8592; Back to cohorts
            </button>
            <div style={{ background: 'white', border: '1px solid rgba(0,23,55,0.1)', borderRadius: '4px', padding: '2rem', marginBottom: '2rem' }}>
              <span className="eyebrow" style={{ marginBottom: '0.5rem', display: 'block' }}>Registering for</span>
              <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.75rem', color: 'var(--navy)', letterSpacing: '0.04em' }}>{selectedCohort.program}</h3>
              <p style={{ color: 'var(--slate)', fontSize: '0.85rem', marginTop: '0.25rem' }}>{selectedCohort.dates} &middot; {selectedCohort.cost}</p>
            </div>

            <form onSubmit={e => { e.preventDefault(); setStep('confirm') }} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }} className="form-row">
                <div><label style={labelStyle}>Full name</label><input type="text" placeholder="Your full name" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} style={inputStyle} /></div>
                <div><label style={labelStyle}>Email</label><input type="email" placeholder="you@email.com" required value={form.email} onChange={e => setForm({...form, email: e.target.value})} style={inputStyle} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }} className="form-row">
                <div><label style={labelStyle}>Phone (optional)</label><input type="tel" placeholder="(000) 000-0000" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} style={inputStyle} /></div>
                <div><label style={labelStyle}>Organization (optional)</label><input type="text" placeholder="Your organization" value={form.org} onChange={e => setForm({...form, org: e.target.value})} style={inputStyle} /></div>
              </div>
              <div><label style={labelStyle}>Create a password</label><input type="password" placeholder="At least 8 characters" required minLength={8} value={form.password} onChange={e => setForm({...form, password: e.target.value})} style={inputStyle} /></div>
              <div><label style={labelStyle}>Confirm password</label><input type="password" placeholder="••••••••" required value={form.confirm} onChange={e => setForm({...form, confirm: e.target.value})} style={inputStyle} /></div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: '0.9rem', padding: '1rem' }}>
                Complete Registration
              </button>
              <p style={{ fontSize: '0.78rem', color: 'var(--slate)', textAlign: 'center', lineHeight: 1.6 }}>By registering you agree to our terms. Already have an account? <Link href="/login" style={{ color: 'var(--gold)' }}>Sign in</Link></p>
            </form>
          </div>
        </section>
      )}

      <style>{`
        @media (max-width: 800px) { .cohort-grid { grid-template-columns: 1fr !important; } }
        @media (max-width: 480px) { .form-row { grid-template-columns: 1fr !important; } }
        input:focus { border-color: var(--gold) !important; box-shadow: 0 0 0 3px rgba(200,136,32,0.12); }
      `}</style>
    </div>
  )
}
