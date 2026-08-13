'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'

export default function ParentCoaching() {
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target) } })
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' })
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  const discoveryLink = 'https://calendly.com/tramainecrawford/free-coaching-discovery-call'
  const link45 = 'https://calendly.com/tramainecrawford/45-minute-parent-coaching-session'
  const link60 = 'https://calendly.com/tramainecrawford/60-minute-parent-coaching-session'

  const topics = [
    'Career & Work',
    'Relationships & Boundaries',
    'Personal Growth & Confidence',
    'Life Transitions & What\u2019s Next',
    'Goals & Priorities',
    'Parenting & Family Decisions',
  ]

  const sessionHappens = [
    { title: 'Bring what\u2019s on your mind.', desc: 'You set the agenda. We focus on what matters most to you.' },
    { title: 'Think it through.', desc: 'I listen, ask questions, challenge assumptions when needed, and help you hear your own thinking more clearly.' },
    { title: 'Leave clearer.', desc: 'You\u2019ll leave with greater clarity about what matters and what you want to do next.' },
  ]

  const rightFor = [
    'Think through an important decision',
    'Get unstuck on something you\u2019ve been carrying',
    'Navigate a career or life transition',
    'Set or reconsider boundaries',
    'Work through competing priorities',
    'Build confidence in your next move',
    'Think through a parenting or family decision',
    'Turn an idea or goal into action',
  ]

  return (
    <>
      {/* HERO */}
      <section aria-label="Parent coaching introduction">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', alignItems: 'stretch', minHeight: '100svh', paddingTop: '115px' }} className="hero-split">
          <div style={{ background: 'var(--paper)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 'clamp(3rem, 7vw, 6rem) clamp(2rem, 5vw, 4rem)' }}>
            <div className="reveal" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ flex: '0 0 2.5rem', height: '1px', background: 'var(--gold)' }} aria-hidden="true" />
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', fontWeight: 700 }}>Coaching For Parents</span>
            </div>
            <h1 className="reveal" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(2.6rem, 6vw, 4.5rem)', color: 'var(--navy)', letterSpacing: '0.02em', lineHeight: 1, marginBottom: '0.5rem' }}>
                You carry a lot.
            </h1>
            <h2 className="reveal" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)', color: 'var(--gold)', letterSpacing: '0.02em', lineHeight: 1.15, marginBottom: '1.5rem', transitionDelay: '0.08s' }}>
              You don&rsquo;t have to think<br />through everything alone.
            </h2>
            <p className="reveal" style={{ fontSize: 'clamp(0.95rem, 2vw, 1.05rem)', color: 'var(--slate)', maxWidth: '480px', lineHeight: 1.8, marginBottom: '2rem', transitionDelay: '0.15s' }}>
              Professional coaching for parents navigating work, relationships, personal growth, family, important decisions, and what&rsquo;s next.
            </p>
            <div className="reveal" style={{ transitionDelay: '0.2s' }}>
              <a href={discoveryLink} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ display: 'inline-block' }}>
                Schedule a Free Discovery Session
              </a>
            </div>
          </div>
          <div style={{ position: 'relative', minHeight: '100%' }} aria-hidden="true">
            <Image src="/images/parent-coaching-hero.jpg" alt="Parent working through a decision at her desk" fill style={{ objectFit: 'cover', objectPosition: 'center top' }} priority />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '4px', background: 'var(--gold)' }} />
          </div>
        </div>
      </section>

      {/* TOPICS */}
      <section style={{ background: 'var(--paper)', padding: 'clamp(3.5rem, 7vw, 6rem) 0', borderTop: '1px solid var(--mist)' }} aria-label="Topics">
        <div className="container">
          <h2 className="reveal" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', color: 'var(--navy)', letterSpacing: '0.03em', textAlign: 'center', marginBottom: '2.5rem' }}>
            What would you like space to think through?
          </h2>
          <div className="reveal topics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem', transitionDelay: '0.1s' }}>
            {topics.map(topic => (
              <div key={topic} style={{ background: 'white', border: '1px solid rgba(0,23,55,0.08)', borderRadius: '4px', padding: '1.5rem 1.25rem', textAlign: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80px' }}>
                {topic}
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', color: 'var(--slate)', fontSize: '0.9rem', lineHeight: 1.7 }}>
            You don&rsquo;t have to have everything figured out before you book.<br />Bring what&rsquo;s on your mind.
          </p>
        </div>
      </section>

      {/* PRICING */}
      <section style={{ background: 'white', padding: 'clamp(3.5rem, 7vw, 6rem) 0' }} aria-label="Choose the time you need">
        <div className="container">
          <h2 className="reveal" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', color: 'var(--navy)', letterSpacing: '0.03em', textAlign: 'center', marginBottom: '2.5rem' }}>
            Choose the time you need
          </h2>
          <div className="reveal pricing-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', maxWidth: '760px', margin: '0 auto 2rem', transitionDelay: '0.1s' }}>
            <div style={{ border: '1.5px solid var(--gold)', borderRadius: '6px', padding: '2rem', textAlign: 'center' }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--navy)', display: 'block', marginBottom: '0.5rem' }}>45 Minutes</span>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2.5rem', color: 'var(--gold)', letterSpacing: '0.03em', display: 'block', marginBottom: '0.75rem' }}>$45</span>
              <p style={{ color: 'var(--slate)', fontSize: '0.88rem', lineHeight: 1.65, marginBottom: '1.5rem' }}>Focused time to work through a specific decision, challenge, goal, or situation.</p>
              <a href={link45} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ display: 'inline-block', width: '100%', textAlign: 'center' }}>Book 45 Minutes</a>
            </div>
            <div style={{ border: '1.5px solid var(--navy)', borderRadius: '6px', padding: '2rem', textAlign: 'center' }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--navy)', display: 'block', marginBottom: '0.5rem' }}>60 Minutes</span>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2.5rem', color: 'var(--gold)', letterSpacing: '0.03em', display: 'block', marginBottom: '0.75rem' }}>$59</span>
              <p style={{ color: 'var(--slate)', fontSize: '0.88rem', lineHeight: 1.65, marginBottom: '1.5rem' }}>More time to explore something complex, gain perspective, and determine your next step.</p>
              <a href={link60} target="_blank" rel="noopener noreferrer" className="btn btn-ghost-dark" style={{ display: 'inline-block', width: '100%', textAlign: 'center', background: 'var(--navy)', color: 'white' }}>Book 60 Minutes</a>
            </div>
          </div>
          <p style={{ textAlign: 'center', color: 'var(--slate)', fontSize: '0.85rem' }}>No package. No long-term commitment. Book when you need it.</p>
        </div>
      </section>

      {/* LEADERSHIP BAND */}
      <section style={{ background: 'var(--navy)', padding: 'clamp(3rem, 6vw, 5rem) 0', textAlign: 'center' }} aria-label="Leadership starts with you">
        <div className="container reveal">
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', color: 'white', letterSpacing: '0.03em', marginBottom: '1.5rem' }}>
            <span style={{ borderBottom: '2px solid var(--gold)' }}>Leadership</span> doesn&rsquo;t <span style={{ borderBottom: '2px solid var(--gold)' }}>start</span> or stop at work.
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '1rem', lineHeight: 1.85, maxWidth: '620px', margin: '0 auto' }}>
            You lead in more places than you may realize. How you lead yourself shapes how you show up in your career, relationships, family, and the decisions that affect the people who depend on you.
          </p>
          <p style={{ color: 'var(--gold)', fontSize: '1rem', lineHeight: 1.85, maxWidth: '620px', margin: '1.25rem auto 0', fontStyle: 'italic' }}>
            Coaching creates space to step away from the noise, think clearly, and decide how you want to move forward.
          </p>
        </div>
      </section>

      {/* SESSION INFO */}
      <section style={{ background: 'var(--paper)', padding: 'clamp(3.5rem, 7vw, 6rem) 0' }} aria-label="What to expect">
        <div className="container">
          <div className="reveal session-info-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'clamp(2.5rem, 5vw, 4rem)' }}>
            <div>
              <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.4rem', color: 'var(--navy)', letterSpacing: '0.03em', marginBottom: '0.5rem', borderBottom: '2px solid var(--gold)', display: 'inline-block', paddingBottom: '0.25rem' }}>
                What happens in a coaching session?
              </h3>
              <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {sessionHappens.map(({ title, desc }) => (
                  <div key={title}>
                    <p style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '0.95rem', marginBottom: '0.35rem' }}>{title}</p>
                    <p style={{ color: 'var(--slate)', fontSize: '0.88rem', lineHeight: 1.7 }}>{desc}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.4rem', color: 'var(--navy)', letterSpacing: '0.03em', marginBottom: '0.5rem', borderBottom: '2px solid var(--gold)', display: 'inline-block', paddingBottom: '0.25rem' }}>
                Is coaching right for what I&rsquo;m dealing with?
              </h3>
              <p style={{ color: 'var(--slate)', fontSize: '0.88rem', marginTop: '1.5rem', marginBottom: '0.75rem' }}>Coaching may be a good fit when you want to:</p>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.55rem', marginBottom: '1.25rem' }}>
                {rightFor.map(item => (
                  <li key={item} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', fontSize: '0.88rem', color: 'var(--slate)', lineHeight: 1.5 }}>
                    <span style={{ color: 'var(--gold)', flexShrink: 0 }}>&#10003;</span>{item}
                  </li>
                ))}
              </ul>
              <p style={{ color: 'var(--slate)', fontSize: '0.78rem', paddingTop: '0.75rem', borderTop: '1px solid var(--mist)' }}>
                Coaching is not therapy, financial advice, legal advice, or crisis support.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA BAND */}
      <section style={{ background: 'var(--gold)', padding: 'clamp(2.5rem, 5vw, 3.5rem) 0' }} aria-label="Get started">
        <div className="container reveal cta-band" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(1.5rem, 3vw, 2rem)', color: 'white', letterSpacing: '0.02em', marginBottom: '0.35rem' }}>What&rsquo;s on your mind?</h3>
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.9rem' }}>You don&rsquo;t have to figure it out alone.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <div style={{ textAlign: 'center' }}>
                <span style={{ display: 'block', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase' }}>45 Minutes</span>
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', color: 'white' }}>$45</span>
              </div>
              <div style={{ textAlign: 'center' }}>
                <span style={{ display: 'block', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase' }}>60 Minutes</span>
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', color: 'white' }}>$59</span>
              </div>
            </div>
            <a href={discoveryLink} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', background: 'var(--navy)', color: 'white', padding: '0.85rem 1.75rem', borderRadius: '3px', fontFamily: "'Montserrat', sans-serif", fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
              Schedule a Free Discovery Session
            </a>
          </div>
        </div>
        <p style={{ textAlign: 'center', color: 'white', fontSize: '0.85rem', marginTop: '1.5rem' }}>
          Have questions first? <a href={discoveryLink} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--navy)', fontWeight: 700, textDecoration: 'underline' }}>Schedule a free discovery session.</a>
        </p>
      </section>

      <style>{`
        @media (max-width: 860px) {
          .hero-split { grid-template-columns: 1fr !important; min-height: auto !important; }
          .hero-split > div:first-child { min-height: 60svh; }
          .hero-split > div:last-child { min-height: 420px !important; }
        }
        @media (max-width: 720px) {
          .topics-grid { grid-template-columns: 1fr 1fr !important; }
          .pricing-grid { grid-template-columns: 1fr !important; }
          .session-info-grid { grid-template-columns: 1fr !important; }
          .cta-band { flex-direction: column; align-items: flex-start !important; }
        }
        @media (max-width: 480px) {
          .topics-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  )
}