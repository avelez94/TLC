'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'

export default function About() {
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
          <span className="eyebrow">About Tramaine L. Crawford</span>
          <h1>Builder of leaders.</h1>
          <p className="sub">For more than a decade, I have coached, trained, and developed leaders. That work began in the U.S. Army, where I learned that leadership is responsibility for people and for outcomes that matter, not a rank or a personality. It carried into federal leadership development, the classroom, and one-to-one coaching. The settings changed. The work did not. Develop the person, build the standard, and create something that holds after you leave the room.</p>
        </div>
      </header>

      <section className="content-section">
        <div className="container">
          <div className="two-col">
            <div className="prose reveal">
              <span className="gold-bar" aria-hidden="true" style={{ marginBottom: '1.75rem' }} />
              <h3>How I Work</h3>
              <p>Most development starts with a gap to fix. I start with what a person already has to build on, then set a standard worth reaching and put real structure behind it. I do not run one-off sessions and walk away. The work is built for what holds after the engagement ends, in how someone leads, decides, and shows up when no one is watching.</p>
              <h3>Philosophy</h3>
              <p>How you show up matters more than what your title says. A parent leading at home, a teacher shaping a classroom, and a manager bringing out the best in a team are doing the same fundamental work. TLC develops that capability with structure, clarity, and follow-through. Not a workshop that fades by the following week, but development built to last.</p>
              <h3>Why TLC Exists</h3>
              <p>Everyone deserves outstanding leadership, and everyone capable of leading deserves the development to get there. Too often that development is reserved for people who already hold the title. TLC exists to change that, providing the coaching and development that help people lead well, wherever they lead.</p>
            </div>
            <div className="reveal" style={{ transitionDelay: '0.12s' }}>
              <div style={{ position: 'relative', aspectRatio: '3/4', marginBottom: '2rem', borderRadius: '2px', overflow: 'hidden', borderBottom: '4px solid var(--gold)' }}>
                <Image src="/images/tramaine-photo.png" alt="Tramaine L. Crawford, founder of TLC Leadership Consulting and Coaching" fill style={{ objectFit: 'cover', objectPosition: 'center top' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                {[
                  'Coaching, training, and developing leaders for more than a decade',
                  'U.S. Army veteran',
                  'Built and managed federal leadership development programs',
                  'Former elementary school teacher',
                ].map(item => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.7rem 0', borderBottom: '1px solid var(--mist)', color: 'var(--slate)', fontSize: '0.88rem' }}>
                    <span style={{ color: 'var(--gold)', fontSize: '0.85rem', flexShrink: 0 }}>&#10003;</span> {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section style={{ background: 'var(--navy)', padding: 'clamp(4.5rem, 9vw, 8rem) 0', textAlign: 'center' }} aria-label="TLC values">
        <div className="container reveal" style={{ maxWidth: '640px' }}>
          <span className="eyebrow">Standards TLC holds</span>
          <blockquote style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 'clamp(1.3rem, 3vw, 1.9rem)', color: 'white', lineHeight: 1.5, margin: '1.25rem 0 2.5rem', fontStyle: 'italic', fontWeight: 400 }}>
            We communicate with respect, honesty, and belief in people&apos;s potential.
          </blockquote>
          <Link href="/contact" className="btn btn-primary">Schedule a Conversation</Link>
        </div>
      </section>
    </>
  )
}
