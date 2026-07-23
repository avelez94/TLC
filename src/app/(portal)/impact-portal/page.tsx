'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Page = 'dashboard' | 'programs' | 'cohort' | 'reps' | 'journal' | 'community' | 'announcements' | 'library' | 'assessments' | 'evaluations' | 'progress' | 'my-impact' | 'certificates' | 'profile'

const navItems: { id: Page; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '⊞' },
  { id: 'cohort', label: 'Current Cohort', icon: '📅' },
  { id: 'reps', label: 'Weekly Reps', icon: '⚡' },
  { id: 'journal', label: 'Reflection Journal', icon: '📓' },
  { id: 'community', label: 'Community', icon: '💬' },
  { id: 'announcements', label: 'Announcements', icon: '📢' },
  { id: 'library', label: 'Resource Library', icon: '📚' },
  { id: 'progress', label: 'My Progress', icon: '📈' },
  { id: 'certificates', label: 'Certificates', icon: '🏆' },
  { id: 'profile', label: 'Profile', icon: '👤' },
]

export default function ImpactPortal() {
  const router = useRouter()
  const [page, setPage] = useState<Page>('dashboard')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  // User data
  const [profile, setProfile] = useState<any>(null)
  const [enrollment, setEnrollment] = useState<any>(null)
  const [cohort, setCohort] = useState<any>(null)
  const [program, setProgram] = useState<any>(null)

  // Content data
  const [reps, setReps] = useState<any[]>([])
  const [submissions, setSubmissions] = useState<any[]>([])
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [resources, setResources] = useState<any[]>([])
  const [certificates, setCertificates] = useState<any[]>([])
  const [cohortSessions, setCohortSessions] = useState<any[]>([])
  const [journalEntries, setJournalEntries] = useState<any[]>([])
  const [journalPrompts, setJournalPrompts] = useState<any[]>([])
  const [communityPosts, setCommunityPosts] = useState<any[]>([])

  // UI state
  const [activeRep, setActiveRep] = useState<string | null>(null)
  const [repReflection, setRepReflection] = useState('')
  const [journalEntry, setJournalEntry] = useState('')
  const [newPost, setNewPost] = useState('')
  const [editingPostId, setEditingPostId] = useState<string | null>(null)
  const [editPostBody, setEditPostBody] = useState('')
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({})
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [actionLoading, setActionLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  const cardStyle = { background: 'white', borderRadius: '6px', border: '1px solid rgba(0,23,55,0.08)', padding: '1.5rem', marginBottom: '1.25rem' }
  const inputStyle = { width: '100%', padding: '0.75rem 1rem', border: '1.5px solid rgba(0,23,55,0.15)', borderRadius: '4px', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.9rem', color: 'var(--ink)', background: 'white', outline: 'none' }
  const labelStyle = { fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: 'var(--gold)', display: 'block', marginBottom: '0.5rem' }

  const navigate = (id: Page) => { setPage(id); setActiveRep(null); setMobileNavOpen(false) }

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

    const { data: enrollmentData } = await supabase
    .from('cohort_enrollments')
    .select('*, cohorts(*, programs(*))')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .in('cohorts.status', ['active', 'upcoming'])
    .order('enrolled_at', { ascending: false })
    .limit(1)
    .single()

    if (enrollmentData) {
      setEnrollment(enrollmentData)
      const c = enrollmentData.cohorts
      setCohort(c)
      setProgram(c?.programs)

      const [
        { data: repsData },
        { data: subsData },
        { data: announcementsData },
        { data: resourcesData },
        { data: certsData },
        { data: sessionsData },
        { data: journalData },
        { data: postsData },
        { data: journalPromptsData },
      ] = await Promise.all([
        supabase.from('weekly_reps').select('*').eq('cohort_id', c.id).order('week_number'),
        supabase.from('weekly_rep_submissions').select('*').eq('user_id', user.id),
        supabase.from('announcements').select('*').or(`cohort_id.eq.${c.id},cohort_id.is.null`).order('created_at', { ascending: false }),
        supabase.from('resources').select('*').or(`portal_type.eq.impact,portal_type.eq.both`).or(`program_id.eq.${c.programs.id},program_id.is.null`).order('created_at', { ascending: false }),
        supabase.from('certificates').select('*, programs(name)').eq('user_id', user.id),
        supabase.from('cohort_sessions').select('*').eq('cohort_id', c.id).order('session_number'),
        supabase.from('journal_entries').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('community_posts').select('*, profiles(full_name), community_likes(user_id), community_comments(*, profiles(full_name, role))').eq('cohort_id', c.id).order('created_at', { ascending: false }),
        supabase.from('journal_prompts').select('*').or(`program_id.eq.${c.programs.id},program_id.is.null`).order('sort_order'),
      ])

      if (repsData) setReps(repsData)
      if (subsData) setSubmissions(subsData)
      if (announcementsData) setAnnouncements(announcementsData)
      if (resourcesData) setResources(resourcesData)
      if (certsData) setCertificates(certsData)
      if (sessionsData) setCohortSessions(sessionsData)
      if (journalData) setJournalEntries(journalData)
      if (postsData) setCommunityPosts(postsData)
      if (journalPromptsData) setJournalPrompts(journalPromptsData)
    }

    setLoading(false)
  }, [router])

  useEffect(() => { fetchAll() }, [fetchAll])

  const isRepCompleted = (repId: string) => submissions.some(s => s.weekly_rep_id === repId)

  const currentCohortWeek = (() => {
    if (!cohort?.start_date) return 1
    const start = new Date(cohort.start_date + 'T00:00:00')
    const diffDays = Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24))
    return Math.max(1, Math.floor(diffDays / 7) + 1)
  })()

  const currentJournalPrompt = (() => {
    const fallback = 'What impact did I create this week, and how did I show up?'
    const inScope = (p: { program_id: string | null }) => p.program_id === (program?.id ?? null) || p.program_id === null
    const scoped = journalPrompts.filter(inScope)
    if (scoped.length === 0) return fallback

    const weekMatches = scoped.filter(p => p.week_number === currentCohortWeek)
    const exactMatch = weekMatches.find(p => p.program_id === program?.id) || weekMatches.find(p => p.program_id === null)
    if (exactMatch) return exactMatch.prompt

    const rotatingPool = scoped.filter(p => p.week_number == null)
    if (rotatingPool.length > 0) {
      return rotatingPool[(currentCohortWeek - 1) % rotatingPool.length].prompt
    }

    return fallback
  })()

  const handleSubmitRep = async () => {
    if (!repReflection.trim() || !activeRep || !profile) return
    setActionLoading(true)
    const { error } = await supabase.from('weekly_rep_submissions').insert({
      weekly_rep_id: activeRep,
      user_id: profile.id,
      reflection: repReflection,
    })
    if (!error) {
      showSuccess('Rep submitted!')
      setActiveRep(null)
      setRepReflection('')
      fetchAll()
    }
    setActionLoading(false)
  }

  const handleSaveJournal = async () => {
    if (!journalEntry.trim() || !profile) return
    setActionLoading(true)
    await supabase.from('journal_entries').insert({
      user_id: profile.id,
      body: journalEntry,
      prompt: currentJournalPrompt,
    })
    setJournalEntry('')
    showSuccess('Entry saved.')
    fetchAll()
    setActionLoading(false)
  }

  const handlePost = async () => {
    if (!newPost.trim() || !profile || !cohort) return
    setActionLoading(true)
    await supabase.from('community_posts').insert({
      user_id: profile.id,
      cohort_id: cohort.id,
      body: newPost,
    })
    setNewPost('')
    fetchAll()
    setActionLoading(false)
  }

  const handleLike = async (postId: string) => {
    if (!profile) return
    const post = communityPosts.find(p => p.id === postId)
    const liked = post?.community_likes?.some((l: any) => l.user_id === profile.id)
    if (liked) {
      await supabase.from('community_likes').delete().eq('post_id', postId).eq('user_id', profile.id)
    } else {
      await supabase.from('community_likes').insert({ post_id: postId, user_id: profile.id })
    }
    fetchAll()
  }

  const handleStartEditPost = (post: { id: string; body: string }) => {
    setEditingPostId(post.id)
    setEditPostBody(post.body)
  }

  const handleSaveEditPost = async (postId: string) => {
    if (!editPostBody.trim()) return
    setActionLoading(true)
    await supabase.from('community_posts').update({ body: editPostBody }).eq('id', postId)
    setEditingPostId(null)
    setEditPostBody('')
    fetchAll()
    setActionLoading(false)
  }

  const handleDeletePost = async (postId: string) => {
    await supabase.from('community_posts').delete().eq('id', postId)
    fetchAll()
  }

  const toggleComments = (postId: string) => {
    setExpandedComments(prev => ({ ...prev, [postId]: !prev[postId] }))
  }

  const handleAddComment = async (postId: string) => {
    const body = commentDrafts[postId]
    if (!body?.trim() || !profile) return
    setActionLoading(true)
    await supabase.from('community_comments').insert({
      post_id: postId,
      user_id: profile.id,
      body,
    })
    setCommentDrafts(prev => ({ ...prev, [postId]: '' }))
    fetchAll()
    setActionLoading(false)
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'there'
  const initials = profile?.full_name?.split(' ').map((n: string) => n[0]).join('') || '?'
  const completedReps = reps.filter(r => isRepCompleted(r.id)).length

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.5rem', color: 'var(--navy)', letterSpacing: '0.08em' }}>Loading your portal...</div>
    </div>
  )

  const Sidebar = () => (
    <div style={{ width: '240px', background: 'var(--navy3)', borderRight: '1px solid rgba(200,136,32,0.15)', display: 'flex', flexDirection: 'column', flexShrink: 0, height: 'calc(100vh - 64px)', position: 'sticky', top: '64px', overflowY: 'auto' }}>
      <div style={{ padding: '1.25rem', borderBottom: '1px solid rgba(200,136,32,0.12)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--navy)', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 }}>{initials}</div>
          <div>
            <div style={{ color: 'white', fontSize: '0.8rem', fontWeight: 600 }}>{profile?.full_name || 'Participant'}</div>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.6rem', fontFamily: 'var(--font-jetbrains), monospace', letterSpacing: '0.08em' }}>{program?.name || 'Impact Lab'}</div>
          </div>
        </div>
      </div>
      <nav style={{ flex: 1, padding: '0.75rem 0' }}>
        {navItems.map(({ id, label, icon }) => (
          <button key={id} onClick={() => navigate(id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.62rem 1.25rem', background: page === id ? 'rgba(200,136,32,0.12)' : 'transparent', border: 'none', borderLeft: `3px solid ${page === id ? 'var(--gold)' : 'transparent'}`, color: page === id ? 'var(--gold)' : 'rgba(255,255,255,0.5)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', fontFamily: 'var(--font-montserrat), sans-serif' }}>
            <span style={{ fontSize: '0.82rem' }}>{icon}</span>{label}
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
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200, background: 'var(--navy3)', borderBottom: '1px solid rgba(200,136,32,0.15)', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.25rem' }}>
        <Link href="/" style={{ display: 'block' }}>
          <Image src="/images/impact-lab-logo.png" alt="The Impact Lab" width={120} height={34} style={{ width: '120px', height: 'auto' }} />
        </Link>
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
              <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                {[
                  { label: 'Current Program', value: program?.name || 'Not enrolled', sub: cohort?.name || '' },
                  { label: 'Weekly Reps', value: `${completedReps} of ${reps.length}`, sub: 'Completed this cohort' },
                  { label: 'Announcements', value: String(announcements.length), sub: 'From Tramaine' },
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
                  {navItems.filter(n => ['cohort','reps','journal','announcements','library'].includes(n.id)).map(({ id, label, icon }) => (
                    <button key={id} onClick={() => setPage(id)} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', width: '100%', padding: '0.6rem 0', background: 'none', border: 'none', borderBottom: '1px solid var(--mist)', color: 'var(--navy)', fontSize: '0.85rem', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-montserrat), sans-serif' }}>
                      <span>{icon}</span>{label}
                    </button>
                  ))}
                </div>
                <div style={cardStyle}>
                  <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1rem' }}>This Week</h3>
                  {reps.filter(r => !isRepCompleted(r.id)).slice(0, 1).map(rep => (
                    <div key={rep.id} style={{ background: 'var(--navy)', borderRadius: '4px', padding: '1.25rem', marginBottom: '1rem' }}>
                      <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '0.4rem' }}>Week {rep.week_number} Rep</span>
                      <p style={{ color: 'white', fontSize: '0.92rem', fontWeight: 600, marginBottom: '0.25rem' }}>{rep.title}</p>
                      {rep.due_date && <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem' }}>Due {new Date(rep.due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</p>}
                    </div>
                  ))}
                  {reps.filter(r => !isRepCompleted(r.id)).length === 0 && <p style={{ color: 'var(--slate)', fontSize: '0.85rem' }}>All caught up on reps.</p>}
                  <button onClick={() => navigate('reps')} className="btn btn-ghost-dark" style={{ fontSize: '0.8rem', padding: '0.65rem 1.25rem' }}>View All Reps</button>
                </div>
              </div>
            </div>
          )}

          {/* CURRENT COHORT */}
          {page === 'cohort' && (
            <div>
              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Current Cohort</span>
              <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '1.5rem' }}>{cohort?.name || 'Your Cohort'}</h1>
              {cohort && (
                <div style={cardStyle}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                    {cohort.start_date && <div><span style={labelStyle}>Start Date</span><p style={{ color: 'var(--ink)', fontSize: '0.88rem' }}>{new Date(cohort.start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p></div>}
                    {cohort.end_date && <div><span style={labelStyle}>End Date</span><p style={{ color: 'var(--ink)', fontSize: '0.88rem' }}>{new Date(cohort.end_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p></div>}
                    {cohort.session_day && cohort.session_time && <div><span style={labelStyle}>Sessions</span><p style={{ color: 'var(--ink)', fontSize: '0.88rem' }}>{cohort.session_day}s at {(() => { const [h, m] = cohort.session_time.split(':').map(Number); const ampm = h >= 12 ? 'PM' : 'AM'; return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${ampm} ET` })()}</p></div>}
                    {cohort.zoom_link && <div><span style={labelStyle}>Zoom Link</span><a href={cohort.zoom_link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold)', fontSize: '0.88rem' }}>Join Session</a></div>}
                  </div>
                  <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1rem' }}>Session Schedule</h3>
                  {cohortSessions.length === 0 ? (
                    <p style={{ color: 'var(--slate)', fontSize: '0.85rem' }}>Schedule will be posted soon.</p>
                  ) : cohortSessions.map(s => (
                    <div key={s.id} style={{ display: 'flex', gap: '1rem', padding: '0.75rem 0', borderBottom: '1px solid var(--mist)', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.1em', minWidth: '80px' }}>
                        {s.session_date ? new Date(s.session_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : `Session ${s.session_number}`}
                      </span>
                      <span style={{ color: 'var(--ink)', fontSize: '0.88rem', fontWeight: 500 }}>{s.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* WEEKLY REPS */}
          {page === 'reps' && !activeRep && (
            <div>
              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Weekly Reps</span>
              <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '0.5rem' }}>Your Reps</h1>
              <p style={{ color: 'var(--slate)', fontSize: '0.9rem', lineHeight: 1.7, marginBottom: '2rem' }}>Weekly reps are the bridge between sessions and real life. Do the rep. Reflect on what happened. Bring it back to the group.</p>
              {reps.length === 0 && <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem' }}><p style={{ color: 'var(--slate)' }}>No reps posted yet. Check back soon.</p></div>}
              {reps.map(rep => {
                const completed = isRepCompleted(rep.id)
                return (
                  <div key={rep.id} style={{ ...cardStyle, borderLeft: `4px solid ${completed ? 'var(--gold)' : 'var(--mist)'}`, cursor: 'pointer' }} onClick={() => { setActiveRep(rep.id); const sub = submissions.find(s => s.weekly_rep_id === rep.id); setRepReflection(sub?.reflection || '') }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--gold)' }}>Week {rep.week_number}</span>
                          {rep.due_date && <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', color: 'var(--slate)' }}>Due {new Date(rep.due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</span>}
                        </div>
                        <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.15rem', color: 'var(--navy)', letterSpacing: '0.04em' }}>{rep.title}</h3>
                      </div>
                      <span style={{ padding: '0.25rem 0.75rem', borderRadius: '2px', fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase', background: completed ? 'rgba(200,136,32,0.1)' : 'var(--mist)', color: completed ? 'var(--gold)' : 'var(--slate)' }}>
                        {completed ? 'Completed' : 'Pending'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* REP DETAIL */}
          {page === 'reps' && activeRep && (() => {
            const rep = reps.find(r => r.id === activeRep)
            if (!rep) return null
            const completed = isRepCompleted(rep.id)
            const sub = submissions.find(s => s.weekly_rep_id === rep.id)
            return (
              <div>
                <button onClick={() => setActiveRep(null)} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: '0.85rem', cursor: 'pointer', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600 }}>&#8592; Back to reps</button>
                <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Week {rep.week_number}</span>
                <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '1.5rem' }}>{rep.title}</h1>
                {rep.instructions && <div style={cardStyle}><span style={labelStyle}>The Rep</span><p style={{ color: 'var(--ink)', fontSize: '0.95rem', lineHeight: 1.75 }}>{rep.instructions}</p></div>}
                {rep.why_it_matters && <div style={{ ...cardStyle, background: 'var(--navy)' }}><span style={{ ...labelStyle, color: 'var(--gold)' }}>Why it matters</span><p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.92rem', lineHeight: 1.75 }}>{rep.why_it_matters}</p></div>}
                <div style={cardStyle}>
                  <span style={labelStyle}>Reflection — What happened when you did this rep?</span>
                  <textarea value={repReflection} onChange={e => setRepReflection(e.target.value)} placeholder="Write your reflection here..." rows={5} style={{ ...inputStyle, resize: 'vertical' }} disabled={completed} />
                  {!completed && <button onClick={handleSubmitRep} disabled={actionLoading} className="btn btn-primary" style={{ marginTop: '1rem', fontSize: '0.85rem' }}>{actionLoading ? 'Submitting...' : 'Submit Rep'}</button>}
                  {completed && <p style={{ color: 'var(--gold)', fontSize: '0.82rem', marginTop: '0.75rem', fontFamily: 'var(--font-jetbrains), monospace', letterSpacing: '0.1em' }}>Submitted on {new Date(sub?.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</p>}
                </div>
              </div>
            )
          })()}

          {/* JOURNAL */}
          {page === 'journal' && (
            <div>
              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Reflection Journal</span>
              <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '1.5rem' }}>Your Journal</h1>
              <div style={cardStyle}>
                <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>New Entry</h3>
                <p style={{ color: 'var(--slate)', fontSize: '0.82rem', marginBottom: '1rem' }}>This week's prompt: <em>{currentJournalPrompt}</em></p>
                <textarea value={journalEntry} onChange={e => setJournalEntry(e.target.value)} placeholder="Write your reflection here..." rows={5} style={{ ...inputStyle, resize: 'vertical' }} />
                <button onClick={handleSaveJournal} disabled={actionLoading} className="btn btn-primary" style={{ marginTop: '1rem', fontSize: '0.8rem', padding: '0.65rem 1.5rem' }}>{actionLoading ? 'Saving...' : 'Save Entry'}</button>
              </div>
              {journalEntries.length === 0 && <p style={{ color: 'var(--slate)', fontSize: '0.88rem', textAlign: 'center', padding: '2rem' }}>No journal entries yet. Write your first one above.</p>}
              {journalEntries.map(entry => (
                <div key={entry.id} style={{ ...cardStyle, borderLeft: '3px solid var(--gold)' }}>
                  <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.1em', color: 'var(--gold)', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>
                    {new Date(entry.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                  {entry.prompt && <p style={{ color: 'var(--slate)', fontSize: '0.8rem', fontStyle: 'italic', marginBottom: '0.5rem' }}>{entry.prompt}</p>}
                  <p style={{ color: 'var(--ink)', fontSize: '0.88rem', lineHeight: 1.7 }}>{entry.body}</p>
                </div>
              ))}
            </div>
          )}

          {/* COMMUNITY */}
          {page === 'community' && (
            <div>
              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Community</span>
              <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '0.5rem' }}>Cohort Community</h1>
              <p style={{ color: 'var(--slate)', fontSize: '0.9rem', lineHeight: 1.7, marginBottom: '1.5rem' }}>Share wins, ask questions, and encourage one another. This is your cohort space.</p>
              <div style={cardStyle}>
                <textarea value={newPost} onChange={e => setNewPost(e.target.value)} placeholder="Share a win, ask a question, or encourage someone..." rows={3} style={{ ...inputStyle, resize: 'none' }} />
                <button onClick={handlePost} disabled={actionLoading} className="btn btn-primary" style={{ marginTop: '0.75rem', fontSize: '0.8rem', padding: '0.65rem 1.25rem' }}>Post</button>
              </div>
              {communityPosts.length === 0 && <p style={{ color: 'var(--slate)', fontSize: '0.88rem', textAlign: 'center', padding: '2rem' }}>No posts yet. Be the first to share something.</p>}
              {communityPosts.map(post => {
                const liked = post.community_likes?.some((l: any) => l.user_id === profile?.id)
                const isOwnPost = post.user_id === profile?.id
                const isEditing = editingPostId === post.id
                const comments = (post.community_comments || []).slice().sort((a: { created_at: string }, b: { created_at: string }) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                const commentsOpen = !!expandedComments[post.id]
                return (
                  <div key={post.id} style={cardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--navy)', fontWeight: 700, fontSize: '0.75rem', flexShrink: 0 }}>
                          {post.profiles?.full_name?.split(' ').map((n: string) => n[0]).join('') || '?'}
                        </div>
                        <div>
                          <span style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.85rem' }}>{post.profiles?.full_name || 'Participant'}</span>
                          <span style={{ display: 'block', fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', color: 'var(--slate)', letterSpacing: '0.08em' }}>
                            {new Date(post.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                          </span>
                        </div>
                      </div>
                      {isOwnPost && !isEditing && (
                        <div style={{ display: 'flex', gap: '0.75rem', flexShrink: 0 }}>
                          <button onClick={() => handleStartEditPost(post)} style={{ background: 'none', border: 'none', color: 'var(--slate)', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'var(--font-montserrat), sans-serif' }}>✎ Edit</button>
                          <button onClick={() => handleDeletePost(post.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,59,48,0.5)', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'var(--font-montserrat), sans-serif' }}>Delete</button>
                        </div>
                      )}
                    </div>

                    {isEditing ? (
                      <div style={{ marginBottom: '0.75rem' }}>
                        <textarea value={editPostBody} onChange={e => setEditPostBody(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                          <button onClick={() => handleSaveEditPost(post.id)} disabled={actionLoading} className="btn btn-primary" style={{ fontSize: '0.78rem', padding: '0.45rem 1rem' }}>{actionLoading ? 'Saving...' : 'Save'}</button>
                          <button onClick={() => { setEditingPostId(null); setEditPostBody('') }} style={{ background: 'none', border: '1.5px solid rgba(0,23,55,0.15)', borderRadius: '4px', padding: '0.45rem 1rem', color: 'var(--slate)', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'var(--font-montserrat), sans-serif' }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <p style={{ color: 'var(--ink)', fontSize: '0.88rem', lineHeight: 1.7, marginBottom: '0.75rem' }}>{post.body}</p>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                      <button onClick={() => handleLike(post.id)} style={{ background: 'none', border: 'none', color: liked ? 'var(--gold)' : 'var(--slate)', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', fontFamily: 'var(--font-montserrat), sans-serif' }}>
                        {liked ? '♥' : '♡'} {post.community_likes?.length || 0}
                      </button>
                      <button onClick={() => toggleComments(post.id)} style={{ background: 'none', border: 'none', color: 'var(--slate)', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'var(--font-montserrat), sans-serif' }}>
                        {comments.length} comment{comments.length === 1 ? '' : 's'} {commentsOpen ? '▲' : '▼'}
                      </button>
                    </div>

                    {commentsOpen && (
                      <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--mist)' }}>
                        {comments.length === 0 && <p style={{ color: 'var(--slate)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>No comments yet.</p>}
                        {comments.map((c: { id: string; body: string; created_at: string; profiles?: { full_name: string | null; role?: string } }) => (
                          <div key={c.id} style={{ marginBottom: '0.6rem' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline' }}>
                              <span style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.78rem' }}>{c.profiles?.full_name || (c.profiles?.role === 'admin' ? 'Tramaine' : 'Participant')}</span>
                              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.55rem', color: 'var(--slate)' }}>{new Date(c.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</span>
                            </div>
                            <p style={{ color: 'var(--ink)', fontSize: '0.82rem', lineHeight: 1.6 }}>{c.body}</p>
                          </div>
                        ))}
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                          <input
                            value={commentDrafts[post.id] || ''}
                            onChange={e => setCommentDrafts(prev => ({ ...prev, [post.id]: e.target.value }))}
                            placeholder="Add a comment..."
                            style={{ ...inputStyle, flex: 1 }}
                          />
                          <button onClick={() => handleAddComment(post.id)} disabled={actionLoading} className="btn btn-primary" style={{ fontSize: '0.78rem', padding: '0.5rem 1rem' }}>Send</button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
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
                  <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                      {new Date(ann.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>{ann.title}</h3>
                  <p style={{ color: 'var(--slate)', fontSize: '0.88rem', lineHeight: 1.7 }}>{ann.body}</p>
                </div>
              ))}
            </div>
          )}

          {/* RESOURCE LIBRARY */}
          {page === 'library' && (
            <div>
              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Resource Library</span>
              <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '1.5rem' }}>Library</h1>
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

          {/* PROGRESS */}
          {page === 'progress' && (
            <div>
              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>My Progress</span>
              <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '1.5rem' }}>Your Progress</h1>
              <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                {[
                  { label: 'Weekly Reps Done', value: completedReps, total: reps.length, icon: '⚡' },
                  { label: 'Journal Entries', value: journalEntries.length, total: Math.max(journalEntries.length, 8), icon: '📓' },
                ].map(({ label, value, total, icon }) => (
                  <div key={label} style={cardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                      <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--gold)' }}>{label}</span>
                      <span style={{ fontSize: '1.25rem' }}>{icon}</span>
                    </div>
                    <div style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '2.5rem', color: 'var(--navy)', letterSpacing: '0.04em', lineHeight: 1, marginBottom: '0.5rem' }}>{value}/{total}</div>
                    <div style={{ height: '6px', background: 'var(--mist)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${total > 0 ? (value / total) * 100 : 0}%`, background: 'var(--gold)', borderRadius: '3px' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CERTIFICATES */}
          {page === 'certificates' && (
            <div>
              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Certificates</span>
              <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '1.5rem' }}>Your Certificates</h1>
              {certificates.length === 0 ? (
                <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem' }}>
                  <p style={{ color: 'var(--slate)', fontSize: '0.88rem' }}>No certificates yet. Complete your program to earn one.</p>
                </div>
              ) : certificates.map(cert => (
                <div key={cert.id} style={{ ...cardStyle, borderLeft: '4px solid var(--gold)' }}>
                  <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.25rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>{cert.programs?.name}</h3>
                  <p style={{ color: 'var(--slate)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Certificate of Completion</p>
                  <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Issued {new Date(cert.issued_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              ))}
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
                    <span style={{ color: 'var(--slate)', fontSize: '0.82rem' }}>{program?.name} Participant</span>
                  </div>
                </div>
                {[
                  { label: 'Full Name', value: profile?.full_name },
                  { label: 'Email', value: profile?.email },
                  { label: 'Current Program', value: program?.name },
                  { label: 'Cohort', value: cohort?.name },
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
          .stat-grid { grid-template-columns: 1fr !important; }
          .two-col-grid { grid-template-columns: 1fr !important; }
        }
        input:focus, textarea:focus, select:focus { border-color: var(--gold) !important; box-shadow: 0 0 0 3px rgba(200,136,32,0.1); }
      `}</style>
    </div>
  )
}