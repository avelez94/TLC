'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function Resources() {
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target) } })
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' })
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <header className="page-hero">
        <div className="container">
          <span className="eyebrow">Resources</span>
          <h1>Articles, insights, and speaking.</h1>
          <p className="sub">Practical thinking on leadership, performance, and what it takes to create lasting impact.</p>
        </div>
      </header>

      <section className="content-section">
        <div className="container">
          <div className="reveal" style={{ background: 'var(--paper)', borderLeft: '3px solid var(--gold)', padding: '1.5rem 2rem', fontSize: '0.95rem', lineHeight: 1.75, color: 'var(--slate)', maxWidth: '600px', borderRadius: '0 2px 2px 0', marginBottom: '3rem' }}>
            <span className="eyebrow" style={{ display: 'block', marginBottom: '0.75rem' }}>Building the library</span>
            Resources are actively being added here. Return for articles, insights, and speaking information from Tramaine L. Crawford.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }} className="services-grid">
            {[
              { tag: 'Coming soon', title: 'Articles and Insights', desc: 'Practical thinking on leadership development and performance, written for people doing the work.', delay: '0s' },
              { tag: 'Coming soon', title: 'Speaking', desc: 'Tramaine speaks to organizations, conferences, and leadership programs on development, emerging leaders, and cultures of impact.', delay: '0.12s' },
              { tag: 'Phase 2', title: 'Downloads and Tools', desc: 'Frameworks, guides, and tools for leaders and organizations. These will live here when the library is ready.', delay: '0.24s' },
            ].map(({ tag, title, desc, delay }) => (
              <div key={title} className="reveal" style={{ background: 'white', border: '1px solid rgba(0,23,55,0.1)', borderRadius: '2px', padding: '2.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', transitionDelay: delay }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)' }}>{tag}</span>
                <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(1.5rem, 3vw, 2rem)', color: 'var(--navy)', letterSpacing: '0.04em', lineHeight: 1.1 }}>{title}</h3>
                <p style={{ color: 'var(--slate)', fontSize: '0.9rem', lineHeight: 1.75 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ background: 'var(--navy3)', padding: 'clamp(4.5rem, 9vw, 8rem) 0', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(200,136,32,0.07) 1px, transparent 1px)', backgroundSize: '36px 36px', pointerEvents: 'none' }} aria-hidden="true" />
        <div className="container reveal" style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(2.5rem, 7vw, 6rem)', color: 'white', letterSpacing: '0.04em', lineHeight: 1, marginBottom: '1rem' }}>Ready to create<br /><span style={{ color: 'var(--gold)' }}>greater impact?</span></h2>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '1rem', maxWidth: '480px', margin: '0 auto 2.5rem', lineHeight: 1.75 }}>One conversation is enough to figure out where to start.</p>
          <Link href="/contact" className="btn btn-primary">Schedule a Conversation</Link>
        </div>
      </section>

      <style>{`
        @media (max-width: 800px) { .services-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </>
  )
}
