'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function Consulting() {
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
          <span className="eyebrow">Leadership Consulting</span>
          <h1>Custom systems for organizations.</h1>
          <p className="sub">When an organization needs to develop its leaders, it needs more than a workshop. It needs a system.</p>
        </div>
      </header>

      <section className="content-section">
        <div className="container">
          <div className="two-col">
            <div className="prose reveal">
              <span className="gold-bar" aria-hidden="true" style={{ marginBottom: '1.75rem' }} />
              <h3>The work</h3>
              <p>TLC designs and builds leadership development programs, learning journeys, and pipelines built for how your people actually work. The deliverable is a built thing, and the client is the organization.</p>
              <p>This is not off-the-shelf content dropped into a room. It is custom design and delivery built around the real problems your leaders face, the real context they operate in, and the real results your organization needs.</p>
              <h3>Problems we help solve</h3>
              <ul>
                <li>New managers and supervisors who need a foundation, not just a title</li>
                <li>High-potential employees who are ready to lead before a role exists for them</li>
                <li>Teams with inconsistent performance and unclear expectations</li>
                <li>Technical experts promoted into people roles without development</li>
                <li>Leadership culture gaps that show up in retention, engagement, and results</li>
              </ul>
              <h3>What we build</h3>
              <ul>
                <li>Leadership development programs and learning journeys</li>
                <li>Supervisor and manager development curricula</li>
                <li>Cohort experiences for high-potential talent</li>
                <li>Workshop design and facilitation</li>
                <li>Program evaluation and measurement frameworks</li>
              </ul>
            </div>
            <div className="reveal" style={{ transitionDelay: '0.12s' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid rgba(0,23,55,0.1)', borderRadius: '2px', overflow: 'hidden', marginBottom: '1.5rem' }}>
                {[
                  { n: '01', title: 'Discovery', desc: 'We learn the organization, the people, and the real problems behind the stated problems. No assumptions.' },
                  { n: '02', title: 'Design', desc: 'A custom development system built for your context, your people, and your outcomes. Not a repurposed template.' },
                  { n: '03', title: 'Delivery', desc: 'Facilitation, coaching, and program delivery. Present in the room, invested in the result.' },
                  { n: '04', title: 'Evaluation', desc: 'We measure what matters and adjust. The goal is a result that holds after we leave.' },
                ].map(({ n, title, desc }) => (
                  <div key={n} style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start', padding: '1.5rem 1.75rem', borderBottom: '1px solid rgba(0,23,55,0.07)', background: 'white' }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', minWidth: '2rem', paddingTop: '0.1rem' }}>{n}</span>
                    <div>
                      <h4 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem', letterSpacing: '0.04em', color: 'var(--navy)', marginBottom: '0.3rem' }}>{title}</h4>
                      <p style={{ color: 'var(--slate)', fontSize: '0.87rem', lineHeight: 1.65, margin: 0 }}>{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ background: 'var(--paper)', borderRadius: '2px', padding: '1.75rem', borderTop: '3px solid var(--gold)' }}>
                <span className="eyebrow" style={{ marginBottom: '0.75rem', display: 'block' }}>Engagement type</span>
                <p style={{ color: 'var(--slate)', fontSize: '0.9rem', lineHeight: 1.72, marginBottom: '1.25rem' }}>Every consulting engagement is custom-scoped. There is no standard package because the work begins with understanding your specific context.</p>
                <Link href="/contact" className="btn btn-primary">Schedule a Consultation</Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
