'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function Coaching() {
  const [pillars, setPillars] = useState<{ title: string; desc: string }[]>([])

  const defaultPillars = [
    { title: 'Leadership', desc: 'How you show up for and develop the people around you.' },
    { title: 'Performance', desc: 'Habits and behaviors that drive consistent results.' },
    { title: 'Communication', desc: 'Clarity, confidence, and presence when it matters.' },
    { title: 'Career Growth', desc: 'Direction, strategy, and momentum toward where you want to go.' },
    { title: 'Confidence', desc: 'The self-belief that shows up when you need it most.' },
    { title: 'Personal Development', desc: 'The whole person. Not just the professional.' },
  ]

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target) } })
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' })
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const fetchFocusAreas = async () => {
      const { data } = await supabase
        .from('programs')
        .select('focus_areas')
        .eq('name', 'Executive Coaching')
        .single()

      if (data?.focus_areas) {
        const parsed = data.focus_areas
          .split('\n')
          .map((line: string) => line.trim())
          .filter(Boolean)
          .map((line: string) => {
            const parts = line.split('|')
            return {
              title: parts[0]?.trim() || line,
              desc: parts[1]?.trim() || '',
            }
          })
        setPillars(parsed)
      } else {
        setPillars(defaultPillars)
      }
    }
    fetchFocusAreas()
  }, [])

  const displayPillars = pillars.length > 0 ? pillars : defaultPillars

  const steps = [
    { n: '01', title: 'Discovery Call', desc: 'A conversation to understand where you are, where you want to go, and whether coaching is the right fit.' },
    { n: '02', title: 'Engagement Design', desc: 'We agree on focus, cadence, and what success looks like before the work begins.' },
    { n: '03', title: 'Coaching Sessions', desc: 'Regular focused sessions with real accountability and real progress between them.' },
    { n: '04', title: 'Measure and Adjust', desc: 'We track progress against what matters and adjust as you grow.' },
  ]

  return (
    <>
      <header className="page-hero">
        <div className="container">
          <span className="eyebrow">Performance &amp; Success Coaching</span>
          <h1>One to one. The work is yours.</h1>
          <p className="sub">Whether you invest in yourself or an organization sponsors your growth, the focus stays on you.</p>
        </div>
      </header>

      <section className="content-section">
        <div className="container">
          <div className="two-col">
            <div className="prose reveal">
              <span className="gold-bar" aria-hidden="true" style={{ marginBottom: '1.75rem' }} />
              <h3>What coaching is</h3>
              <p>Coaching is one to one. We build clarity, capability, and the behavior change that shows up in how you lead, perform, and show up. The person in the room is always the client, even when an organization pays.</p>
              <p>A coach does not tell you what to do. A coach helps you build the thinking, the habits, and the self-awareness to figure out what you should do, and then do it consistently.</p>
              <h3>Who coaching is for</h3>
              <ul>
                <li>Emerging leaders moving into greater responsibility</li>
                <li>Professionals in career transitions or new roles</li>
                <li>High-performers who want to operate at a higher level</li>
                <li>People who know what they want but are not moving toward it</li>
                <li>Individuals sponsored by their organization for targeted development</li>
              </ul>
              <h3>Focus areas</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1.25rem' }}>
                {displayPillars.map(({ title, desc }) => (
                  <div key={title} style={{ background: 'var(--paper)', borderRadius: '2px', padding: '1.35rem', borderLeft: '3px solid var(--gold)' }}>
                    <h4 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1rem', letterSpacing: '0.04em', color: 'var(--navy)', marginBottom: desc ? '0.35rem' : 0 }}>{title}</h4>
                    {desc && <p style={{ color: 'var(--slate)', fontSize: '0.84rem', lineHeight: 1.6, margin: 0 }}>{desc}</p>}
                  </div>
                ))}
              </div>
            </div>
            <div className="reveal" style={{ transitionDelay: '0.12s' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid rgba(0,23,55,0.1)', borderRadius: '2px', overflow: 'hidden', marginBottom: '1.5rem' }}>
                {steps.map(({ n, title, desc }) => (
                  <div key={n} style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start', padding: '1.5rem 1.75rem', borderBottom: '1px solid rgba(0,23,55,0.07)', background: 'white' }}>
                    <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', minWidth: '2rem', paddingTop: '0.1rem' }}>{n}</span>
                    <div>
                      <h4 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', letterSpacing: '0.04em', color: 'var(--navy)', marginBottom: '0.3rem' }}>{title}</h4>
                      <p style={{ color: 'var(--slate)', fontSize: '0.87rem', lineHeight: 1.65, margin: 0 }}>{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ background: 'var(--paper)', borderRadius: '2px', padding: '1.75rem', borderTop: '3px solid var(--gold)' }}>
                <span className="eyebrow" style={{ marginBottom: '0.75rem', display: 'block' }}>Getting started</span>
                <p style={{ color: 'var(--slate)', fontSize: '0.9rem', lineHeight: 1.72, marginBottom: '1.25rem' }}>Coaching engagements are scoped after an initial discovery conversation. The discovery call is free and carries no obligation.</p>
                <Link href="/contact" className="btn btn-primary">Schedule a Discovery Call</Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}