'use client'

import { useRef, useState } from 'react'
import { ADMIN_TRAINING_CHAPTERS } from '@/lib/training-files'
import { cardStyle, helpStyle, pageTitleStyle, sectionTitleStyle } from '../components/shared'

const fileUrl = (key: string, download = false) => `/api/admin/training/${key}${download ? '?download=1' : ''}`
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

const downloadStyle = { display: 'inline-flex', alignItems: 'center', minHeight: '44px', padding: '0.6rem 1rem', background: 'white', border: '1.5px solid rgba(0,23,55,0.2)', borderRadius: '3px', fontWeight: 600, fontSize: '0.8rem', color: 'var(--navy)', textDecoration: 'none', fontFamily: 'var(--font-montserrat), sans-serif' } as const
const videoStyle = { width: '100%', maxWidth: '100%', aspectRatio: '16 / 9', background: '#000', borderRadius: '6px', display: 'block' } as const
const metaStyle = { fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.66rem', letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: '#8a5a10', margin: '0 0 0.35rem' }

export default function TrainingPage() {
  const video = useRef<HTMLVideoElement>(null)
  const [current, setCurrent] = useState(1)

  const jump = (start: number) => {
    const v = video.current; if (!v) return
    v.currentTime = start; void v.play().catch(() => {})
    v.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
  const onTime = () => {
    const t = video.current?.currentTime ?? 0
    const ch = ADMIN_TRAINING_CHAPTERS.filter(c => c[2] <= t + 0.2).pop()
    if (ch && ch[0] !== current) setCurrent(ch[0])
  }

  return (
    <div style={{ maxWidth: '1040px' }}>
      <h1 style={pageTitleStyle}>Training</h1>
      <p style={helpStyle}>Two walkthrough videos and the quick-start guide. Only signed-in administrators can open this page and these files. The admin video uses practice data with made-up people.</p>

      <section style={cardStyle} aria-labelledby="tr-guide">
        <p style={metaStyle}>Guide · 1 page</p>
        <h2 id="tr-guide" style={sectionTitleStyle}>Admin quick-start guide</h2>
        <p style={helpStyle}>Every task from the admin video on one page, in the same order as its 18 chapters.</p>
        <a href={fileUrl('quick-start', true)} style={downloadStyle}>Download the guide (PDF)</a>
      </section>

      <section style={cardStyle} aria-labelledby="tr-admin">
        <p style={metaStyle}>Video · 9 min 19 s · 18 chapters</p>
        <h2 id="tr-admin" style={sectionTitleStyle}>How to use the admin dashboard</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '1.25rem', alignItems: 'start' }}>
          <div style={{ gridColumn: 'span 2', minWidth: 0 }} className="training-video">
            <video ref={video} controls preload="metadata" playsInline src={fileUrl('admin-training')} style={videoStyle} onTimeUpdate={onTime} aria-label="Admin training video" />
          </div>
          <ol aria-label="Chapters" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '2px', maxHeight: '380px', overflowY: 'auto', minWidth: 0 }}>
            {ADMIN_TRAINING_CHAPTERS.map(([n, title, start]) => (
              <li key={n}>
                <button type="button" id={`training-chapter-${n}`} onClick={() => jump(start)} aria-current={current === n ? 'true' : undefined}
                  style={{ width: '100%', display: 'grid', gridTemplateColumns: '2em 1fr auto', gap: '0.5rem', alignItems: 'baseline', textAlign: 'left', padding: '0.55rem 0.65rem', minHeight: '40px', border: 0, borderRadius: '4px', background: current === n ? 'rgba(200,136,32,0.14)' : 'transparent', cursor: 'pointer', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.82rem', fontWeight: 500, color: 'var(--navy)' }}>
                  <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.72rem', color: '#8a5a10' }}>{String(n).padStart(2, '0')}</span>
                  <span>{title}</span>
                  <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.7rem', color: 'var(--slate)' }}>{fmt(start)}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
        <p style={{ ...helpStyle, margin: '0.75rem 0' }}>Select a chapter to jump to it.</p>
        <a href={fileUrl('admin-training', true)} style={downloadStyle}>Download the video (MP4, 45 MB)</a>
      </section>

      <section style={cardStyle} aria-labelledby="tr-site">
        <p style={metaStyle}>Video · 3 min 49 s</p>
        <h2 id="tr-site" style={sectionTitleStyle}>The Impact Lab website</h2>
        <p style={helpStyle}>A tour of the Impact Lab page: the three pathways, how the Lab works, organizational programs and the inquiry form.</p>
        <video controls preload="metadata" playsInline src={fileUrl('website-tour')} style={{ ...videoStyle, maxWidth: '760px', marginBottom: '1rem' }} aria-label="Website tour video" />
        <a href={fileUrl('website-tour', true)} style={downloadStyle}>Download the video (MP4, 29 MB)</a>
      </section>
      <style>{`@media (max-width: 720px) { .training-video { grid-column: auto !important } }`}</style>
    </div>
  )
}
