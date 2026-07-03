'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Page = 'dashboard' | 'sessions' | 'announcements' | 'resources' | 'messages' | 'checkin' | 'profile'

const navItems: { id: Page; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '⊞' },
  { id: 'sessions', label: 'My Sessions', icon: '📅' },
  { id: 'announcements', label: 'Announcements', icon: '📢' },
  { id: 'resources', label: 'Resources', icon: '📚' },
  { id: 'messages', label: 'Messages', icon: '💬' },
  { id: 'checkin', label: 'Weekly Check-In', icon: '📋' },
  { id: 'profile', label: 'Profile', icon: '👤' },
]

export default function CoachingPortal() {
  const router = useRouter()
  const [page, setPage] = useState<Page>('dashboard')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const [profile, setProfile] = useState<any>(null)
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [resources, setResources] = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])
  const [tramaine, setTramaine] = useState<any>(null)

  const [activeMessage, setActiveMessage] = useState('')
  const [checkInSubmitted, setCheckInSubmitted] = useState(false)
  const [checkIn, setCheckIn] = useState({ went_well: '', challenging: '', progress: '', focus_today: '', anything_changed: '' })
  const [actionLoading, setActionLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  const cardStyle = { background: 'white', borderRadius: '6px', border: '1px solid rgba(0,23,55,0.08)', padding: '1.5rem', marginBottom: '1.25rem' }
  const inputStyle = { width: '100%', padding: '0.75rem 1rem', border: '1.5px solid rgba(0,23,55,0.15)', borderRadius: '4px', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.9rem', color: 'var(--ink)', background: 'white', outline: 'none' }
  const labelStyle = { fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: 'var(--gold)', display: 'block', marginBottom: '0.5rem' }

  const navigate = (id: Page) => { setPage(id); setMobileNavOpen(false) }

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 4000)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const fetchAll = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (profileData) setProfile(profileData)

    // Get admin user (Tramaine) for messaging
    const { data: adminData } = await supabase.from('profiles').select('*').eq('role', 'admin').single()
    if (adminData) setTramaine(adminData)

    const [
      { data: announcementsData },
      { data: resourcesData },
      { data: messagesData },
    ] = await Promise.all([
      supabase.from('announcements').select('*').or('target_role.eq.coaching_client,cohort_id.is.null').order('created_at', { ascending: false }),
      supabase.from('resources').select('*').or('portal_type.eq.coaching,portal_type.eq.both').order('created_at', { ascending: false }),
      adminData
        ? supabase.from('messages').select('*, profiles!messages_sender_id_fkey(full_name)').or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`).order('created_at')
        : Promise.resolve({ data: [] }),
    ])

    if (announcementsData) setAnnouncements(announcementsData)
    if (resourcesData) setResources(resourcesData)
    if (messagesData) setMessages(messagesData)

    setLoading(false)
  }, [router])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleSendMessage = async () => {
    if (!activeMessage.trim() || !profile || !tramaine) return
    setActionLoading(true)
    await supabase.from('messages').insert({
      sender_id: profile.id,
      recipient_id: tramaine.id,
      body: activeMessage,
    })
    setActiveMessage('')
    fetchAll()
    setActionLoading(false)
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'there'
  const initials = profile?.full_name?.split(' ').map((n: string) => n[0]).join('') || '?'

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.5rem', color: 'var(--navy)', letterSpacing: '0.08em' }}>Loading your portal...</div>
    </div>
  )

  const Sidebar = () => (
    <div style={{ width: '240px', background: 'var(--navy)', borderRight: '1px solid rgba(200,136,32,0.15)', display: 'flex', flexDirection: 'column', flexShrink: 0, height: 'calc(100vh - 64px)', position: 'sticky', top: '64px', overflowY: 'auto' }}>
      <div style={{ padding: '1.25rem', borderBottom: '1px solid rgba(200,136,32,0.12)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--navy)', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 }}>{initials}</div>
          <div>
            <div style={{ color: 'white', fontSize: '0.8rem', fontWeight: 600 }}>{profile?.full_name || 'Client'}</div>
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
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200, background: 'var(--navy)', borderBottom: '1px solid rgba(200,136,32,0.15)', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link href="/" style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.25rem', color: 'var(--gold)', letterSpacing: '0.08em', textDecoration: 'none' }}>TLC</Link>
          <span style={{ color: 'rgba(255,255,255,0.2)' }}>/</span>
          <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.55rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>Coaching Portal</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--navy)', fontWeight: 700, fontSize: '0.8rem' }}>{initials}</div>
          <button className="mobile-hamburger" onClick={() => setMobileNavOpen(!mobileNavOpen)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: 'white', display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <span style={{ display: 'block', width: '22px', height: '2px', background: 'currentColor', borderRadius: '1px', transition: 'transform 0.2s', transform: mobileNavOpen ? 'translateY(7px) rotate(45deg)' : 'none' }} />
            <span style={{ display: 'block', width: '22px', height: '2px', background: 'currentColor', borderRadius: '1px', opacity: mobileNavOpen ? 0 : 1, transition: 'opacity 0.2s' }} />
            <span style={{ display: 'block', width: '22px', height: '2px', background: 'currentColor', borderRadius: '1px', transition: 'transform 0.2s', transform: mobileNavOpen ? 'translateY(-7px) rotate(-45deg)' : 'none' }} />
          </button>
        </div>
      </div>

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

          {successMsg && (
            <div style={{ background: 'rgba(200,136,32,0.1)', border: '1px solid rgba(200,136,32,0.3)', borderRadius: '4px', padding: '0.85rem 1rem', marginBottom: '1.25rem', color: 'var(--gold)', fontSize: '0.85rem' }}>
              {successMsg}
            </div>
          )}

          {/* DASHBOARD */}
          {page === 'dashboard' && (
            <div>
              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Dashboard</span>
              <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '1.5rem' }}>Welcome back, {firstName}.</h1>
              <div className="two-col-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={cardStyle}>
                  <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1rem' }}>Quick Links</h3>
                  {navItems.filter(n => n.id !== 'dashboard').map(({ id, label, icon }) => (
                    <button key={id} onClick={() => setPage(id)} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', width: '100%', padding: '0.6rem 0', background: 'none', border: 'none', borderBottom: '1px solid var(--mist)', color: 'var(--navy)', fontSize: '0.85rem', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-montserrat), sans-serif' }}>
                      <span>{icon}</span>{label}
                    </button>
                  ))}
                </div>
                <div style={cardStyle}>
                  <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1rem' }}>Recent Announcements</h3>
                  {announcements.slice(0, 3).length === 0 && <p style={{ color: 'var(--slate)', fontSize: '0.85rem' }}>No announcements yet.</p>}
                  {announcements.slice(0, 3).map(ann => (
                    <div key={ann.id} style={{ padding: '0.6rem 0', borderBottom: '1px solid var(--mist)' }}>
                      <p style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.85rem', marginBottom: '0.15rem' }}>{ann.title}</p>
                      <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', color: 'var(--slate)' }}>
                        {new Date(ann.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                      </span>
                    </div>
                  ))}
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
                <p style={{ color: 'var(--slate)', fontSize: '0.88rem', lineHeight: 1.7 }}>Your session schedule and recordings will appear here. Reach out to Tramaine via the Messages section to schedule or reschedule sessions.</p>
                <button onClick={() => setPage('messages')} className="btn btn-primary" style={{ fontSize: '0.85rem', marginTop: '1rem' }}>Message Tramaine</button>
              </div>
            </div>
          )}

          {/* ANNOUNCEMENTS */}
          {page === 'announcements' && (
            <div>
              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Announcements</span>
              <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '1.5rem' }}>Announcements</h1>
              {announcements.length === 0 && <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem' }}><p style={{ color: 'var(--slate)' }}>No announcements yet.</p></div>}
              {announcements.map(ann => (
                <div key={ann.id} style={{ ...cardStyle, borderLeft: '4px solid var(--gold)' }}>
                  <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>
                    {new Date(ann.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                  <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>{ann.title}</h3>
                  <p style={{ color: 'var(--slate)', fontSize: '0.88rem', lineHeight: 1.7 }}>{ann.body}</p>
                </div>
              ))}
            </div>
          )}

          {/* RESOURCES */}
          {page === 'resources' && (
            <div>
              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Resources</span>
              <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '1.5rem' }}>Resource Library</h1>
              {resources.length === 0 && <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem' }}><p style={{ color: 'var(--slate)' }}>No resources added yet. Check back soon.</p></div>}
              {Object.entries(
                resources.reduce((acc: any, r: any) => {
                  const key = r.topic || r.type || 'General'
                  if (!acc[key]) acc[key] = []
                  acc[key].push(r)
                  return acc
                }, {})
              ).map(([category, items]: [string, any]) => (
                <div key={category} style={cardStyle}>
                  <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '0.75rem', textTransform: 'capitalize' }}>{category}</h3>
                  {items.map((r: any) => (
                    <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0', borderBottom: '1px solid var(--mist)', gap: '1rem', flexWrap: 'wrap' }}>
                      <div>
                        <span style={{ color: 'var(--ink)', fontSize: '0.88rem', fontWeight: 500 }}>{r.title}</span>
                        {r.description && <span style={{ display: 'block', color: 'var(--slate)', fontSize: '0.78rem' }}>{r.description}</span>}
                      </div>
                      {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ background: 'none', border: '1px solid var(--gold)', color: 'var(--gold)', borderRadius: '2px', padding: '0.3rem 0.75rem', fontSize: '0.72rem', textDecoration: 'none', flexShrink: 0 }}>View</a>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* MESSAGES */}
          {page === 'messages' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Messages</span>
              <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '1rem' }}>Messages with Tramaine</h1>
              <div style={{ flex: 1, background: 'white', border: '1px solid rgba(0,23,55,0.08)', borderRadius: '6px', padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
                {messages.length === 0 && <p style={{ color: 'var(--slate)', fontSize: '0.85rem', textAlign: 'center', margin: 'auto' }}>No messages yet. Send Tramaine a message below.</p>}
                {messages.map(msg => {
                  const isMe = msg.sender_id === profile?.id
                  return (
                    <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                      <div style={{ maxWidth: '75%', background: isMe ? 'var(--navy)' : 'var(--paper)', color: isMe ? 'white' : 'var(--ink)', borderRadius: '8px', padding: '0.85rem 1rem', fontSize: '0.88rem', lineHeight: 1.6 }}>
                        <p style={{ margin: 0 }}>{msg.body}</p>
                        <span style={{ fontSize: '0.65rem', color: isMe ? 'rgba(255,255,255,0.4)' : 'var(--slate)', display: 'block', marginTop: '0.35rem' }}>
                          {new Date(msg.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <input value={activeMessage} onChange={e => setActiveMessage(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage() } }} placeholder="Type a message..." style={{ ...inputStyle, flex: 1 }} />
                <button onClick={handleSendMessage} disabled={actionLoading} className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.65rem 1.25rem', whiteSpace: 'nowrap' }}>Send</button>
              </div>
            </div>
          )}

          {/* WEEKLY CHECK-IN */}
          {page === 'checkin' && (
            <div>
              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Weekly Check-In</span>
              <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '0.5rem' }}>Pre-Session Check-In</h1>
              <p style={{ color: 'var(--slate)', fontSize: '0.9rem', lineHeight: 1.7, marginBottom: '2rem' }}>Complete this before your next session so Tramaine can prepare.</p>
              {checkInSubmitted ? (
                <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>✓</div>
                  <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.5rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>Check-in submitted.</h3>
                  <p style={{ color: 'var(--slate)', fontSize: '0.88rem' }}>Tramaine will review your responses before your session.</p>
                </div>
              ) : (
                <form onSubmit={async e => {
                  e.preventDefault()
                  if (!profile) return
                  setActionLoading(true)
                  await supabase.from('weekly_checkins').insert({
                    user_id: profile.id,
                    went_well: checkIn.went_well,
                    challenging: checkIn.challenging,
                    progress: checkIn.progress,
                    focus_today: checkIn.focus_today,
                    anything_changed: checkIn.anything_changed,
                  })
                  setCheckInSubmitted(true)
                  setActionLoading(false)
                }} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
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
                  <button type="submit" disabled={actionLoading} className="btn btn-primary" style={{ alignSelf: 'flex-start', fontSize: '0.85rem' }}>{actionLoading ? 'Submitting...' : 'Submit Check-In'}</button>
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
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--navy)', fontWeight: 700, fontSize: '1.25rem' }}>{initials}</div>
                  <div>
                    <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.25rem', color: 'var(--navy)', letterSpacing: '0.04em' }}>{profile?.full_name}</h3>
                    <span style={{ color: 'var(--slate)', fontSize: '0.82rem' }}>Coaching Client</span>
                  </div>
                </div>
                {[
                  { label: 'Full Name', value: profile?.full_name },
                  { label: 'Email', value: profile?.email },
                  { label: 'Phone', value: profile?.phone },
                  { label: 'Organization', value: profile?.organization },
                ].map(({ label, value }) => value ? (
                  <div key={label} style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--mist)', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--gold)' }}>{label}</span>
                    <span style={{ color: 'var(--ink)', fontSize: '0.88rem', fontWeight: 500 }}>{value}</span>
                  </div>
                ) : null)}
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
          .two-col-grid { grid-template-columns: 1fr !important; }
        }
        input:focus, textarea:focus, select:focus { border-color: var(--gold) !important; box-shadow: 0 0 0 3px rgba(200,136,32,0.1); }
      `}</style>
    </div>
  )
}