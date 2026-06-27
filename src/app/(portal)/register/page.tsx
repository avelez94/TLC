'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

interface Program {
  id: string
  name: string
  description: string | null
  type: string
  price: number | null
  price_label: string | null
  session_day: string | null
  session_time: string | null
  duration_weeks: number | null
}

interface Cohort {
  id: string
  program_id: string
  name: string
  start_date: string | null
  end_date: string | null
  status: string
  programs?: Program
}

interface CohortSession {
  id: string
  cohort_id: string
  session_number: number
  title: string
  session_date: string | null
}

interface ProgramInclude {
  id: string
  program_id: string
  item: string
  sort_order: number
}

export default function Register() {
  const [programs, setPrograms] = useState<Program[]>([])
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [sessions, setSessions] = useState<CohortSession[]>([])
  const [includes, setIncludes] = useState<ProgramInclude[]>([])
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null)
  const [selectedCohort, setSelectedCohort] = useState<Cohort | null>(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<'program' | 'cohort' | 'form' | 'success'>('program')
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    organization: '',
    why: '',
  })

  useEffect(() => {
    const fetchData = async () => {
      const [
        { data: programsData },
        { data: cohortsData },
        { data: sessionsData },
        { data: includesData },
      ] = await Promise.all([
        supabase.from('programs').select('*').eq('type', 'cohort').order('name'),
        supabase.from('cohorts').select('*, programs(*)').in('status', ['active', 'upcoming']).order('start_date'),
        supabase.from('cohort_sessions').select('*').order('session_number'),
        supabase.from('program_includes').select('*').order('sort_order'),
      ])
      if (programsData) setPrograms(programsData)
      if (cohortsData) setCohorts(cohortsData)
      if (sessionsData) setSessions(sessionsData)
      if (includesData) setIncludes(includesData)
      setLoading(false)
    }
    fetchData()
  }, [])

  const programCohorts = selectedProgram
    ? cohorts.filter(c => c.program_id === selectedProgram.id)
    : []

  const cohortSessions = selectedCohort
    ? sessions.filter(s => s.cohort_id === selectedCohort.id)
    : []

  const programIncludes = selectedProgram
    ? includes.filter(i => i.program_id === selectedProgram.id)
    : []

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCohort || !selectedProgram) return
    setSubmitting(true)

    // If Leaders, just send inquiry email — no payment processing yet
    if (selectedProgram.price_label === 'Request a Quote') {
      // For now just show success — wire to email later
      setStep('success')
      setSubmitting(false)
      return
    }

    // For paid programs, create the user and enrollment
    // For now show success — payment processing comes later
    setStep('success')
    setSubmitting(false)
  }

  const inputStyle = {
    width: '100%', padding: '0.9rem 1rem',
    border: '1.5px solid rgba(0,23,55,0.15)',
    borderRadius: '3px', color: 'var(--ink)',
    fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.94rem',
    outline: 'none', background: 'white',
  }

  const labelStyle = {
    fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.65rem',
    letterSpacing: '0.18em', textTransform: 'uppercase' as const,
    color: 'var(--slate)', marginBottom: '0.4rem', display: 'block'
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.5rem', color: 'white', letterSpacing: '0.08em' }}>Loading...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', fontFamily: 'var(--font-montserrat), sans-serif' }}>

      {/* HEADER */}
      <div style={{ background: 'var(--navy)', padding: 'clamp(1.25rem, 3vw, 1.75rem) clamp(1.25rem, 5vw, 2.75rem)', borderBottom: '1px solid rgba(200,136,32,0.15)' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/">
            <Image src="/images/tlc-logo.png" alt="TLC Leadership" width={80} height={68} style={{ height: '68px', width: 'auto' }} />
          </Link>
          <Link href="/impact" style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.65rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>
            &#8592; Back to Impact Lab
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: 'clamp(2rem, 5vw, 4rem) clamp(1.25rem, 5vw, 2.75rem)' }}>

        {/* STEP 1 — SELECT PROGRAM */}
        {step === 'program' && (
          <div>
            <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.62rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '0.75rem' }}>The Impact Lab</span>
            <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(2rem, 5vw, 3.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', lineHeight: 1, marginBottom: '0.75rem' }}>Join a Cohort</h1>
            <p style={{ color: 'var(--slate)', fontSize: '0.95rem', lineHeight: 1.75, marginBottom: '2.5rem' }}>Choose the program that is right for where you are. Each one is designed to meet you at your current stage of growth.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {programs.map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedProgram(p)
                    setSelectedCohort(null)
                    setStep('cohort')
                  }}
                  style={{ width: '100%', padding: '1.75rem', background: 'white', border: '1.5px solid rgba(0,23,55,0.1)', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s, box-shadow 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--gold)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 20px rgba(200,136,32,0.08)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,23,55,0.1)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                    <h2 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.75rem', color: 'var(--navy)', letterSpacing: '0.04em' }}>{p.name}</h2>
                    <span style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.5rem', color: 'var(--gold)', letterSpacing: '0.04em', flexShrink: 0 }}>
                      {p.price_label || 'Contact Us'}
                    </span>
                  </div>
                  {p.description && <p style={{ color: 'var(--slate)', fontSize: '0.88rem', lineHeight: 1.7, marginBottom: '0.75rem' }}>{p.description}</p>}
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    {cohorts.filter(c => c.program_id === p.id).length > 0 && (
                      <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                        {cohorts.filter(c => c.program_id === p.id).length} cohort{cohorts.filter(c => c.program_id === p.id).length !== 1 ? 's' : ''} available
                      </span>
                    )}
                    {p.session_day && p.session_time && (
                      <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: 'var(--slate)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                        {p.session_day}s at {p.session_time}
                      </span>
                    )}
                    {p.duration_weeks && (
                      <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: 'var(--slate)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                        {p.duration_weeks} weeks
                      </span>
                    )}
                  </div>
                  {cohorts.filter(c => c.program_id === p.id).length === 0 && (
                    <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: 'var(--slate)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginTop: '0.5rem' }}>
                      No cohorts currently open — check back soon
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div style={{ textAlign: 'center', marginTop: '2rem' }}>
              <Link href="/login" style={{ color: 'var(--slate)', fontSize: '0.85rem' }}>Already registered? Sign in &#8594;</Link>
            </div>
          </div>
        )}

        {/* STEP 2 — SELECT COHORT */}
        {step === 'cohort' && selectedProgram && (
          <div>
            <button onClick={() => setStep('program')} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: '0.85rem', cursor: 'pointer', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, padding: 0 }}>
              &#8592; Back
            </button>

            <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.62rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '0.5rem' }}>{selectedProgram.name}</span>
            <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(2rem, 5vw, 3rem)', color: 'var(--navy)', letterSpacing: '0.04em', lineHeight: 1, marginBottom: '2rem' }}>Select a Cohort</h1>

            {programCohorts.length === 0 ? (
              <div style={{ background: 'white', border: '1px solid rgba(0,23,55,0.08)', borderRadius: '6px', padding: '3rem', textAlign: 'center' }}>
                <p style={{ color: 'var(--slate)', fontSize: '0.9rem', lineHeight: 1.7 }}>No cohorts are currently open for {selectedProgram.name}. Check back soon or <Link href="/contact" style={{ color: 'var(--gold)' }}>contact us</Link> to be notified when the next one opens.</p>
              </div>
            ) : programCohorts.map(cohort => {
              const cohortSessionList = sessions.filter(s => s.cohort_id === cohort.id)
              return (
                <button
                  key={cohort.id}
                  onClick={() => { setSelectedCohort(cohort); setStep('form') }}
                  style={{ width: '100%', padding: '1.75rem', background: 'white', border: '1.5px solid rgba(0,23,55,0.1)', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', marginBottom: '1rem', transition: 'border-color 0.15s, box-shadow 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--gold)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 20px rgba(200,136,32,0.08)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,23,55,0.1)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div>
                      <h2 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.5rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>{cohort.name}</h2>
                      {cohort.start_date && cohort.end_date && (
                        <p style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.65rem', color: 'var(--slate)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                          {formatDate(cohort.start_date)} to {formatDate(cohort.end_date)}
                        </p>
                      )}
                      {(cohort as any).session_day && (cohort as any).session_time && (
                        <p style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.65rem', color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '0.25rem' }}>
                          {(cohort as any).session_day}s at {(cohort as any).session_time}
                        </p>
                      )}
                    </div>
                    <span style={{ background: cohort.status === 'active' ? 'rgba(200,136,32,0.1)' : 'rgba(0,23,55,0.06)', color: cohort.status === 'active' ? 'var(--gold)' : 'var(--navy)', fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.25rem 0.75rem', borderRadius: '2px' }}>
                      {cohort.status === 'active' ? 'Enrolling Now' : 'Coming Soon'}
                    </span>
                  </div>

                  {cohortSessionList.length > 0 && (
                    <div style={{ marginBottom: '1.25rem' }}>
                      <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '0.75rem' }}>Sessions</span>
                      {cohortSessionList.map(s => (
                        <div key={s.id} style={{ display: 'flex', gap: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid var(--mist)', alignItems: 'flex-start' }}>
                          <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: 'var(--gold)', letterSpacing: '0.08em', flexShrink: 0, paddingTop: '0.1rem' }}>
                            {s.session_date ? formatDate(s.session_date) : `Session ${s.session_number}`}
                          </span>
                          <span style={{ color: 'var(--ink)', fontSize: '0.88rem', lineHeight: 1.5 }}>{s.title}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {programIncludes.length > 0 && (
                    <div>
                      <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '0.75rem' }}>What is included</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {programIncludes.map(inc => (
                          <div key={inc.id} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                            <span style={{ color: 'var(--gold)', fontSize: '0.85rem', flexShrink: 0 }}>✓</span>
                            <span style={{ color: 'var(--ink)', fontSize: '0.88rem', lineHeight: 1.5 }}>{inc.item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.5rem', color: 'var(--gold)', letterSpacing: '0.04em' }}>
                      {selectedProgram.price_label || 'Contact Us'}
                    </span>
                    <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.65rem', color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                      Register &#8594;
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* STEP 3 — REGISTRATION FORM */}
        {step === 'form' && selectedProgram && selectedCohort && (
          <div>
            <button onClick={() => setStep('cohort')} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: '0.85rem', cursor: 'pointer', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, padding: 0 }}>
              &#8592; Back
            </button>

            <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.62rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '0.5rem' }}>Registration</span>
            <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(2rem, 5vw, 3rem)', color: 'var(--navy)', letterSpacing: '0.04em', lineHeight: 1, marginBottom: '0.5rem' }}>You are joining</h1>
            <p style={{ color: 'var(--slate)', fontSize: '0.95rem', marginBottom: '0.25rem', fontWeight: 600 }}>{selectedCohort.name}</p>
            {selectedCohort.start_date && (
              <p style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.65rem', color: 'var(--slate)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '2rem' }}>
                {formatDate(selectedCohort.start_date)} to {formatDate(selectedCohort.end_date)}
              </p>
            )}

            {/* Order summary */}
            <div style={{ background: 'var(--navy)', borderRadius: '6px', padding: '1.5rem', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <div>
                  <p style={{ color: 'white', fontWeight: 600, fontSize: '0.9rem' }}>{selectedProgram.name}</p>
                  <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.78rem' }}>{selectedCohort.name}</p>
                </div>
                <span style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.5rem', color: 'var(--gold)', letterSpacing: '0.04em' }}>
                  {selectedProgram.price_label || 'Quote'}
                </span>
              </div>
              {programIncludes.slice(0, 3).map(inc => (
                <div key={inc.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <span style={{ color: 'var(--gold)', fontSize: '0.8rem' }}>✓</span>
                  <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem' }}>{inc.item}</span>
                </div>
              ))}
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>First and Last Name</label>
                  <input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="Jane Smith" style={inputStyle} required />
                </div>
                <div>
                  <label style={labelStyle}>Email Address</label>
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="jane@email.com" style={inputStyle} required />
                </div>
                <div>
                  <label style={labelStyle}>Phone Number</label>
                  <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="(301) 555-0000" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Organization (optional)</label>
                  <input value={form.organization} onChange={e => setForm({ ...form, organization: e.target.value })} placeholder="Where do you work?" style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>
                  {selectedProgram.price_label === 'Request a Quote'
                    ? 'Tell us about your team or organization'
                    : 'Why do you want to join this program?'}
                </label>
                <textarea value={form.why} onChange={e => setForm({ ...form, why: e.target.value })} placeholder={selectedProgram.price_label === 'Request a Quote' ? 'Tell us about your team size, goals, and what you are looking for...' : 'What are you hoping to get out of this experience?'} rows={4} style={{ ...inputStyle, resize: 'vertical' }} required />
              </div>
              <button
                type="submit"
                disabled={submitting}
                style={{ width: '100%', padding: '1rem', background: submitting ? 'rgba(200,136,32,0.5)' : 'var(--gold)', color: 'var(--navy)', border: 'none', borderRadius: '3px', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: submitting ? 'not-allowed' : 'pointer' }}
              >
                {submitting ? 'Submitting...' : selectedProgram.price_label === 'Request a Quote' ? 'Submit Request' : `Register for ${selectedProgram.price_label}`}
              </button>
              <p style={{ color: 'var(--slate)', fontSize: '0.78rem', textAlign: 'center', lineHeight: 1.6 }}>
                {selectedProgram.price_label === 'Request a Quote'
                  ? 'We will follow up within 24 hours to discuss your team.'
                  : 'After registering you will receive an email with next steps and payment instructions.'}
              </p>
            </form>
          </div>
        )}

        {/* STEP 4 — SUCCESS */}
        {step === 'success' && selectedProgram && selectedCohort && (
          <div style={{ textAlign: 'center', padding: '3rem 0' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', fontSize: '1.5rem' }}>✓</div>
            <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.62rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '0.75rem' }}>
              {selectedProgram.price_label === 'Request a Quote' ? 'Request received' : 'Registration received'}
            </span>
            <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(2rem, 5vw, 3rem)', color: 'var(--navy)', letterSpacing: '0.04em', lineHeight: 1, marginBottom: '1rem' }}>
              {selectedProgram.price_label === 'Request a Quote' ? 'We will be in touch.' : 'You are in.'}
            </h1>
            <p style={{ color: 'var(--slate)', fontSize: '0.95rem', lineHeight: 1.75, maxWidth: '480px', margin: '0 auto 2rem' }}>
              {selectedProgram.price_label === 'Request a Quote'
                ? `Thank you for your interest in ${selectedProgram.name}. We will follow up within 24 hours to discuss your team and next steps.`
                : `Thank you for registering for ${selectedCohort.name}. Check your email for confirmation and next steps. We look forward to seeing you.`}
            </p>
            <Link href="/" className="btn btn-primary" style={{ fontSize: '0.85rem' }}>Back to Home</Link>
          </div>
        )}

      </div>

      <style>{`
        input:focus, textarea:focus { border-color: var(--gold) !important; box-shadow: 0 0 0 3px rgba(200,136,32,0.1); }
        input::placeholder, textarea::placeholder { color: rgba(0,23,55,0.3); }
      `}</style>
    </div>
  )
}