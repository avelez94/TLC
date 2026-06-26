'use client'

import { useState } from 'react'
import Link from 'next/link'

type Page = 'dashboard' | 'sessions' | 'action-plan' | 'journal' | 'resources' | 'assessments' | 'messages' | 'checkin' | 'profile'

const client = {
  name: 'Marcus Johnson',
  coach: 'Tramaine L. Crawford',
  focus: 'Leadership Presence & Executive Communication',
  nextSession: 'Tuesday, July 8 at 10:00 AM',
  sessionsCompleted: 4,
  sessionsTotal: 12,
  zoomLink: 'https://zoom.us/j/example',
}

export default function CoachingPortal() {
  const [page, setPage] = useState<Page>('dashboard')
  const [journalEntry, setJournalEntry] = useState('')
  const [journalEntries, setJournalEntries] = useState([
    { date: 'June 18, 2025', prompt: 'What did I learn this week?', response: 'I noticed I tend to dominate conversations when I feel uncertain. The coaching session helped me see that asking questions creates more space for others and actually builds more trust.' },
    { date: 'June 11, 2025', prompt: 'Where did I apply what we discussed?', response: 'Used the pause technique in my team meeting on Thursday. Instead of jumping to solutions I asked the team what they thought first. The conversation was much richer.' },
  ])
  const [checkInSubmitted, setCheckInSubmitted] = useState(false)
  const [checkIn, setCheckIn] = useState({ win: '', challenge: '', progress: '', priority: '', discuss: '' })
  const [activeMessage, setActiveMessage] = useState('')
  const [messages, setMessages] = useState([
    { from: 'coach', text: 'Great work in our last session. Remember to practice the listening technique we discussed before our next meeting.', time: 'June 20, 2:14 PM' },
    { from: 'client', text: 'Thank you. I have been trying it in my one-on-ones and it is making a real difference.', time: 'June 20, 3:45 PM' },
    { from: 'coach', text: 'That is exactly what we want to see. Keep a note of specific moments you notice a shift. Bring those to our next session.', time: 'June 20, 4:02 PM' },
  ])

  const navItems: { id: Page; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: '⊞' },
    { id: 'sessions', label: 'My Sessions', icon: '📅' },
    { id: 'action-plan', label: 'Action Plan', icon: '✓' },
    { id: 'journal', label: 'Journal', icon: '📓' },
    { id: 'resources', label: 'Resources', icon: '📚' },
    { id: 'assessments', label: 'Assessments', icon: '📊' },
    { id: 'messages', label: 'Messages', icon: '💬' },
    { id: 'checkin', label: 'Weekly Check-In', icon: '📋' },
    { id: 'profile', label: 'Profile', icon: '👤' },
  ]

  const sidebarStyle = {
    width: '260px', minHeight: '100vh', background: 'var(--navy)',
    borderRight: '1px solid rgba(200,136,32,0.15)',
    display: 'flex', flexDirection: 'column' as const, flexShrink: 0,
  }

  const mainStyle = {
    flex: 1, background: 'var(--paper)', minHeight: '100vh',
    padding: 'clamp(1.5rem, 3vw, 2.5rem)',
    overflowY: 'auto' as const,
  }

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

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Montserrat', sans-serif" }}>
      {/* Sidebar */}
      <div style={sidebarStyle}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(200,136,32,0.15)' }}>
          <Link href="/" style={{ display: 'block', marginBottom: '1.25rem' }}>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.25rem', color: 'var(--gold)', letterSpacing: '0.08em' }}>TLC</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', display: 'block' }}>Coaching Portal</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--navy)', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0 }}>
              {client.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div>
              <div style={{ color: 'white', fontSize: '0.82rem', fontWeight: 600 }}>{client.name}</div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.65rem', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em' }}>Coaching Client</div>
            </div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '1rem 0' }}>
          {navItems.map(({ id, label, icon }) => (
            <button key={id} onClick={() => setPage(id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1.5rem', background: page === id ? 'rgba(200,136,32,0.12)' : 'transparent', border: 'none', borderLeft: `3px solid ${page === id ? 'var(--gold)' : 'transparent'}`, color: page === id ? 'var(--gold)' : 'rgba(255,255,255,0.55)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', fontFamily: "'Montserrat', sans-serif" }}>
              <span style={{ fontSize: '0.9rem' }}>{icon}</span> {label}
            </button>
          ))}
        </nav>

        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <Link href="/login" style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)', display: 'block', textAlign: 'center' }}>Sign out</Link>
        </div>
      </div>

      {/* Main content */}
      <div style={mainStyle}>

        {/* DASHBOARD */}
        {page === 'dashboard' && (
          <div>
            <div style={{ marginBottom: '2rem' }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Dashboard</span>
              <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem' }}>Welcome back, {client.name.split(' ')[0]}.</h1>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
              {[
                { label: 'Next Session', value: client.nextSession, sub: 'with ' + client.coach },
                { label: 'Current Focus', value: client.focus, sub: 'Active coaching goal' },
                { label: 'Sessions', value: `${client.sessionsCompleted} of ${client.sessionsTotal}`, sub: 'Completed' },
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
                <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1rem' }}>Quick Links</h3>
                {navItems.filter(n => ['sessions','action-plan','checkin','messages'].includes(n.id)).map(({ id, label, icon }) => (
                  <button key={id} onClick={() => setPage(id)} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', width: '100%', padding: '0.6rem 0', background: 'none', border: 'none', borderBottom: '1px solid var(--mist)', color: 'var(--navy)', fontSize: '0.85rem', cursor: 'pointer', textAlign: 'left', fontFamily: "'Montserrat', sans-serif" }}>
                    <span>{icon}</span> {label}
                  </button>
                ))}
              </div>
              <div style={cardStyle}>
                <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1rem' }}>Progress</h3>
                <div style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--slate)' }}>
                  <span>Session progress</span><span>{client.sessionsCompleted}/{client.sessionsTotal}</span>
                </div>
                <div style={{ height: '8px', background: 'var(--mist)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(client.sessionsCompleted / client.sessionsTotal) * 100}%`, background: 'var(--gold)', borderRadius: '4px', transition: 'width 0.5s' }} />
                </div>
                <div style={{ marginTop: '1.25rem' }}>
                  <a href={client.zoomLink} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.65rem 1.25rem' }}>Join Next Session</a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SESSIONS */}
        {page === 'sessions' && (
          <div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>My Sessions</span>
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '1.5rem' }}>Sessions</h1>
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em' }}>Upcoming</h3>
                <span style={{ background: 'rgba(200,136,32,0.1)', color: 'var(--gold)', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', padding: '0.25rem 0.65rem', borderRadius: '2px' }}>Next</span>
              </div>
              <p style={{ fontWeight: 600, color: 'var(--navy)', marginBottom: '0.25rem' }}>Session 5 — {client.nextSession}</p>
              <p style={{ color: 'var(--slate)', fontSize: '0.85rem', marginBottom: '1rem' }}>with {client.coach}</p>
              <a href={client.zoomLink} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.65rem 1.25rem' }}>Join Zoom</a>
            </div>
            <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1rem', marginTop: '1.5rem' }}>Past Sessions</h3>
            {[
              { n: 4, date: 'June 17, 2025', topic: 'Communication under pressure', summary: 'Explored how stress affects communication patterns. Identified three trigger situations and practiced reframing responses.' },
              { n: 3, date: 'June 3, 2025', topic: 'Building trust with your team', summary: 'Discussed the trust equation and identified one specific behavior to change. Action item: one-on-ones with each direct report.' },
              { n: 2, date: 'May 20, 2025', topic: 'Presence and executive confidence', summary: 'Worked on posture, pacing, and preparation. Identified confidence patterns and how they show up in meetings.' },
              { n: 1, date: 'May 6, 2025', topic: 'Foundation session — goals and focus', summary: 'Established coaching goals, agreed on focus areas, and set expectations for the engagement.' },
            ].map(({ n, date, topic, summary }) => (
              <div key={n} style={{ ...cardStyle, borderLeft: '3px solid var(--mist)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '0.88rem' }}>Session {n} — {topic}</span>
                  <span style={{ color: 'var(--slate)', fontSize: '0.78rem', fontFamily: "'JetBrains Mono', monospace" }}>{date}</span>
                </div>
                <p style={{ color: 'var(--slate)', fontSize: '0.85rem', lineHeight: 1.65 }}>{summary}</p>
              </div>
            ))}
          </div>
        )}

        {/* ACTION PLAN */}
        {page === 'action-plan' && (
          <div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Action Plan</span>
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '1.5rem' }}>Goals &amp; Action Items</h1>
            <div style={cardStyle}>
              <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1rem' }}>Current Coaching Goals</h3>
              {['Develop a stronger executive presence in high-stakes meetings', 'Build trust and psychological safety with my direct reports', 'Communicate with clarity and confidence under pressure'].map((goal, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.75rem', padding: '0.75rem 0', borderBottom: '1px solid var(--mist)', alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--gold)', fontWeight: 700, flexShrink: 0, marginTop: '0.1rem' }}>0{i + 1}</span>
                  <span style={{ color: 'var(--ink)', fontSize: '0.9rem', lineHeight: 1.55 }}>{goal}</span>
                </div>
              ))}
            </div>
            <div style={cardStyle}>
              <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1rem' }}>Active Action Items</h3>
              {[
                { item: 'Complete one-on-ones with all 5 direct reports', due: 'July 5', done: true },
                { item: 'Practice the pause technique in this week\'s team meeting', due: 'July 8', done: false },
                { item: 'Read chapters 3–4 of the recommended book', due: 'July 8', done: false },
                { item: 'Write three reflection journal entries before next session', due: 'July 8', done: false },
              ].map(({ item, due, done }, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.75rem', padding: '0.75rem 0', borderBottom: '1px solid var(--mist)', alignItems: 'flex-start' }}>
                  <div style={{ width: '18px', height: '18px', borderRadius: '3px', border: `2px solid ${done ? 'var(--gold)' : 'rgba(0,23,55,0.2)'}`, background: done ? 'var(--gold)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '0.15rem' }}>
                    {done && <span style={{ color: 'var(--navy)', fontSize: '0.65rem', fontWeight: 700 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ color: done ? 'var(--slate)' : 'var(--ink)', fontSize: '0.88rem', textDecoration: done ? 'line-through' : 'none' }}>{item}</span>
                    <span style={{ display: 'block', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', color: 'var(--gold)', letterSpacing: '0.1em', marginTop: '0.2rem' }}>Due {due}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* JOURNAL */}
        {page === 'journal' && (
          <div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Journal</span>
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '1.5rem' }}>Reflection Journal</h1>
            <div style={cardStyle}>
              <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>New entry</h3>
              <p style={{ color: 'var(--slate)', fontSize: '0.82rem', marginBottom: '1rem' }}>Today&apos;s prompt: <em>What impact did I create this week, and how did I show up?</em></p>
              <textarea value={journalEntry} onChange={e => setJournalEntry(e.target.value)} placeholder="Write your reflection here..." rows={5} style={{ ...inputStyle, resize: 'vertical' }} />
              <button onClick={() => { if (journalEntry.trim()) { setJournalEntries([{ date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), prompt: 'What impact did I create this week, and how did I show up?', response: journalEntry }, ...journalEntries]); setJournalEntry('') } }} className="btn btn-primary" style={{ marginTop: '1rem', fontSize: '0.8rem', padding: '0.65rem 1.5rem' }}>Save Entry</button>
            </div>
            <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1rem', marginTop: '1.5rem' }}>Past Entries</h3>
            {journalEntries.map((entry, i) => (
              <div key={i} style={{ ...cardStyle, borderLeft: '3px solid var(--gold)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', color: 'var(--gold)', textTransform: 'uppercase' }}>{entry.date}</span>
                </div>
                <p style={{ color: 'var(--slate)', fontSize: '0.8rem', fontStyle: 'italic', marginBottom: '0.5rem' }}>{entry.prompt}</p>
                <p style={{ color: 'var(--ink)', fontSize: '0.88rem', lineHeight: 1.7 }}>{entry.response}</p>
              </div>
            ))}
          </div>
        )}

        {/* RESOURCES */}
        {page === 'resources' && (
          <div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Resources</span>
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '1.5rem' }}>Your Resource Library</h1>
            {[
              { category: 'Worksheets', items: ['Executive Presence Self-Assessment', 'Trust Equation Worksheet', 'Communication Style Inventory'] },
              { category: 'Recommended Reading', items: ['The Trusted Advisor — David Maister', 'Dare to Lead — Brené Brown', 'The First 90 Days — Michael Watkins'] },
              { category: 'Session Materials', items: ['Session 4 Slides — Communication Under Pressure', 'Session 3 Worksheet — Building Trust', 'Coaching Agreement'] },
            ].map(({ category, items }) => (
              <div key={category} style={{ ...cardStyle }}>
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

        {/* ASSESSMENTS */}
        {page === 'assessments' && (
          <div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Assessments</span>
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '1.5rem' }}>Assessments &amp; Exercises</h1>
            {[
              { title: 'DiSC Assessment', desc: 'Understanding your behavioral style and how it shapes your leadership.', status: 'Completed', date: 'May 6, 2025' },
              { title: 'Leadership Presence Assessment', desc: 'A self-reflection tool to evaluate your current executive presence.', status: 'Completed', date: 'May 20, 2025' },
              { title: 'Communication Under Pressure', desc: 'Reflection exercise from Session 4.', status: 'Pending', date: 'Due July 8, 2025' },
              { title: 'Mid-Engagement Reflection', desc: 'Halfway check-in on progress toward coaching goals.', status: 'Upcoming', date: 'Available July 15' },
            ].map(({ title, desc, status, date }) => (
              <div key={title} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.05rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '0.3rem' }}>{title}</h3>
                  <p style={{ color: 'var(--slate)', fontSize: '0.85rem', lineHeight: 1.55, marginBottom: '0.5rem' }}>{desc}</p>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', color: 'var(--slate)', letterSpacing: '0.1em' }}>{date}</span>
                </div>
                <span style={{ padding: '0.3rem 0.75rem', borderRadius: '2px', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', background: status === 'Completed' ? 'rgba(200,136,32,0.1)' : status === 'Pending' ? 'rgba(0,23,55,0.08)' : 'transparent', color: status === 'Completed' ? 'var(--gold)' : 'var(--slate)', border: status === 'Upcoming' ? '1px solid rgba(0,23,55,0.1)' : 'none', whiteSpace: 'nowrap' as const }}>{status}</span>
              </div>
            ))}
          </div>
        )}

        {/* MESSAGES */}
        {page === 'messages' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 5rem)' }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Messages</span>
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '1.5rem' }}>Messages with {client.coach}</h1>
            <div style={{ flex: 1, background: 'white', border: '1px solid rgba(0,23,55,0.08)', borderRadius: '6px', padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: msg.from === 'client' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '70%', background: msg.from === 'client' ? 'var(--navy)' : 'var(--paper)', color: msg.from === 'client' ? 'white' : 'var(--ink)', borderRadius: '8px', padding: '0.85rem 1rem', fontSize: '0.88rem', lineHeight: 1.6 }}>
                    <p style={{ margin: 0 }}>{msg.text}</p>
                    <span style={{ fontSize: '0.65rem', color: msg.from === 'client' ? 'rgba(255,255,255,0.4)' : 'var(--slate)', display: 'block', marginTop: '0.35rem' }}>{msg.time}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <input value={activeMessage} onChange={e => setActiveMessage(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && activeMessage.trim()) { setMessages([...messages, { from: 'client', text: activeMessage, time: 'Just now' }]); setActiveMessage('') } }} placeholder="Type a message..." style={{ ...inputStyle, flex: 1 }} />
              <button onClick={() => { if (activeMessage.trim()) { setMessages([...messages, { from: 'client', text: activeMessage, time: 'Just now' }]); setActiveMessage('') } }} className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.65rem 1.25rem', whiteSpace: 'nowrap' }}>Send</button>
            </div>
          </div>
        )}

        {/* WEEKLY CHECK-IN */}
        {page === 'checkin' && (
          <div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Weekly Check-In</span>
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '0.5rem' }}>Pre-Session Check-In</h1>
            <p style={{ color: 'var(--slate)', fontSize: '0.9rem', lineHeight: 1.7, marginBottom: '2rem' }}>Complete this before your next session on {client.nextSession}. Your responses will be reviewed by {client.coach} before you meet.</p>
            {checkInSubmitted ? (
              <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>&#10003;</div>
                <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>Check-in submitted.</h3>
                <p style={{ color: 'var(--slate)', fontSize: '0.88rem' }}>{client.coach} will review your responses before your session.</p>
              </div>
            ) : (
              <form onSubmit={e => { e.preventDefault(); setCheckInSubmitted(true) }} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {[
                  { key: 'win', label: 'Biggest win since our last session', placeholder: 'What went well?' },
                  { key: 'challenge', label: 'Biggest challenge', placeholder: 'What felt hard or stuck?' },
                  { key: 'progress', label: 'Progress since last session', placeholder: 'What have you worked on or noticed?' },
                  { key: 'priority', label: 'Current priority', placeholder: 'What matters most right now?' },
                  { key: 'discuss', label: 'Anything you want to discuss?', placeholder: 'Questions, concerns, or topics you want to cover.' },
                ].map(({ key, label, placeholder }) => (
                  <div key={key} style={cardStyle}>
                    <label style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '0.6rem' }}>{label}</label>
                    <textarea value={checkIn[key as keyof typeof checkIn]} onChange={e => setCheckIn({ ...checkIn, [key]: e.target.value })} placeholder={placeholder} rows={3} required style={{ ...inputStyle, resize: 'vertical' }} />
                  </div>
                ))}
                <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start', fontSize: '0.85rem' }}>Submit Check-In</button>
              </form>
            )}
          </div>
        )}

        {/* PROFILE */}
        {page === 'profile' && (
          <div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Profile</span>
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '1.5rem' }}>Your Profile</h1>
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '2rem' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--navy)', fontWeight: 700, fontSize: '1.25rem' }}>
                  {client.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.25rem', color: 'var(--navy)', letterSpacing: '0.04em' }}>{client.name}</h3>
                  <span style={{ color: 'var(--slate)', fontSize: '0.82rem' }}>Coaching Client</span>
                </div>
              </div>
              {[{ label: 'Full Name', value: client.name }, { label: 'Coach', value: client.coach }, { label: 'Coaching Focus', value: client.focus }].map(({ label, value }) => (
                <div key={label} style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--mist)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--gold)' }}>{label}</span>
                  <span style={{ color: 'var(--ink)', fontSize: '0.88rem', fontWeight: 500 }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 768px) {
          body > div > div { flex-direction: column; }
        }
        input:focus, textarea:focus { border-color: var(--gold) !important; box-shadow: 0 0 0 3px rgba(200,136,32,0.1); }
      `}</style>
    </div>
  )
}