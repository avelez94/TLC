'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
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
  leadership_goal: string | null
  focus_areas: string | null
  sort_order: number
}

const staticPrograms = [
  {
    id: 'finders',
    num: '01',
    tag: 'Program 01 · Individuals · The Front Door',
    name: 'Impact Finders',
    motto: '"Before you build anything, you have to see clearly."',
    keywords: ['Clarity', 'Direction', 'Purpose'],
    desc: 'Impact Finders is reflective group work that helps you see where you want your impact, what matters most, and what is getting in your way. This is the front door to TLC\'s practice because direction is the prerequisite for everything else.',
    dark: false,
  },
  {
    id: 'makers',
    num: '02',
    tag: 'Program 02 · Individuals & Organizations',
    name: 'Impact Makers',
    motto: '"Build the behaviors behind high-contribution work."',
    keywords: ['Performance', 'Accountability', 'Contribution'],
    desc: 'Some people contribute at a level that gets noticed. Others do solid work that goes unseen. Often the difference is not talent, it is how someone reads a situation and chooses to respond. Impact Makers examines the mindsets and everyday practices behind high-contribution work.',
    dark: true,
  },
  {
    id: 'leaders',
    num: '03',
    tag: 'Program 03 · Organizations',
    name: 'Impact Leaders',
    motto: '"Raise the level of play across a team while owning how you show up."',
    keywords: ['Team Leadership', 'Ownership', 'Culture'],
    desc: 'Impact Leaders is for team leads, supervisors, and managers who want to raise the level of contribution around them while owning how they show up. You will examine the conditions that bring out strong work in others, how to give people room to step up, and how your own habits either invite that or quietly shut it down.',
    dark: false,
  },
]

export default function Impact() {
  const [programs, setPrograms] = useState<Program[]>([])

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target) } })
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' })
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const fetchPrograms = async () => {
      const { data } = await supabase
        .from('programs')
        .select('*')
        .eq('type', 'cohort')
        .order('sort_order')
      if (data) setPrograms(data)
    }
    fetchPrograms()
  }, [])

  const getProgramData = (name: string) => {
    return programs.find(p => p.name === name)
  }

  const parseList = (text: string | null): string[] => {
    if (!text) return []
    return text.split('\n').map(s => s.trim()).filter(Boolean)
  }

  return (
    <>
      {/* HEADER */}
      <header style={{ background: 'var(--navy)', padding: 'calc(115px + 2rem) 0 0', textAlign: 'center' }}>
        <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 'clamp(2.5rem, 5vw, 4rem)' }}>
          <Image src="/images/impact-lab-logo.png" alt="The Impact Lab" width={680} height={191} style={{ width: '100%', maxWidth: '680px', height: 'auto', marginBottom: '2rem' }} className="reveal" priority />
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 'clamp(1rem, 2vw, 1.12rem)', maxWidth: '640px', lineHeight: 1.85, textAlign: 'center', marginBottom: '1.25rem' }}>
            The Impact Lab is TLC Leadership Consulting &amp; Coaching&apos;s learning environment for cohort-based experiences. It brings people together to learn, reflect, practice, and apply ideas that strengthen how they live, contribute, and lead.
          </p>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 'clamp(0.95rem, 1.8vw, 1.05rem)', maxWidth: '620px', lineHeight: 1.85, textAlign: 'center' }}>
            Whether you are seeking greater clarity, strengthening your contribution, or developing your ability to lead others, The Impact Lab provides structured learning experiences designed to help you create meaningful impact where it matters most.
          </p>
        </div>
        <div style={{ borderTop: '1px solid rgba(200,136,32,0.15)' }} />
      </header>

      {/* PROGRAM NAV */}
      <nav style={{ background: 'var(--paper)', borderBottom: '1px solid var(--mist)', position: 'sticky', top: '115px', zIndex: 100 }}>
        <div style={{ maxWidth: '1140px', margin: '0 auto', padding: '0 clamp(1.25rem, 5vw, 2.75rem)', display: 'flex', gap: 0, overflowX: 'auto', justifyContent: 'center' }}>
          {['Impact Finders', 'Impact Makers', 'Impact Leaders'].map((label, i) => (
            <a key={label} href={`#${['finders','makers','leaders'][i]}`} style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.65rem', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 500, color: 'var(--slate)', textDecoration: 'none', padding: '1.1rem 1.5rem', borderBottom: '2px solid transparent', whiteSpace: 'nowrap', transition: 'color 0.15s, border-color 0.15s' }}>{label}</a>
          ))}
        </div>
      </nav>

      {/* BANNER */}
      <div className="container" style={{ paddingTop: 'clamp(2.5rem, 5vw, 4rem)' }}>
        <Image src="/images/impact-lab-banner.png" alt="People working together" width={1140} height={326} style={{ width: '100%', aspectRatio: '21/6', objectFit: 'cover', objectPosition: 'center', borderRadius: '2px', marginBottom: 'clamp(2.5rem, 5vw, 4rem)', borderBottom: '3px solid var(--gold)' }} className="reveal" />
      </div>

      {/* WHERE LEARNING BECOMES IMPACT */}
      <div style={{ background: 'var(--paper)', padding: 'clamp(3rem, 6vw, 5rem) 0', borderBottom: '1px solid var(--mist)' }}>
        <div className="container reveal">
          <span className="eyebrow">Where learning becomes impact</span>
          <h2 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(2rem, 5vw, 3.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', lineHeight: 1, marginTop: '0.5rem', marginBottom: '1.25rem' }}>Three experiences. One environment.</h2>
          <p style={{ color: 'var(--slate)', fontSize: '1.05rem', lineHeight: 1.8, maxWidth: '720px' }}>
            The Impact Lab is home to three distinct cohort learning experiences. They are not levels to complete or steps in a sequence. Each experience is designed around a different developmental need, allowing you to choose the one that best aligns with where you are today and where you want to grow.
          </p>
        </div>
      </div>

      {/* PROGRAMS */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {staticPrograms.map(({ id, num, tag, name, motto, keywords, desc, dark }) => {
          const dbProgram = getProgramData(name)
          const goal = dbProgram?.leadership_goal
          const focusList = parseList(dbProgram?.focus_areas || null)
          const priceLabel = dbProgram?.price_label
          const isLeaders = name === 'Impact Leaders'

          return (
            <div key={id} id={id} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', borderBottom: '1px solid rgba(0,23,55,0.08)', background: dark ? 'var(--navy)' : 'white', scrollMarginTop: '180px' }} className="reveal pathway-step">
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: 'clamp(2rem, 4vw, 3rem) 1.5rem', borderRight: `1px solid ${dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,23,55,0.08)'}`, gap: '0.5rem' }}>
                <span style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(3rem, 6vw, 5rem)', color: 'var(--gold)', lineHeight: 1, letterSpacing: '0.04em' }}>{num}</span>
                <div style={{ width: '2px', flex: 1, minHeight: '2rem', background: `linear-gradient(to bottom, rgba(200,136,32,${dark ? '0.4' : '0.3'}), transparent)` }} />
              </div>
              <div style={{ padding: 'clamp(2rem, 4vw, 3rem) clamp(1.5rem, 4vw, 3rem)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem', alignItems: 'start' }} className="pathway-body">
                <div>
                  <div style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '0.5rem' }}>{tag}</div>
                  <h2 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(2rem, 4vw, 3.25rem)', color: dark ? 'white' : 'var(--navy)', letterSpacing: '0.04em', lineHeight: 1, marginBottom: '0.6rem' }}>{name}</h2>
                  <p style={{ fontSize: 'clamp(1rem, 2vw, 1.15rem)', fontStyle: 'italic', color: dark ? 'rgba(255,255,255,0.55)' : 'var(--slate)', fontWeight: 400, marginBottom: '1rem', lineHeight: 1.4 }}>{motto}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1.25rem' }}>
                    {keywords.map(k => <span key={k} style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: dark ? 'rgba(255,255,255,0.7)' : 'var(--navy)', background: dark ? 'rgba(255,255,255,0.07)' : 'var(--mist)', padding: '0.3rem 0.65rem', borderRadius: '2px' }}>{k}</span>)}
                  </div>
                  <p style={{ color: dark ? 'rgba(255,255,255,0.6)' : 'var(--slate)', fontSize: '0.93rem', lineHeight: 1.78, marginBottom: '1.5rem' }}>{desc}</p>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {isLeaders ? (
                      <Link href="/contact" className="btn btn-primary">Request Organizational Support</Link>
                    ) : (
                      <Link href="/register" className="btn btn-primary">Join a Cohort</Link>
                    )}
                  </div>
                </div>
                <div>
                  {goal && (
                    <>
                      <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '0.5rem', display: 'block' }}>Leadership Development Goal</span>
                      <p style={{ fontSize: '0.95rem', fontWeight: 600, color: dark ? 'rgba(255,255,255,0.85)' : 'var(--navy)', marginBottom: '1.5rem', lineHeight: 1.5, paddingLeft: '1rem', borderLeft: '2px solid var(--gold)' }}>{goal}</p>
                    </>
                  )}
                  {focusList.length > 0 && (
                    <>
                      <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '0.65rem', marginTop: '0.25rem', display: 'block' }}>Focus Areas</span>
                      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.45rem', marginBottom: '1.75rem' }}>
                        {focusList.map(f => <li key={f} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.88rem', color: dark ? 'rgba(255,255,255,0.6)' : 'var(--slate)', lineHeight: 1.5 }}><span style={{ color: 'var(--gold)', fontSize: '0.8rem', flexShrink: 0, fontWeight: 700 }}>&#10022;</span>{f}</li>)}
                      </ul>
                    </>
                  )}
                  <div style={{ background: dark ? 'rgba(255,255,255,0.05)' : 'white', border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,23,55,0.1)'}`, borderRadius: '2px', padding: '1.25rem' }}>
                    {[
                      { label: 'Format', value: isLeaders ? 'Organizational group' : 'Group cohort' },
                      { label: 'Who it is for', value: isLeaders ? 'Team leads, supervisors, managers' : 'Individuals' },
                      { label: 'Investment', value: isLeaders ? 'Request a quote' : (priceLabel || 'Contact us') },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ padding: '0.5rem 0', borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,23,55,0.06)'}`, display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                        <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.55rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)' }}>{label}</span>
                        <span style={{ fontSize: '0.85rem', color: dark ? 'rgba(255,255,255,0.85)' : 'var(--ink)', fontWeight: 600 }}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* CTA */}
      <section style={{ background: 'var(--navy3)', padding: 'clamp(4.5rem, 9vw, 8rem) 0', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(200,136,32,0.07) 1px, transparent 1px)', backgroundSize: '36px 36px', pointerEvents: 'none' }} />
        <div className="container reveal" style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(2.5rem, 7vw, 6rem)', color: 'white', letterSpacing: '0.04em', lineHeight: 1, marginBottom: '1rem' }}>Ready to<br /><span style={{ color: 'var(--gold)' }}>step up?</span></h2>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '1rem', maxWidth: '480px', margin: '0 auto 2.5rem', lineHeight: 1.75 }}>Join a cohort or bring Impact Lab programs to your organization. Reach out and we will find the right fit.</p>
          <Link href="/register" className="btn btn-primary" style={{ marginRight: '1rem' }}>Join a Cohort</Link>
          <Link href="/contact" className="btn btn-ghost-light">Contact Us</Link>
        </div>
      </section>

      <style>{`
        @media (max-width: 800px) {
          .pathway-step { grid-template-columns: 72px 1fr !important; }
          .pathway-body { grid-template-columns: 1fr !important; gap: 1.5rem !important; }
        }
        @media (max-width: 480px) {
          .pathway-step { grid-template-columns: 52px 1fr !important; }
        }
      `}</style>
    </>
  )
}