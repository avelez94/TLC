'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Page = 'dashboard' | 'sessions' | 'goals' | 'development-plan' | 'life-domains' | 'insights' | 'journal' | 'growth-journey' | 'resources' | 'assessments' | 'messages' | 'checkin' | 'profile'

const client = {
  name: 'Marcus Johnson',
  coach: 'Tramaine L. Crawford',
  focus: 'Leadership Presence & Executive Communication',
  nextSession: 'Tuesday, July 8 at 10:00 AM',
  sessionsCompleted: 4,
  sessionsTotal: 12,
  zoomLink: 'https://zoom.us/j/example',
}

const navItems: { id: Page; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '⊞' },
  { id: 'sessions', label: 'My Sessions', icon: '📅' },
  { id: 'goals', label: 'My Goals', icon: '🎯' },
  { id: 'development-plan', label: 'Development Plan', icon: '🌱' },
  { id: 'life-domains', label: 'Life Domains', icon: '🌐' },
  { id: 'insights', label: 'Insights', icon: '💡' },
  { id: 'journal', label: 'Journal', icon: '📓' },
  { id: 'growth-journey', label: 'Growth Journey', icon: '📈' },
  { id: 'resources', label: 'Resources', icon: '📚' },
  { id: 'assessments', label: 'Assessments', icon: '📊' },
  { id: 'messages', label: 'Messages', icon: '💬' },
  { id: 'checkin', label: 'Weekly Check-In', icon: '📋' },
  { id: 'profile', label: 'Profile', icon: '👤' },
]

const defaultDomains = ['Self', 'Family', 'Career', 'Leadership', 'Health', 'Faith', 'Finances', 'Relationships', 'Community']

export default function CoachingPortal() {
  const router = useRouter()
  const [page, setPage] = useState<Page>('dashboard')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [journalEntry, setJournalEntry] = useState('')
  const [journalEntries, setJournalEntries] = useState([
    { date: 'June 18, 2025', domain: 'Leadership', prompt: 'What did I learn this week?', response: 'I noticed I tend to dominate conversations when I feel uncertain. Asking questions creates more space for others and actually builds more trust.' },
    { date: 'June 11, 2025', domain: 'Career', prompt: 'Where did I apply what we discussed?', response: 'Used the pause technique in my team meeting on Thursday. Instead of jumping to solutions I asked the team what they thought first. The conversation was much richer.' },
  ])
  const [checkInSubmitted, setCheckInSubmitted] = useState(false)
  const [checkIn, setCheckIn] = useState({ went_well: '', challenging: '', progress: '', focus_today: '', anything_changed: '' })
  const [activeMessage, setActiveMessage] = useState('')
  const [messages, setMessages] = useState([
    { from: 'coach', text: 'Great work in our last session. Remember to practice the listening technique we discussed before our next meeting.', time: 'June 20, 2:14 PM' },
    { from: 'client', text: 'Thank you. I have been trying it in my one-on-ones and it is making a real difference.', time: 'June 20, 3:45 PM' },
    { from: 'coach', text: 'That is exactly what we want to see. Keep a note of specific moments you notice a shift. Bring those to our next session.', time: 'June 20, 4:02 PM' },
  ])
  const [goals, setGoals] = useState([
    { id: 1, title: 'Develop stronger executive presence', why: 'To lead with more confidence in high-stakes meetings', status: 'active', domain: 'Leadership', target: 'September 2025' },
    { id: 2, title: 'Build trust with my direct reports', why: 'To create a team environment where people bring their best', status: 'active', domain: 'Career', target: 'August 2025' },
    { id: 3, title: 'Establish a consistent morning routine', why: 'To start each day grounded and intentional', status: 'paused', domain: 'Self', target: 'July 2025' },
  ])
  const [insights, setInsights] = useState([
    { id: 1, date: 'June 17, 2025', domain: 'Leadership', insight: 'When I slow down my pace of speech, people actually listen more closely.', awareness: 'I have been rushing through presentations because of anxiety.', challenge: 'Staying calm when the stakes feel high.', commitment: 'Practice the 3-second pause before every key point this week.' },
  ])
  const [newInsight, setNewInsight] = useState({ domain: 'Leadership', insight: '', awareness: '', challenge: '', commitment: '' })
  const [showInsightForm, setShowInsightForm] = useState(false)
  const [customDomain, setCustomDomain] = useState('')
  const [activeDomains, setActiveDomains] = useState(defaultDomains)
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null)

  const cardStyle = { background: 'white', borderRadius: '6px', border: '1px solid rgba(0,23,55,0.08)', padding: '1.5rem', marginBottom: '1.25rem' }
  const inputStyle = { width: '100%', padding: '0.75rem 1rem', border: '1.5px solid rgba(0,23,55,0.15)', borderRadius: '4px', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.9rem', color: 'var(--ink)', background: 'white', outline: 'none' }
  const labelStyle = { fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: 'var(--gold)', display: 'block', marginBottom: '0.5rem' }

  const navigate = (id: Page) => { setPage(id); setMobileNavOpen(false) }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const Sidebar = () => (
    <div style={{ width: '240px', background: 'var(--navy)', borderRight: '1px solid rgba(200,136,32,0.15)', display: 'flex', flexDirection: 'column', flexShrink: 0, height: 'calc(100vh - 64px)', position: 'sticky', top: '64px', overflowY: 'auto' }}>
      <div style={{ padding: '1.25rem', borderBottom: '1px solid rgba(200,136,32,0.12)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--navy)', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 }}>
            {client.name.split(' ').map(n => n[0]).join('')}
          </div>
          <div>
            <div style={{ color: 'white', fontSize: '0.8rem', fontWeight: 600 }}>{client.name}</div>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.6rem', fontFamily: 'var(--font-jetbrains), monospace', letterSpacing: '0.08em' }}>Coaching Client</div>
          </div>
        </div>
      </div>
      <nav style={{ flex: 1, padding: '0.75rem 0' }}>
        {navItems.map(({ id, label, icon }) => (
          <button key={id} onClick={() => setPage(id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.65rem 1.25rem', background: page === id ? 'rgba(200,136,32,0.12)' : 'transparent', border: 'none', borderLeft: `3px solid ${page === id ? 'var(--gold)' : 'transparent'}`, color: page === id ? 'var(--gold)' : 'rgba(255,255,255,0.5)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', fontFamily: 'var(--font-montserrat), sans-serif' }}>
            <span style={{ fontSize: '0.85rem' }}>{icon}</span>{label}
          </button>
        ))}
      </nav>
      <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={handleSignOut} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', cursor: 'pointer', width: '100%', textAlign: 'center', fontFamily: 'var(--font-montserrat), sans-serif' }}>Sign out</button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', fontFamily: 'var(--font-montserrat), sans-serif', background: 'var(--paper)' }}>

      {/* TOP BAR */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200, background: 'var(--navy)', borderBottom: '1px solid rgba(200,136,32,0.15)', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link href="/" style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.25rem', color: 'var(--gold)', letterSpacing: '0.08em', textDecoration: 'none' }}>TLC</Link>
          <span style={{ color: 'rgba(255,255,255,0.2)' }}>/</span>
          <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.55rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>Coaching Portal</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--navy)', fontWeight: 700, fontSize: '0.8rem' }}>
            {client.name.split(' ').map(n => n[0]).join('')}
          </div>
          {/* Hamburger — mobile only */}
          <button className="mobile-hamburger" onClick={() => setMobileNavOpen(!mobileNavOpen)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: 'white', display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <span style={{ display: 'block', width: '22px', height: '2px', background: 'currentColor', borderRadius: '1px', transition: 'transform 0.2s', transform: mobileNavOpen ? 'translateY(7px) rotate(45deg)' : 'none' }} />
            <span style={{ display: 'block', width: '22px', height: '2px', background: 'currentColor', borderRadius: '1px', opacity: mobileNavOpen ? 0 : 1, transition: 'opacity 0.2s' }} />
            <span style={{ display: 'block', width: '22px', height: '2px', background: 'currentColor', borderRadius: '1px', transition: 'transform 0.2s', transform: mobileNavOpen ? 'translateY(-7px) rotate(-45deg)' : 'none' }} />
          </button>
        </div>
      </div>

      {/* MOBILE NAV OVERLAY */}
      {mobileNavOpen && (
        <div style={{ position: 'fixed', top: '64px', left: 0, right: 0, bottom: 0, background: 'var(--navy3)', zIndex: 199, overflowY: 'auto', borderTop: '2px solid var(--gold)' }}>
          <div style={{ padding: '1rem 0' }}>
            {navItems.map(({ id, label, icon }) => (
              <button key={id} onClick={() => navigate(id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '1rem 1.5rem', background: page === id ? 'rgba(200,136,32,0.12)' : 'transparent', border: 'none', borderLeft: `3px solid ${page === id ? 'var(--gold)' : 'transparent'}`, borderBottom: '1px solid rgba(255,255,255,0.05)', color: page === id ? 'var(--gold)' : 'rgba(255,255,255,0.65)', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-montserrat), sans-serif' }}>
                <span>{icon}</span>{label}
              </button>
            ))}
            <div style={{ padding: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '0.5rem' }}>
              <button onClick={handleSignOut} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: '0.85rem', cursor: 'pointer', display: 'block', width: '100%', textAlign: 'center', fontFamily: 'var(--font-montserrat), sans-serif' }}>Sign out</button>
            </div>
          </div>
        </div>
      )}

      {/* LAYOUT */}
      <div style={{ display: 'flex', paddingTop: '64px', minHeight: '100vh' }}>
        <div className="desktop-sidebar"><Sidebar /></div>

        {/* MAIN */}
        <div style={{ flex: 1, padding: 'clamp(1.25rem, 3vw, 2rem)', minWidth: 0 }}>

          {/* DASHBOARD */}
          {page === 'dashboard' && (
            <div>
              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Dashboard</span>
              <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '1.5rem' }}>Welcome back, {client.name.split(' ')[0]}.</h1>
              <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                {[
                  { label: 'Next Session', value: client.nextSession, sub: 'with ' + client.coach },
                  { label: 'Current Focus', value: client.focus, sub: 'Active coaching goal' },
                  { label: 'Sessions', value: `${client.sessionsCompleted} of ${client.sessionsTotal}`, sub: 'Completed' },
                ].map(({ label, value, sub }) => (
                  <div key={label} style={{ ...cardStyle, marginBottom: 0 }}>
                    <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.55rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '0.5rem' }}>{label}</span>
                    <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '0.88rem', lineHeight: 1.4, marginBottom: '0.25rem' }}>{value}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--slate)' }}>{sub}</div>
                  </div>
                ))}
              </div>
              <div className="two-col-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={cardStyle}>
                  <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1rem' }}>Quick Links</h3>
                  {navItems.filter(n => ['sessions','goals','checkin','messages','insights'].includes(n.id)).map(({ id, label, icon }) => (
                    <button key={id} onClick={() => setPage(id)} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', width: '100%', padding: '0.6rem 0', background: 'none', border: 'none', borderBottom: '1px solid var(--mist)', color: 'var(--navy)', fontSize: '0.85rem', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-montserrat), sans-serif' }}>
                      <span>{icon}</span>{label}
                    </button>
                  ))}
                </div>
                <div style={cardStyle}>
                  <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1rem' }}>Progress</h3>
                  <div style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--slate)' }}>
                    <span>Session progress</span><span>{client.sessionsCompleted}/{client.sessionsTotal}</span>
                  </div>
                  <div style={{ height: '8px', background: 'var(--mist)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(client.sessionsCompleted / client.sessionsTotal) * 100}%`, background: 'var(--gold)', borderRadius: '4px' }} />
                  </div>
                  <div style={{ marginTop: '1.25rem' }}>
                    <a href={client.zoomLink} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.65rem 1.25rem' }}>Join Next Session</a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MY SESSIONS */}
          {page === 'sessions' && (
            <div>
              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>My Sessions</span>
              <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '1.5rem' }}>Sessions</h1>
              <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em' }}>Upcoming</h3>
                  <span style={{ background: 'rgba(200,136,32,0.1)', color: 'var(--gold)', fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.1em', padding: '0.25rem 0.65rem', borderRadius: '2px' }}>Next</span>
                </div>
                <p style={{ fontWeight: 600, color: 'var(--navy)', marginBottom: '0.25rem' }}>Session 5 — {client.nextSession}</p>
                <p style={{ color: 'var(--slate)', fontSize: '0.85rem', marginBottom: '1rem' }}>with {client.coach}</p>
                <a href={client.zoomLink} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.65rem 1.25rem' }}>Join Zoom</a>
              </div>
              <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1rem', marginTop: '1.5rem' }}>Past Sessions</h3>
              {[
                { n: 4, date: 'June 17, 2025', topic: 'Communication under pressure', summary: 'Explored how stress affects communication patterns. Identified three trigger situations and practiced reframing responses.' },
                { n: 3, date: 'June 3, 2025', topic: 'Building trust with your team', summary: 'Discussed the trust equation and identified one specific behavior to change.' },
                { n: 2, date: 'May 20, 2025', topic: 'Presence and executive confidence', summary: 'Worked on posture, pacing, and preparation. Identified confidence patterns and how they show up in meetings.' },
                { n: 1, date: 'May 6, 2025', topic: 'Foundation session — goals and focus', summary: 'Established coaching goals, agreed on focus areas, and set expectations for the engagement.' },
              ].map(({ n, date, topic, summary }) => (
                <div key={n} style={{ ...cardStyle, borderLeft: '3px solid var(--mist)' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: '0.5rem', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '0.88rem' }}>Session {n} — {topic}</span>
                    <span style={{ color: 'var(--slate)', fontSize: '0.78rem', fontFamily: 'var(--font-jetbrains), monospace' }}>{date}</span>
                  </div>
                  <p style={{ color: 'var(--slate)', fontSize: '0.85rem', lineHeight: 1.65 }}>{summary}</p>
                </div>
              ))}
            </div>
          )}

          {/* MY GOALS */}
          {page === 'goals' && (
            <div>
              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>My Goals</span>
              <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '1.5rem' }}>Coaching Goals</h1>
              {goals.map(goal => (
                <div key={goal.id} style={{ ...cardStyle, borderLeft: `4px solid ${goal.status === 'active' ? 'var(--gold)' : 'var(--mist)'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                    <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.15rem', color: 'var(--navy)', letterSpacing: '0.04em' }}>{goal.title}</h3>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', letterSpacing: '0.1em', padding: '0.2rem 0.6rem', borderRadius: '2px', background: 'rgba(200,136,32,0.1)', color: 'var(--gold)' }}>{goal.domain}</span>
                      <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', letterSpacing: '0.1em', padding: '0.2rem 0.6rem', borderRadius: '2px', background: goal.status === 'active' ? 'rgba(200,136,32,0.1)' : 'var(--mist)', color: goal.status === 'active' ? 'var(--gold)' : 'var(--slate)', textTransform: 'uppercase' }}>{goal.status}</span>
                    </div>
                  </div>
                  <p style={{ color: 'var(--slate)', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '0.5rem' }}><strong style={{ color: 'var(--navy)' }}>Why it matters:</strong> {goal.why}</p>
                  <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', color: 'var(--slate)', letterSpacing: '0.1em' }}>Target: {goal.target}</span>
                </div>
              ))}
            </div>
          )}

          {/* DEVELOPMENT PLAN */}
          {page === 'development-plan' && (
            <div>
              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Development Plan</span>
              <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '0.5rem' }}>Your Living Coaching Plan</h1>
              <p style={{ color: 'var(--slate)', fontSize: '0.9rem', lineHeight: 1.7, marginBottom: '1.5rem' }}>This is your personal development plan. It evolves as you grow throughout the coaching engagement.</p>
              {[
                { label: 'Coaching Objectives', value: 'Build executive presence, strengthen team relationships, and communicate with clarity under pressure.' },
                { label: 'Current Coaching Focus', value: 'Communication under pressure — practicing the pause technique and managing emotional reactivity in high-stakes conversations.' },
                { label: 'Current Commitments', value: '1. Complete one-on-ones with all 5 direct reports by July 5.\n2. Practice the pause technique in this week\'s team meeting.\n3. Write three reflection journal entries before next session.' },
                { label: 'Progress Notes', value: 'Significant progress on self-awareness. Beginning to notice emotional triggers in real time. Trust-building with the team is improving based on feedback from direct reports.' },
                { label: 'Next Coaching Conversation', value: 'Reviewing communication under pressure. Sharing what worked, what did not, and what I noticed about myself.' },
              ].map(({ label, value }) => (
                <div key={label} style={cardStyle}>
                  <span style={labelStyle}>{label}</span>
                  <p style={{ color: 'var(--ink)', fontSize: '0.9rem', lineHeight: 1.75, whiteSpace: 'pre-line' }}>{value}</p>
                </div>
              ))}
            </div>
          )}

          {/* LIFE DOMAINS */}
          {page === 'life-domains' && (
            <div>
              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Life Domains</span>
              <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '0.5rem' }}>Life Domains</h1>
              <p style={{ color: 'var(--slate)', fontSize: '0.9rem', lineHeight: 1.7, marginBottom: '1.5rem' }}>Your coaching journey is organized around the areas of life that matter most to you. Click a domain to see everything connected to it.</p>
              <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                {activeDomains.map(domain => (
                  <button key={domain} onClick={() => setSelectedDomain(selectedDomain === domain ? null : domain)} style={{ padding: '1.5rem', background: selectedDomain === domain ? 'var(--navy)' : 'white', border: `2px solid ${selectedDomain === domain ? 'var(--gold)' : 'rgba(0,23,55,0.1)'}`, borderRadius: '6px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                    <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: selectedDomain === domain ? 'white' : 'var(--navy)', letterSpacing: '0.04em', marginBottom: '0.35rem' }}>{domain}</h3>
                    <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', color: 'var(--gold)', letterSpacing: '0.1em' }}>
                      {goals.filter(g => g.domain === domain).length} goals
                    </span>
                  </button>
                ))}
              </div>
              {selectedDomain && (
                <div style={cardStyle}>
                  <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1rem' }}>{selectedDomain} — Goals</h3>
                  {goals.filter(g => g.domain === selectedDomain).length === 0 ? (
                    <p style={{ color: 'var(--slate)', fontSize: '0.88rem' }}>No goals in this domain yet.</p>
                  ) : goals.filter(g => g.domain === selectedDomain).map(g => (
                    <div key={g.id} style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--mist)' }}>
                      <p style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.9rem' }}>{g.title}</p>
                      <p style={{ color: 'var(--slate)', fontSize: '0.82rem', marginTop: '0.25rem' }}>{g.why}</p>
                    </div>
                  ))}
                </div>
              )}
              <div style={cardStyle}>
                <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '0.75rem' }}>Add a custom domain</h3>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <input value={customDomain} onChange={e => setCustomDomain(e.target.value)} placeholder="e.g. Entrepreneurship" style={{ ...inputStyle, flex: 1 }} />
                  <button onClick={() => { if (customDomain.trim() && !activeDomains.includes(customDomain)) { setActiveDomains([...activeDomains, customDomain]); setCustomDomain('') } }} className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.65rem 1.25rem', whiteSpace: 'nowrap' }}>Add</button>
                </div>
              </div>
            </div>
          )}

          {/* INSIGHTS */}
          {page === 'insights' && (
            <div>
              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Insights</span>
              <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '0.5rem' }}>Your Insights</h1>
              <p style={{ color: 'var(--slate)', fontSize: '0.9rem', lineHeight: 1.7, marginBottom: '1.5rem' }}>Capture your biggest insights after each coaching session. These compound over time into a record of your growth.</p>
              <button onClick={() => setShowInsightForm(!showInsightForm)} className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.65rem 1.25rem', marginBottom: '1.5rem' }}>
                {showInsightForm ? 'Cancel' : '+ New Insight'}
              </button>
              {showInsightForm && (
                <div style={{ ...cardStyle, borderTop: '3px solid var(--gold)' }}>
                  <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1.25rem' }}>Capture an insight</h3>
                  {[
                    { key: 'insight', label: 'Biggest Insight', placeholder: 'What is the most important thing you learned or realized?' },
                    { key: 'awareness', label: 'Biggest Awareness', placeholder: 'What did you become aware of about yourself?' },
                    { key: 'challenge', label: 'Biggest Challenge', placeholder: 'What is still challenging you?' },
                    { key: 'commitment', label: 'My Commitment', placeholder: 'What are you committing to do differently?' },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key} style={{ marginBottom: '1rem' }}>
                      <label style={labelStyle}>{label}</label>
                      <textarea value={newInsight[key as keyof typeof newInsight]} onChange={e => setNewInsight({ ...newInsight, [key]: e.target.value })} placeholder={placeholder} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
                    </div>
                  ))}
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={labelStyle}>Life Domain</label>
                    <select value={newInsight.domain} onChange={e => setNewInsight({ ...newInsight, domain: e.target.value })} style={inputStyle}>
                      {activeDomains.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <button onClick={() => {
                    if (newInsight.insight.trim()) {
                      setInsights([{ id: insights.length + 1, date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), ...newInsight }, ...insights])
                      setNewInsight({ domain: 'Leadership', insight: '', awareness: '', challenge: '', commitment: '' })
                      setShowInsightForm(false)
                    }
                  }} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>Save Insight</button>
                </div>
              )}
              {insights.map(ins => (
                <div key={ins.id} style={{ ...cardStyle, borderLeft: '3px solid var(--gold)' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{ins.date}</span>
                    <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', color: 'var(--slate)', background: 'var(--mist)', padding: '0.2rem 0.5rem', borderRadius: '2px' }}>{ins.domain}</span>
                  </div>
                  {[
                    { label: 'Biggest Insight', value: ins.insight },
                    { label: 'Biggest Awareness', value: ins.awareness },
                    { label: 'Biggest Challenge', value: ins.challenge },
                    { label: 'My Commitment', value: ins.commitment },
                  ].map(({ label, value }) => value ? (
                    <div key={label} style={{ marginBottom: '0.75rem' }}>
                      <span style={{ ...labelStyle, fontSize: '0.55rem' }}>{label}</span>
                      <p style={{ color: 'var(--ink)', fontSize: '0.88rem', lineHeight: 1.65 }}>{value}</p>
                    </div>
                  ) : null)}
                </div>
              ))}
            </div>
          )}

          {/* JOURNAL */}
          {page === 'journal' && (
            <div>
              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Journal</span>
              <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '1.5rem' }}>Reflection Journal</h1>
              <div style={cardStyle}>
                <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1rem' }}>New entry</h3>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={labelStyle}>Life Domain</label>
                  <select style={inputStyle} id="journal-domain">
                    {activeDomains.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <p style={{ color: 'var(--slate)', fontSize: '0.82rem', marginBottom: '0.75rem' }}>Today&apos;s prompt: <em>What impact did I create this week, and how did I show up?</em></p>
                <textarea value={journalEntry} onChange={e => setJournalEntry(e.target.value)} placeholder="Write your reflection here..." rows={5} style={{ ...inputStyle, resize: 'vertical' }} />
                <button onClick={() => {
                  if (journalEntry.trim()) {
                    const domainEl = document.getElementById('journal-domain') as HTMLSelectElement
                    setJournalEntries([{ date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), domain: domainEl?.value || 'Self', prompt: 'What impact did I create this week, and how did I show up?', response: journalEntry }, ...journalEntries])
                    setJournalEntry('')
                  }
                }} className="btn btn-primary" style={{ marginTop: '1rem', fontSize: '0.8rem', padding: '0.65rem 1.5rem' }}>Save Entry</button>
              </div>
              {journalEntries.map((entry, i) => (
                <div key={i} style={{ ...cardStyle, borderLeft: '3px solid var(--gold)' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.1em', color: 'var(--gold)', textTransform: 'uppercase' }}>{entry.date}</span>
                    <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', color: 'var(--slate)', background: 'var(--mist)', padding: '0.2rem 0.5rem', borderRadius: '2px' }}>{entry.domain}</span>
                  </div>
                  <p style={{ color: 'var(--slate)', fontSize: '0.8rem', fontStyle: 'italic', marginBottom: '0.5rem' }}>{entry.prompt}</p>
                  <p style={{ color: 'var(--ink)', fontSize: '0.88rem', lineHeight: 1.7 }}>{entry.response}</p>
                </div>
              ))}
            </div>
          )}

          {/* GROWTH JOURNEY */}
          {page === 'growth-journey' && (
            <div>
              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Growth Journey</span>
              <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '0.5rem' }}>Your Growth Timeline</h1>
              <p style={{ color: 'var(--slate)', fontSize: '0.9rem', lineHeight: 1.7, marginBottom: '2rem' }}>A visual record of your coaching journey — every session, insight, and milestone along the way.</p>
              <div style={{ position: 'relative', paddingLeft: '2rem' }}>
                <div style={{ position: 'absolute', left: '0.65rem', top: 0, bottom: 0, width: '2px', background: 'linear-gradient(to bottom, var(--gold), rgba(200,136,32,0.1))' }} />
                {[
                  { date: 'June 17, 2025', type: 'session', title: 'Session 4 — Communication under pressure', desc: 'Explored stress responses and reframing techniques.' },
                  { date: 'June 17, 2025', type: 'insight', title: 'Insight captured', desc: 'Slowing down speech creates more presence and trust.' },
                  { date: 'June 3, 2025', type: 'session', title: 'Session 3 — Building trust', desc: 'Discussed the trust equation and committed to one-on-ones.' },
                  { date: 'May 20, 2025', type: 'session', title: 'Session 2 — Executive confidence', desc: 'Worked on posture, pacing, and preparation.' },
                  { date: 'May 6, 2025', type: 'session', title: 'Session 1 — Foundation', desc: 'Established coaching goals and expectations.' },
                ].map((milestone, i) => (
                  <div key={i} style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', position: 'relative' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: milestone.type === 'insight' ? 'var(--gold)' : 'var(--navy)', border: '2px solid var(--gold)', flexShrink: 0, marginTop: '0.2rem' }} />
                    <div style={cardStyle}>
                      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{milestone.date}</span>
                        <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.55rem', color: 'var(--slate)', background: 'var(--mist)', padding: '0.15rem 0.45rem', borderRadius: '2px', textTransform: 'uppercase' }}>{milestone.type}</span>
                      </div>
                      <h4 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>{milestone.title}</h4>
                      <p style={{ color: 'var(--slate)', fontSize: '0.85rem', lineHeight: 1.6 }}>{milestone.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* RESOURCES */}
          {page === 'resources' && (
            <div>
              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Resources</span>
              <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '1.5rem' }}>Resource Library</h1>
              {[
                { category: 'Worksheets', items: ['Executive Presence Self-Assessment', 'Trust Equation Worksheet', 'Communication Style Inventory'] },
                { category: 'Recommended Reading', items: ['The Trusted Advisor — David Maister', 'Dare to Lead — Brene Brown', 'The First 90 Days — Michael Watkins'] },
                { category: 'Session Materials', items: ['Session 4 Slides — Communication Under Pressure', 'Session 3 Worksheet — Building Trust', 'Coaching Agreement'] },
                { category: 'Videos', items: ['Introduction to the DiSC Model', 'The Power of Vulnerability — Brene Brown TED Talk'] },
              ].map(({ category, items }) => (
                <div key={category} style={cardStyle}>
                  <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '0.75rem' }}>{category}</h3>
                  {items.map(item => (
                    <div key={item} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0', borderBottom: '1px solid var(--mist)' }}>
                      <span style={{ color: 'var(--ink)', fontSize: '0.88rem' }}>{item}</span>
                      <button style={{ background: 'none', border: '1px solid var(--gold)', color: 'var(--gold)', borderRadius: '2px', padding: '0.3rem 0.75rem', fontSize: '0.72rem', cursor: 'pointer' }}>View</button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* ASSESSMENTS */}
          {page === 'assessments' && (
            <div>
              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Assessments</span>
              <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '1.5rem' }}>Assessments</h1>
              {[
                { title: 'DiSC Assessment', desc: 'Understanding your behavioral style and how it shapes your leadership.', status: 'Completed', date: 'May 6, 2025' },
                { title: 'Leadership Presence Assessment', desc: 'A self-reflection tool to evaluate your current executive presence.', status: 'Completed', date: 'May 20, 2025' },
                { title: 'Values Assessment', desc: 'Identify and clarify the core values driving your decisions.', status: 'Pending', date: 'Due July 8, 2025' },
                { title: 'Mid-Engagement Reflection', desc: 'Halfway check-in on progress toward coaching goals.', status: 'Upcoming', date: 'Available July 15' },
              ].map(({ title, desc, status, date }) => (
                <div key={title} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.05rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '0.3rem' }}>{title}</h3>
                    <p style={{ color: 'var(--slate)', fontSize: '0.85rem', lineHeight: 1.55, marginBottom: '0.5rem' }}>{desc}</p>
                    <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: 'var(--slate)', letterSpacing: '0.1em' }}>{date}</span>
                  </div>
                  <span style={{ padding: '0.3rem 0.75rem', borderRadius: '2px', fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', background: status === 'Completed' ? 'rgba(200,136,32,0.1)' : status === 'Pending' ? 'rgba(0,23,55,0.08)' : 'transparent', color: status === 'Completed' ? 'var(--gold)' : 'var(--slate)', border: status === 'Upcoming' ? '1px solid rgba(0,23,55,0.1)' : 'none', whiteSpace: 'nowrap' as const }}>{status}</span>
                </div>
              ))}
            </div>
          )}

          {/* MESSAGES */}
          {page === 'messages' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Messages</span>
              <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '1rem' }}>Messages with {client.coach}</h1>
              <div style={{ flex: 1, background: 'white', border: '1px solid rgba(0,23,55,0.08)', borderRadius: '6px', padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
                {messages.map((msg, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: msg.from === 'client' ? 'flex-end' : 'flex-start' }}>
                    <div style={{ maxWidth: '75%', background: msg.from === 'client' ? 'var(--navy)' : 'var(--paper)', color: msg.from === 'client' ? 'white' : 'var(--ink)', borderRadius: '8px', padding: '0.85rem 1rem', fontSize: '0.88rem', lineHeight: 1.6 }}>
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
              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Weekly Check-In</span>
              <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '0.5rem' }}>Pre-Session Check-In</h1>
              <p style={{ color: 'var(--slate)', fontSize: '0.9rem', lineHeight: 1.7, marginBottom: '2rem' }}>Complete this before your next session on {client.nextSession}.</p>
              {checkInSubmitted ? (
                <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>✓</div>
                  <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.5rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>Check-in submitted.</h3>
                  <p style={{ color: 'var(--slate)', fontSize: '0.88rem' }}>{client.coach} will review your responses before your session.</p>
                </div>
              ) : (
                <form onSubmit={e => { e.preventDefault(); setCheckInSubmitted(true) }} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {[
                    { key: 'went_well', label: 'What has gone well since our last session?', placeholder: 'Wins, progress, positive moments...' },
                    { key: 'challenging', label: 'What has been challenging?', placeholder: 'Struggles, stuck points, tensions...' },
                    { key: 'progress', label: 'What progress have you made?', placeholder: 'Changes you have noticed or actions you have taken...' },
                    { key: 'focus_today', label: 'What would you like to focus on today?', placeholder: 'Topics, questions, or goals for this session...' },
                    { key: 'anything_changed', label: 'Has anything changed since our last session?', placeholder: 'New developments, decisions, or shifts in priorities...' },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key} style={cardStyle}>
                      <label style={labelStyle}>{label}</label>
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
              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Profile</span>
              <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '1.5rem' }}>Your Profile</h1>
              <div style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '2rem' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--navy)', fontWeight: 700, fontSize: '1.25rem' }}>
                    {client.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.25rem', color: 'var(--navy)', letterSpacing: '0.04em' }}>{client.name}</h3>
                    <span style={{ color: 'var(--slate)', fontSize: '0.82rem' }}>Coaching Client</span>
                  </div>
                </div>
                {[
                  { label: 'Full Name', value: client.name },
                  { label: 'Coach', value: client.coach },
                  { label: 'Coaching Focus', value: client.focus },
                  { label: 'Time Zone', value: 'America/New_York' },
                  { label: 'Notifications', value: 'Email and in-app' },
                ].map(({ label, value }) => (
                  <div key={label} style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--mist)', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--gold)' }}>{label}</span>
                    <span style={{ color: 'var(--ink)', fontSize: '0.88rem', fontWeight: 500 }}>{value}</span>
                  </div>
                ))}
              </div>
              <button onClick={handleSignOut} className="btn btn-ghost-dark" style={{ fontSize: '0.85rem', marginTop: '1rem' }}>Sign Out</button>
            </div>
          )}

        </div>
      </div>

      <style>{`
        .desktop-sidebar { display: flex; }
        .mobile-hamburger { display: none; }
        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
          .mobile-hamburger { display: flex !important; }
          .stat-grid { grid-template-columns: 1fr !important; }
          .two-col-grid { grid-template-columns: 1fr !important; }
        }
        input:focus, textarea:focus, select:focus { border-color: var(--gold) !important; box-shadow: 0 0 0 3px rgba(200,136,32,0.1); }
      `}</style>
    </div>
  )
}