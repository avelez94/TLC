'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Page = 'dashboard' | 'users' | 'programs' | 'cohorts' | 'enrollments' | 'reps' | 'announcements' | 'resources' | 'attendance' | 'assessments' | 'evaluations' | 'certificates' | 'messages' | 'reports'

const navItems: { id: Page; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '⊞' },
  { id: 'users', label: 'Users', icon: '👥' },
  { id: 'programs', label: 'Programs', icon: '🎯' },
  { id: 'cohorts', label: 'Cohorts', icon: '📅' },
  { id: 'enrollments', label: 'Enrollments', icon: '📋' },
  { id: 'reps', label: 'Weekly Reps', icon: '⚡' },
  { id: 'announcements', label: 'Announcements', icon: '📢' },
  { id: 'resources', label: 'Resources', icon: '📚' },
  { id: 'attendance', label: 'Attendance', icon: '✅' },
  { id: 'assessments', label: 'Assessments', icon: '📊' },
  { id: 'evaluations', label: 'Evaluations', icon: '📝' },
  { id: 'certificates', label: 'Certificates', icon: '🏆' },
  { id: 'messages', label: 'Messages', icon: '💬' },
  { id: 'reports', label: 'Reports', icon: '📈' },
]

// Sample data
const sampleUsers = [
  { id: '1', name: 'Jordan Williams', email: 'impact@impact.com', role: 'impact_participant', program: 'Impact Makers', status: 'active', joined: 'April 1, 2025' },
  { id: '2', name: 'Marcus Johnson', email: 'coach@coach.com', role: 'coaching_client', program: 'Coaching', status: 'active', joined: 'May 6, 2025' },
  { id: '3', name: 'Alicia Martinez', email: 'alicia@test.com', role: 'impact_participant', program: 'Impact Makers', status: 'active', joined: 'April 1, 2025' },
  { id: '4', name: 'Derek Thompson', email: 'derek@test.com', role: 'impact_participant', program: 'Impact Makers', status: 'active', joined: 'April 1, 2025' },
  { id: '5', name: 'Priya Singh', email: 'priya@test.com', role: 'impact_participant', program: 'Impact Makers', status: 'active', joined: 'April 1, 2025' },
]

const samplePrograms = [
  { id: '1', name: 'Impact Finders', type: 'cohort', cohorts: 3, participants: 42, status: 'active' },
  { id: '2', name: 'Impact Makers', type: 'cohort', cohorts: 5, participants: 78, status: 'active' },
  { id: '3', name: 'Impact Leaders', type: 'cohort', cohorts: 2, participants: 24, status: 'active' },
  { id: '4', name: 'Executive Coaching', type: 'coaching', cohorts: 0, participants: 12, status: 'active' },
]

const sampleCohorts = [
  { id: '1', name: 'Impact Makers — Spring 2025', program: 'Impact Makers', start: 'April 1, 2025', end: 'July 15, 2025', participants: 18, status: 'active' },
  { id: '2', name: 'Impact Finders — Spring 2025', program: 'Impact Finders', start: 'March 1, 2025', end: 'May 31, 2025', participants: 22, status: 'completed' },
  { id: '3', name: 'Impact Makers — Fall 2025', program: 'Impact Makers', start: 'September 1, 2025', end: 'November 15, 2025', participants: 0, status: 'upcoming' },
]

const sampleEvaluations = [
  { id: '1', user: 'Jordan Williams', cohort: 'Impact Makers — Spring 2025', session: 3, type: 'session', submitted: 'June 16, 2025', rating: 'Excellent' },
  { id: '2', user: 'Alicia Martinez', cohort: 'Impact Makers — Spring 2025', session: 3, type: 'session', submitted: 'June 16, 2025', rating: 'Very Good' },
  { id: '3', user: 'Derek Thompson', cohort: 'Impact Makers — Spring 2025', session: 3, type: 'facilitator', submitted: 'June 16, 2025', rating: 'Excellent' },
]

export default function Admin() {
  const router = useRouter()
  const [page, setPage] = useState<Page>('dashboard')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [users, setUsers] = useState(sampleUsers)
  const [programs, setPrograms] = useState(samplePrograms)
  const [cohorts, setCohorts] = useState(sampleCohorts)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [showProgramForm, setShowProgramForm] = useState(false)
  const [showCohortForm, setShowCohortForm] = useState(false)
  const [showRepForm, setShowRepForm] = useState(false)
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false)
  const [showResourceForm, setShowResourceForm] = useState(false)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [userFilter, setUserFilter] = useState('all')
  const [invite, setInvite] = useState({ email: '', full_name: '', role: 'impact_participant' })
  const [newProgram, setNewProgram] = useState({ name: '', type: 'cohort' })
  const [newCohort, setNewCohort] = useState({ name: '', program: 'Impact Makers', start: '', end: '', zoom_link: '' })
  const [newRep, setNewRep] = useState({ cohort: 'Impact Makers — Spring 2025', week: '', title: '', instructions: '', why: '', due: '' })
  const [newAnnouncement, setNewAnnouncement] = useState({ cohort: 'all', title: '', body: '' })
  const [newResource, setNewResource] = useState({ title: '', type: 'pdf', url: '', program: 'Impact Makers', topic: '', portal_type: 'impact' })
  const [reps, setReps] = useState([
    { id: '1', cohort: 'Impact Makers — Spring 2025', week: 3, title: 'Have one meaningful conversation', due: 'July 8, 2025', submissions: 14, total: 18 },
    { id: '2', cohort: 'Impact Makers — Spring 2025', week: 4, title: 'Practice active listening', due: 'July 8, 2025', submissions: 6, total: 18 },
  ])
  const [announcements, setAnnouncements] = useState([
    { id: '1', cohort: 'Impact Makers — Spring 2025', title: 'Session 4 reminder', date: 'July 1, 2025', body: 'Complete your Week 4 rep before July 8.' },
    { id: '2', cohort: 'All', title: 'Welcome to the platform', date: 'April 1, 2025', body: 'Your portal is now live.' },
  ])
  const [resources, setResources] = useState([
    { id: '1', title: 'Impact Makers Workbook', type: 'pdf', program: 'Impact Makers', portal_type: 'impact', topic: 'Program materials' },
    { id: '2', title: 'Executive Presence Self-Assessment', type: 'worksheet', program: 'Coaching', portal_type: 'coaching', topic: 'Self-assessment' },
    { id: '3', title: 'Session 3 Recording', type: 'recording', program: 'Impact Makers', portal_type: 'impact', topic: 'Session recordings' },
  ])
  const [attendance, setAttendance] = useState([
    { session: 1, date: 'April 1', attendees: [
      { name: 'Jordan Williams', attended: true },
      { name: 'Alicia Martinez', attended: true },
      { name: 'Derek Thompson', attended: true },
      { name: 'Priya Singh', attended: false },
    ]},
    { session: 2, date: 'April 8', attendees: [
      { name: 'Jordan Williams', attended: true },
      { name: 'Alicia Martinez', attended: true },
      { name: 'Derek Thompson', attended: false },
      { name: 'Priya Singh', attended: true },
    ]},
    { session: 3, date: 'April 15', attendees: [
      { name: 'Jordan Williams', attended: true },
      { name: 'Alicia Martinez', attended: true },
      { name: 'Derek Thompson', attended: true },
      { name: 'Priya Singh', attended: true },
    ]},
  ])

  const cardStyle = { background: 'white', borderRadius: '6px', border: '1px solid rgba(0,23,55,0.08)', padding: '1.5rem', marginBottom: '1.25rem' }
  const inputStyle = { width: '100%', padding: '0.75rem 1rem', border: '1.5px solid rgba(0,23,55,0.15)', borderRadius: '4px', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.9rem', color: 'var(--ink)', background: 'white', outline: 'none' }
  const labelStyle = { fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: 'var(--gold)', display: 'block', marginBottom: '0.5rem' }
  const thStyle = { fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: 'var(--slate)', padding: '0.65rem 1rem', textAlign: 'left' as const, borderBottom: '1px solid var(--mist)', background: 'var(--paper)' }
  const tdStyle = { padding: '0.85rem 1rem', fontSize: '0.85rem', color: 'var(--ink)', borderBottom: '1px solid var(--mist)', verticalAlign: 'middle' as const }

  const navigate = (id: Page) => { setPage(id); setMobileNavOpen(false) }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviteLoading(true)
    setInviteError('')
    setInviteSuccess('')

    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invite),
      })
      const data = await res.json()
      if (data.error) {
        setInviteError(data.error)
      } else {
        setInviteSuccess(`Invitation sent to ${invite.email}. They will receive an email to set their password.`)
        setInvite({ email: '', full_name: '', role: 'impact_participant' })
        setShowInviteForm(false)
      }
    } catch {
      setInviteError('Failed to send invite. Please try again.')
    }
    setInviteLoading(false)
  }

  const roleBadge = (role: string) => {
    const colors: Record<string, { bg: string; color: string }> = {
      admin: { bg: 'rgba(200,136,32,0.15)', color: 'var(--gold)' },
      coaching_client: { bg: 'rgba(0,23,55,0.08)', color: 'var(--navy)' },
      impact_participant: { bg: 'rgba(10,37,71,0.08)', color: 'var(--slate)' },
    }
    const style = colors[role] || colors.impact_participant
    return (
      <span style={{ ...style, fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.2rem 0.6rem', borderRadius: '2px' }}>
        {role.replace('_', ' ')}
      </span>
    )
  }

  const statusBadge = (status: string) => {
    const colors: Record<string, { bg: string; color: string }> = {
      active: { bg: 'rgba(200,136,32,0.1)', color: 'var(--gold)' },
      completed: { bg: 'var(--mist)', color: 'var(--slate)' },
      upcoming: { bg: 'rgba(0,23,55,0.06)', color: 'var(--navy)' },
    }
    const style = colors[status] || colors.active
    return (
      <span style={{ ...style, fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.2rem 0.6rem', borderRadius: '2px' }}>
        {status}
      </span>
    )
  }

  const Sidebar = () => (
    <div style={{ width: '240px', background: 'var(--navy3)', borderRight: '1px solid rgba(200,136,32,0.15)', display: 'flex', flexDirection: 'column', flexShrink: 0, height: 'calc(100vh - 64px)', position: 'sticky', top: '64px', overflowY: 'auto' }}>
      <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(200,136,32,0.12)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--gold)' }} />
          <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>Admin Panel</span>
        </div>
      </div>
      <nav style={{ flex: 1, padding: '0.75rem 0' }}>
        {navItems.map(({ id, label, icon }) => (
          <button key={id} onClick={() => setPage(id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.62rem 1.25rem', background: page === id ? 'rgba(200,136,32,0.12)' : 'transparent', border: 'none', borderLeft: `3px solid ${page === id ? 'var(--gold)' : 'transparent'}`, color: page === id ? 'var(--gold)' : 'rgba(255,255,255,0.5)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', fontFamily: 'var(--font-montserrat), sans-serif' }}>
            <span style={{ fontSize: '0.82rem' }}>{icon}</span>{label}
          </button>
        ))}
      </nav>
      <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <Link href="/" style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', display: 'block', textAlign: 'center', marginBottom: '0.5rem' }}>View public site</Link>
        <button onClick={handleSignOut} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: '0.72rem', cursor: 'pointer', width: '100%', textAlign: 'center', fontFamily: 'var(--font-montserrat), sans-serif' }}>Sign out</button>
      </div>
    </div>
  )

  const filteredUsers = userFilter === 'all' ? users : users.filter(u => u.role === userFilter)

  return (
    <div style={{ minHeight: '100vh', fontFamily: 'var(--font-montserrat), sans-serif', background: 'var(--paper)' }}>

      {/* TOP BAR */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200, background: 'var(--navy3)', borderBottom: '1px solid rgba(200,136,32,0.15)', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.25rem', color: 'var(--gold)', letterSpacing: '0.08em' }}>TLC</span>
          <span style={{ color: 'rgba(255,255,255,0.2)' }}>/</span>
          <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.55rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>Admin</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--navy)', fontWeight: 700, fontSize: '0.8rem' }}>TC</div>
          <button className="mobile-hamburger" onClick={() => setMobileNavOpen(!mobileNavOpen)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: 'white', flexDirection: 'column', gap: '5px' }}>
            <span style={{ display: 'block', width: '22px', height: '2px', background: 'currentColor', borderRadius: '1px', transition: 'transform 0.2s', transform: mobileNavOpen ? 'translateY(7px) rotate(45deg)' : 'none' }} />
            <span style={{ display: 'block', width: '22px', height: '2px', background: 'currentColor', borderRadius: '1px', opacity: mobileNavOpen ? 0 : 1, transition: 'opacity 0.2s' }} />
            <span style={{ display: 'block', width: '22px', height: '2px', background: 'currentColor', borderRadius: '1px', transition: 'transform 0.2s', transform: mobileNavOpen ? 'translateY(-7px) rotate(-45deg)' : 'none' }} />
          </button>
        </div>
      </div>

      {/* MOBILE NAV */}
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

      <div style={{ display: 'flex', paddingTop: '64px', minHeight: '100vh' }}>
        <div className="desktop-sidebar"><Sidebar /></div>

        <div style={{ flex: 1, padding: 'clamp(1.25rem, 3vw, 2rem)', minWidth: 0 }}>

          {/* DASHBOARD */}
          {page === 'dashboard' && (
            <div>
              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Admin</span>
              <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '1.5rem' }}>Overview</h1>
              <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                {[
                  { label: 'Total Users', value: '94', sub: 'Active accounts' },
                  { label: 'Active Cohorts', value: '3', sub: 'Currently running' },
                  { label: 'Programs', value: '4', sub: 'Total programs' },
                  { label: 'Certificates Issued', value: '47', sub: 'All time' },
                ].map(({ label, value, sub }) => (
                  <div key={label} style={{ ...cardStyle, marginBottom: 0 }}>
                    <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.55rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '0.5rem' }}>{label}</span>
                    <div style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '2.5rem', color: 'var(--navy)', letterSpacing: '0.04em', lineHeight: 1, marginBottom: '0.25rem' }}>{value}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--slate)' }}>{sub}</div>
                  </div>
                ))}
              </div>
              <div className="two-col-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={cardStyle}>
                  <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1rem' }}>Active Cohorts</h3>
                  {cohorts.filter(c => c.status === 'active').map(c => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0', borderBottom: '1px solid var(--mist)', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <p style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.85rem' }}>{c.name}</p>
                        <p style={{ color: 'var(--slate)', fontSize: '0.75rem' }}>{c.participants} participants</p>
                      </div>
                      {statusBadge(c.status)}
                    </div>
                  ))}
                </div>
                <div style={cardStyle}>
                  <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1rem' }}>Quick Actions</h3>
                  {[
                    { label: 'Invite a user', action: () => { setPage('users'); setShowInviteForm(true) } },
                    { label: 'Create a cohort', action: () => { setPage('cohorts'); setShowCohortForm(true) } },
                    { label: 'Post an announcement', action: () => { setPage('announcements'); setShowAnnouncementForm(true) } },
                    { label: 'Add a weekly rep', action: () => { setPage('reps'); setShowRepForm(true) } },
                    { label: 'Add a resource', action: () => { setPage('resources'); setShowResourceForm(true) } },
                    { label: 'Issue a certificate', action: () => setPage('certificates') },
                  ].map(({ label, action }) => (
                    <button key={label} onClick={action} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '0.6rem 0', background: 'none', border: 'none', borderBottom: '1px solid var(--mist)', color: 'var(--navy)', fontSize: '0.85rem', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 500 }}>
                      {label} <span style={{ color: 'var(--gold)' }}>&#8594;</span>
                    </button>
                  ))}
                </div>
              </div>
              <div style={cardStyle}>
                <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1rem' }}>Program Overview</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['Program', 'Type', 'Cohorts', 'Participants', 'Status'].map(h => <th key={h} style={thStyle}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {programs.map(p => (
                        <tr key={p.id}>
                          <td style={tdStyle}><span style={{ fontWeight: 600, color: 'var(--navy)' }}>{p.name}</span></td>
                          <td style={tdStyle}><span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.65rem', color: 'var(--slate)', textTransform: 'uppercase' }}>{p.type}</span></td>
                          <td style={tdStyle}>{p.cohorts}</td>
                          <td style={tdStyle}>{p.participants}</td>
                          <td style={tdStyle}>{statusBadge(p.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* USERS */}
          {page === 'users' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Users</span>
                  <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem' }}>All Users</h1>
                </div>
                <button onClick={() => setShowInviteForm(!showInviteForm)} className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.65rem 1.25rem' }}>
                  {showInviteForm ? 'Cancel' : '+ Invite User'}
                </button>
              </div>

              {inviteSuccess && (
                <div style={{ background: 'rgba(200,136,32,0.1)', border: '1px solid rgba(200,136,32,0.3)', borderRadius: '4px', padding: '0.85rem 1rem', marginBottom: '1.25rem', color: 'var(--gold)', fontSize: '0.85rem' }}>
                  {inviteSuccess}
                </div>
              )}

              {showInviteForm && (
                <div style={{ ...cardStyle, borderTop: '3px solid var(--gold)', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>Invite a New User</h3>
                  <p style={{ color: 'var(--slate)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>They will receive an email with a link to set their own password.</p>
                  {inviteError && (
                    <div style={{ background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.3)', borderRadius: '4px', padding: '0.75rem 1rem', marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>{inviteError}</div>
                  )}
                  <form onSubmit={handleInvite} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={labelStyle}>Full Name</label>
                      <input value={invite.full_name} onChange={e => setInvite({ ...invite, full_name: e.target.value })} placeholder="Jane Smith" style={inputStyle} required />
                    </div>
                    <div>
                      <label style={labelStyle}>Email Address</label>
                      <input type="email" value={invite.email} onChange={e => setInvite({ ...invite, email: e.target.value })} placeholder="jane@email.com" style={inputStyle} required />
                    </div>
                    <div>
                      <label style={labelStyle}>Role</label>
                      <select value={invite.role} onChange={e => setInvite({ ...invite, role: e.target.value })} style={inputStyle}>
                        <option value="impact_participant">Impact Lab Participant</option>
                        <option value="coaching_client">Coaching Client</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                      <button type="submit" disabled={inviteLoading} className="btn btn-primary" style={{ fontSize: '0.85rem', width: '100%' }}>
                        {inviteLoading ? 'Sending...' : 'Send Invitation'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                {[
                  { value: 'all', label: 'All Users' },
                  { value: 'impact_participant', label: 'Impact Lab' },
                  { value: 'coaching_client', label: 'Coaching' },
                  { value: 'admin', label: 'Admins' },
                ].map(({ value, label }) => (
                  <button key={value} onClick={() => setUserFilter(value)} style={{ padding: '0.45rem 1rem', borderRadius: '2px', border: `1.5px solid ${userFilter === value ? 'var(--gold)' : 'rgba(0,23,55,0.15)'}`, background: userFilter === value ? 'rgba(200,136,32,0.08)' : 'white', color: userFilter === value ? 'var(--gold)' : 'var(--slate)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-montserrat), sans-serif' }}>
                    {label}
                  </button>
                ))}
              </div>

              <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['Name', 'Email', 'Role', 'Program', 'Joined', 'Actions'].map(h => <th key={h} style={thStyle}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map(user => (
                        <tr key={user.id} style={{ transition: 'background 0.1s' }}>
                          <td style={tdStyle}><span style={{ fontWeight: 600, color: 'var(--navy)' }}>{user.name}</span></td>
                          <td style={tdStyle}><span style={{ color: 'var(--slate)', fontSize: '0.82rem' }}>{user.email}</span></td>
                          <td style={tdStyle}>{roleBadge(user.role)}</td>
                          <td style={tdStyle}><span style={{ color: 'var(--slate)', fontSize: '0.82rem' }}>{user.program}</span></td>
                          <td style={tdStyle}><span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.65rem', color: 'var(--slate)' }}>{user.joined}</span></td>
                          <td style={tdStyle}>
                            <button style={{ background: 'none', border: '1px solid rgba(0,23,55,0.15)', color: 'var(--navy)', borderRadius: '2px', padding: '0.25rem 0.65rem', fontSize: '0.72rem', cursor: 'pointer' }}>View</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* PROGRAMS */}
          {page === 'programs' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Programs</span>
                  <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem' }}>All Programs</h1>
                </div>
                <button onClick={() => setShowProgramForm(!showProgramForm)} className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.65rem 1.25rem' }}>
                  {showProgramForm ? 'Cancel' : '+ New Program'}
                </button>
              </div>
              {showProgramForm && (
                <div style={{ ...cardStyle, borderTop: '3px solid var(--gold)', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1.25rem' }}>Create a Program</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={labelStyle}>Program Name</label>
                      <input value={newProgram.name} onChange={e => setNewProgram({ ...newProgram, name: e.target.value })} placeholder="e.g. Impact Leaders" style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Type</label>
                      <select value={newProgram.type} onChange={e => setNewProgram({ ...newProgram, type: e.target.value })} style={inputStyle}>
                        <option value="cohort">Cohort</option>
                        <option value="self_paced">Self-Paced</option>
                      </select>
                    </div>
                  </div>
                  <button onClick={() => {
                    if (newProgram.name.trim()) {
                      setPrograms([...programs, { id: String(programs.length + 1), name: newProgram.name, type: newProgram.type, cohorts: 0, participants: 0, status: 'active' }])
                      setNewProgram({ name: '', type: 'cohort' })
                      setShowProgramForm(false)
                    }
                  }} className="btn btn-primary" style={{ fontSize: '0.85rem', marginTop: '1rem' }}>Create Program</button>
                </div>
              )}
              {programs.map(p => (
                <div key={p.id} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.25rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>{p.name}</h3>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: 'var(--slate)', textTransform: 'uppercase' }}>{p.type}</span>
                      <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: 'var(--slate)' }}>{p.cohorts} cohorts</span>
                      <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: 'var(--slate)' }}>{p.participants} participants</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    {statusBadge(p.status)}
                    <button style={{ background: 'none', border: '1px solid rgba(0,23,55,0.15)', color: 'var(--navy)', borderRadius: '2px', padding: '0.3rem 0.75rem', fontSize: '0.75rem', cursor: 'pointer' }}>Manage</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* COHORTS */}
          {page === 'cohorts' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Cohorts</span>
                  <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem' }}>All Cohorts</h1>
                </div>
                <button onClick={() => setShowCohortForm(!showCohortForm)} className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.65rem 1.25rem' }}>
                  {showCohortForm ? 'Cancel' : '+ New Cohort'}
                </button>
              </div>
              {showCohortForm && (
                <div style={{ ...cardStyle, borderTop: '3px solid var(--gold)', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1.25rem' }}>Create a Cohort</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={labelStyle}>Cohort Name</label>
                      <input value={newCohort.name} onChange={e => setNewCohort({ ...newCohort, name: e.target.value })} placeholder="e.g. Impact Makers — Fall 2025" style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Program</label>
                      <select value={newCohort.program} onChange={e => setNewCohort({ ...newCohort, program: e.target.value })} style={inputStyle}>
                        {programs.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Start Date</label>
                      <input type="date" value={newCohort.start} onChange={e => setNewCohort({ ...newCohort, start: e.target.value })} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>End Date</label>
                      <input type="date" value={newCohort.end} onChange={e => setNewCohort({ ...newCohort, end: e.target.value })} style={inputStyle} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>Zoom Link</label>
                      <input value={newCohort.zoom_link} onChange={e => setNewCohort({ ...newCohort, zoom_link: e.target.value })} placeholder="https://zoom.us/j/..." style={inputStyle} />
                    </div>
                  </div>
                  <button onClick={() => {
                    if (newCohort.name.trim()) {
                      setCohorts([...cohorts, { id: String(cohorts.length + 1), name: newCohort.name, program: newCohort.program, start: newCohort.start, end: newCohort.end, participants: 0, status: 'upcoming' }])
                      setNewCohort({ name: '', program: 'Impact Makers', start: '', end: '', zoom_link: '' })
                      setShowCohortForm(false)
                    }
                  }} className="btn btn-primary" style={{ fontSize: '0.85rem', marginTop: '1rem' }}>Create Cohort</button>
                </div>
              )}
              {cohorts.map(c => (
                <div key={c.id} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.15rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '0.35rem' }}>{c.name}</h3>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: 'var(--slate)' }}>{c.program}</span>
                      <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: 'var(--slate)' }}>{c.start} to {c.end}</span>
                      <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: 'var(--slate)' }}>{c.participants} participants</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    {statusBadge(c.status)}
                    <button style={{ background: 'none', border: '1px solid rgba(0,23,55,0.15)', color: 'var(--navy)', borderRadius: '2px', padding: '0.3rem 0.75rem', fontSize: '0.75rem', cursor: 'pointer' }}>Manage</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ENROLLMENTS */}
          {page === 'enrollments' && (
            <div>
              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Enrollments</span>
              <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '1.5rem' }}>Manage Enrollments</h1>
              <div style={cardStyle}>
                <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1rem' }}>Enroll a Participant</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={labelStyle}>Participant</label>
                    <select style={inputStyle}>
                      {users.filter(u => u.role === 'impact_participant').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Cohort</label>
                    <select style={inputStyle}>
                      {cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
                <button className="btn btn-primary" style={{ fontSize: '0.85rem', marginTop: '1rem' }}>Enroll</button>
              </div>
              <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>{['Participant', 'Cohort', 'Program', 'Enrolled', 'Status'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {users.filter(u => u.role === 'impact_participant').map(u => (
                        <tr key={u.id}>
                          <td style={tdStyle}><span style={{ fontWeight: 600, color: 'var(--navy)' }}>{u.name}</span></td>
                          <td style={tdStyle}>Impact Makers — Spring 2025</td>
                          <td style={tdStyle}>Impact Makers</td>
                          <td style={tdStyle}><span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.65rem', color: 'var(--slate)' }}>{u.joined}</span></td>
                          <td style={tdStyle}>{statusBadge('active')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* WEEKLY REPS */}
          {page === 'reps' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Weekly Reps</span>
                  <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem' }}>Weekly Reps</h1>
                </div>
                <button onClick={() => setShowRepForm(!showRepForm)} className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.65rem 1.25rem' }}>
                  {showRepForm ? 'Cancel' : '+ New Rep'}
                </button>
              </div>
              {showRepForm && (
                <div style={{ ...cardStyle, borderTop: '3px solid var(--gold)', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1.25rem' }}>Create a Weekly Rep</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <label style={labelStyle}>Cohort</label>
                      <select value={newRep.cohort} onChange={e => setNewRep({ ...newRep, cohort: e.target.value })} style={inputStyle}>
                        {cohorts.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Week Number</label>
                      <input type="number" value={newRep.week} onChange={e => setNewRep({ ...newRep, week: e.target.value })} placeholder="e.g. 5" style={inputStyle} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>Rep Title</label>
                      <input value={newRep.title} onChange={e => setNewRep({ ...newRep, title: e.target.value })} placeholder="e.g. Ask for feedback" style={inputStyle} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>Instructions</label>
                      <textarea value={newRep.instructions} onChange={e => setNewRep({ ...newRep, instructions: e.target.value })} placeholder="What should participants do this week?" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>Why it matters</label>
                      <textarea value={newRep.why} onChange={e => setNewRep({ ...newRep, why: e.target.value })} placeholder="Why is this rep important?" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
                    </div>
                    <div>
                      <label style={labelStyle}>Due Date</label>
                      <input type="date" value={newRep.due} onChange={e => setNewRep({ ...newRep, due: e.target.value })} style={inputStyle} />
                    </div>
                  </div>
                  <button onClick={() => {
                    if (newRep.title.trim()) {
                      setReps([...reps, { id: String(reps.length + 1), cohort: newRep.cohort, week: parseInt(newRep.week), title: newRep.title, due: newRep.due, submissions: 0, total: 18 }])
                      setNewRep({ cohort: 'Impact Makers — Spring 2025', week: '', title: '', instructions: '', why: '', due: '' })
                      setShowRepForm(false)
                    }
                  }} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>Create Rep</button>
                </div>
              )}
              {reps.map(rep => (
                <div key={rep.id} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', color: 'var(--gold)', textTransform: 'uppercase' }}>Week {rep.week}</span>
                      <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', color: 'var(--slate)' }}>{rep.cohort}</span>
                      <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', color: 'var(--slate)' }}>Due {rep.due}</span>
                    </div>
                    <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em' }}>{rep.title}</h3>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.5rem', color: 'var(--navy)', letterSpacing: '0.04em' }}>{rep.submissions}/{rep.total}</div>
                    <div style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', color: 'var(--slate)', textTransform: 'uppercase' }}>Submitted</div>
                    <div style={{ height: '4px', background: 'var(--mist)', borderRadius: '2px', marginTop: '0.35rem', overflow: 'hidden', width: '80px' }}>
                      <div style={{ height: '100%', width: `${(rep.submissions / rep.total) * 100}%`, background: 'var(--gold)', borderRadius: '2px' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ANNOUNCEMENTS */}
          {page === 'announcements' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Announcements</span>
                  <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem' }}>Announcements</h1>
                </div>
                <button onClick={() => setShowAnnouncementForm(!showAnnouncementForm)} className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.65rem 1.25rem' }}>
                  {showAnnouncementForm ? 'Cancel' : '+ New Announcement'}
                </button>
              </div>
              {showAnnouncementForm && (
                <div style={{ ...cardStyle, borderTop: '3px solid var(--gold)', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1.25rem' }}>Post an Announcement</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                      <label style={labelStyle}>Send to</label>
                      <select value={newAnnouncement.cohort} onChange={e => setNewAnnouncement({ ...newAnnouncement, cohort: e.target.value })} style={inputStyle}>
                        <option value="all">All Participants</option>
                        {cohorts.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Title</label>
                      <input value={newAnnouncement.title} onChange={e => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })} placeholder="Announcement title" style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Message</label>
                      <textarea value={newAnnouncement.body} onChange={e => setNewAnnouncement({ ...newAnnouncement, body: e.target.value })} placeholder="Write your announcement here..." rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
                    </div>
                    <button onClick={() => {
                      if (newAnnouncement.title.trim()) {
                        setAnnouncements([{ id: String(announcements.length + 1), cohort: newAnnouncement.cohort === 'all' ? 'All' : newAnnouncement.cohort, title: newAnnouncement.title, date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), body: newAnnouncement.body }, ...announcements])
                        setNewAnnouncement({ cohort: 'all', title: '', body: '' })
                        setShowAnnouncementForm(false)
                      }
                    }} className="btn btn-primary" style={{ fontSize: '0.85rem', alignSelf: 'flex-start' }}>Post Announcement</button>
                  </div>
                </div>
              )}
              {announcements.map(ann => (
                <div key={ann.id} style={{ ...cardStyle, borderLeft: '4px solid var(--gold)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <div>
                      <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em' }}>{ann.title}</h3>
                      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                        <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', color: 'var(--gold)', textTransform: 'uppercase' }}>{ann.date}</span>
                        <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', color: 'var(--slate)' }}>{ann.cohort}</span>
                      </div>
                    </div>
                    <button onClick={() => setAnnouncements(announcements.filter(a => a.id !== ann.id))} style={{ background: 'none', border: 'none', color: 'rgba(255,59,48,0.5)', fontSize: '0.75rem', cursor: 'pointer' }}>Delete</button>
                  </div>
                  <p style={{ color: 'var(--slate)', fontSize: '0.88rem', lineHeight: 1.7 }}>{ann.body}</p>
                </div>
              ))}
            </div>
          )}

          {/* RESOURCES */}
          {page === 'resources' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Resources</span>
                  <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem' }}>Resource Library</h1>
                </div>
                <button onClick={() => setShowResourceForm(!showResourceForm)} className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.65rem 1.25rem' }}>
                  {showResourceForm ? 'Cancel' : '+ Add Resource'}
                </button>
              </div>
              {showResourceForm && (
                <div style={{ ...cardStyle, borderTop: '3px solid var(--gold)', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1.25rem' }}>Add a Resource</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>Title</label>
                      <input value={newResource.title} onChange={e => setNewResource({ ...newResource, title: e.target.value })} placeholder="Resource title" style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Type</label>
                      <select value={newResource.type} onChange={e => setNewResource({ ...newResource, type: e.target.value })} style={inputStyle}>
                        {['pdf', 'video', 'article', 'worksheet', 'template', 'book', 'recording'].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Portal</label>
                      <select value={newResource.portal_type} onChange={e => setNewResource({ ...newResource, portal_type: e.target.value })} style={inputStyle}>
                        <option value="impact">Impact Lab</option>
                        <option value="coaching">Coaching</option>
                        <option value="both">Both</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Program</label>
                      <select value={newResource.program} onChange={e => setNewResource({ ...newResource, program: e.target.value })} style={inputStyle}>
                        {programs.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Topic</label>
                      <input value={newResource.topic} onChange={e => setNewResource({ ...newResource, topic: e.target.value })} placeholder="e.g. Session recordings" style={inputStyle} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>URL or File Path</label>
                      <input value={newResource.url} onChange={e => setNewResource({ ...newResource, url: e.target.value })} placeholder="https://..." style={inputStyle} />
                    </div>
                  </div>
                  <button onClick={() => {
                    if (newResource.title.trim()) {
                      setResources([...resources, { id: String(resources.length + 1), ...newResource }])
                      setNewResource({ title: '', type: 'pdf', url: '', program: 'Impact Makers', topic: '', portal_type: 'impact' })
                      setShowResourceForm(false)
                    }
                  }} className="btn btn-primary" style={{ fontSize: '0.85rem', marginTop: '1rem' }}>Add Resource</button>
                </div>
              )}
              <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>{['Title', 'Type', 'Program', 'Portal', 'Actions'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {resources.map(r => (
                        <tr key={r.id}>
                          <td style={tdStyle}><span style={{ fontWeight: 600, color: 'var(--navy)' }}>{r.title}</span></td>
                          <td style={tdStyle}><span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.65rem', color: 'var(--slate)', textTransform: 'uppercase' }}>{r.type}</span></td>
                          <td style={tdStyle}>{r.program}</td>
                          <td style={tdStyle}><span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.65rem', color: 'var(--gold)', textTransform: 'uppercase' }}>{r.portal_type}</span></td>
                          <td style={tdStyle}>
                            <button onClick={() => setResources(resources.filter(res => res.id !== r.id))} style={{ background: 'none', border: 'none', color: 'rgba(255,59,48,0.6)', fontSize: '0.75rem', cursor: 'pointer' }}>Remove</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ATTENDANCE */}
          {page === 'attendance' && (
            <div>
              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Attendance</span>
              <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '0.5rem' }}>Session Attendance</h1>
              <p style={{ color: 'var(--slate)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Impact Makers — Spring 2025</p>
              {attendance.map(session => (
                <div key={session.session} style={cardStyle}>
                  <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1rem' }}>Session {session.session} — {session.date}</h3>
                  {session.attendees.map((a, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0', borderBottom: '1px solid var(--mist)' }}>
                      <span style={{ color: 'var(--ink)', fontSize: '0.88rem' }}>{a.name}</span>
                      <button onClick={() => {
                        setAttendance(attendance.map(s => s.session === session.session ? { ...s, attendees: s.attendees.map((att, idx) => idx === i ? { ...att, attended: !att.attended } : att) } : s))
                      }} style={{ padding: '0.25rem 0.75rem', borderRadius: '2px', border: 'none', background: a.attended ? 'rgba(200,136,32,0.1)' : 'var(--mist)', color: a.attended ? 'var(--gold)' : 'var(--slate)', fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
                        {a.attended ? 'Present' : 'Absent'}
                      </button>
                    </div>
                  ))}
                  <div style={{ marginTop: '0.75rem', fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: 'var(--slate)' }}>
                    {session.attendees.filter(a => a.attended).length} of {session.attendees.length} attended
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ASSESSMENTS */}
          {page === 'assessments' && (
            <div>
              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Assessments</span>
              <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '1.5rem' }}>Assessments</h1>
              <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>{['Participant', 'Assessment', 'Type', 'Completed', 'Status'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {[
                        { user: 'Jordan Williams', assessment: 'Pre-Program Self-Assessment', type: 'pre', date: 'March 28, 2025', status: 'completed' },
                        { user: 'Jordan Williams', assessment: 'Mid-Program Assessment', type: 'mid', date: 'Due July 8, 2025', status: 'pending' },
                        { user: 'Alicia Martinez', assessment: 'Pre-Program Self-Assessment', type: 'pre', date: 'March 28, 2025', status: 'completed' },
                        { user: 'Marcus Johnson', assessment: 'DiSC Assessment', type: 'disc', date: 'May 6, 2025', status: 'completed' },
                        { user: 'Marcus Johnson', assessment: 'Leadership Presence Assessment', type: 'self', date: 'May 20, 2025', status: 'completed' },
                      ].map((a, i) => (
                        <tr key={i}>
                          <td style={tdStyle}><span style={{ fontWeight: 600, color: 'var(--navy)' }}>{a.user}</span></td>
                          <td style={tdStyle}>{a.assessment}</td>
                          <td style={tdStyle}><span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: 'var(--slate)', textTransform: 'uppercase' }}>{a.type}</span></td>
                          <td style={tdStyle}><span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.65rem', color: 'var(--slate)' }}>{a.date}</span></td>
                          <td style={tdStyle}>{statusBadge(a.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* EVALUATIONS */}
          {page === 'evaluations' && (
            <div>
              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Evaluations</span>
              <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '1.5rem' }}>Evaluations</h1>
              <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>{['Participant', 'Cohort', 'Session', 'Type', 'Submitted', 'Rating'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {sampleEvaluations.map(e => (
                        <tr key={e.id}>
                          <td style={tdStyle}><span style={{ fontWeight: 600, color: 'var(--navy)' }}>{e.user}</span></td>
                          <td style={tdStyle}><span style={{ color: 'var(--slate)', fontSize: '0.82rem' }}>{e.cohort}</span></td>
                          <td style={tdStyle}>{e.session}</td>
                          <td style={tdStyle}><span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: 'var(--slate)', textTransform: 'uppercase' }}>{e.type}</span></td>
                          <td style={tdStyle}><span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.65rem', color: 'var(--slate)' }}>{e.submitted}</span></td>
                          <td style={tdStyle}><span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: 'var(--gold)', textTransform: 'uppercase' }}>{e.rating}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* CERTIFICATES */}
          {page === 'certificates' && (
            <div>
              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Certificates</span>
              <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '1.5rem' }}>Certificates</h1>
              <div style={cardStyle}>
                <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1rem' }}>Issue a Certificate</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={labelStyle}>Participant</label>
                    <select style={inputStyle}>
                      {users.filter(u => u.role === 'impact_participant').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Program</label>
                    <select style={inputStyle}>
                      {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                </div>
                <button className="btn btn-primary" style={{ fontSize: '0.85rem', marginTop: '1rem' }}>Issue Certificate</button>
              </div>
              <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>{['Participant', 'Program', 'Issued', 'Actions'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {[
                        { name: 'Alex Rivera', program: 'Impact Finders', issued: 'May 31, 2025' },
                        { name: 'Sam Chen', program: 'Impact Finders', issued: 'May 31, 2025' },
                        { name: 'Maya Johnson', program: 'Impact Makers', issued: 'November 15, 2024' },
                      ].map((c, i) => (
                        <tr key={i}>
                          <td style={tdStyle}><span style={{ fontWeight: 600, color: 'var(--navy)' }}>{c.name}</span></td>
                          <td style={tdStyle}>{c.program}</td>
                          <td style={tdStyle}><span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.65rem', color: 'var(--slate)' }}>{c.issued}</span></td>
                          <td style={tdStyle}><button style={{ background: 'none', border: '1px solid var(--gold)', color: 'var(--gold)', borderRadius: '2px', padding: '0.25rem 0.65rem', fontSize: '0.72rem', cursor: 'pointer' }}>Download</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* MESSAGES */}
          {page === 'messages' && (
            <div>
              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Messages</span>
              <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '1.5rem' }}>Message Threads</h1>
              {[
                { client: 'Marcus Johnson', coach: 'Tramaine L. Crawford', last: 'Keep a note of specific moments you notice a shift.', time: 'June 20, 4:02 PM', unread: 0 },
              ].map((thread, i) => (
                <div key={i} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', cursor: 'pointer' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.9rem' }}>{thread.client}</span>
                      <span style={{ color: 'rgba(0,23,55,0.3)', fontSize: '0.75rem' }}>with {thread.coach}</span>
                    </div>
                    <p style={{ color: 'var(--slate)', fontSize: '0.85rem', lineHeight: 1.5 }}>{thread.last}</p>
                  </div>
                  <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.62rem', color: 'var(--slate)' }}>{thread.time}</span>
                </div>
              ))}
            </div>
          )}

          {/* REPORTS */}
          {page === 'reports' && (
            <div>
              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Reports</span>
              <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '1.5rem' }}>Program Reports</h1>
              <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                {[
                  { label: 'Avg Attendance Rate', value: '87%', sub: 'Impact Makers Spring 2025' },
                  { label: 'Rep Completion Rate', value: '73%', sub: 'All cohorts' },
                  { label: 'Participant Satisfaction', value: '94%', sub: 'Based on evaluations' },
                ].map(({ label, value, sub }) => (
                  <div key={label} style={{ ...cardStyle, marginBottom: 0 }}>
                    <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.55rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '0.5rem' }}>{label}</span>
                    <div style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '2.5rem', color: 'var(--navy)', letterSpacing: '0.04em', lineHeight: 1, marginBottom: '0.25rem' }}>{value}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--slate)' }}>{sub}</div>
                  </div>
                ))}
              </div>
              <div style={cardStyle}>
                <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1rem' }}>Cohort Completion Rates</h3>
                {[
                  { name: 'Impact Makers — Spring 2025', completion: 60, participants: 18 },
                  { name: 'Impact Finders — Spring 2025', completion: 100, participants: 22 },
                  { name: 'Impact Makers — Fall 2024', completion: 100, participants: 16 },
                ].map(({ name, completion, participants }) => (
                  <div key={name} style={{ marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <span style={{ color: 'var(--navy)', fontWeight: 600, fontSize: '0.88rem' }}>{name}</span>
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: 'var(--slate)' }}>{participants} participants</span>
                        <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: 'var(--gold)' }}>{completion}%</span>
                      </div>
                    </div>
                    <div style={{ height: '8px', background: 'var(--mist)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${completion}%`, background: 'var(--gold)', borderRadius: '4px' }} />
                    </div>
                  </div>
                ))}
              </div>
              <div style={cardStyle}>
                <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1rem' }}>Weekly Rep Submissions</h3>
                {reps.map(rep => (
                  <div key={rep.id} style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <span style={{ color: 'var(--navy)', fontWeight: 500, fontSize: '0.85rem' }}>Week {rep.week} — {rep.title}</span>
                      <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: 'var(--gold)' }}>{rep.submissions}/{rep.total}</span>
                    </div>
                    <div style={{ height: '6px', background: 'var(--mist)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(rep.submissions / rep.total) * 100}%`, background: 'var(--gold)', borderRadius: '3px' }} />
                    </div>
                  </div>
                ))}
              </div>
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
          .stat-grid { grid-template-columns: 1fr 1fr !important; }
          .two-col-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 480px) {
          .stat-grid { grid-template-columns: 1fr !important; }
        }
        input:focus, textarea:focus, select:focus { border-color: var(--gold) !important; box-shadow: 0 0 0 3px rgba(200,136,32,0.1); }
        tr:hover td { background: rgba(0,23,55,0.02); }
      `}</style>
    </div>
  )
}