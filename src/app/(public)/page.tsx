'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'

export default function Home() {
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target) } })
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' })
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <>
      {/* HERO */}
      <section aria-label="Introduction">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', alignItems: 'stretch', minHeight: '100svh', paddingTop: '115px' }} className="hero-split">
          <div style={{ background: 'var(--navy)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 'clamp(3rem, 7vw, 6rem) clamp(2rem, 5vw, 4rem)', position: 'relative', zIndex: 1 }}>
            <div className="reveal" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: 'clamp(1.5rem, 3vw, 2.5rem)' }}>
              <div style={{ flex: '0 0 3rem', height: '1px', background: 'rgba(200,136,32,0.4)' }} aria-hidden="true" />
              <span className="eyebrow" style={{ color: 'rgba(255,255,255,0.45)' }}>TLC Leadership Consulting &amp; Coaching</span>
            </div>
            <h1 className="reveal" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(2.8rem, 7vw, 6.5rem)', color: 'white', letterSpacing: '0.03em', lineHeight: 1, marginBottom: '1.5rem', transitionDelay: '0.1s' }}>
              Helping people grow, lead, and create greater impact.
            </h1>
            <p className="reveal" style={{ fontSize: 'clamp(0.95rem, 2vw, 1.1rem)', color: 'rgba(255,255,255,0.62)', maxWidth: '560px', lineHeight: 1.8, marginBottom: 'clamp(2rem, 4vw, 3rem)', transitionDelay: '0.2s' }}>
              Leadership is not a title. It is how you show up and the impact you create, whether you are leading a team, raising a family, teaching a classroom, or becoming your own best self.
            </p>
            <p className="reveal" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '2rem', opacity: 0.8, transitionDelay: '0.25s' }}>
              With Tramaine L. Crawford
            </p>
            <div className="reveal" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', transitionDelay: '0.3s' }}>
              <Link href="/contact" className="btn btn-primary">Schedule a Conversation</Link>
              <Link href="/impact" className="btn btn-ghost-light">Explore the Impact Lab</Link>
            </div>
          </div>
          <div style={{ position: 'relative', background: 'linear-gradient(160deg, var(--navy2) 0%, #0f3060 60%, rgba(200,136,32,0.12) 100%)', minHeight: '100%' }} aria-hidden="true">
            <Image src="/images/hero-image.jpg" alt="A leader facilitating a strategic planning session with a diverse professional team" fill style={{ objectFit: 'cover', objectPosition: 'center top' }} priority />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(0,23,55,0.2) 0%, transparent 50%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '4px', background: 'var(--gold)' }} />
          </div>
        </div>
      </section>

      {/* BELIEF */}
      <section style={{ background: 'var(--paper)', padding: 'clamp(4.5rem, 9vw, 8rem) 0' }} aria-label="Our belief">
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 'clamp(3rem, 6vw, 6rem)', alignItems: 'center' }} className="belief-grid">
            <blockquote className="reveal" style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 'clamp(1.25rem, 2.5vw, 1.7rem)', fontStyle: 'italic', fontWeight: 400, color: 'var(--navy)', lineHeight: 1.5, paddingLeft: '2rem', borderLeft: '3px solid var(--gold)' }}>
              People have the capacity to create real impact. Most just need clarity, support, and development to become who they are capable of becoming.
            </blockquote>
            <div className="reveal" style={{ color: 'var(--slate)', transitionDelay: '0.12s' }}>
              <span className="eyebrow" style={{ marginBottom: '1rem', display: 'block' }}>The belief behind TLC</span>
              <p style={{ lineHeight: 1.8, marginBottom: '1.1rem', fontSize: '1rem', marginTop: '0.75rem' }}>TLC helps individuals and organizations build that capacity and make it last. This is not executive-only work. Impact happens in workplaces, classrooms, communities, and homes.</p>
              <p style={{ lineHeight: 1.8, fontSize: '1rem' }}>A first-time manager and a seasoned executive are working on the same fundamental thing. So are a teacher, a parent, and a community organizer. TLC is built for all of them.</p>
            </div>
          </div>
        </div>
      </section>

      {/* IMPACT TILES */}
      <section style={{ background: 'var(--navy)', padding: 'clamp(4.5rem, 9vw, 8rem) 0' }} aria-label="Where impact happens">
        <div className="container">
          <div className="reveal" style={{ marginBottom: 'clamp(2.5rem, 5vw, 4rem)' }}>
            <span className="eyebrow">Where do you want to create impact?</span>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(2.5rem, 6vw, 5rem)', color: 'white', letterSpacing: '0.04em', lineHeight: 1, marginTop: '0.75rem' }}>Impact happens<br />everywhere.</h2>
          </div>
          <div className="reveal" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5px', background: 'rgba(200,136,32,0.1)', transitionDelay: '0.1s' }}>
            {[
              { img: 'tile-leadership.jpg', label: 'Leadership', desc: 'Building the people and systems that move teams and organizations forward.' },
              { img: 'tile-family.jpg', label: 'Family', desc: 'Showing up fully for the people who matter most.' },
              { img: 'tile-faith.jpg', label: 'Faith', desc: 'Leading and serving from conviction.' },
              { img: 'tile-education.jpg', label: 'Education', desc: 'Shaping the next generation through teaching and mentorship.' },
              { img: 'tile-community.jpg', label: 'Community', desc: 'Making a difference in the places and people around you.' },
              { img: 'tile-career.jpg', label: 'Career', desc: 'Growing into the work you are capable of.' },
            ].map(({ img, label, desc }) => (
              <div key={label} style={{ background: 'var(--navy2)', padding: 'clamp(1.25rem, 2.5vw, 1.75rem)', display: 'flex', flexDirection: 'column', gap: '0.5rem', transition: 'background 0.2s' }}>
                <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', marginBottom: '0.75rem', borderRadius: '2px', overflow: 'hidden' }}>
                  <Image src={`/images/${img}`} alt={label} fill style={{ objectFit: 'cover' }} />
                </div>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>{label}</span>
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.87rem', lineHeight: 1.65, marginTop: '0.2rem' }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHO WE HELP */}
      <section aria-label="Who we help" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }} className="who-grid">
        {[
          { side: 'left', label: 'Individuals', heading: 'People who want to grow.', items: ['Emerging leaders and high-potential professionals', 'First-time managers and supervisors', 'Teachers and educators', 'Parents and family leaders', 'Coaches and mentors', 'Community and faith leaders', 'Anyone becoming their best self'] },
          { side: 'right', label: 'Organizations', heading: 'Teams built for greater impact.', items: ['Government agencies and federal programs', 'Corporations and private sector teams', 'Schools and educational institutions', 'Nonprofits and mission-driven organizations', 'Associations and professional networks', 'Leadership teams, managers, and supervisors'] },
        ].map(({ side, label, heading, items }) => (
          <div key={side} style={{ background: side === 'left' ? 'white' : 'var(--navy)', padding: 'clamp(4.5rem, 9vw, 8rem) clamp(1.25rem, 5vw, 2.75rem)' }}>
            <div className="reveal" style={{ maxWidth: '570px', marginLeft: side === 'left' ? 'auto' : undefined }}>
              <span className="eyebrow" style={{ marginBottom: '0.75rem', display: 'block' }}>{label}</span>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(2rem, 4vw, 3.25rem)', letterSpacing: '0.04em', lineHeight: 1, marginBottom: '1.5rem', marginTop: '0.5rem', color: side === 'left' ? 'var(--navy)' : 'white' }}>{heading}</h2>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                {items.map(item => (
                  <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', fontSize: '0.92rem', lineHeight: 1.55, color: side === 'left' ? 'var(--slate)' : 'rgba(255,255,255,0.62)', paddingBottom: '0.55rem', borderBottom: `1px solid ${side === 'left' ? 'var(--mist)' : 'rgba(255,255,255,0.07)'}` }}>
                    <span style={{ display: 'block', width: '5px', height: '5px', minWidth: '5px', borderRadius: '50%', background: 'var(--gold)', marginTop: '0.5em', flexShrink: 0 }} aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </section>

      {/* SERVICES */}
      <section style={{ background: 'var(--paper)', padding: 'clamp(4.5rem, 9vw, 8rem) 0' }} aria-label="Services">
        <div className="container">
          <div className="reveal" style={{ marginBottom: 'clamp(2.5rem, 5vw, 4rem)' }}>
            <span className="eyebrow">Three ways in</span>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(2.5rem, 6vw, 5rem)', color: 'var(--navy)', letterSpacing: '0.04em', lineHeight: 1, marginTop: '0.75rem' }}>How TLC helps.</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }} className="services-grid">
            {[
              { href: '/consulting', tag: 'Leadership Consulting', title: 'Custom systems for organizations.', desc: 'When an organization needs to develop its leaders, it needs more than a workshop. TLC designs and builds programs, learning journeys, and pipelines built for how your people actually work.', delay: '0s' },
              { href: '/coaching', tag: 'Performance & Success Coaching', title: 'One to one. The work is yours.', desc: 'Whether you invest in yourself or an organization sponsors your growth, the focus stays on you. Coaching builds the clarity, capability, and behavior change that shows up in how you lead and perform.', delay: '0.12s' },
              { href: '/impact', tag: 'The Impact Lab', title: 'Step up. Solve problems. Create impact.', desc: 'Cohort programs built to move people from where they are to who they are capable of becoming. Three programs, one path. Find your direction, build your impact, raise it in others.', delay: '0.24s' },
            ].map(({ href, tag, title, desc, delay }) => (
              <Link key={href} href={href} className="reveal" style={{ background: 'white', border: '1px solid rgba(0,23,55,0.1)', borderRadius: '2px', padding: '2.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', textDecoration: 'none', color: 'inherit', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s', position: 'relative', transitionDelay: delay }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)' }}>{tag}</span>
                <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(1.5rem, 3vw, 2rem)', color: 'var(--navy)', letterSpacing: '0.04em', lineHeight: 1.1 }}>{title}</h3>
                <p style={{ color: 'var(--slate)', fontSize: '0.9rem', lineHeight: 1.75, flex: 1 }}>{desc}</p>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--gold)' }}>Learn more &#8594;</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT TEASER */}
      <section style={{ background: 'var(--navy)', padding: 'clamp(4.5rem, 9vw, 8rem) 0', position: 'relative', overflow: 'hidden' }} aria-label="About Tramaine L. Crawford">
        <div style={{ position: 'absolute', right: '-1rem', top: '50%', transform: 'translateY(-50%)', fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(12rem, 22vw, 22rem)', color: 'rgba(255,255,255,0.02)', letterSpacing: '0.05em', lineHeight: 1, pointerEvents: 'none', userSelect: 'none' }} aria-hidden="true">TLC</div>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: '0.85fr 1fr', gap: 'clamp(3rem, 6vw, 6rem)', alignItems: 'center' }} className="about-grid">
            <div className="reveal" style={{ aspectRatio: '3/4', position: 'relative', borderRadius: '2px', border: '1px solid rgba(200,136,32,0.2)', overflow: 'hidden' }}>
              <Image src="/images/tramaine-photo.png" alt="Tramaine L. Crawford" fill style={{ objectFit: 'cover', objectPosition: 'center top' }} />
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '4px', background: 'var(--gold)' }} aria-hidden="true" />
            </div>
            <div className="reveal" style={{ position: 'relative', zIndex: 1, transitionDelay: '0.12s' }}>
              <span className="eyebrow" style={{ marginBottom: '0.75rem', display: 'block' }}>The Practitioner Behind TLC</span>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(2.25rem, 5vw, 4rem)', color: 'white', letterSpacing: '0.04em', lineHeight: 1, marginBottom: '1.5rem', marginTop: '0.5rem' }}>I learned leadership by doing it.</h2>
              <p style={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.8, marginBottom: '1.1rem', fontSize: '1rem' }}>My leadership development started in the Army, where you learn fast that leadership is not a title or a personality. It is responsibility for people and for outcomes that matter. I carried that into federal leadership development, the classroom, and coaching. Across all of it the work has stayed the same.</p>
              <div style={{ margin: '1.75rem 0', display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                {['Began leading in the U.S. Army', 'Built federal leadership development programs', 'Taught in the elementary classroom', 'Coaches and mentors leaders today'].map(item => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.7rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.55)', fontSize: '0.88rem' }}>
                    <span style={{ color: 'var(--gold)', fontSize: '0.85rem', flexShrink: 0 }}>&#10003;</span> {item}
                  </div>
                ))}
              </div>
              <Link href="/about" className="btn btn-ghost-light">Read the full story</Link>
            </div>
          </div>
        </div>
      </section>

      {/* IMPACT LAB FEATURE — updated copy */}
      <section style={{ background: 'var(--paper)', padding: 'clamp(4.5rem, 9vw, 8rem) 0' }} aria-label="The Impact Lab">
        <div className="container">
          <div className="reveal impact-intro-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'clamp(3rem, 6vw, 5rem)', alignItems: 'center', marginBottom: 'clamp(3rem, 6vw, 5rem)', paddingBottom: 'clamp(2rem, 4vw, 3.5rem)', borderBottom: '1.5px solid var(--mist)' }}>
            <div>
              <span className="eyebrow" style={{ marginBottom: '0.75rem', display: 'block' }}>The Impact Lab</span>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(2.5rem, 6vw, 5rem)', color: 'var(--navy)', letterSpacing: '0.04em', lineHeight: 1, marginTop: '0.25rem' }}>One learning environment. Multiple paths to growth.</h2>
            </div>
            <div>
              <p style={{ color: 'var(--slate)', fontSize: '1rem', lineHeight: 1.8, marginBottom: '1rem' }}>The Impact Lab is TLC Leadership Consulting &amp; Coaching&apos;s virtual learning environment. It brings together cohort-based learning experiences for people who want to grow, strengthen their contribution, and create greater impact in their work, their families, and their communities.</p>
              <p style={{ color: 'var(--slate)', fontSize: '1rem', lineHeight: 1.8, marginBottom: '1.75rem' }}>Whether you are seeking greater clarity, developing the habits behind meaningful contribution, or learning to lead others more effectively, you will find a learning experience designed for where you are today.</p>
              <Link href="/impact" className="btn btn-primary">Explore The Impact Lab</Link>
            </div>
          </div>

          <div className="reveal" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', border: '1px solid rgba(0,23,55,0.12)', borderRadius: '2px', overflow: 'hidden', transitionDelay: '0.1s' }}>
            {[
              { num: '01', name: 'Impact Finders', motion: 'Find your direction', desc: 'Before you build anything, you have to see clearly. Impact Finders helps you see where you want your impact, what matters most, and what is getting in your way.', price: 'Free or low founding-cohort price', dark: false, cta: 'Join the Cohort', href: '/register', ctaClass: 'btn-ghost-dark' },
              { num: '02', name: 'Impact Makers', motion: 'Build your impact', desc: 'Builds the behaviors that turn effort into real impact, whether you come as an individual or your organization develops a group.', price: 'Founding cohorts open. Inquire for details.', dark: true, cta: 'Join the Cohort', href: '/register', ctaClass: 'btn-primary' },
              { num: '03', name: 'Impact Leaders', motion: 'Raise it in others', desc: 'For team leads, supervisors, and managers who want to raise the level of play across a team while owning how they show up.', price: 'Contact for organizational pricing', dark: false, cta: 'Request Support', href: '/contact', ctaClass: 'btn-ghost-dark' },
            ].map(({ num, name, motion, desc, price, dark, cta, href, ctaClass }) => (
              <div key={num} style={{ padding: '2.25rem', borderRight: '1px solid rgba(0,23,55,0.1)', display: 'flex', flexDirection: 'column', gap: '0.85rem', background: dark ? 'var(--navy)' : 'white' }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: dark ? 'rgba(200,136,32,0.7)' : 'var(--gold)' }}>Program {num}</span>
                <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(1.6rem, 3vw, 2.25rem)', color: dark ? 'white' : 'var(--navy)', letterSpacing: '0.04em', lineHeight: 1 }}>{name}</h3>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--gold)' }}>{motion}</span>
                <p style={{ color: dark ? 'rgba(255,255,255,0.6)' : 'var(--slate)', fontSize: '0.88rem', lineHeight: 1.72, flex: 1 }}>{desc}</p>
                <p style={{ fontSize: '0.78rem', color: dark ? 'rgba(255,255,255,0.35)' : 'var(--slate)', paddingTop: '1rem', borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,23,55,0.08)'}` }}>{price}</p>
                <Link href={href} className={`btn ${ctaClass}`} style={{ fontSize: '0.75rem', padding: '0.65rem 1.25rem' }}>{cta}</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA BAND */}
      <section style={{ background: 'var(--navy3)', padding: 'clamp(4.5rem, 9vw, 8rem) 0', textAlign: 'center', position: 'relative', overflow: 'hidden' }} aria-label="Get started">
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(200,136,32,0.07) 1px, transparent 1px)', backgroundSize: '36px 36px', pointerEvents: 'none' }} aria-hidden="true" />
        <div className="container reveal" style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(2.5rem, 7vw, 6rem)', color: 'white', letterSpacing: '0.04em', lineHeight: 1, marginBottom: '1rem' }}>Ready to create<br /><span style={{ color: 'var(--gold)' }}>greater impact?</span></h2>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '1rem', maxWidth: '480px', margin: '0 auto 2.5rem', lineHeight: 1.75 }}>One conversation is enough to figure out where to start. Schedule time with Tramaine.</p>
          <Link href="/contact" className="btn btn-primary">Schedule a Conversation</Link>
        </div>
      </section>

      <style>{`
        @media (max-width: 860px) {
          .hero-split { grid-template-columns: 1fr !important; min-height: auto !important; }
          .hero-split > div:first-child { min-height: 70svh; }
          .hero-split > div:last-child { min-height: 480px; aspect-ratio: 3/4; }
        }
        @media (max-width: 720px) {
          .belief-grid { grid-template-columns: 1fr !important; }
          .about-grid { grid-template-columns: 1fr !important; }
          .who-grid { grid-template-columns: 1fr !important; }
          .impact-intro-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 800px) {
          .services-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  )
}