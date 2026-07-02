'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function Contact() {
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '', email: '', phone: '', org: '', interest: '', message: ''
  })

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target) } })
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' })
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.error) {
        setError('Something went wrong. Please try again or email us directly.')
      } else {
        setSubmitted(true)
      }
    } catch {
      setError('Something went wrong. Please try again or email us directly.')
    }
    setSubmitting(false)
  }

  const inputStyle = {
    padding: '0.8rem 1rem',
    border: '1.5px solid rgba(0,23,55,0.18)',
    borderRadius: '2px',
    fontFamily: "'Montserrat', sans-serif",
    fontSize: '0.94rem',
    color: 'var(--ink)',
    background: 'white',
    width: '100%',
    outline: 'none',
  }

  const labelStyle = {
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--ink)',
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
  }

  return (
    <>
      <header className="page-hero">
        <div className="container">
          <span className="eyebrow">Contact</span>
          <h1>Let&apos;s start a conversation.</h1>
          <p className="sub">Whether you are an individual, an organization, or still figuring out the right next step, reach out. One conversation is enough to figure out where to start.</p>
        </div>
      </header>

      <section className="content-section">
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 'clamp(3rem, 6vw, 5rem)', alignItems: 'start' }} className="contact-grid">
            <div className="reveal">
              <span className="gold-bar" aria-hidden="true" style={{ marginBottom: '1.75rem' }} />
              {submitted ? (
                <div style={{ padding: '1.1rem 1.35rem', background: 'rgba(200,136,32,0.1)', borderLeft: '3px solid var(--gold)', borderRadius: '0 2px 2px 0', fontSize: '0.92rem', color: 'var(--ink)', lineHeight: 1.65 }}>
                  Thank you, {form.name}. Your message was sent and Tramaine will be in touch shortly. Check your email for a confirmation.
                </div>
              ) : (
                <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                  {error && (
                    <div style={{ padding: '0.85rem 1rem', background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.2)', borderRadius: '2px', color: '#cc2200', fontSize: '0.88rem' }}>
                      {error}
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }} className="form-row">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <label style={labelStyle}>Name</label>
                      <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Your full name" required style={inputStyle} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <label style={labelStyle}>Email</label>
                      <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="your@email.com" required style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }} className="form-row">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <label style={labelStyle}>Phone (optional)</label>
                      <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="(000) 000-0000" style={inputStyle} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <label style={labelStyle}>Organization (optional)</label>
                      <input type="text" value={form.org} onChange={e => setForm({ ...form, org: e.target.value })} placeholder="Your organization" style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={labelStyle}>Area of interest</label>
                    <select value={form.interest} onChange={e => setForm({ ...form, interest: e.target.value })} required style={{ ...inputStyle, appearance: 'none' }}>
                      <option value="" disabled>Select an area</option>
                      <option value="consulting">Leadership Consulting</option>
                      <option value="coaching">Performance & Success Coaching</option>
                      <option value="finders">The Impact Lab — Impact Finders</option>
                      <option value="makers">The Impact Lab — Impact Makers</option>
                      <option value="leaders">The Impact Lab — Impact Leaders</option>
                      <option value="speaking">Speaking</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={labelStyle}>Message</label>
                    <textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} placeholder="Tell us a little about what you are looking for..." required rows={5} style={{ ...inputStyle, resize: 'vertical' }} />
                  </div>
                  <button type="submit" disabled={submitting} className="btn btn-primary" style={{ alignSelf: 'flex-start', opacity: submitting ? 0.6 : 1 }}>
                    {submitting ? 'Sending...' : 'Send Message'}
                  </button>
                </form>
              )}
            </div>

            <div className="reveal" style={{ transitionDelay: '0.12s' }}>
              <span className="eyebrow">Direct contact</span>
              <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.7rem', letterSpacing: '0.04em', color: 'var(--navy)', margin: '0.75rem 0' }}>Reach out directly.</h3>
              <p style={{ color: 'var(--slate)', fontSize: '0.92rem', lineHeight: 1.75, marginBottom: '1.5rem' }}>For time-sensitive inquiries or if you prefer a direct conversation, here is how to reach Tramaine.</p>
              {[
                { icon: '✉', label: 'Email', value: 'tramaine@tramainecrawford.com', href: 'mailto:tramaine@tramainecrawford.com' },
                { icon: '✆', label: 'Phone', value: '(202) 599-1381', href: 'tel:+12025991381' },
                { icon: '🔗', label: 'LinkedIn', value: 'Connect on LinkedIn', href: 'https://www.linkedin.com/in/mrcrawfordceo/' },
                { icon: '📍', label: 'Address', value: '2001 L St NW, Suite 500, Washington, DC 20036', href: 'https://maps.google.com/?q=2001+L+St+NW+Suite+500+Washington+DC+20036' },
              ].map(({ icon, label, value, href }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', padding: '1rem 0', borderTop: '1px solid var(--mist)' }}>
                  <span style={{ fontSize: '1.1rem', minWidth: '1.5rem' }} aria-hidden="true">{icon}</span>
                  <div>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '0.2rem' }}>{label}</span>
                    <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noopener noreferrer' : undefined} style={{ color: 'var(--ink)', fontSize: '0.92rem', textDecoration: 'none' }}>{value}</a>
                  </div>
                </div>
              ))}
              <div style={{ marginTop: '2rem', background: 'var(--navy)', borderRadius: '2px', padding: '1.5rem' }}>
                <span className="eyebrow" style={{ display: 'block', marginBottom: '0.75rem' }}>Prefer to schedule directly?</span>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.88rem', lineHeight: 1.7, marginBottom: '1rem' }}>Pick a time that works and Tramaine will be there.</p>
                <Link href="/contact" className="btn btn-primary">Schedule a Conversation</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <style>{`
        @media (max-width: 720px) { .contact-grid { grid-template-columns: 1fr !important; } }
        @media (max-width: 480px) { .form-row { grid-template-columns: 1fr !important; } }
        input:focus, textarea:focus, select:focus { border-color: var(--gold) !important; box-shadow: 0 0 0 3px rgba(200,136,32,0.1); }
      `}</style>
    </>
  )
}