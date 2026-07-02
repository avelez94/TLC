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
  motto: string | null
  keywords: string | null
  sort_order: number
}

const staticPrograms = [
  {
    id: 'finders',
    num: '01',
    tag: 'Individual · Level 01',
    name: 'Impact Finders',
    dark: false,
    whoFor: 'Individuals seeking greater clarity, direction, and purpose before pursuing their next stage of personal or professional growth.',
    experience: [
      'Guided cohort discussions',
      'Personal reflection and self-discovery',
      'Practical learning and application',
      'Weekly action commitments',
      'Accountability through community',
    ],
  },
  {
    id: 'makers',
    num: '02',
    tag: 'Individual · Level 02',
    name: 'Impact Makers',
    dark: true,
    whoFor: 'Individuals who have gained clarity about where they want to make an impact and are ready to consistently practice the behaviors that lead to greater contribution.',
    experience: [
      'Guided cohort discussions',
      'Practical learning and application',
      'Weekly action commitments',
      'Accountability through community',
      'Reflection on real-world experiences',
    ],
  },
  {
    id: 'leaders',
    num: '03',
    tag: 'Individual · Level 03',
    name: 'Impact Leaders',
    dark: false,
    whoFor: 'Individuals who are ready to intentionally develop, influence, and lead others while creating greater impact through people.',
    experience: [
      'Guided cohort discussions',
      'Practical learning and application',
      'Weekly leadership practice',
      'Accountability through community',
      'Reflection on real-world leadership experiences',
    ],
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

  const getProgram = (name: string) => programs.find(p => p.name === name)

  const parseList = (text: string | null): string[] => {
    if (!text) return []
    return text.split('\n').map(s => s.trim()).filter(Boolean)
  }

  const parseKeywords = (text: string | null): string[] => {
    if (!text) return []
    return text.split(',').map(s => s.trim()).filter(Boolean)
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
            Whether you are seeking greater clarity, strengthening your contribution, developing as a leader, or navigating your next stage of growth, The Impact Lab provides structured learning experiences that help you turn insight into action and create meaningful impact where it matters most.
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

      {/* INTRO */}
      <div style={{ background: 'var(--paper)', padding: 'clamp(3rem, 6vw, 5rem) 0', borderBottom: '1px solid var(--mist)' }}>
        <div className="container reveal">
          <span className="eyebrow">Individual Programs</span>
          <h2 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(2rem, 5vw, 3.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', lineHeight: 1, marginTop: '0.5rem', marginBottom: '1.25rem' }}>Three levels. One journey.</h2>
          <p style={{ color: 'var(--slate)', fontSize: '1.05rem', lineHeight: 1.8, maxWidth: '720px' }}>
            The Impact Lab offers three distinct cohort learning experiences for individuals. Each level is designed around a different stage of growth. Start where you are and move forward from there.
          </p>
        </div>
      </div>

      {/* PROGRAMS */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {staticPrograms.map(({ id, num, tag, name, dark, whoFor, experience }) => {
          const db = getProgram(name)
          const motto = db?.motto
          const keywords = parseKeywords(db?.keywords || null)
          const description = db?.description
          const goal = db?.leadership_goal
          const focusList = parseList(db?.focus_areas || null)
          const priceLabel = db?.price_label

          return (
            <div key={id} id={id} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', borderBottom: '1px solid rgba(0,23,55,0.08)', background: dark ? 'var(--navy)' : 'white', scrollMarginTop: '180px' }} className="reveal pathway-step">
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: 'clamp(2rem, 4vw, 3rem) 1.5rem', borderRight: `1px solid ${dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,23,55,0.08)'}`, gap: '0.5rem' }}>
                <span style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(3rem, 6vw, 5rem)', color: 'var(--gold)', lineHeight: 1, letterSpacing: '0.04em' }}>{num}</span>
                <div style={{ width: '2px', flex: 1, minHeight: '2rem', background: `linear-gradient(to bottom, rgba(200,136,32,${dark ? '0.4' : '0.3'}), transparent)` }} />
              </div>

              <div style={{ padding: 'clamp(2rem, 4vw, 3rem) clamp(1.5rem, 4vw, 3rem)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem', alignItems: 'start' }} className="pathway-body">
                {/* LEFT COLUMN */}
                <div>
                  <div style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '0.5rem' }}>{tag}</div>
                  <h2 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(2rem, 4vw, 3.25rem)', color: dark ? 'white' : 'var(--navy)', letterSpacing: '0.04em', lineHeight: 1, marginBottom: '0.6rem' }}>{name}</h2>
                  {motto && <p style={{ fontSize: 'clamp(1rem, 2vw, 1.15rem)', fontStyle: 'italic', color: dark ? 'rgba(255,255,255,0.55)' : 'var(--slate)', fontWeight: 400, marginBottom: '1rem', lineHeight: 1.4 }}>{motto}</p>}
                  {keywords.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1.25rem' }}>
                      {keywords.map(k => <span key={k} style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: dark ? 'rgba(255,255,255,0.7)' : 'var(--navy)', background: dark ? 'rgba(255,255,255,0.07)' : 'var(--mist)', padding: '0.3rem 0.65rem', borderRadius: '2px' }}>{k}</span>)}
                    </div>
                  )}
                  {description && <p style={{ color: dark ? 'rgba(255,255,255,0.6)' : 'var(--slate)', fontSize: '0.93rem', lineHeight: 1.78, marginBottom: '1.5rem' }}>{description}</p>}
                  <Link href="/register" className="btn btn-primary">Join a Cohort</Link>
                </div>

                {/* RIGHT COLUMN */}
                <div>
                  {goal && (
                    <div style={{ marginBottom: '1.75rem' }}>
                      <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '0.5rem', display: 'block' }}>Leadership Development Goal</span>
                      <p style={{ fontSize: '0.95rem', fontWeight: 600, color: dark ? 'rgba(255,255,255,0.85)' : 'var(--navy)', lineHeight: 1.5, paddingLeft: '1rem', borderLeft: '2px solid var(--gold)', margin: 0 }}>{goal}</p>
                    </div>
                  )}

                  {focusList.length > 0 && (
                    <div style={{ marginBottom: '1.75rem' }}>
                      <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '0.65rem', display: 'block' }}>Focus Areas</span>
                      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                        {focusList.map(f => <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', fontSize: '0.88rem', color: dark ? 'rgba(255,255,255,0.6)' : 'var(--slate)', lineHeight: 1.5 }}><span style={{ color: 'var(--gold)', fontSize: '0.8rem', flexShrink: 0, fontWeight: 700, paddingTop: '0.1rem' }}>&#10022;</span>{f}</li>)}
                      </ul>
                    </div>
                  )}

                  {experience.length > 0 && (
                    <div style={{ marginBottom: '1.75rem' }}>
                      <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '0.65rem', display: 'block' }}>What You Will Experience</span>
                      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                        {experience.map(e => <li key={e} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', fontSize: '0.88rem', color: dark ? 'rgba(255,255,255,0.6)' : 'var(--slate)', lineHeight: 1.5 }}><span style={{ color: 'var(--gold)', fontSize: '0.8rem', flexShrink: 0, fontWeight: 700, paddingTop: '0.1rem' }}>&#10022;</span>{e}</li>)}
                      </ul>
                    </div>
                  )}

                  <div style={{ background: dark ? 'rgba(255,255,255,0.05)' : 'var(--paper)', border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,23,55,0.1)'}`, borderRadius: '2px', padding: '1.25rem' }}>
                    {[
                      { label: 'Format', value: 'Cohort-Based Learning Experience' },
                      { label: 'Who It Is For', value: whoFor },
                      { label: 'Investment', value: priceLabel || 'Contact us' },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ padding: '0.5rem 0', borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,23,55,0.06)'}`, display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                        <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.55rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)' }}>{label}</span>
                        <span style={{ fontSize: '0.85rem', color: dark ? 'rgba(255,255,255,0.85)' : 'var(--ink)', fontWeight: label === 'Investment' ? 700 : 600, lineHeight: 1.5 }}>{value}</span>
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
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '1rem', maxWidth: '480px', margin: '0 auto 2.5rem', lineHeight: 1.75 }}>Join a cohort and start creating the impact you were made for.</p>
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