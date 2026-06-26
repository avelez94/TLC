'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

type Page = 'dashboard' | 'programs' | 'cohort' | 'reps' | 'journal' | 'community' | 'library' | 'progress' | 'certificates'

const participant = {
  name: 'Jordan Williams',
  program: 'Impact Makers',
  cohort: 'Impact Makers — Spring 2025',
  nextSession: 'Tuesday, July 8 at 6:00 PM',
  zoomLink: 'https://zoom.us/j/example',
  sessionsCompleted: 3,
  sessionsTotal: 5,
  repsCompleted: 6,
  repsTotal: 10,
  reflections: 4,
}

const weeklyReps = [
  {
    id: 1, week: 'Week 3', title: 'Have one meaningful conversation',
    instructions: 'This week, identify one conversation you have been avoiding or putting off. Have it. It does not need to be dramatic. It needs to be real.',
    why: 'High contributors do not let important things go unsaid. The habit of addressing what matters builds trust, clears the air, and moves things forward.',
    due: 'July 8, 2025', completed: true,
    reflection: 'I talked to my manager about the project timeline. It went better than I expected and we are now aligned.',
  },
  {
    id: 2, week: 'Week 4', title: 'Practice active listening',
    instructions: 'In your next three conversations, focus entirely on listening. No planning your response while the other person talks. Ask one follow-up question before sharing your own thoughts.',
    why: 'Most people listen to respond, not to understand. Shifting this habit changes how people experience you as a colleague and leader.',
    due: 'July 8, 2025', completed: false, reflection: '',
  },
  {
    id: 3, week: 'Week 5', title: 'Ask for feedback',
    instructions: 'Ask one person you work with for specific feedback on something you are working to improve. Make it easy for them to be honest.',
    why: 'People who seek feedback grow faster than people who wait for it. This rep builds the habit of actively pursuing what you need to improve.',
    due: 'July 15, 2025', completed: false, reflection: '',
  },
]

export default function ImpactPortal() {
  const [page, setPage] = useState<Page>('dashboard')
  const [reps, setReps] = useState(weeklyReps)
  const [activeRep, setActiveRep] = useState<number | null>(null)
  const [repReflection, setRepReflection] = useState('')
  const [journalEntry, setJournalEntry] = useState('')
  const [journalEntries, setJournalEntries] = useState([
    { date: 'June 24, 2025', week: 'Week 3', prompt: 'Where did I apply what I learned?', response: 'I used the listening technique in our team standup. Instead of jumping in with my updates first I asked the team what they needed. The energy in the room shifted.' },
    { date: 'June 17, 2025', week: 'Week 2', prompt: 'What challenged me this week?', response: 'Stepping up without being asked felt uncomfortable. I almost waited for permission to share my idea. I shared it anyway and my manager said it was exactly what they needed.' },
  ])
  const [communityPosts, setCommunityPosts] = useState([
    { name: 'Alicia M.', time: '2 hours ago', text: 'Just completed Week 3 rep. That conversation I had been avoiding? Done. Lighter on the other side.', likes: 4 },
    { name: 'Derek T.', time: 'Yesterday', text: 'The active listening rep is harder than it sounds. I caught myself planning my response three times in one conversation. Awareness is the first step.', likes: 7 },
    { name: 'Priya S.', time: '2 days ago', text: 'Session 3 was the best one yet. The discussion about reading the real job to be done changed how I am thinking about my work.', likes: 9 },
  ])
  const [newPost, setNewPost] = useState('')

  const navItems: { id: Page; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: '⊞' },
    { id: 'programs', label: 'My Programs', icon: '🎯' },
    { id: 'cohort', label: 'Current Cohort', icon: '📅' },
    { id: 'reps', label: 'Weekly Reps', icon: '⚡' },
    { id: 'journal', label: 'Reflection Journal', icon: '📓' },
    { id: 'community', label: 'Community', icon: '💬' },
    { id: 'library', label: 'Resource Library', icon: '📚' },
    { id: 'progress', label: 'Progress', icon: '📊' },
    { id: 'certificates', label: 'Certificates', icon: '🏆' },
  ]

  const cardStyle = {
    background: 'white', borderRadius: '6px',
    border: '1px solid rgba(0,23,55,0.08)',
    padding: '1.5rem', marginBottom: '1.25rem',
  }

  const inputStyle = {
    width: '100%', padding: '0.75rem 1rem',
    border: '1.5px solid rgba(0,23,55,0.15)',
    borderRadius: '4px', fontFamily: "'Montserrat', sans-serif",
    fontSize: '0.9rem', color: 'var(--ink)',
    background: 'white', outline: 'none',
  }

  const completedRep = reps.filter(r => r.completed).length

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Montserrat', sans-serif" }}>
      {/* Sidebar */}
      <div style={{ width: '260px', minHeight: '100vh', background: 'var(--navy3)', borderRight: '1px solid rgba(200,136,32,0.15)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(200,136,32,0.15)' }}>
          <Link href="/" style={{ display: 'block', marginBottom: '1.25rem' }}>
            <Image src="/images/impact-lab-logo.png" alt="The Impact Lab" width={140} height={40} style={{ width: '140px', height: 'auto' }} />
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--navy)', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0 }}>
              {participant.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div>
              <div style={{ color: 'white', fontSize: '0.82rem', fontWeight: 600 }}>{participant.name}</div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.65rem', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em' }}>{participant.program}</div>
            </div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '1rem 0' }}>
          {navItems.map(({ id, label, icon }) => (
            <button key={id} onClick={() => { setPage(id); setActiveRep(null) }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1.5rem', background: page === id ? 'rgba(200,136,32,0.12)' : 'transparent', border: 'none', borderLeft: `3px solid ${page === id ? 'var(--gold)' : 'transparent'}`, color: page === id ? 'var(--gold)' : 'rgba(255,255,255,0.55)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', fontFamily: "'Montserrat', sans-serif" }}>
              <span style={{ fontSize: '0.9rem' }}>{icon}</span> {label}
            </button>
          ))}
        </nav>

        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <Link href="/login" style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)', display: 'block', textAlign: 'center' }}>Sign out</Link>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, background: 'var(--paper)', minHeight: '100vh', padding: 'clamp(1.5rem, 3vw, 2.5rem)', overflowY: 'auto' }}>

        {/* DASHBOARD */}
        {page === 'dashboard' && (
          <div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Dashboard</span>
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '1.5rem' }}>Welcome back, {participant.name.split(' ')[0]}.</h1>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
              {[
                { label: 'Current Program', value: participant.program, sub: 'Active enrollment' },
                { label: 'Next Session', value: participant.nextSession, sub: participant.cohort },
                { label: 'This Week', value: `${completedRep} of ${reps.length} reps done`, sub: 'Weekly reps' },
              ].map(({ label, value, sub }) => (
                <div key={label} style={{ ...cardStyle, marginBottom: 0 }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '0.5rem' }}>{label}</span>
                  <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '0.9rem', lineHeight: 1.4, marginBottom: '0.25rem' }}>{value}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--slate)' }}>{sub}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={cardStyle}>
                <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1rem' }}>Program Progress</h3>
                {[
                  { label: 'Sessions', done: participant.sessionsCompleted, total: participant.sessionsTotal },
                  { label: 'Weekly Reps', done: participant.repsCompleted, total: participant.repsTotal },
                  { label: 'Reflections', done: participant.reflections, total: 8 },
                ].map(({ label, done, total }) => (
                  <div key={label} style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--slate)', marginBottom: '0.35rem' }}>
                      <span>{label}</span><span>{done}/{total}</span>
                    </div>
                    <div style={{ height: '6px', background: 'var(--mist)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(done / total) * 100}%`, background: 'var(--gold)', borderRadius: '3px' }} />
                    </div>
                  </div>
                ))}
                <a href={participant.zoomLink} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.65rem 1.25rem', marginTop: '0.5rem' }}>Join Next Session</a>
              </div>
              <div style={cardStyle}>
                <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1rem' }}>This Week&apos;s Focus</h3>
                <div style={{ background: 'var(--navy)', borderRadius: '4px', padding: '1.25rem', marginBottom: '1rem' }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '0.4rem' }}>Week 4 Rep</span>
                  <p style={{ color: 'white', fontSize: '0.92rem', fontWeight: 600, marginBottom: '0.25rem' }}>Practice active listening</p>
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem' }}>Due July 8</p>
                </div>
                <button onClick={() => setPage('reps')} className="btn btn-ghost-dark" style={{ fontSize: '0.8rem', padding: '0.65rem 1.25rem' }}>View Weekly Reps</button>
              </div>
            </div>
          </div>
        )}

        {/* MY PROGRAMS */}
        {page === 'programs' && (
          <div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>My Programs</span>
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '1.5rem' }}>Your Enrollments</h1>
            <div style={{ ...cardStyle, borderLeft: '4px solid var(--gold)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '0.35rem' }}>Program 02</span>
                  <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', color: 'var(--navy)', letterSpacing: '0.04em' }}>Impact Makers</h3>
                </div>
                <span style={{ background: 'rgba(200,136,32,0.1)', color: 'var(--gold)', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', padding: '0.25rem 0.75rem', borderRadius: '2px' }}>Active</span>
              </div>
              <p style={{ color: 'var(--slate)', fontSize: '0.88rem', lineHeight: 1.65, marginBottom: '1.25rem' }}>Spring 2025 Cohort &middot; April 1 – May 13, 2025</p>
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--slate)', marginBottom: '0.35rem' }}>
                  <span>Overall progress</span><span>60%</span>
                </div>
                <div style={{ height: '8px', background: 'var(--mist)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: '60%', background: 'var(--gold)', borderRadius: '4px' }} />
                </div>
              </div>
              <button onClick={() => setPage('cohort')} className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.65rem 1.25rem' }}>Access Program</button>
            </div>
            <div style={{ ...cardStyle, opacity: 0.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--slate)', display: 'block', marginBottom: '0.35rem' }}>Program 01</span>
                  <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.25rem', color: 'var(--slate)', letterSpacing: '0.04em' }}>Impact Finders</h3>
                </div>
                <span style={{ background: 'var(--mist)', color: 'var(--slate)', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', padding: '0.25rem 0.75rem', borderRadius: '2px' }}>Completed</span>
              </div>
            </div>
          </div>
        )}

        {/* CURRENT COHORT */}
        {page === 'cohort' && (
          <div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Current Cohort</span>
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '1.5rem' }}>Impact Makers — Spring 2025</h1>

            <div style={cardStyle}>
              <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1rem' }}>Session Schedule</h3>
              {[
                { n: 1, date: 'April 1', topic: 'The gap between effort and contribution', done: true },
                { n: 2, date: 'April 8', topic: 'Reading the real job to be done', done: true },
                { n: 3, date: 'April 15', topic: 'Stepping up without being asked', done: true },
                { n: 4, date: 'July 8', topic: 'What you applied and what you learned', done: false, next: true },
                { n: 5, date: 'July 15', topic: 'Integration and next steps', done: false },
              ].map(({ n, date, topic, done, next }) => (
                <div key={n} style={{ display: 'flex', gap: '1rem', padding: '0.75rem 0', borderBottom: '1px solid var(--mist)', alignItems: 'center' }}>
                  <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: done ? 'var(--gold)' : next ? 'var(--navy)' : 'var(--mist)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: done ? 'var(--navy)' : next ? 'white' : 'var(--slate)', fontSize: '0.7rem', fontWeight: 700, flexShrink: 0 }}>
                    {done ? '✓' : n}
                  </span>
                  <div style={{ flex: 1 }}>
                    <span style={{ color: 'var(--ink)', fontSize: '0.88rem', fontWeight: done ? 400 : 600 }}>{topic}</span>
                    <span style={{ display: 'block', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', color: next ? 'var(--gold)' : 'var(--slate)', marginTop: '0.15rem' }}>{date}{next ? ' — Next session' : ''}</span>
                  </div>
                  {next && <a href={participant.zoomLink} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '0.5rem 1rem' }}>Join Zoom</a>}
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={cardStyle}>
                <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '0.75rem' }}>Announcements</h3>
                <div style={{ background: 'rgba(200,136,32,0.08)', border: '1px solid rgba(200,136,32,0.2)', borderRadius: '4px', padding: '1rem' }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.58rem', color: 'var(--gold)', letterSpacing: '0.1em' }}>July 1, 2025</span>
                  <p style={{ color: 'var(--ink)', fontSize: '0.85rem', lineHeight: 1.6, marginTop: '0.35rem' }}>Reminder: Complete your Week 4 rep before our next session on July 8. Come ready to share what you applied and what you noticed.</p>
                </div>
              </div>
              <div style={cardStyle}>
                <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '0.75rem' }}>Materials</h3>
                {['Session 3 Slides', 'Impact Makers Workbook', 'Week 4 Rep Guide', 'Session 3 Recording'].map(item => (
                  <div key={item} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0', borderBottom: '1px solid var(--mist)' }}>
                    <span style={{ color: 'var(--ink)', fontSize: '0.85rem' }}>{item}</span>
                    <button style={{ background: 'none', border: '1px solid var(--gold)', color: 'var(--gold)', borderRadius: '2px', padding: '0.25rem 0.65rem', fontSize: '0.68rem', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace" }}>View</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* WEEKLY REPS */}
        {page === 'reps' && activeRep === null && (
          <div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Weekly Reps</span>
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '0.5rem' }}>Your Reps</h1>
            <p style={{ color: 'var(--slate)', fontSize: '0.9rem', lineHeight: 1.7, marginBottom: '2rem' }}>Weekly reps are the bridge between sessions and real life. Each one is a practical assignment connected to what you are learning. Do the rep. Reflect on what happened. Bring it back to the group.</p>
            {reps.map((rep) => (
              <div key={rep.id} style={{ ...cardStyle, borderLeft: `4px solid ${rep.completed ? 'var(--gold)' : 'var(--mist)'}`, cursor: 'pointer' }} onClick={() => { setActiveRep(rep.id); setRepReflection(rep.reflection) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--gold)' }}>{rep.week}</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.1em', color: 'var(--slate)' }}>Due {rep.due}</span>
                    </div>
                    <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.15rem', color: 'var(--navy)', letterSpacing: '0.04em' }}>{rep.title}</h3>
                  </div>
                  <span style={{ padding: '0.25rem 0.75rem', borderRadius: '2px', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase', background: rep.completed ? 'rgba(200,136,32,0.1)' : 'var(--mist)', color: rep.completed ? 'var(--gold)' : 'var(--slate)', whiteSpace: 'nowrap' as const }}>
                    {rep.completed ? 'Completed' : 'Pending'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* WEEKLY REP DETAIL */}
        {page === 'reps' && activeRep !== null && (() => {
          const rep = reps.find(r => r.id === activeRep)!
          return (
            <div>
              <button onClick={() => setActiveRep(null)} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: '0.85rem', cursor: 'pointer', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}>
                &#8592; Back to reps
              </button>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>{rep.week}</span>
              <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '1.5rem' }}>{rep.title}</h1>
              <div style={cardStyle}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '0.6rem' }}>The Rep</span>
                <p style={{ color: 'var(--ink)', fontSize: '0.95rem', lineHeight: 1.75 }}>{rep.instructions}</p>
              </div>
              <div style={{ ...cardStyle, background: 'var(--navy)' }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '0.6rem' }}>Why it matters</span>
                <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.92rem', lineHeight: 1.75 }}>{rep.why}</p>
              </div>
              <div style={cardStyle}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '0.35rem' }}>Due date</span>
                <p style={{ color: 'var(--ink)', fontWeight: 600, marginBottom: '1.5rem' }}>{rep.due}</p>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '0.6rem' }}>Reflection — What happened when you did this rep?</span>
                <textarea value={repReflection} onChange={e => setRepReflection(e.target.value)} placeholder="Write your reflection here..." rows={5} style={{ ...inputStyle, resize: 'vertical' }} disabled={rep.completed} />
                {!rep.completed && (
                  <button onClick={() => {
                    setReps(reps.map(r => r.id === activeRep ? { ...r, completed: true, reflection: repReflection } : r))
                    setActiveRep(null)
                  }} className="btn btn-primary" style={{ marginTop: '1rem', fontSize: '0.85rem' }}>
                    Submit Rep
                  </button>
                )}
                {rep.completed && <p style={{ color: 'var(--gold)', fontSize: '0.82rem', marginTop: '0.75rem', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em' }}>&#10003; Submitted</p>}
              </div>
            </div>
          )
        })()}

        {/* REFLECTION JOURNAL */}
        {page === 'journal' && (
          <div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Reflection Journal</span>
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '1.5rem' }}>Your Journal</h1>
            <div style={cardStyle}>
              <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>New entry</h3>
              <p style={{ color: 'var(--slate)', fontSize: '0.82rem', marginBottom: '1rem' }}>This week&apos;s prompt: <em>What impact do I want to create this week?</em></p>
              <textarea value={journalEntry} onChange={e => setJournalEntry(e.target.value)} placeholder="Write your reflection here..." rows={5} style={{ ...inputStyle, resize: 'vertical' }} />
              <button onClick={() => { if (journalEntry.trim()) { setJournalEntries([{ date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), week: 'Week 4', prompt: 'What impact do I want to create this week?', response: journalEntry }, ...journalEntries]); setJournalEntry('') } }} className="btn btn-primary" style={{ marginTop: '1rem', fontSize: '0.8rem', padding: '0.65rem 1.5rem' }}>Save Entry</button>
            </div>
            {journalEntries.map((entry, i) => (
              <div key={i} style={{ ...cardStyle, borderLeft: '3px solid var(--gold)' }}>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', color: 'var(--gold)', textTransform: 'uppercase' }}>{entry.date}</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.58rem', color: 'var(--slate)' }}>{entry.week}</span>
                </div>
                <p style={{ color: 'var(--slate)', fontSize: '0.8rem', fontStyle: 'italic', marginBottom: '0.5rem' }}>{entry.prompt}</p>
                <p style={{ color: 'var(--ink)', fontSize: '0.88rem', lineHeight: 1.7 }}>{entry.response}</p>
              </div>
            ))}
          </div>
        )}

        {/* COMMUNITY */}
        {page === 'community' && (
          <div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Community</span>
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '0.5rem' }}>Cohort Community</h1>
            <p style={{ color: 'var(--slate)', fontSize: '0.9rem', lineHeight: 1.7, marginBottom: '1.5rem' }}>Share wins, ask questions, and encourage one another. This is your cohort space.</p>
            <div style={cardStyle}>
              <textarea value={newPost} onChange={e => setNewPost(e.target.value)} placeholder="Share a win, ask a question, or encourage someone..." rows={3} style={{ ...inputStyle, resize: 'none' }} />
              <button onClick={() => { if (newPost.trim()) { setCommunityPosts([{ name: participant.name, time: 'Just now', text: newPost, likes: 0 }, ...communityPosts]); setNewPost('') } }} className="btn btn-primary" style={{ marginTop: '0.75rem', fontSize: '0.8rem', padding: '0.65rem 1.25rem' }}>Post</button>
            </div>
            {communityPosts.map((post, i) => (
              <div key={i} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--navy)', fontWeight: 700, fontSize: '0.75rem', flexShrink: 0 }}>
                      {post.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <span style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.85rem' }}>{post.name}</span>
                      <span style={{ display: 'block', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.58rem', color: 'var(--slate)', letterSpacing: '0.08em' }}>{post.time}</span>
                    </div>
                  </div>
                </div>
                <p style={{ color: 'var(--ink)', fontSize: '0.88rem', lineHeight: 1.7, marginBottom: '0.75rem' }}>{post.text}</p>
                <button onClick={() => setCommunityPosts(communityPosts.map((p, j) => j === i ? { ...p, likes: p.likes + 1 } : p))} style={{ background: 'none', border: 'none', color: 'var(--slate)', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', fontFamily: "'Montserrat', sans-serif" }}>
                  ♡ {post.likes}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* RESOURCE LIBRARY */}
        {page === 'library' && (
          <div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Resource Library</span>
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '1.5rem' }}>Library</h1>
            {[
              { category: 'Session Recordings', items: ['Session 1 Recording — April 1', 'Session 2 Recording — April 8', 'Session 3 Recording — April 15'] },
              { category: 'Workbooks & Worksheets', items: ['Impact Makers Workbook', 'Week 1 Rep Worksheet', 'Contribution Self-Assessment'] },
              { category: 'Recommended Reading', items: ['The Effective Executive — Peter Drucker', 'Drive — Daniel Pink', 'The War of Art — Steven Pressfield'] },
              { category: 'Templates', items: ['Weekly Reflection Template', 'One-on-One Prep Template', 'Feedback Request Template'] },
            ].map(({ category, items }) => (
              <div key={category} style={cardStyle}>
                <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '0.75rem' }}>{category}</h3>
                {items.map(item => (
                  <div key={item} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0', borderBottom: '1px solid var(--mist)' }}>
                    <span style={{ color: 'var(--ink)', fontSize: '0.88rem' }}>{item}</span>
                    <button style={{ background: 'none', border: '1px solid var(--gold)', color: 'var(--gold)', borderRadius: '2px', padding: '0.3rem 0.75rem', fontSize: '0.72rem', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em' }}>View</button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* PROGRESS */}
        {page === 'progress' && (
          <div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Progress</span>
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '1.5rem' }}>Your Progress</h1>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
              {[
                { label: 'Sessions Completed', value: participant.sessionsCompleted, total: participant.sessionsTotal, icon: '📅' },
                { label: 'Weekly Reps Done', value: participant.repsCompleted, total: participant.repsTotal, icon: '⚡' },
                { label: 'Reflections Submitted', value: participant.reflections, total: 8, icon: '📓' },
                { label: 'Program Progress', value: 60, total: 100, icon: '🎯', percent: true },
              ].map(({ label, value, total, icon, percent }) => (
                <div key={label} style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--gold)' }}>{label}</span>
                    <span style={{ fontSize: '1.25rem' }}>{icon}</span>
                  </div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2.5rem', color: 'var(--navy)', letterSpacing: '0.04em', lineHeight: 1, marginBottom: '0.5rem' }}>{value}{percent ? '%' : `/${total}`}</div>
                  <div style={{ height: '6px', background: 'var(--mist)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${percent ? value : (value / total) * 100}%`, background: 'var(--gold)', borderRadius: '3px' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CERTIFICATES */}
        {page === 'certificates' && (
          <div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Certificates</span>
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '1.5rem' }}>Your Certificates</h1>
            <div style={{ ...cardStyle, opacity: 0.7 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.25rem', color: 'var(--navy)', letterSpacing: '0.04em' }}>Impact Makers — Spring 2025</h3>
                  <p style={{ color: 'var(--slate)', fontSize: '0.85rem', marginTop: '0.25rem' }}>Certificate of Completion</p>
                </div>
                <span style={{ background: 'var(--mist)', color: 'var(--slate)', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', padding: '0.25rem 0.75rem', borderRadius: '2px' }}>In Progress</span>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <p style={{ color: 'var(--slate)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>Requirements to earn your certificate:</p>
                {[
                  { req: 'Attend 4 of 5 sessions', done: true },
                  { req: 'Complete 8 of 10 weekly reps', done: false },
                  { req: 'Submit 6 reflections', done: false },
                  { req: 'Complete final submission', done: false },
                ].map(({ req, done }) => (
                  <div key={req} style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', padding: '0.4rem 0' }}>
                    <span style={{ color: done ? 'var(--gold)' : 'var(--mist)', fontSize: '0.85rem' }}>{done ? '✓' : '○'}</span>
                    <span style={{ color: done ? 'var(--ink)' : 'var(--slate)', fontSize: '0.85rem' }}>{req}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        input:focus, textarea:focus { border-color: var(--gold) !important; box-shadow: 0 0 0 3px rgba(200,136,32,0.1); }
      `}</style>
    </div>
  )
}