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

  const whyCards = [
    { title: 'What got you here may not be enough for what comes next.', body: 'Strong performance often creates the opportunity to lead. But doing the work well and leading people well require different capabilities.\n\nLeadership development doesn\u2019t end when someone receives the title. The demands simply change.' },
    { title: 'When leaders don\u2019t grow, the impact doesn\u2019t stop with them.', body: 'Leadership shows up in more than the leader\u2019s own performance.\n\nIt affects the people they develop, the decisions they make, the standards they tolerate, the culture they reinforce, and the results they produce.\n\nThat\u2019s why developing a leader is rarely an investment in one person alone.' },
    { title: 'Coaching isn\u2019t just for leaders who are struggling.', body: 'Sometimes something isn\u2019t working. Sometimes you\u2019re stepping into something bigger.\n\nAnd sometimes you\u2019re already performing well but recognize that your next level of responsibility will require something different from you.\n\nCoaching helps leaders move forward with greater clarity, confidence, and impact.' },
  ]

  const pillars = [
    { n: '01', title: 'Leadership Effectiveness', desc: 'Move from doing the work yourself to setting direction, developing people, creating accountability, and accomplishing results through others.' },
    { n: '02', title: 'Communication & Influence', desc: 'Navigate difficult conversations, communicate expectations clearly, listen differently, and increase your ability to influence without relying solely on authority.' },
    { n: '03', title: 'Transitions & Growth', desc: 'Adjust how you think and lead as promotions, expanded responsibilities, and changing expectations require more from you.' },
    { n: '04', title: 'Executive Presence & Self-Awareness', desc: 'Understand how others experience your leadership and become more intentional about the behaviors, reactions, and patterns shaping your impact.' },
  ]

  const howItWorks = [
    { n: '01', title: 'Focus', desc: 'We define what matters most, the leadership challenge, the outcomes you want, and what meaningful progress looks like.' },
    { n: '02', title: 'Coach', desc: 'Through one-to-one conversations, we explore thinking, challenge assumptions, build awareness, and consider new possibilities.' },
    { n: '03', title: 'Apply', desc: 'You put insight into practice in real conversations, decisions, and situations where leadership happens. We reflect on what happened, learn from it, and adjust the work.' },
  ]

  const orgAlignments = [
    'Leadership transitions',
    'Development plans',
    '360 feedback or assessment results',
    'High-potential development',
    'Succession preparation',
    'Leadership development programs',
    'Organizational change',
    'Identified leadership capabilities',
  ]

  return (
    <>
      {/* HERO */}
      <section aria-label="Executive and leadership coaching" style={{ background: 'var(--navy)', paddingTop: '115px' }}>
        <div className="container coaching-wide reveal-grid" style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 'clamp(2.5rem, 5vw, 4rem)', alignItems: 'center', padding: 'clamp(3rem, 6vw, 5rem) 0' }}>
          <div>
            <div className="reveal" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ flex: '0 0 2.5rem', height: '1px', background: 'var(--gold)' }} aria-hidden="true" />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', fontWeight: 700 }}>Executive &amp; Leadership Coaching</span>
            </div>
            <h1 className="reveal" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(2.4rem, 5vw, 3.75rem)', color: 'white', letterSpacing: '0.02em', lineHeight: 1.05, marginBottom: '1.25rem', transitionDelay: '0.05s' }}>
              Leadership Gets More Complex as Responsibility Grows.
            </h1>
            <p className="reveal" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1rem', lineHeight: 1.85, maxWidth: '520px', marginBottom: '2rem', transitionDelay: '0.1s' }}>
              The expectations increase. The decisions carry more weight. The relationships become more complicated. And how a leader thinks, communicates, responds, and influences others matters more than ever.
            </p>
            <div className="reveal hero-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '1.75rem', transitionDelay: '0.15s' }}>
              <div>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.68rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '0.5rem' }}>For Individual Leaders</span>
                <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.88rem', lineHeight: 1.7 }}>Coaching provides dedicated space to work through the challenges that come with greater responsibility.</p>
              </div>
              <div>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.68rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '0.5rem' }}>For Organizations</span>
                <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.88rem', lineHeight: 1.7 }}>Coaching provides targeted development that strengthens the people entrusted with leading others and delivering results.</p>
              </div>
            </div>
            <p className="reveal" style={{ color: 'var(--gold)', fontSize: '0.95rem', fontStyle: 'italic', marginBottom: '2rem', transitionDelay: '0.2s' }}>
              The work is individual. The impact extends far beyond the individual.
            </p>
            <a href={discoveryLink} target="_blank" rel="noopener noreferrer" className="btn btn-primary reveal" style={{ display: 'inline-block', transitionDelay: '0.25s' }}>
              Schedule a Discovery Call
            </a>
          </div>
          <div className="reveal hero-image-wrap" style={{ position: 'relative', width: '100%', aspectRatio: '4/5', borderRadius: '4px', overflow: 'hidden', transitionDelay: '0.1s' }}>
            <Image src="/images/coaching-hero.jpg" alt="Executive leader reflecting at his desk" fill style={{ objectFit: 'cover' }} priority />
          </div>
        </div>
      </section>

      {/* WHY THIS MATTERS — 3 COLUMN */}
      <section style={{ background: 'white', padding: 'clamp(3.5rem, 7vw, 6rem) 0' }} aria-label="Why leadership coaching matters">
        <div className="container coaching-wide reveal-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'clamp(2rem, 4vw, 3rem)' }}>
          {whyCards.map(({ title, body }, i) => (
            <div key={title} className="reveal" style={{ transitionDelay: `${i * 0.08}s` }}>
              <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.35rem', color: 'var(--navy)', letterSpacing: '0.02em', lineHeight: 1.2, marginBottom: '0.5rem' }}>{title}</h3>
              <div style={{ width: '2.5rem', height: '2px', background: 'var(--gold)', marginBottom: '1.1rem' }} />
              {body.split('\n\n').map((para, pi) => (
                <p key={pi} style={{ color: 'var(--slate)', fontSize: '0.87rem', lineHeight: 1.75, marginBottom: '0.9rem' }}>{para}</p>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* THE WORK BEHIND BETTER LEADERSHIP — NAVY BAND */}
      <section style={{ background: 'var(--navy)', padding: 'clamp(3rem, 6vw, 4.5rem) 0' }} aria-label="The work behind better leadership">
        <div className="container coaching-wide">
          <span className="reveal" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.68rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '2rem' }}>
            The Work Behind Better Leadership
          </span>
          <div className="reveal-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'clamp(1.5rem, 3vw, 2.5rem)' }}>
            {pillars.map(({ n, title, desc }, i) => (
              <div key={n} className="reveal" style={{ transitionDelay: `${i * 0.06}s` }}>
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2.25rem', color: 'var(--gold)', letterSpacing: '0.02em', display: 'block', marginBottom: '0.5rem' }}>{n}</span>
                <h4 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem', color: 'white', letterSpacing: '0.02em', lineHeight: 1.2, marginBottom: '0.65rem' }}>{title}</h4>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', lineHeight: 1.7 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CHALLENGE + HOW IT WORKS */}
      <section style={{ background: 'var(--paper)', padding: 'clamp(3.5rem, 7vw, 6rem) 0' }} aria-label="How coaching works">
        <div className="container coaching-wide reveal-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 'clamp(2.5rem, 5vw, 4rem)' }}>
          <div className="reveal">
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(1.75rem, 3.5vw, 2.4rem)', color: 'var(--navy)', letterSpacing: '0.02em', lineHeight: 1.1, marginBottom: '0.5rem' }}>
              You bring the challenge.<br />We work on the leader.
            </h2>
            <div style={{ width: '2.5rem', height: '2px', background: 'var(--gold)', marginBottom: '1.5rem' }} />
            <p style={{ color: 'var(--slate)', fontSize: '0.9rem', lineHeight: 1.8, marginBottom: '1rem' }}>
              The issue that brings someone to coaching isn&rsquo;t always the real work.
            </p>
            <p style={{ color: 'var(--slate)', fontSize: '0.9rem', lineHeight: 1.8, marginBottom: '1rem' }}>
              A delegation problem may involve trust. A difficult conversation may involve conflict avoidance. A transition problem may require letting go of behaviors that worked at a previous level.
            </p>
            <p style={{ color: 'var(--slate)', fontSize: '0.9rem', lineHeight: 1.8, marginBottom: '1.5rem' }}>
              Coaching creates space to look beneath the immediate challenge, at the thinking, assumptions, behaviors, and patterns influencing how the leader responds.
            </p>
            <p style={{ color: 'var(--navy)', fontSize: '0.9rem', fontWeight: 700, lineHeight: 1.7 }}>
              Solving today&rsquo;s problem matters.<br />Developing the person who will face tomorrow&rsquo;s problems matters more.
            </p>
          </div>
          <div className="reveal" style={{ transitionDelay: '0.1s' }}>
            <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', color: 'var(--navy)', letterSpacing: '0.02em', marginBottom: '0.5rem' }}>How coaching works</h3>
            <div style={{ width: '2.5rem', height: '2px', background: 'var(--gold)', marginBottom: '1.5rem' }} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {howItWorks.map(({ n, title, desc }, i) => (
                <div key={n} style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start', padding: '1.35rem 0', borderTop: i === 0 ? 'none' : '1px solid rgba(0,23,55,0.08)' }}>
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', color: 'var(--gold)', letterSpacing: '0.02em', minWidth: '2.5rem' }}>{n}</span>
                  <div>
                    <h4 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.05rem', color: 'var(--navy)', letterSpacing: '0.02em', marginBottom: '0.3rem' }}>{title}</h4>
                    <p style={{ color: 'var(--slate)', fontSize: '0.87rem', lineHeight: 1.65 }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* TWO WAYS TO ENGAGE */}
      <section style={{ background: 'white', padding: 'clamp(3.5rem, 7vw, 6rem) 0', borderTop: '1px solid var(--mist)' }} aria-label="Two ways to engage">
        <div className="container coaching-wide">
          <span className="reveal eyebrow" style={{ display: 'block', marginBottom: '2rem' }}>Two Ways to Engage</span>
          <div className="reveal-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'clamp(1.5rem, 3vw, 2.5rem)' }}>
            <div className="reveal" style={{ background: 'var(--paper)', borderRadius: '4px', padding: '1.75rem' }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '0.6rem' }}>For Individual Leaders</span>
              <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.3rem', color: 'var(--navy)', letterSpacing: '0.02em', marginBottom: '0.75rem' }}>Invest in the leader you&rsquo;re becoming.</h3>
              <p style={{ color: 'var(--slate)', fontSize: '0.87rem', lineHeight: 1.7, marginBottom: '1.5rem' }}>You don&rsquo;t need to wait for your organization to invest in you. Coaching provides dedicated space to strengthen your leadership, navigate challenges, and prepare for what&rsquo;s next.</p>
              <a href={discoveryLink} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ fontSize: '0.78rem' }}>Schedule a Discovery Call</a>
            </div>
            <div className="reveal" style={{ background: 'var(--paper)', borderRadius: '4px', padding: '1.75rem', transitionDelay: '0.06s' }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '0.6rem' }}>For Organizations</span>
              <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.3rem', color: 'var(--navy)', letterSpacing: '0.02em', marginBottom: '0.75rem' }}>Develop the leader. Strengthen the organization.</h3>
              <p style={{ color: 'var(--slate)', fontSize: '0.87rem', lineHeight: 1.7, marginBottom: '1.5rem' }}>Organization-sponsored coaching provides individualized development focused on the leadership capabilities, behaviors, and challenges that matter to the leader and the organization.</p>
              <a href="/contact" className="btn btn-ghost-dark" style={{ fontSize: '0.78rem' }}>Discuss Organization-Sponsored Coaching</a>
            </div>
            <div className="reveal" style={{ background: 'var(--navy)', borderRadius: '4px', padding: '1.75rem', transitionDelay: '0.12s' }}>
              <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem', color: 'white', letterSpacing: '0.02em', lineHeight: 1.2, marginBottom: '1rem' }}>Coaching That Connects Development to the Work</h3>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.83rem', lineHeight: 1.6, marginBottom: '0.85rem' }}>Organization-sponsored coaching can be aligned with:</p>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
                {orgAlignments.map(item => (
                  <li key={item} style={{ display: 'flex', gap: '0.55rem', alignItems: 'flex-start', fontSize: '0.82rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>
                    <span style={{ color: 'var(--gold)', flexShrink: 0 }}>&#8226;</span>{item}
                  </li>
                ))}
              </ul>
              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.8rem', lineHeight: 1.65, paddingTop: '0.85rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                The goal is not coaching for coaching&rsquo;s sake. <strong style={{ color: 'white' }}>The goal is meaningful development that shows up in how the leader performs, leads, and contributes to the organization.</strong>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* THE LEADER IS THE CLIENT — NAVY BAND */}
      <section style={{ background: 'var(--navy)', padding: 'clamp(2.5rem, 5vw, 3.5rem) 0' }} aria-label="The leader is the client">
        <div className="container coaching-wide reveal leader-client-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem', alignItems: 'center' }}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(1.5rem, 3vw, 2rem)', color: 'white', letterSpacing: '0.02em' }}>
            The Leader Is the Client.
          </h2>
          <div>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.87rem', lineHeight: 1.75, marginBottom: '0.6rem' }}>
              When an organization sponsors coaching, we establish clear expectations around the purpose of the engagement, desired outcomes, roles, confidentiality, and how progress will be evaluated.
            </p>
            <p style={{ color: 'var(--gold)', fontSize: '0.87rem', lineHeight: 1.75 }}>
              The organization can help define why the coaching matters.<br />
              The coaching conversation remains a trusted space for the leader to do the work.
            </p>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section style={{ background: 'var(--paper)', padding: 'clamp(3.5rem, 7vw, 5.5rem) 0', textAlign: 'center' }} aria-label="Develop the leader, expand the impact">
        <div className="container coaching-wide reveal">
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(1.9rem, 4vw, 2.75rem)', color: 'var(--navy)', letterSpacing: '0.02em', marginBottom: '0.75rem' }}>
            Develop the Leader. Expand the Impact.
          </h2>
          <p style={{ color: 'var(--slate)', fontSize: '0.95rem', lineHeight: 1.75, maxWidth: '620px', margin: '0 auto 2rem' }}>
            Whether you&rsquo;re investing in your own growth or the development of someone responsible for leading others, the first step is understanding what leadership requires next.
          </p>
          <a href={discoveryLink} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
            Schedule a Discovery Call
          </a>
        </div>
      </section>

      <style>{`
        .coaching-wide { max-width: 1360px !important; }
        @media (max-width: 860px) {
          .container.reveal-grid[style*="1.1fr 1fr"] { grid-template-columns: 1fr !important; }
          .hero-image-wrap { aspect-ratio: 16/10 !important; order: -1; }
          .hero-two-col { grid-template-columns: 1fr !important; gap: 1.25rem !important; }
        }
        @media (max-width: 720px) {
          section .reveal-grid[style*="repeat(3, 1fr)"] { grid-template-columns: 1fr !important; }
          section .reveal-grid[style*="repeat(4, 1fr)"] { grid-template-columns: 1fr 1fr !important; }
          .container.reveal-grid[style*="1fr 1.1fr"] { grid-template-columns: 1fr !important; }
          .leader-client-grid { grid-template-columns: 1fr !important; text-align: left; }
        }
        @media (max-width: 480px) {
          section .reveal-grid[style*="repeat(4, 1fr)"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  )
}