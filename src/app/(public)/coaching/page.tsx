'use client'

import { useEffect } from 'react'
import Image from 'next/image'

export default function Coaching() {
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target) } })
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' })
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  const discoveryLink = 'https://calendly.com/tramainecrawford/30-minute-zoom-meeting?month=2026-07'

  const whoIWorkWith = [
    { title: 'Emerging Leaders', desc: 'Preparing for greater responsibility, strengthening confidence, and becoming more intentional about how they lead.' },
    { title: 'New Managers & Supervisors', desc: 'Adjusting to the shift from doing the work to leading people, managing expectations, and being accountable for results.' },
    { title: 'Mid-Career Professionals', desc: 'Thinking more intentionally about growth, direction, impact, and what they want from the next stage of their career.' },
    { title: 'Professionals Navigating Career Transitions', desc: 'Working through change, uncertainty, new opportunities, important decisions, and what\u2019s next.' },
  ]

  const whatWeCanWorkOn = [
    { title: 'Growth', desc: 'Preparing for more, expanding your capabilities, and stepping into your next level.' },
    { title: 'Leadership', desc: 'Leading others, building trust, communicating clearly, and increasing your influence.' },
    { title: 'Career', desc: 'Direction, advancement, new opportunities, professional identity, and what\u2019s next.' },
    { title: 'Change', desc: 'Promotions, new roles, career transitions, and changing expectations.' },
    { title: 'Challenges', desc: 'Confidence, difficult conversations, relationships, competing priorities, or feeling stuck.' },
    { title: 'Decisions', desc: 'Important choices, clarity, priorities, and situations where there isn\u2019t an obvious answer.' },
  ]

  const howWeWork = [
    { n: '01', title: 'Focus', desc: 'We define what matters most, the challenge, opportunity, decision, or transition, the outcomes you want, and what meaningful progress looks like.' },
    { n: '02', title: 'Coach', desc: 'Through one-to-one conversations, we explore thinking, challenge assumptions, build awareness, and consider new possibilities.' },
    { n: '03', title: 'Apply', desc: 'You put insight into practice in real conversations, decisions, relationships, and situations. We reflect on what happened, learn from it, and adjust the work.' },
  ]

  return (
    <>
      {/* HERO */}
      <section aria-label="Leadership and professional coaching" style={{ paddingTop: '115px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '0.68fr 1.32fr', alignItems: 'stretch', minHeight: '78vh' }} className="hero-split">
          <div style={{ background: 'var(--paper)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 'clamp(3rem, 7vw, 6rem) clamp(2rem, 5vw, 4rem)' }}>
            <div className="reveal" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ flex: '0 0 2.5rem', height: '1px', background: 'var(--gold)' }} aria-hidden="true" />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', fontWeight: 700 }}>Leadership &amp; Professional Coaching</span>
            </div>
            <h1 className="reveal" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(2.4rem, 5.5vw, 3.6rem)', color: 'var(--navy)', letterSpacing: '0.02em', lineHeight: 1.05, marginBottom: '1.25rem', transitionDelay: '0.05s' }}>
              When What&rsquo;s Next Requires Something Different From <span style={{ color: 'var(--gold)' }}>You.</span>
            </h1>
            <p className="reveal" style={{ color: 'var(--slate)', fontSize: '1rem', lineHeight: 1.85, maxWidth: '480px', marginBottom: '1.5rem', transitionDelay: '0.1s' }}>
              Coaching gives you dedicated space to work through leadership and career challenges, navigate change, make important decisions, and prepare for what&rsquo;s next.
            </p>
            <p className="reveal" style={{ color: 'var(--navy)', fontSize: '0.85rem', fontWeight: 700, lineHeight: 1.7, marginBottom: '2rem', transitionDelay: '0.15s' }}>
              For emerging leaders, new managers &amp; supervisors, mid-career professionals, and career transition professionals.
            </p>
            <a href={discoveryLink} target="_blank" rel="noopener noreferrer" className="btn btn-primary reveal" style={{ display: 'inline-block', transitionDelay: '0.2s' }}>
              Schedule a Discovery Call
            </a>
          </div>
          <div className="reveal hero-image-wrap" style={{ position: 'relative', minHeight: '100%', transitionDelay: '0.1s' }} aria-hidden="true">
            <Image src="/images/coaching-hero.jpg" alt="A coach facilitating a discussion with a small group of professionals" fill style={{ objectFit: 'cover', objectPosition: '75% center' }} priority />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, var(--paper) 0%, rgba(247,245,240,0.5) 8%, transparent 22%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '4px', background: 'var(--gold)' }} />
          </div>
        </div>
      </section>

      {/* WHO I WORK WITH */}
      <section style={{ background: 'white', padding: 'clamp(3.5rem, 7vw, 6rem) 0' }} aria-label="Who I work with">
        <div className="container coaching-wide" style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h2 className="reveal" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.03em', marginBottom: '0.5rem' }}>
            Who I Work With
          </h2>
          <div style={{ width: '3rem', height: '2px', background: 'var(--gold)', margin: '0 auto 1.5rem' }} />
          <p className="reveal" style={{ color: 'var(--slate)', fontSize: '0.95rem', lineHeight: 1.8, maxWidth: '640px', margin: '0 auto', transitionDelay: '0.06s' }}>
            My coaching practice primarily serves professionals navigating growth, greater responsibility, career decisions, and transition.
          </p>
        </div>
        <div className="container coaching-wide reveal-grid who-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'clamp(1.5rem, 3vw, 2rem)' }}>
          {whoIWorkWith.map(({ title, desc }, i) => (
            <div key={title} className="reveal" style={{ textAlign: 'center', padding: '0 0.5rem', borderLeft: i === 0 ? 'none' : '1px solid var(--mist)', transitionDelay: `${i * 0.06}s` }}>
              <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.05rem', color: 'var(--navy)', letterSpacing: '0.02em', marginBottom: '0.85rem', lineHeight: 1.3 }}>{title}</h3>
              <p style={{ color: 'var(--slate)', fontSize: '0.85rem', lineHeight: 1.7 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* WHAT WE CAN WORK ON */}
      <section style={{ background: 'var(--paper)', padding: 'clamp(3.5rem, 7vw, 6rem) 0' }} aria-label="What we can work on">
        <h2 className="reveal" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.03em', textAlign: 'center', marginBottom: '0.5rem' }}>
          What We Can Work On
        </h2>
        <div style={{ width: '3rem', height: '2px', background: 'var(--gold)', margin: '0 auto 3rem' }} />
        <div className="container coaching-wide reveal-grid work-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 'clamp(1rem, 2vw, 1.5rem)' }}>
          {whatWeCanWorkOn.map(({ title, desc }, i) => (
            <div key={title} className="reveal" style={{ textAlign: 'center', padding: '0 0.4rem', borderLeft: i === 0 ? 'none' : '1px solid rgba(0,23,55,0.1)', transitionDelay: `${i * 0.05}s` }}>
              <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '0.95rem', color: 'var(--navy)', letterSpacing: '0.03em', marginBottom: '0.75rem' }}>{title}</h3>
              <p style={{ color: 'var(--slate)', fontSize: '0.8rem', lineHeight: 1.65 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW WE WORK TOGETHER */}
      <section style={{ background: 'white', padding: 'clamp(3.5rem, 7vw, 6rem) 0' }} aria-label="How we work together">
        <h2 className="reveal" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.03em', textAlign: 'center', marginBottom: '0.5rem' }}>
          How We Work Together
        </h2>
        <div style={{ width: '3rem', height: '2px', background: 'var(--gold)', margin: '0 auto 3rem' }} />
        <div className="container coaching-wide reveal-grid how-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'clamp(1.5rem, 3vw, 2rem)', alignItems: 'flex-start' }}>
          {howWeWork.map(({ n, title, desc }, i) => (
            <div key={n} style={{ display: 'flex', alignItems: 'center' }}>
              <div className="reveal" style={{ flex: 1, transitionDelay: `${i * 0.08}s` }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2rem', color: 'var(--gold)', letterSpacing: '0.02em' }}>{n}</span>
                  <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.15rem', color: 'var(--navy)', letterSpacing: '0.03em' }}>{title}</h3>
                </div>
                <p style={{ color: 'var(--slate)', fontSize: '0.85rem', lineHeight: 1.75 }}>{desc}</p>
              </div>
              {i < howWeWork.length - 1 && (
                <span className="how-arrow" style={{ color: 'var(--gold)', fontSize: '1.5rem', padding: '0 1rem', flexShrink: 0 }} aria-hidden="true">&#8594;</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* TWO WAYS TO ENGAGE */}
      <section style={{ background: 'var(--paper)', padding: 'clamp(3rem, 6vw, 5rem) 0', borderTop: '1px solid var(--mist)' }} aria-label="Two ways to engage">
        <h2 className="reveal" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.03em', textAlign: 'center', marginBottom: '2.5rem' }}>
          Two Ways to Engage
        </h2>
        <div className="container coaching-wide reveal-grid engage-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'clamp(1.5rem, 3vw, 2rem)' }}>
          <div className="reveal" style={{ background: 'white', border: '1px solid rgba(0,23,55,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9' }}>
              <Image src="/images/coaching-individual.jpg" alt="A comfortable seating area for one-to-one coaching conversations" fill style={{ objectFit: 'cover' }} />
            </div>
            <div style={{ padding: '1.75rem' }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.68rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--slate)', display: 'block', marginBottom: '0.4rem' }}>For Individuals</span>
              <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem', color: 'var(--gold)', letterSpacing: '0.02em', marginBottom: '0.85rem' }}>Leadership &amp; Professional Coaching</h3>
              <p style={{ color: 'var(--slate)', fontSize: '0.87rem', lineHeight: 1.7, marginBottom: '1.5rem' }}>One-to-one coaching for professionals who want to grow, lead with greater impact, navigate challenges, and prepare for what&rsquo;s next.</p>
              <a href={discoveryLink} target="_blank" rel="noopener noreferrer" className="btn btn-ghost-dark" style={{ fontSize: '0.78rem', whiteSpace: 'normal' }}>Schedule a Discovery Call</a>
            </div>
          </div>
          <div className="reveal" style={{ background: 'white', border: '1px solid rgba(0,23,55,0.08)', borderRadius: '4px', overflow: 'hidden', transitionDelay: '0.08s' }}>
            <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9' }}>
              <Image src="/images/coaching-organizations.jpg" alt="An empty conference room prepared for organization-sponsored coaching sessions" fill style={{ objectFit: 'cover' }} />
            </div>
            <div style={{ padding: '1.75rem' }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.68rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--slate)', display: 'block', marginBottom: '0.4rem' }}>For Organizations</span>
              <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem', color: 'var(--gold)', letterSpacing: '0.02em', marginBottom: '0.85rem' }}>Organization-Sponsored Coaching</h3>
              <p style={{ color: 'var(--slate)', fontSize: '0.87rem', lineHeight: 1.7, marginBottom: '1.5rem' }}>Targeted coaching for leaders and high-potential employees aligned to your development priorities, transitions, and culture.</p>
              <a href="/contact" className="btn btn-ghost-dark" style={{ fontSize: '0.78rem', whiteSpace: 'normal', textAlign: 'center' }}>Discuss Organization-Sponsored Coaching</a>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA BAND */}
      <section style={{ background: 'var(--navy)', padding: 'clamp(2rem, 4vw, 2.5rem) 0' }} aria-label="Develop the leader, expand the impact">
        <div className="container coaching-wide reveal final-cta-band" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(1.4rem, 3vw, 1.85rem)', color: 'white', letterSpacing: '0.02em', lineHeight: 1.15 }}>
              Develop the Leader.<br />Expand the Impact.
            </h2>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.88rem', lineHeight: 1.7, maxWidth: '420px', flex: 1 }}>
            Whether you are investing in your own growth or the development of someone responsible for leading others, the first step is understanding what leadership requires next.
          </p>
          <a href={discoveryLink} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ flexShrink: 0, whiteSpace: 'normal' }}>
            Schedule a Discovery Call
          </a>
        </div>
      </section>

      <style>{`
        .coaching-wide { max-width: 1360px !important; }
        body { overflow-x: hidden; }
        @media (max-width: 860px) {
          .hero-split { grid-template-columns: 1fr !important; min-height: auto !important; }
          .hero-split > div:first-child { min-height: 60svh; }
          .hero-image-wrap { min-height: auto !important; aspect-ratio: 4/3; width: calc(100% - 2rem) !important; margin: 0 1rem; border-radius: 4px; overflow: hidden; }
          .who-grid { grid-template-columns: 1fr 1fr !important; }
          .who-grid > div { border-left: none !important; border-top: 1px solid var(--mist); padding-top: 1.5rem !important; }
          .who-grid > div:nth-child(1), .who-grid > div:nth-child(2) { border-top: none; padding-top: 0 !important; }
          .work-grid { grid-template-columns: 1fr 1fr !important; }
          .work-grid > div { border-left: none !important; border-top: 1px solid rgba(0,23,55,0.1); padding-top: 1.25rem !important; }
          .work-grid > div:nth-child(1), .work-grid > div:nth-child(2) { border-top: none; padding-top: 0 !important; }
        }
        @media (max-width: 720px) {
          .how-grid { grid-template-columns: 1fr !important; }
          .how-arrow { display: none; }
          .engage-grid { grid-template-columns: 1fr !important; }
          .final-cta-band { flex-direction: column; align-items: flex-start !important; text-align: left; }
        }
        @media (max-width: 480px) {
          .who-grid { grid-template-columns: 1fr !important; }
          .who-grid > div { border-top: 1px solid var(--mist) !important; padding-top: 1.5rem !important; }
          .who-grid > div:first-child { border-top: none !important; padding-top: 0 !important; }
          .work-grid { grid-template-columns: 1fr !important; }
          .work-grid > div { border-top: 1px solid rgba(0,23,55,0.1) !important; padding-top: 1.25rem !important; }
          .work-grid > div:first-child { border-top: none !important; padding-top: 0 !important; }
        }
      `}</style>
    </>
  )
}