'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import type { Profile, Program, Cohort, WeeklyRep, Announcement, Resource, Certificate, CohortEnrollment, JournalPrompt } from '@/types'

type Page = 'dashboard' | 'registrations' | 'calendar' | 'users' | 'programs' | 'cohorts' | 'reps' | 'prompts' | 'community' | 'announcements' | 'resources' | 'attendance' | 'certificates' | 'reports'

const navItems: { id: Page; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '⊞' },
  { id: 'registrations', label: 'Registrations', icon: '📥' },
  { id: 'calendar', label: 'Calendar', icon: '📆' },
  { id: 'users', label: 'Users', icon: '👥' },
  { id: 'programs', label: 'Programs', icon: '🎯' },
  { id: 'cohorts', label: 'Cohorts', icon: '📅' },
  { id: 'reps', label: 'Weekly Reps', icon: '⚡' },
  { id: 'prompts', label: 'Journal Prompts', icon: '📝' },
  { id: 'community', label: 'Community', icon: '💬' },
  { id: 'announcements', label: 'Announcements', icon: '📢' },
  { id: 'resources', label: 'Resources', icon: '📚' },
  { id: 'attendance', label: 'Attendance', icon: '✅' },
  { id: 'certificates', label: 'Certificates', icon: '🏆' },
  { id: 'reports', label: 'Reports', icon: '📈' },
]

export default function Admin() {
  const router = useRouter()
  const [page, setPage] = useState<Page>('dashboard')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  // Data state
  const [users, setUsers] = useState<Profile[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [reps, setReps] = useState<WeeklyRep[]>([])
  const [journalPrompts, setJournalPrompts] = useState<JournalPrompt[]>([])
  const [communityPosts, setCommunityPosts] = useState<any[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [enrollments, setEnrollments] = useState<CohortEnrollment[]>([])
  const [registrations, setRegistrations] = useState<any[]>([])
  const [expandedRegistration, setExpandedRegistration] = useState<string | null>(null)
  const [registrationFilter, setRegistrationFilter] = useState('all')
  const [cohortSessions, setCohortSessions] = useState<any[]>([])
  const [bookings, setBookings] = useState<any[]>([])
  const [availabilityBlocks, setAvailabilityBlocks] = useState<any[]>([])
  const [newSession, setNewSession] = useState({ cohort_id: '', session_number: '', title: '', session_date: '' })

  // UI state
  const [userFilter, setUserFilter] = useState('all')
  const [communityCohortFilter, setCommunityCohortFilter] = useState('all')
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({})
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [showCohortForm, setShowCohortForm] = useState(false)
  const [showRepForm, setShowRepForm] = useState(false)
  const [showPromptForm, setShowPromptForm] = useState(false)
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false)
  const [showResourceForm, setShowResourceForm] = useState(false)
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const [expandedProgram, setExpandedProgram] = useState<string | null>(null)
  const [expandedCohort, setExpandedCohort] = useState<string | null>(null)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [billingRate, setBillingRate] = useState('')
  const [billingHours, setBillingHours] = useState('')
  const [billingClientType, setBillingClientType] = useState<'new' | 'existing'>('existing')
  const [paymentLinkUrl, setPaymentLinkUrl] = useState('')
  const [paymentRequestLoading, setPaymentRequestLoading] = useState(false)

  // Form state
  const [invite, setInvite] = useState({ email: '', full_name: '', role: 'impact_participant', program_id: '', cohort_id: '' })
  const [newCohort, setNewCohort] = useState({ name: '', program_id: '', start_date: '', end_date: '', zoom_link: '', status: 'upcoming' })
  const [newRep, setNewRep] = useState({ cohort_id: '', week_number: '', title: '', instructions: '', why_it_matters: '', due_date: '' })
  const [newPrompt, setNewPrompt] = useState({ prompt: '', program_id: '', week_number: '' })
  const [newCommunityPost, setNewCommunityPost] = useState({ cohort_id: '', body: '' })
  const [newAnnouncement, setNewAnnouncement] = useState({ cohort_id: '', title: '', body: '' })
  const [newResource, setNewResource] = useState({ title: '', description: '', type: 'pdf', url: '', program_id: '', topic: '', portal_type: 'impact' })

  // Styles
  const cardStyle = { background: 'white', borderRadius: '6px', border: '1px solid rgba(0,23,55,0.08)', padding: '1.5rem', marginBottom: '1.25rem' }
  const inputStyle = { width: '100%', padding: '0.75rem 1rem', border: '1.5px solid rgba(0,23,55,0.15)', borderRadius: '4px', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.9rem', color: 'var(--ink)', background: 'white', outline: 'none' }
  const labelStyle = { fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: 'var(--gold)', display: 'block', marginBottom: '0.5rem' }
  const thStyle = { fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: 'var(--slate)', padding: '0.65rem 1rem', textAlign: 'left' as const, borderBottom: '1px solid var(--mist)', background: 'var(--paper)' }
  const tdStyle = { padding: '0.85rem 1rem', fontSize: '0.85rem', color: 'var(--ink)', borderBottom: '1px solid var(--mist)', verticalAlign: 'middle' as const }

  const navigate = (id: Page) => { setPage(id); setMobileNavOpen(false) }

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 4000)
  }

  // Data fetching
  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [
      { data: usersData },
      { data: programsData },
      { data: cohortsData },
      { data: repsData },
      { data: journalPromptsData },
      { data: communityPostsData },
      { data: announcementsData },
      { data: resourcesData },
      { data: certsData },
      { data: enrollmentsData },
    ] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('programs').select('*').order('name'),
      supabase.from('cohorts').select('*, programs(name)').order('created_at', { ascending: false }),
      supabase.from('weekly_reps').select('*, cohorts(name)').order('week_number'),
      supabase.from('journal_prompts').select('*, programs(name)').order('sort_order'),
      supabase.from('community_posts').select('*, profiles(full_name, email, role), cohorts(name), community_likes(user_id), community_comments(*, profiles(full_name, email))').order('created_at', { ascending: false }),
      supabase.from('announcements').select('*, cohorts(name)').order('created_at', { ascending: false }),
      supabase.from('resources').select('*, programs(name)').order('created_at', { ascending: false }),
      supabase.from('certificates').select('*, profiles(full_name, email), programs(name)').order('issued_at', { ascending: false }),
      supabase.from('cohort_enrollments').select('*, profiles(full_name, email, role), cohorts(name)').order('enrolled_at', { ascending: false }),
    ])
    const { data: registrationsData } = await supabase
      .from('registrations')
      .select('*, programs(name, price_label), cohorts(name)')
      .order('created_at', { ascending: false })
    const { data: cohortSessionsData } = await supabase
      .from('cohort_sessions')
      .select('*')
      .order('session_number')
    const today = new Date().toISOString().split('T')[0]
    const twoWeeksOut = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const { data: bookingsData } = await supabase
      .from('bookings')
      .select('*')
      .gte('booking_date', today)
      .lte('booking_date', twoWeeksOut)
      .order('booking_date')
      .order('booking_time')
    const { data: blocksData } = await supabase
      .from('availability_blocks')
      .select('*')
      .gte('block_date', today)
      .lte('block_date', twoWeeksOut)
    if (usersData) setUsers(usersData)
    if (programsData) setPrograms(programsData)
    if (cohortsData) setCohorts(cohortsData)
    if (repsData) setReps(repsData)
    if (journalPromptsData) setJournalPrompts(journalPromptsData)
    if (communityPostsData) setCommunityPosts(communityPostsData)
    if (announcementsData) setAnnouncements(announcementsData)
    if (resourcesData) setResources(resourcesData)
    if (certsData) setCertificates(certsData)
    if (enrollmentsData) setEnrollments(enrollmentsData)
    if (registrationsData) setRegistrations(registrationsData)
    if (cohortSessionsData) setCohortSessions(cohortSessionsData)
    if (bookingsData) setBookings(bookingsData)
    if (blocksData) setAvailabilityBlocks(blocksData)
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

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
        setInvite({ email: '', full_name: '', role: 'impact_participant', program_id: '', cohort_id: '' })
        setShowInviteForm(false)
        fetchAll()
      }
    } catch {
      setInviteError('Failed to send invite. Please try again.')
    }
    setInviteLoading(false)
  }

  const handleCreateCohort = async () => {
    if (!newCohort.name.trim() || !newCohort.program_id) return
    setActionLoading(true)
    const selectedProg = programs.find(p => p.id === newCohort.program_id)
    const { error } = await supabase.from('cohorts').insert({
      name: newCohort.name,
      program_id: newCohort.program_id,
      start_date: newCohort.start_date || null,
      end_date: newCohort.end_date || null,
      zoom_link: newCohort.zoom_link || null,
      status: newCohort.status,
      session_day: (selectedProg as any)?.session_day || null,
      session_time: (selectedProg as any)?.session_time || null,
    })
    if (!error) {
      showSuccess('Cohort created.')
      setNewCohort({ name: '', program_id: '', start_date: '', end_date: '', zoom_link: '', status: 'upcoming' })
      setShowCohortForm(false)
      fetchAll()
    }
    setActionLoading(false)
  }

  const handleCreateRep = async () => {
    if (!newRep.title.trim() || !newRep.cohort_id) return
    setActionLoading(true)
    const { error } = await supabase.from('weekly_reps').insert({
      cohort_id: newRep.cohort_id,
      week_number: parseInt(newRep.week_number) || 1,
      title: newRep.title,
      instructions: newRep.instructions || null,
      why_it_matters: newRep.why_it_matters || null,
      due_date: newRep.due_date || null,
    })
    if (!error) {
      showSuccess('Weekly rep created.')
      setNewRep({ cohort_id: '', week_number: '', title: '', instructions: '', why_it_matters: '', due_date: '' })
      setShowRepForm(false)
      fetchAll()
    }
    setActionLoading(false)
  }

  const handleCreatePrompt = async () => {
    if (!newPrompt.prompt.trim()) return
    setActionLoading(true)
    const nextSortOrder = journalPrompts.reduce((max, p) => Math.max(max, p.sort_order), 0) + 1
    const { error } = await supabase.from('journal_prompts').insert({
      prompt: newPrompt.prompt,
      program_id: newPrompt.program_id || null,
      week_number: newPrompt.week_number ? parseInt(newPrompt.week_number) : null,
      sort_order: nextSortOrder,
    })
    if (!error) {
      showSuccess('Journal prompt added.')
      setNewPrompt({ prompt: '', program_id: '', week_number: '' })
      setShowPromptForm(false)
      fetchAll()
    }
    setActionLoading(false)
  }

  const handleDeletePrompt = async (id: string) => {
    await supabase.from('journal_prompts').delete().eq('id', id)
    fetchAll()
  }

  const handleCreateCommunityPost = async () => {
    if (!newCommunityPost.body.trim() || !newCommunityPost.cohort_id) return
    setActionLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('community_posts').insert({
      user_id: user?.id,
      cohort_id: newCommunityPost.cohort_id,
      body: newCommunityPost.body,
    })
    if (!error) {
      showSuccess('Posted to the community feed.')
      setNewCommunityPost({ cohort_id: '', body: '' })
      fetchAll()
    }
    setActionLoading(false)
  }

  const handleDeleteCommunityPost = async (id: string) => {
    await supabase.from('community_posts').delete().eq('id', id)
    fetchAll()
  }

  const toggleComments = (postId: string) => {
    setExpandedComments(prev => ({ ...prev, [postId]: !prev[postId] }))
  }

  const handleDeleteComment = async (id: string) => {
    await supabase.from('community_comments').delete().eq('id', id)
    fetchAll()
  }

  const handleAddComment = async (postId: string) => {
    const body = commentDrafts[postId]
    if (!body?.trim()) return
    setActionLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('community_comments').insert({
      post_id: postId,
      user_id: user?.id,
      body,
    })
    setCommentDrafts(prev => ({ ...prev, [postId]: '' }))
    fetchAll()
    setActionLoading(false)
  }

  const handleCreateAnnouncement = async () => {
    if (!newAnnouncement.title.trim()) return
    setActionLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('announcements').insert({
      cohort_id: newAnnouncement.cohort_id || null,
      title: newAnnouncement.title,
      body: newAnnouncement.body || null,
      created_by: user?.id || null,
    })
    if (!error) {
      showSuccess('Announcement posted.')
      setNewAnnouncement({ cohort_id: '', title: '', body: '' })
      setShowAnnouncementForm(false)
      fetchAll()
    }
    setActionLoading(false)
  }

  const handleDeleteAnnouncement = async (id: string) => {
    await supabase.from('announcements').delete().eq('id', id)
    fetchAll()
  }

  const handleCreateResource = async () => {
    if (!newResource.title.trim()) return
    setActionLoading(true)
    const { error } = await supabase.from('resources').insert({
      title: newResource.title,
      description: newResource.description || null,
      type: newResource.type,
      url: newResource.url || null,
      program_id: newResource.program_id || null,
      topic: newResource.topic || null,
      portal_type: newResource.portal_type,
    })
    if (!error) {
      showSuccess('Resource added.')
      setNewResource({ title: '', description: '', type: 'pdf', url: '', program_id: '', topic: '', portal_type: 'impact' })
      setShowResourceForm(false)
      fetchAll()
    }
    setActionLoading(false)
  }

  const handleDeleteResource = async (id: string) => {
    await supabase.from('resources').delete().eq('id', id)
    fetchAll()
  }

  const handleIssueCertificate = async (userId: string, programId: string) => {
    setActionLoading(true)
    const { error } = await supabase.from('certificates').insert({
      user_id: userId,
      program_id: programId,
      requirements_met: {},
    })
    if (!error) {
      showSuccess('Certificate issued.')
      fetchAll()
    }
    setActionLoading(false)
  }

  const handleUpdateUserRole = async (userId: string, role: string) => {
    await supabase.from('profiles').update({ role }).eq('id', userId)
    fetchAll()
  }

  const handleUpdateHourlyRate = async (userId: string, value: string) => {
    const rate = value.trim() === '' ? null : parseFloat(value)
    await supabase.from('profiles').update({ hourly_rate: rate }).eq('id', userId)
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, hourly_rate: rate } : u))
    showSuccess('Hourly rate updated.')
  }

  const handleSendPaymentRequest = async (user: Profile) => {
    const rate = parseFloat(billingRate)
    const hours = parseFloat(billingHours)
    if (!rate || !hours || !user.email) return
    setPaymentRequestLoading(true)
    setPaymentLinkUrl('')
    try {
      const res = await fetch('/api/create-payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          amount: Math.round(rate * hours * 100) / 100,
          hours,
          client_type: billingClientType,
        }),
      })
      const data = await res.json()
      if (data.error) {
        showSuccess(`Failed to send payment request: ${data.error}`)
      } else {
        setPaymentLinkUrl(data.url)
        showSuccess(`Payment request sent to ${user.email}.`)
      }
    } catch {
      showSuccess('Failed to send payment request. Please try again.')
    }
    setPaymentRequestLoading(false)
  }

  const handleUpdateCohortStatus = async (cohortId: string, status: string) => {
    await supabase.from('cohorts').update({ status }).eq('id', cohortId)
    fetchAll()
  }

  const handleUpdateRegistrationStatus = async (id: string, status: string) => {
    await supabase.from('registrations').update({ status }).eq('id', id)
    showSuccess('Registration updated.')
    fetchAll()
  }

  const handleGenerateSchedule = async (cohortId: string) => {
    const cohort = cohorts.find(c => c.id === cohortId)
    if (!cohort || !cohort.start_date || !cohort.end_date) {
      showSuccess('Please set a start date and end date on the cohort first.')
      return
    }
    const program = programs.find(p => p.id === cohort.program_id)
    const sessionDay = (cohort as any).session_day || (program as any)?.session_day
    if (!sessionDay) {
      showSuccess('Please set a session day on the program first then try again.')
      return
    }
    const dayMap: Record<string, number> = {
      Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
      Thursday: 4, Friday: 5, Saturday: 6
    }
    const targetDay = dayMap[sessionDay]
    const start = new Date(cohort.start_date)
    const end = new Date(cohort.end_date)
    const dates: Date[] = []
    const current = new Date(start)
    while (current.getDay() !== targetDay) {
      current.setDate(current.getDate() + 1)
    }
    while (current <= end) {
      dates.push(new Date(current))
      current.setDate(current.getDate() + 7)
    }
    if (dates.length === 0) {
      showSuccess('No ' + sessionDay + 's found between those dates.')
      return
    }
    setActionLoading(true)
    // Delete existing sessions first
    await supabase.from('cohort_sessions').delete().eq('cohort_id', cohortId)
    // Insert generated sessions
    const sessions = dates.map((date, i) => ({
      cohort_id: cohortId,
      session_number: i + 1,
      title: 'Session ' + (i + 1),
      session_date: date.toISOString().split('T')[0],
    }))
    await supabase.from('cohort_sessions').insert(sessions)
    showSuccess('Generated ' + sessions.length + ' sessions.')
    fetchAll()
    setActionLoading(false)
  }

  const handleAddSession = async () => {
    if (!newSession.title.trim() || !newSession.cohort_id) return
    setActionLoading(true)
    const { error } = await supabase.from('cohort_sessions').insert({
      cohort_id: newSession.cohort_id,
      session_number: parseInt(newSession.session_number) || 1,
      title: newSession.title,
      session_date: newSession.session_date || null,
    })
    if (!error) {
      showSuccess('Session added.')
      setNewSession({ cohort_id: '', session_number: '', title: '', session_date: '' })
      fetchAll()
    }
    setActionLoading(false)
  }

  const handleDeleteSession = async (id: string) => {
    await supabase.from('cohort_sessions').delete().eq('id', id)
    fetchAll()
  }

  const handleConfirmAndInvite = async (reg: any) => {
    setActionLoading(true)
    await supabase.from('registrations').update({ status: 'confirmed' }).eq('id', reg.id)
    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: reg.email,
          full_name: reg.full_name,
          role: 'impact_participant',
          program_id: reg.program_id,
          cohort_id: reg.cohort_id,
        }),
      })
      const data = await res.json()
      if (data.error) {
        showSuccess(`Confirmed, but invite failed: ${data.error}`)
      } else {
        showSuccess(`${reg.full_name} confirmed and invited.`)
      }
    } catch {
      showSuccess('Confirmed, but invite email failed to send.')
    }
    fetchAll()
    setActionLoading(false)
  }

  const roleBadge = (role: string) => {
    const map: Record<string, { bg: string; color: string; label: string }> = {
      admin: { bg: 'rgba(200,136,32,0.15)', color: 'var(--gold)', label: 'Admin' },
      coaching_client: { bg: 'rgba(0,23,55,0.08)', color: 'var(--navy)', label: 'Coaching' },
      impact_participant: { bg: 'rgba(10,37,71,0.06)', color: 'var(--slate)', label: 'Impact Lab' },
    }
    const s = map[role] || map.impact_participant
    return <span style={{ ...s, fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.2rem 0.6rem', borderRadius: '2px' }}>{s.label}</span>
  }

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; color: string }> = {
      active: { bg: 'rgba(200,136,32,0.1)', color: 'var(--gold)' },
      completed: { bg: 'var(--mist)', color: 'var(--slate)' },
      upcoming: { bg: 'rgba(0,23,55,0.06)', color: 'var(--navy)' },
      pending: { bg: 'rgba(0,23,55,0.06)', color: 'var(--slate)' },
      withdrawn: { bg: 'rgba(255,59,48,0.08)', color: '#ff6b6b' },
    }
    const s = map[status] || map.active
    return <span style={{ ...s, fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.2rem 0.6rem', borderRadius: '2px' }}>{status}</span>
  }

  const filteredUsers = userFilter === 'all' ? users : users.filter(u => u.role === userFilter)

  const activeCohorts = cohorts.filter(c => c.status === 'active')
  const impactUsers = users.filter(u => u.role === 'impact_participant')
  const coachingUsers = users.filter(u => u.role === 'coaching_client')

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
          <button key={id} onClick={() => setPage(id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.65rem 1.25rem', background: page === id ? 'rgba(200,136,32,0.12)' : 'transparent', border: 'none', borderLeft: `3px solid ${page === id ? 'var(--gold)' : 'transparent'}`, color: page === id ? 'var(--gold)' : 'rgba(255,255,255,0.5)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', fontFamily: 'var(--font-montserrat), sans-serif' }}>
            <span>{icon}</span>{label}
          </button>
        ))}
      </nav>
      <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <Link href="/" style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', display: 'block', textAlign: 'center', marginBottom: '0.5rem' }}>View public site</Link>
        <button onClick={handleSignOut} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: '0.72rem', cursor: 'pointer', width: '100%', textAlign: 'center', fontFamily: 'var(--font-montserrat), sans-serif' }}>Sign out</button>
      </div>
    </div>
  )

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.5rem', color: 'var(--navy)', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>Loading...</div>
        <div style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: 'var(--slate)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Fetching your data</div>
      </div>
    </div>
  )

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

          {/* GLOBAL SUCCESS */}
          {successMsg && (
            <div style={{ background: 'rgba(200,136,32,0.1)', border: '1px solid rgba(200,136,32,0.3)', borderRadius: '4px', padding: '0.85rem 1rem', marginBottom: '1.25rem', color: 'var(--gold)', fontSize: '0.85rem' }}>
              {successMsg}
            </div>
          )}

          {/* DASHBOARD */}
          {page === 'dashboard' && (
            <div>
              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Admin</span>
              <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '1.5rem' }}>Overview</h1>
              <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                {[
                  { label: 'Total Users', value: String(users.length), sub: 'All accounts' },
                  { label: 'Impact Lab', value: String(impactUsers.length), sub: 'Participants' },
                  { label: 'Coaching Clients', value: String(coachingUsers.length), sub: 'Active clients' },
                  { label: 'Active Cohorts', value: String(activeCohorts.length), sub: 'Currently running' },
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
                  {activeCohorts.length === 0 && <p style={{ color: 'var(--slate)', fontSize: '0.85rem' }}>No active cohorts yet.</p>}
                  {activeCohorts.map(c => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0', borderBottom: '1px solid var(--mist)', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <p style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.85rem' }}>{c.name}</p>
                        <p style={{ color: 'var(--slate)', fontSize: '0.75rem' }}>{enrollments.filter(e => e.cohort_id === c.id && e.status === 'active').length} enrolled</p>
                      </div>
                      {statusBadge(c.status)}
                    </div>
                  ))}
                </div>
                <div style={cardStyle}>
                  <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1rem' }}>Quick Actions</h3>
                  {[
                    { label: 'Review registrations', action: () => setPage('registrations') },
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
                <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1rem' }}>Programs</h3>
                {programs.length === 0 && <p style={{ color: 'var(--slate)', fontSize: '0.85rem' }}>No programs yet. Create one in the Programs section.</p>}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr>{['Program', 'Type', 'Cohorts', 'Status'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
                    <tbody>
                      {programs.map(p => (
                        <tr key={p.id}>
                          <td style={tdStyle}><span style={{ fontWeight: 600, color: 'var(--navy)' }}>{p.name}</span></td>
                          <td style={tdStyle}><span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.65rem', color: 'var(--slate)', textTransform: 'uppercase' }}>{p.type}</span></td>
                          <td style={tdStyle}>{cohorts.filter(c => c.program_id === p.id).length}</td>
                          <td style={tdStyle}>{statusBadge('active')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* CALENDAR */}
          {page === 'calendar' && (
            <div>
              <div style={{ marginBottom: '1.5rem' }}>
                <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Calendar</span>
                <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem' }}>Upcoming Appointments</h1>
                <p style={{ color: 'var(--slate)', fontSize: '0.85rem', marginTop: '0.35rem' }}>Next 14 days. Click a time slot to block it from public booking.</p>
              </div>

              {/* UPCOMING BOOKINGS */}
              <div style={cardStyle}>
                <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1rem' }}>Booked Appointments</h3>
                {bookings.length === 0 ? (
                  <p style={{ color: 'var(--slate)', fontSize: '0.88rem' }}>No appointments booked yet.</p>
                ) : bookings.map(b => (
                  <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '1rem 0', borderBottom: '1px solid var(--mist)', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div>
                      <p style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.88rem', marginBottom: '0.15rem' }}>{b.full_name}</p>
                      <p style={{ color: 'var(--slate)', fontSize: '0.78rem', marginBottom: '0.15rem' }}>{b.email} · {b.phone}</p>
                      {b.reason && <p style={{ color: 'var(--slate)', fontSize: '0.78rem', fontStyle: 'italic' }}>{b.reason}</p>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.65rem', color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        {new Date(b.booking_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </p>
                      <p style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.65rem', color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        {(() => { const [h, m] = b.booking_time.split(':').map(Number); const ampm = h >= 12 ? 'PM' : 'AM'; return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${ampm} ET` })()}
                      </p>
                      <button onClick={async () => { await supabase.from('bookings').delete().eq('id', b.id); fetchAll() }} style={{ background: 'none', border: 'none', color: 'rgba(255,59,48,0.5)', fontSize: '0.72rem', cursor: 'pointer', marginTop: '0.25rem' }}>Cancel</button>
                    </div>
                  </div>
                ))}
              </div>

              {/* BLOCK TIME */}
              <div style={cardStyle}>
                <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>Block Time Off</h3>
                <p style={{ color: 'var(--slate)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>Mark dates and times as unavailable so clients cannot book them.</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={labelStyle}>Date</label>
                    <input type="date" id="block-date" min={new Date().toISOString().split('T')[0]} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Time</label>
                    <select id="block-time" style={inputStyle}>
                      {['08:00','08:15','08:30','08:45','09:00','09:15','09:30','09:45','10:00','10:15','10:30','10:45','11:00','11:15','11:30','11:45','12:00','12:15','12:30','12:45','13:00','13:15','13:30','13:45','14:00','14:15','14:30','14:45','15:00','15:15','15:30','15:45','16:00','16:15','16:30','16:45'].map(t => {
                        const [h, m] = t.split(':').map(Number)
                        const ampm = h >= 12 ? 'PM' : 'AM'
                        const label = `${h % 12 || 12}:${String(m).padStart(2,'0')} ${ampm}`
                        return <option key={t} value={t}>{label}</option>
                      })}
                    </select>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    const date = (document.getElementById('block-date') as HTMLInputElement)?.value
                    const time = (document.getElementById('block-time') as HTMLSelectElement)?.value
                    if (!date || !time) return
                    await supabase.from('availability_blocks').insert({ block_date: date, block_time: time })
                    showSuccess('Time blocked.')
                    fetchAll()
                  }}
                  className="btn btn-primary"
                  style={{ fontSize: '0.85rem' }}
                >
                  Block This Time
                </button>

                {availabilityBlocks.length > 0 && (
                  <div style={{ marginTop: '1.5rem' }}>
                    <span style={labelStyle}>Currently Blocked</span>
                    {availabilityBlocks.map(b => (
                      <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--mist)' }}>
                        <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.65rem', color: 'var(--slate)', textTransform: 'uppercase' }}>
                          {new Date(b.block_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at {(() => { const [h, m] = b.block_time.split(':').map(Number); const ampm = h >= 12 ? 'PM' : 'AM'; return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${ampm}` })()}
                        </span>
                        <button onClick={async () => { await supabase.from('availability_blocks').delete().eq('id', b.id); fetchAll() }} style={{ background: 'none', border: 'none', color: 'rgba(255,59,48,0.5)', fontSize: '0.72rem', cursor: 'pointer' }}>Unblock</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* REGISTRATIONS */}
          {page === 'registrations' && (
            <div>
              <div style={{ marginBottom: '1.5rem' }}>
                <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Registrations</span>
                <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem' }}>Registrations</h1>
                <p style={{ color: 'var(--slate)', fontSize: '0.85rem', marginTop: '0.35rem' }}>Click a registration to confirm them and send their portal invite.</p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                {[
                  { value: 'all', label: `All (${registrations.length})` },
                  { value: 'pending', label: `Pending (${registrations.filter(r => r.status === 'pending').length})` },
                  { value: 'confirmed', label: `Confirmed (${registrations.filter(r => r.status === 'confirmed').length})` },
                  { value: 'paid', label: `Paid, Unconfirmed (${registrations.filter(r => r.payment_status === 'paid' && r.status === 'pending').length})` },
                ].map(({ value, label }) => (
                  <button key={value} onClick={() => setRegistrationFilter(value)} style={{ padding: '0.45rem 1rem', borderRadius: '2px', border: `1.5px solid ${registrationFilter === value ? 'var(--gold)' : 'rgba(0,23,55,0.15)'}`, background: registrationFilter === value ? 'rgba(200,136,32,0.08)' : 'white', color: registrationFilter === value ? 'var(--gold)' : 'var(--slate)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-montserrat), sans-serif' }}>
                    {label}
                  </button>
                ))}
              </div>

              {registrations.length === 0 ? (
                <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem' }}>
                  <p style={{ color: 'var(--slate)', fontSize: '0.88rem' }}>No registrations yet.</p>
                </div>
              ) : (
                <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
                  {registrations
                    .filter(r => {
                      if (registrationFilter === 'all') return true
                      if (registrationFilter === 'paid') return r.payment_status === 'paid' && r.status === 'pending'
                      return r.status === registrationFilter
                    })
                    .map(reg => (
                    <div key={reg.id}>
                      <div
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid var(--mist)', flexWrap: 'wrap', gap: '0.75rem', cursor: 'pointer' }}
                        onClick={() => setExpandedRegistration(expandedRegistration === reg.id ? null : reg.id)}
                      >
                        <div>
                          <p style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.88rem' }}>{reg.full_name}</p>
                          <p style={{ color: 'var(--slate)', fontSize: '0.78rem' }}>{(reg.programs as any)?.name} — {(reg.cohorts as any)?.name}</p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.2rem 0.6rem', borderRadius: '2px', background: reg.payment_status === 'paid' ? 'rgba(200,136,32,0.1)' : 'rgba(0,23,55,0.06)', color: reg.payment_status === 'paid' ? 'var(--gold)' : 'var(--slate)' }}>
                            {reg.payment_status === 'paid' ? 'Paid' : (reg.programs as any)?.price_label === 'Request a Quote' ? 'Quote Request' : 'Unpaid'}
                          </span>
                          {statusBadge(reg.status)}
                          <span style={{ color: 'var(--slate)', fontSize: '0.8rem' }}>{expandedRegistration === reg.id ? '▲' : '▼'}</span>
                        </div>
                      </div>
                      {expandedRegistration === reg.id && (
                        <div style={{ padding: '1.25rem 1.5rem', background: 'var(--paper)', borderBottom: '1px solid var(--mist)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
                            <div>
                              <span style={labelStyle}>Email</span>
                              <p style={{ color: 'var(--ink)', fontSize: '0.85rem' }}><a href={`mailto:${reg.email}`} style={{ color: 'var(--gold)' }}>{reg.email}</a></p>
                            </div>
                            {reg.phone && (
                              <div>
                                <span style={labelStyle}>Phone</span>
                                <p style={{ color: 'var(--ink)', fontSize: '0.85rem' }}><a href={`tel:${reg.phone}`} style={{ color: 'var(--gold)' }}>{reg.phone}</a></p>
                              </div>
                            )}
                            {reg.organization && (
                              <div>
                                <span style={labelStyle}>Organization</span>
                                <p style={{ color: 'var(--ink)', fontSize: '0.85rem' }}>{reg.organization}</p>
                              </div>
                            )}
                            <div>
                              <span style={labelStyle}>Submitted</span>
                              <p style={{ color: 'var(--ink)', fontSize: '0.85rem' }}>{new Date(reg.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                            </div>
                            {reg.amount_paid && (
                              <div>
                                <span style={labelStyle}>Amount Paid</span>
                                <p style={{ color: 'var(--ink)', fontSize: '0.85rem', fontWeight: 600 }}>${reg.amount_paid}</p>
                              </div>
                            )}
                            {reg.why && (
                              <div style={{ gridColumn: '1 / -1' }}>
                                <span style={labelStyle}>Why they want to join</span>
                                <p style={{ color: 'var(--ink)', fontSize: '0.85rem', lineHeight: 1.6 }}>{reg.why}</p>
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                            {reg.status === 'pending' && (
                              <button onClick={() => handleConfirmAndInvite(reg)} disabled={actionLoading} className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.55rem 1.1rem' }}>
                                {actionLoading ? 'Processing...' : 'Confirm and Send Invite'}
                              </button>
                            )}
                            {reg.status !== 'waitlist' && (
                              <button onClick={() => handleUpdateRegistrationStatus(reg.id, 'waitlist')} style={{ background: 'none', border: '1px solid rgba(0,23,55,0.15)', color: 'var(--navy)', borderRadius: '2px', padding: '0.55rem 1.1rem', fontSize: '0.8rem', cursor: 'pointer' }}>Waitlist</button>
                            )}
                            {reg.status !== 'declined' && (
                              <button onClick={() => handleUpdateRegistrationStatus(reg.id, 'declined')} style={{ background: 'none', border: '1px solid rgba(255,59,48,0.3)', color: '#ff6b6b', borderRadius: '2px', padding: '0.55rem 1.1rem', fontSize: '0.8rem', cursor: 'pointer' }}>Decline</button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
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
                <div style={{ background: 'rgba(200,136,32,0.1)', border: '1px solid rgba(200,136,32,0.3)', borderRadius: '4px', padding: '0.85rem 1rem', marginBottom: '1.25rem', color: 'var(--gold)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                  {inviteSuccess}
                </div>
              )}

              {showInviteForm && (
                <div style={{ ...cardStyle, borderTop: '3px solid var(--gold)', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>Invite a New User</h3>
                  <p style={{ color: 'var(--slate)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>They will receive an email to set their own password and will be automatically enrolled.</p>
                  {inviteError && <div style={{ background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.3)', borderRadius: '4px', padding: '0.75rem 1rem', marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>{inviteError}</div>}
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
                      <select value={invite.role} onChange={e => setInvite({ ...invite, role: e.target.value, program_id: '', cohort_id: '' })} style={inputStyle}>
                        <option value="impact_participant">Impact Lab Participant</option>
                        <option value="coaching_client">Coaching Client</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    {invite.role === 'impact_participant' && (
                      <div>
                        <label style={labelStyle}>Program</label>
                        <select value={invite.program_id} onChange={e => setInvite({ ...invite, program_id: e.target.value, cohort_id: '' })} style={inputStyle} required>
                          <option value="">Select a program...</option>
                          {programs.filter(p => p.type === 'cohort').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                    )}
                    {invite.role === 'coaching_client' && (
                      <div>
                        <label style={labelStyle}>Program</label>
                        <select value={invite.program_id} onChange={e => setInvite({ ...invite, program_id: e.target.value })} style={inputStyle} required>
                          <option value="">Select a program...</option>
                          {programs.filter(p => p.type !== 'cohort').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                    )}
                    {invite.role === 'impact_participant' && invite.program_id && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={labelStyle}>Cohort</label>
                        <select value={invite.cohort_id} onChange={e => setInvite({ ...invite, cohort_id: e.target.value })} style={inputStyle} required>
                          <option value="">Select a cohort...</option>
                          {cohorts.filter(c => c.program_id === invite.program_id && (c.status === 'active' || c.status === 'upcoming')).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                    )}
                    <div style={{ gridColumn: '1 / -1' }}>
                      <button type="submit" disabled={inviteLoading} className="btn btn-primary" style={{ fontSize: '0.85rem', width: '100%' }}>
                        {inviteLoading ? 'Sending...' : 'Send Invitation'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                {[
                  { value: 'all', label: `All (${users.length})` },
                  { value: 'impact_participant', label: `Impact Lab (${impactUsers.length})` },
                  { value: 'coaching_client', label: `Coaching (${coachingUsers.length})` },
                  { value: 'admin', label: `Admins (${users.filter(u => u.role === 'admin').length})` },
                ].map(({ value, label }) => (
                  <button key={value} onClick={() => setUserFilter(value)} style={{ padding: '0.45rem 1rem', borderRadius: '2px', border: `1.5px solid ${userFilter === value ? 'var(--gold)' : 'rgba(0,23,55,0.15)'}`, background: userFilter === value ? 'rgba(200,136,32,0.08)' : 'white', color: userFilter === value ? 'var(--gold)' : 'var(--slate)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-montserrat), sans-serif' }}>
                    {label}
                  </button>
                ))}
              </div>

              <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
                {filteredUsers.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--slate)', fontSize: '0.88rem' }}>No users yet. Invite someone to get started.</div>
                ) : (
                  <div>
                    {filteredUsers.map(user => (
                      <div key={user.id}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid var(--mist)', flexWrap: 'wrap', gap: '0.75rem', cursor: 'pointer' }} onClick={() => {
                          const next = expandedUser === user.id ? null : user.id
                          setExpandedUser(next)
                          setBillingRate(next && user.hourly_rate != null ? String(user.hourly_rate) : '')
                          setBillingHours('')
                          setBillingClientType('existing')
                          setPaymentLinkUrl('')
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--navy)', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 }}>
                              {(user.full_name || user.email || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.88rem' }}>{user.full_name || 'No name'}</p>
                              <p style={{ color: 'var(--slate)', fontSize: '0.78rem' }}>{user.email}</p>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                            {roleBadge(user.role)}
                            <span style={{ color: 'var(--slate)', fontSize: '0.8rem' }}>{expandedUser === user.id ? '▲' : '▼'}</span>
                          </div>
                        </div>
                        {expandedUser === user.id && (
                          <div style={{ padding: '1.25rem 1.5rem', background: 'var(--paper)', borderBottom: '1px solid var(--mist)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
                              <div>
                                <span style={labelStyle}>Joined</span>
                                <p style={{ color: 'var(--ink)', fontSize: '0.85rem' }}>{new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                              </div>
                              <div>
                                <span style={labelStyle}>Timezone</span>
                                <p style={{ color: 'var(--ink)', fontSize: '0.85rem' }}>{user.timezone || 'Not set'}</p>
                              </div>
                              {user.role === 'impact_participant' && (
                                <div style={{ gridColumn: '1 / -1' }}>
                                  <span style={labelStyle}>Enrollments</span>
                                  {enrollments.filter(e => e.user_id === user.id).length === 0 ? (
                                    <p style={{ color: 'var(--slate)', fontSize: '0.85rem' }}>Not enrolled in any cohort yet.</p>
                                  ) : enrollments.filter(e => e.user_id === user.id).map(e => (
                                    <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--mist)' }}>
                                      <span style={{ color: 'var(--ink)', fontSize: '0.85rem' }}>{(e.cohorts as any)?.name || 'Unknown cohort'}</span>
                                      {statusBadge(e.status)}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {user.role === 'coaching_client' && (
                              <div style={{ ...cardStyle, background: 'var(--paper)' }}>
                                <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1rem' }}>Coaching Billing</h3>
                                <div style={{ marginBottom: '1rem' }}>
                                  <label style={labelStyle}>Invoice Type</label>
                                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    {[
                                      { value: 'new' as const, label: 'New Client — First Invoice' },
                                      { value: 'existing' as const, label: 'Existing Client — Follow-up Invoice' },
                                    ].map(({ value, label }) => (
                                      <button
                                        key={value}
                                        type="button"
                                        onClick={() => setBillingClientType(value)}
                                        style={{ padding: '0.45rem 1rem', borderRadius: '2px', border: `1.5px solid ${billingClientType === value ? 'var(--gold)' : 'rgba(0,23,55,0.15)'}`, background: billingClientType === value ? 'rgba(200,136,32,0.08)' : 'white', color: billingClientType === value ? 'var(--gold)' : 'var(--slate)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-montserrat), sans-serif' }}
                                      >
                                        {label}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                  <div>
                                    <label style={labelStyle}>Hourly Rate ($)</label>
                                    <input
                                      type="number"
                                      value={billingRate}
                                      onChange={e => setBillingRate(e.target.value)}
                                      onBlur={e => handleUpdateHourlyRate(user.id, e.target.value)}
                                      placeholder="e.g. 150"
                                      style={inputStyle}
                                      min="0"
                                      step="0.01"
                                    />
                                  </div>
                                  <div>
                                    <label style={labelStyle}>Hours to Bill</label>
                                    <input
                                      type="number"
                                      value={billingHours}
                                      onChange={e => setBillingHours(e.target.value)}
                                      placeholder="e.g. 2"
                                      style={inputStyle}
                                      min="0"
                                      step="0.25"
                                    />
                                  </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                                  <div>
                                    <span style={labelStyle}>Total</span>
                                    <p style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.5rem', color: 'var(--navy)', letterSpacing: '0.04em' }}>
                                      ${((parseFloat(billingRate) || 0) * (parseFloat(billingHours) || 0)).toFixed(2)}
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => handleSendPaymentRequest(user)}
                                    disabled={paymentRequestLoading || !billingRate || !billingHours}
                                    className="btn btn-primary"
                                    style={{ fontSize: '0.8rem', padding: '0.6rem 1.1rem' }}
                                  >
                                    {paymentRequestLoading ? 'Sending...' : 'Send Payment Request'}
                                  </button>
                                </div>
                                {paymentLinkUrl && (
                                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--mist)', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                                    <span style={labelStyle}>Payment Link</span>
                                    <a href={paymentLinkUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold)', fontSize: '0.8rem', wordBreak: 'break-all' }}>{paymentLinkUrl}</a>
                                    <button
                                      onClick={() => { navigator.clipboard.writeText(paymentLinkUrl); showSuccess('Link copied to clipboard.') }}
                                      style={{ background: 'none', border: '1.5px solid rgba(0,23,55,0.15)', borderRadius: '2px', padding: '0.3rem 0.7rem', color: 'var(--slate)', fontSize: '0.72rem', cursor: 'pointer' }}
                                    >
                                      Copy
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--slate)' }}>Change role:</span>
                                <select value={user.role} onChange={e => handleUpdateUserRole(user.id, e.target.value)} style={{ ...inputStyle, width: 'auto', padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}>
                                  <option value="impact_participant">Impact Lab</option>
                                  <option value="coaching_client">Coaching</option>
                                  <option value="admin">Admin</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PROGRAMS */}
          {page === 'programs' && (
            <div>
              <div style={{ marginBottom: '1.5rem' }}>
                <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Programs</span>
                <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem' }}>Your Programs</h1>
                <p style={{ color: 'var(--slate)', fontSize: '0.85rem', marginTop: '0.35rem' }}>Click any program to edit its details and manage its cohorts.</p>
              </div>

              {programs.map(p => (
                <div key={p.id} style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', cursor: 'pointer' }} onClick={() => setExpandedProgram(expandedProgram === p.id ? null : p.id)}>
                    <div>
                      <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.25rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>{p.name}</h3>
                      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: 'var(--slate)', textTransform: 'uppercase' }}>{p.type}</span>
                        <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: 'var(--slate)' }}>{cohorts.filter(c => c.program_id === p.id).length} cohorts</span>
                        <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: 'var(--slate)' }}>{enrollments.filter(e => cohorts.find(c => c.program_id === p.id && c.id === e.cohort_id)).length} participants</span>
                      </div>
                    </div>
                    <span style={{ color: 'var(--slate)', fontSize: '0.8rem' }}>{expandedProgram === p.id ? '▲' : '▼'}</span>
                  </div>
                  {expandedProgram === p.id && (
                    <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--mist)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                        {/* COACHING PROGRAM — focus areas only */}
                        {p.type === 'coaching' && (
                          <>
                            <div style={{ gridColumn: '1 / -1' }}>
                              <label style={labelStyle}>Focus Areas <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.65rem', color: 'var(--slate)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>— shown as cards on the Coaching page. Format each line as: Title | Description</span></label>
                              <textarea id={`focus-${p.id}`} defaultValue={(p as any).focus_areas || ''} rows={8} placeholder="Leadership | How you show up for and develop the people around you.&#10;Performance | Habits and behaviors that drive consistent results.&#10;Communication | Clarity, confidence, and presence when it matters." style={{ ...inputStyle, resize: 'vertical' }} />
                              <p style={{ color: 'var(--slate)', fontSize: '0.75rem', marginTop: '0.5rem', lineHeight: 1.5 }}>Each line becomes one card. Use a pipe character ( | ) to separate the title from the description.</p>
                            </div>
                          </>
                        )}
                        {/* COHORT PROGRAMS — full set of fields */}
                        {p.type === 'cohort' && (
                          <>
                            <div style={{ gridColumn: '1 / -1' }}>
                              <label style={labelStyle}>Motto <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.65rem', color: 'var(--slate)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>— shown in italics under the program name on the Impact Lab page</span></label>
                              <input id={`motto-${p.id}`} defaultValue={(p as any).motto || ''} placeholder='"Before you build anything, you have to see clearly."' style={inputStyle} />
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                              <label style={labelStyle}>Keywords <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.65rem', color: 'var(--slate)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>— shown as tags on the Impact Lab page, separated by commas</span></label>
                              <input id={`keywords-${p.id}`} defaultValue={(p as any).keywords || ''} placeholder="Clarity, Direction, Purpose" style={inputStyle} />
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                              <label style={labelStyle}>Program Description <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.65rem', color: 'var(--slate)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>— shown on the Impact Lab page and the Register page</span></label>
                              <textarea id={`desc-${p.id}`} defaultValue={p.description || ''} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                              <label style={labelStyle}>Leadership Development Goal <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.65rem', color: 'var(--slate)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>— shown on the Impact Lab page next to the description</span></label>
                              <textarea id={`goal-${p.id}`} defaultValue={(p as any).leadership_goal || ''} rows={2} placeholder="e.g. Get clear on where you want your impact and what is standing between you and it." style={{ ...inputStyle, resize: 'vertical' }} />
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                              <label style={labelStyle}>Focus Areas <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.65rem', color: 'var(--slate)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>— shown as bullet points on the Impact Lab page, one item per line</span></label>
                              <textarea id={`focus-${p.id}`} defaultValue={(p as any).focus_areas || ''} rows={6} placeholder="Clarity on your impact&#10;Identifying what matters most&#10;Removing what is in the way&#10;Direction and next steps" style={{ ...inputStyle, resize: 'vertical' }} />
                            </div>
                            <div>
                              <label style={labelStyle}>Session Day <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.65rem', color: 'var(--slate)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>— shown on the Register page</span></label>
                              <select id={`day-${p.id}`} defaultValue={(p as any).session_day || ''} style={inputStyle}>
                                <option value="">Select a day...</option>
                                {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d => (
                                  <option key={d} value={d}>{d}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label style={labelStyle}>Session Time <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.65rem', color: 'var(--slate)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>— shown on the Register page</span></label>
                              <input type="time" id={`time-${p.id}`} defaultValue={(p as any).session_time || ''} style={inputStyle} />
                            </div>
                            <div>
                              <label style={labelStyle}>Duration (weeks) <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.65rem', color: 'var(--slate)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>— shown on the Register page</span></label>
                              <input type="number" id={`duration-${p.id}`} defaultValue={(p as any).duration_weeks || ''} placeholder="e.g. 4" min="1" style={inputStyle} />
                            </div>
                          </>
                        )}
                      </div>
                      <button
                        onClick={async () => {
                          setActionLoading(true)
                          const desc = (document.getElementById(`desc-${p.id}`) as HTMLTextAreaElement)?.value
                          const goal = (document.getElementById(`goal-${p.id}`) as HTMLTextAreaElement)?.value
                          const focus = (document.getElementById(`focus-${p.id}`) as HTMLTextAreaElement)?.value
                          const day = (document.getElementById(`day-${p.id}`) as HTMLSelectElement)?.value
                          const time = (document.getElementById(`time-${p.id}`) as HTMLInputElement)?.value
                          const duration = (document.getElementById(`duration-${p.id}`) as HTMLInputElement)?.value
                          const motto = (document.getElementById(`motto-${p.id}`) as HTMLInputElement)?.value
                          const keywords = (document.getElementById(`keywords-${p.id}`) as HTMLInputElement)?.value
                          await supabase.from('programs').update({
                            description: desc || null,
                            motto: motto || null,
                            keywords: keywords || null,
                            leadership_goal: goal || null,
                            focus_areas: focus || null,
                            session_day: day || null,
                            session_time: time || null,
                            duration_weeks: duration ? parseInt(duration) : null,
                          }).eq('id', p.id)
                          showSuccess(`${p.name} updated.`)
                          setExpandedProgram(null)
                          fetchAll()
                          setActionLoading(false)
                        }}
                        disabled={actionLoading}
                        className="btn btn-primary"
                        style={{ fontSize: '0.85rem', marginBottom: '1.5rem' }}
                      >
                        {actionLoading ? 'Saving...' : 'Save Changes'}
                      </button>
                      <span style={labelStyle}>Cohorts in this program</span>
                      {cohorts.filter(c => c.program_id === p.id).length === 0 ? (
                        <p style={{ color: 'var(--slate)', fontSize: '0.85rem', marginBottom: '1rem' }}>No cohorts yet. Create one in the Cohorts section.</p>
                      ) : cohorts.filter(c => c.program_id === p.id).map(c => (
                        <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0', borderBottom: '1px solid var(--mist)', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <span style={{ color: 'var(--ink)', fontSize: '0.85rem', fontWeight: 500 }}>{c.name}</span>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', color: 'var(--slate)' }}>{enrollments.filter(e => e.cohort_id === c.id).length} enrolled</span>
                            {statusBadge(c.status)}
                          </div>
                        </div>
                      ))}
                      <button onClick={() => { setPage('cohorts'); setNewCohort({ ...newCohort, program_id: p.id }); setShowCohortForm(true) }} className="btn btn-ghost-dark" style={{ fontSize: '0.78rem', padding: '0.5rem 1rem', marginTop: '1rem' }}>+ Add Cohort</button>
                    </div>
                  )}
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
                      <select value={newCohort.program_id} onChange={e => setNewCohort({ ...newCohort, program_id: e.target.value })} style={inputStyle} required>
                        <option value="">Select a program...</option>
                        {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Start Date</label>
                      <input type="date" value={newCohort.start_date} onChange={e => setNewCohort({ ...newCohort, start_date: e.target.value })} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>End Date</label>
                      <input type="date" value={newCohort.end_date} onChange={e => setNewCohort({ ...newCohort, end_date: e.target.value })} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Status</label>
                      <select value={newCohort.status} onChange={e => setNewCohort({ ...newCohort, status: e.target.value })} style={inputStyle}>
                        <option value="upcoming">Upcoming</option>
                        <option value="active">Active</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Zoom Link</label>
                      <input value={newCohort.zoom_link} onChange={e => setNewCohort({ ...newCohort, zoom_link: e.target.value })} placeholder="https://zoom.us/j/..." style={inputStyle} />
                    </div>
                  </div>
                  <button onClick={handleCreateCohort} disabled={actionLoading} className="btn btn-primary" style={{ fontSize: '0.85rem', marginTop: '1rem' }}>
                    {actionLoading ? 'Creating...' : 'Create Cohort'}
                  </button>
                </div>
              )}
              {cohorts.length === 0 && !showCohortForm && (
                <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem' }}>
                  <p style={{ color: 'var(--slate)', fontSize: '0.88rem', marginBottom: '1rem' }}>No cohorts yet. Create your first one.</p>
                  <button onClick={() => setShowCohortForm(true)} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>+ Create Cohort</button>
                </div>
              )}
              {cohorts.map(c => (
                <div key={c.id} style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', cursor: 'pointer' }} onClick={() => setExpandedCohort(expandedCohort === c.id ? null : c.id)}>
                    <div>
                      <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.15rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '0.35rem' }}>{c.name}</h3>
                      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: 'var(--slate)' }}>{(c.programs as any)?.name || 'No program'}</span>
                        {c.start_date && <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: 'var(--slate)' }}>{c.start_date} to {c.end_date}</span>}
                        <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: 'var(--slate)' }}>{enrollments.filter(e => e.cohort_id === c.id && e.status === 'active').length} enrolled</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      {statusBadge(c.status)}
                      <span style={{ color: 'var(--slate)', fontSize: '0.8rem' }}>{expandedCohort === c.id ? '▲' : '▼'}</span>
                    </div>
                  </div>
                  {expandedCohort === c.id && (
                    <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--mist)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                        <div>
                          <label style={labelStyle}>Cohort Name</label>
                          <input defaultValue={c.name} style={inputStyle} onBlur={async e => { if (e.target.value !== c.name) { await supabase.from('cohorts').update({ name: e.target.value }).eq('id', c.id); fetchAll() } }} />
                        </div>
                        <div>
                          <label style={labelStyle}>Status</label>
                          <select value={c.status} onChange={e => handleUpdateCohortStatus(c.id, e.target.value)} style={inputStyle}>
                            <option value="upcoming">Upcoming</option>
                            <option value="active">Active</option>
                            <option value="completed">Completed</option>
                          </select>
                        </div>
                        <div>
                          <label style={labelStyle}>Start Date</label>
                          <input type="date" defaultValue={c.start_date || ''} style={inputStyle} onBlur={async e => { await supabase.from('cohorts').update({ start_date: e.target.value || null }).eq('id', c.id); fetchAll() }} />
                        </div>
                        <div>
                          <label style={labelStyle}>End Date</label>
                          <input type="date" defaultValue={c.end_date || ''} style={inputStyle} onBlur={async e => { await supabase.from('cohorts').update({ end_date: e.target.value || null }).eq('id', c.id); fetchAll() }} />
                        </div>
                        <div>
                          <label style={labelStyle}>Session Day</label>
                          <select defaultValue={(c as any).session_day || ''} style={inputStyle} onChange={async e => { await supabase.from('cohorts').update({ session_day: e.target.value || null }).eq('id', c.id); fetchAll() }}>
                            <option value="">Select a day...</option>
                            {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label style={labelStyle}>Session Time</label>
                          <input type="time" defaultValue={(c as any).session_time || ''} style={inputStyle} onBlur={async e => { await supabase.from('cohorts').update({ session_time: e.target.value || null }).eq('id', c.id); fetchAll() }} />
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={labelStyle}>Zoom Link</label>
                          <input defaultValue={c.zoom_link || ''} placeholder="https://zoom.us/j/..." style={inputStyle} onBlur={async e => { await supabase.from('cohorts').update({ zoom_link: e.target.value || null }).eq('id', c.id); fetchAll() }} />
                        </div>
                      </div>
                      <span style={labelStyle}>Enrolled Participants</span>
                      {enrollments.filter(e => e.cohort_id === c.id).length === 0 ? (
                        <p style={{ color: 'var(--slate)', fontSize: '0.85rem' }}>No participants enrolled yet. Invite someone and assign them to this cohort.</p>
                      ) : enrollments.filter(e => e.cohort_id === c.id).map(e => (
                        <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0', borderBottom: '1px solid var(--mist)', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div>
                            <span style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.85rem' }}>{(e.profiles as any)?.full_name || 'Unknown'}</span>
                            <span style={{ display: 'block', color: 'var(--slate)', fontSize: '0.75rem' }}>{(e.profiles as any)?.email}</span>
                          </div>
                          {statusBadge(e.status)}
                        </div>
                      ))}
                      <div style={{ marginTop: '1.5rem' }}>
                        <span style={labelStyle}>Session Schedule <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.65rem', color: 'var(--slate)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>shown on the Register page</span></span>
                        {cohortSessions.filter(s => s.cohort_id === c.id).length === 0 ? (
                          <p style={{ color: 'var(--slate)', fontSize: '0.85rem', marginBottom: '1rem' }}>No sessions added yet.</p>
                        ) : cohortSessions.filter(s => s.cohort_id === c.id).map(s => (
                          <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0', borderBottom: '1px solid var(--mist)', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', color: 'var(--gold)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>
                                Session {s.session_number}{s.session_date ? ' · ' + new Date(s.session_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : ''}
                              </span>
                              <input
                                defaultValue={s.title}
                                style={{ ...inputStyle, padding: '0.35rem 0.65rem', fontSize: '0.85rem', width: '100%' }}
                                onBlur={async e => {
                                  if (e.target.value !== s.title) {
                                    await supabase.from('cohort_sessions').update({ title: e.target.value }).eq('id', s.id)
                                    fetchAll()
                                  }
                                }}
                              />
                            </div>
                            <button onClick={() => handleDeleteSession(s.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,59,48,0.5)', fontSize: '0.75rem', cursor: 'pointer', flexShrink: 0 }}>Remove</button>
                          </div>
                        ))}
                        <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(200,136,32,0.05)', borderRadius: '4px', border: '1px solid rgba(200,136,32,0.2)', marginBottom: '0.75rem' }}>
                          <p style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.4rem' }}>Schedule Generator</p>
                          <p style={{ color: 'var(--slate)', fontSize: '0.8rem', lineHeight: 1.5, marginBottom: '0.75rem' }}>
                          Automatically generates one session per {(c as any).session_day || programs.find(p => p.id === c.program_id) && (programs.find(p => p.id === c.program_id) as any)?.session_day || 'session day'} between the start and end dates. Make sure the program has a session day set under Programs.
                        </p>
                          <button onClick={() => handleGenerateSchedule(c.id)} disabled={actionLoading} style={{ background: 'var(--gold)', border: 'none', color: 'var(--navy)', borderRadius: '2px', padding: '0.55rem 1.1rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-montserrat), sans-serif' }}>
                            {actionLoading ? 'Generating...' : 'Generate Schedule'}
                          </button>
                          <p style={{ color: 'var(--slate)', fontSize: '0.72rem', marginTop: '0.5rem' }}>Note: this will replace any existing sessions for this cohort.</p>
                        </div>
                        <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--paper)', borderRadius: '4px', border: '1px solid var(--mist)' }}>
                          <p style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>Add a Session</p>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                            <div>
                              <label style={labelStyle}>Session Number</label>
                              <input type="number" value={newSession.cohort_id === c.id ? newSession.session_number : ''} onChange={e => setNewSession({ cohort_id: c.id, session_number: e.target.value, title: newSession.cohort_id === c.id ? newSession.title : '', session_date: newSession.cohort_id === c.id ? newSession.session_date : '' })} placeholder={String(cohortSessions.filter(s => s.cohort_id === c.id).length + 1)} min="1" style={inputStyle} />
                            </div>
                            <div>
                              <label style={labelStyle}>Date (optional)</label>
                              <input type="date" value={newSession.cohort_id === c.id ? newSession.session_date : ''} onChange={e => setNewSession({ cohort_id: c.id, session_number: newSession.cohort_id === c.id ? newSession.session_number : '', title: newSession.cohort_id === c.id ? newSession.title : '', session_date: e.target.value })} style={inputStyle} />
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                              <label style={labelStyle}>Session Title</label>
                              <input value={newSession.cohort_id === c.id ? newSession.title : ''} onChange={e => setNewSession({ cohort_id: c.id, session_number: newSession.cohort_id === c.id ? newSession.session_number : '', title: e.target.value, session_date: newSession.cohort_id === c.id ? newSession.session_date : '' })} placeholder="e.g. Where do you want your impact?" style={inputStyle} />
                            </div>
                          </div>
                          <button onClick={() => { setNewSession(prev => ({ ...prev, cohort_id: c.id })); handleAddSession() }} disabled={actionLoading} className="btn btn-primary" style={{ fontSize: '0.78rem', padding: '0.5rem 1rem' }}>
                            {actionLoading ? 'Adding...' : '+ Add Session'}
                          </button>
                        </div>
                      </div>

                      <div style={{ marginTop: '1.5rem' }}>
                        <span style={labelStyle}>Weekly Reps in this cohort</span>
                        {reps.filter(r => r.cohort_id === c.id).length === 0 ? (
                          <p style={{ color: 'var(--slate)', fontSize: '0.85rem' }}>No reps yet.</p>
                        ) : reps.filter(r => r.cohort_id === c.id).map(r => (
                          <div key={r.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--mist)' }}>
                            <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', color: 'var(--gold)', textTransform: 'uppercase' }}>Week {r.week_number}</span>
                            <p style={{ color: 'var(--ink)', fontSize: '0.85rem', fontWeight: 500 }}>{r.title}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
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
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={labelStyle}>Cohort</label>
                      <select value={newRep.cohort_id} onChange={e => setNewRep({ ...newRep, cohort_id: e.target.value })} style={inputStyle} required>
                        <option value="">Select a cohort...</option>
                        {cohorts.filter(c => c.status === 'active' || c.status === 'upcoming').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Week Number</label>
                      <input type="number" value={newRep.week_number} onChange={e => setNewRep({ ...newRep, week_number: e.target.value })} placeholder="e.g. 5" style={inputStyle} min="1" />
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
                      <textarea value={newRep.why_it_matters} onChange={e => setNewRep({ ...newRep, why_it_matters: e.target.value })} placeholder="Why is this rep important?" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
                    </div>
                    <div>
                      <label style={labelStyle}>Due Date</label>
                      <input type="date" value={newRep.due_date} onChange={e => setNewRep({ ...newRep, due_date: e.target.value })} style={inputStyle} />
                    </div>
                  </div>
                  <button onClick={handleCreateRep} disabled={actionLoading} className="btn btn-primary" style={{ fontSize: '0.85rem', marginTop: '1rem' }}>
                    {actionLoading ? 'Creating...' : 'Create Rep'}
                  </button>
                </div>
              )}
              {reps.length === 0 && !showRepForm && (
                <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem' }}>
                  <p style={{ color: 'var(--slate)', fontSize: '0.88rem', marginBottom: '1rem' }}>No weekly reps yet.</p>
                  <button onClick={() => setShowRepForm(true)} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>+ Create Rep</button>
                </div>
              )}
              {reps.map(rep => (
                <div key={rep.id} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', color: 'var(--gold)', textTransform: 'uppercase' }}>Week {rep.week_number}</span>
                      <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', color: 'var(--slate)' }}>{(rep.cohorts as any)?.name}</span>
                      {rep.due_date && <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', color: 'var(--slate)' }}>Due {rep.due_date}</span>}
                    </div>
                    <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em' }}>{rep.title}</h3>
                  </div>
                  <button onClick={async () => { await supabase.from('weekly_reps').delete().eq('id', rep.id); fetchAll() }} style={{ background: 'none', border: 'none', color: 'rgba(255,59,48,0.5)', fontSize: '0.75rem', cursor: 'pointer', flexShrink: 0 }}>Delete</button>
                </div>
              ))}
            </div>
          )}

          {/* JOURNAL PROMPTS */}
          {page === 'prompts' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Journal Prompts</span>
                  <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem' }}>Journal Prompts</h1>
                </div>
                <button onClick={() => setShowPromptForm(!showPromptForm)} className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.65rem 1.25rem' }}>
                  {showPromptForm ? 'Cancel' : '+ New Prompt'}
                </button>
              </div>
              {showPromptForm && (
                <div style={{ ...cardStyle, borderTop: '3px solid var(--gold)', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1.25rem' }}>Add a Journal Prompt</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                      <label style={labelStyle}>Prompt</label>
                      <textarea value={newPrompt.prompt} onChange={e => setNewPrompt({ ...newPrompt, prompt: e.target.value })} placeholder="What question should participants reflect on?" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={labelStyle}>Program</label>
                        <select value={newPrompt.program_id} onChange={e => setNewPrompt({ ...newPrompt, program_id: e.target.value })} style={inputStyle}>
                          <option value="">All Programs</option>
                          {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>Week Number</label>
                        <input type="number" value={newPrompt.week_number} onChange={e => setNewPrompt({ ...newPrompt, week_number: e.target.value })} placeholder="Leave blank to rotate" style={inputStyle} min="1" />
                      </div>
                    </div>
                    <button onClick={handleCreatePrompt} disabled={actionLoading} className="btn btn-primary" style={{ fontSize: '0.85rem', alignSelf: 'flex-start' }}>
                      {actionLoading ? 'Adding...' : 'Add Prompt'}
                    </button>
                  </div>
                </div>
              )}
              {journalPrompts.length === 0 && !showPromptForm && (
                <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem' }}>
                  <p style={{ color: 'var(--slate)', fontSize: '0.88rem', marginBottom: '1rem' }}>No journal prompts yet.</p>
                  <button onClick={() => setShowPromptForm(true)} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>+ Add Prompt</button>
                </div>
              )}
              {journalPrompts.map(jp => (
                <div key={jp.id} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', color: 'var(--slate)' }}>{jp.programs?.name || 'All Programs'}</span>
                      {jp.week_number != null && <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', color: 'var(--gold)', textTransform: 'uppercase' }}>Week {jp.week_number}</span>}
                    </div>
                    <p style={{ color: 'var(--ink)', fontSize: '0.9rem', lineHeight: 1.6 }}>{jp.prompt}</p>
                  </div>
                  <button onClick={() => handleDeletePrompt(jp.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,59,48,0.5)', fontSize: '0.75rem', cursor: 'pointer', flexShrink: 0 }}>Delete</button>
                </div>
              ))}
            </div>
          )}

          {/* COMMUNITY */}
          {page === 'community' && (
            <div>
              <div style={{ marginBottom: '1.5rem' }}>
                <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Community</span>
                <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem' }}>Community Feed</h1>
              </div>

              <div style={{ ...cardStyle, borderTop: '3px solid var(--gold)' }}>
                <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1.25rem' }}>Post as Tramaine</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={labelStyle}>Cohort</label>
                    <select value={newCommunityPost.cohort_id} onChange={e => setNewCommunityPost({ ...newCommunityPost, cohort_id: e.target.value })} style={inputStyle} required>
                      <option value="">Select a cohort...</option>
                      {cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Message</label>
                    <textarea value={newCommunityPost.body} onChange={e => setNewCommunityPost({ ...newCommunityPost, body: e.target.value })} placeholder="Share something with this cohort..." rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                  </div>
                  <button onClick={handleCreateCommunityPost} disabled={actionLoading || !newCommunityPost.cohort_id || !newCommunityPost.body.trim()} className="btn btn-primary" style={{ fontSize: '0.85rem', alignSelf: 'flex-start' }}>
                    {actionLoading ? 'Posting...' : 'Post'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1.5rem 0 1.25rem', flexWrap: 'wrap' }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Filter by Cohort</label>
                <select value={communityCohortFilter} onChange={e => setCommunityCohortFilter(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
                  <option value="all">All Cohorts</option>
                  {cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {(() => {
                const filteredPosts = communityPosts.filter(p => communityCohortFilter === 'all' || p.cohort_id === communityCohortFilter)
                if (filteredPosts.length === 0) {
                  return (
                    <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem' }}>
                      <p style={{ color: 'var(--slate)', fontSize: '0.88rem' }}>No posts yet.</p>
                    </div>
                  )
                }
                return filteredPosts.map(post => {
                  const isAdmin = post.profiles?.role === 'admin'
                  const comments = (post.community_comments || []).slice().sort((a: { created_at: string }, b: { created_at: string }) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                  const commentsOpen = !!expandedComments[post.id]
                  return (
                    <div key={post.id} style={{ ...cardStyle, borderLeft: isAdmin ? '4px solid var(--gold)' : '1px solid rgba(0,23,55,0.08)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                            <span style={{ fontWeight: 600, color: isAdmin ? 'var(--gold)' : 'var(--navy)', fontSize: '0.88rem' }}>{isAdmin ? 'Tramaine' : (post.profiles?.full_name || 'Unknown')}</span>
                            {isAdmin && (
                              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.55rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--navy)', background: 'rgba(200,136,32,0.15)', padding: '0.15rem 0.5rem', borderRadius: '2px' }}>Admin</span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', color: 'var(--slate)' }}>{post.cohorts?.name || 'Unknown cohort'}</span>
                            <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', color: 'var(--slate)' }}>{new Date(post.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                          </div>
                        </div>
                        <button onClick={() => handleDeleteCommunityPost(post.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,59,48,0.5)', fontSize: '0.75rem', cursor: 'pointer' }}>Delete</button>
                      </div>
                      <p style={{ color: 'var(--slate)', fontSize: '0.88rem', lineHeight: 1.7, marginBottom: '0.5rem' }}>{post.body}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                        <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: 'var(--slate)' }}>♡ {post.community_likes?.length || 0}</span>
                        <button onClick={() => toggleComments(post.id)} style={{ background: 'none', border: 'none', color: 'var(--slate)', fontSize: '0.7rem', cursor: 'pointer', fontFamily: 'var(--font-jetbrains), monospace' }}>
                          {comments.length} comment{comments.length === 1 ? '' : 's'} {commentsOpen ? '▲' : '▼'}
                        </button>
                      </div>
                      {commentsOpen && (
                        <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--mist)' }}>
                          {comments.length === 0 && <p style={{ color: 'var(--slate)', fontSize: '0.8rem' }}>No comments yet.</p>}
                          {comments.map((c: { id: string; body: string; created_at: string; profiles?: { full_name: string | null } }) => (
                            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.6rem' }}>
                              <div>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline' }}>
                                  <span style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.78rem' }}>{c.profiles?.full_name || 'Unknown'}</span>
                                  <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.55rem', color: 'var(--slate)' }}>{new Date(c.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                                </div>
                                <p style={{ color: 'var(--ink)', fontSize: '0.82rem', lineHeight: 1.6 }}>{c.body}</p>
                              </div>
                              <button onClick={() => handleDeleteComment(c.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,59,48,0.5)', fontSize: '0.7rem', cursor: 'pointer', flexShrink: 0 }}>Delete</button>
                            </div>
                          ))}
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <textarea
                              value={commentDrafts[post.id] || ''}
                              onChange={e => setCommentDrafts(prev => ({ ...prev, [post.id]: e.target.value }))}
                              placeholder="Add a comment..."
                              rows={2}
                              style={{ ...inputStyle, flex: 1, resize: 'vertical' }}
                            />
                            <button onClick={() => handleAddComment(post.id)} disabled={actionLoading} className="btn btn-primary" style={{ fontSize: '0.78rem', padding: '0.5rem 1rem' }}>Send</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })
              })()}
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
                      <select value={newAnnouncement.cohort_id} onChange={e => setNewAnnouncement({ ...newAnnouncement, cohort_id: e.target.value })} style={inputStyle}>
                        <option value="">All Participants</option>
                        {cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
                    <button onClick={handleCreateAnnouncement} disabled={actionLoading} className="btn btn-primary" style={{ fontSize: '0.85rem', alignSelf: 'flex-start' }}>
                      {actionLoading ? 'Posting...' : 'Post Announcement'}
                    </button>
                  </div>
                </div>
              )}
              {announcements.length === 0 && !showAnnouncementForm && (
                <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem' }}>
                  <p style={{ color: 'var(--slate)', fontSize: '0.88rem' }}>No announcements yet.</p>
                </div>
              )}
              {announcements.map(ann => (
                <div key={ann.id} style={{ ...cardStyle, borderLeft: '4px solid var(--gold)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <div>
                      <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em' }}>{ann.title}</h3>
                      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', color: 'var(--gold)', textTransform: 'uppercase' }}>{new Date(ann.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                        <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', color: 'var(--slate)' }}>{(ann.cohorts as any)?.name || 'All Participants'}</span>
                      </div>
                    </div>
                    <button onClick={() => handleDeleteAnnouncement(ann.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,59,48,0.5)', fontSize: '0.75rem', cursor: 'pointer' }}>Delete</button>
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
                      <select value={newResource.portal_type} onChange={e => setNewResource({ ...newResource, portal_type: e.target.value, program_id: '' })} style={inputStyle}>
                        <option value="impact">Impact Lab</option>
                        <option value="coaching">Coaching Portal</option>
                        <option value="both">Both Portals</option>
                      </select>
                    </div>
                    <div style={{ opacity: newResource.portal_type === 'coaching' ? 0.4 : 1, pointerEvents: newResource.portal_type === 'coaching' ? 'none' : 'auto' }}>
                      <label style={labelStyle}>
                        Program
                        {newResource.portal_type === 'coaching' && <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.65rem', color: 'var(--slate)', textTransform: 'none', letterSpacing: 0, fontWeight: 400, marginLeft: '0.5rem' }}>not applicable for coaching</span>}
                      </label>
                      <select
                        value={newResource.program_id}
                        onChange={e => setNewResource({ ...newResource, program_id: e.target.value })}
                        disabled={newResource.portal_type === 'coaching'}
                        style={inputStyle}
                      >
                        <option value="">All Impact Lab programs</option>
                        {programs.filter(p => p.type === 'cohort').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Topic</label>
                      <input value={newResource.topic} onChange={e => setNewResource({ ...newResource, topic: e.target.value })} placeholder="e.g. Session recordings" style={inputStyle} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>Description</label>
                      <input value={newResource.description} onChange={e => setNewResource({ ...newResource, description: e.target.value })} placeholder="Brief description" style={inputStyle} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>File Upload <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.65rem', color: 'var(--slate)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>upload a file from your computer</span></label>
                      <input
                        type="file"
                        id="resource-file"
                        accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.mp4,.mov,.mp3,.png,.jpg,.jpeg"
                        style={{ ...inputStyle, padding: '0.5rem 1rem', cursor: 'pointer' }}
                        onChange={async e => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          setActionLoading(true)
                          const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`
                          const { data, error } = await supabase.storage.from('resources').upload(fileName, file)
                          if (!error && data) {
                            const { data: urlData } = supabase.storage.from('resources').getPublicUrl(fileName)
                            setNewResource({ ...newResource, url: urlData.publicUrl })
                            showSuccess(`File uploaded: ${file.name}`)
                          } else {
                            showSuccess('Upload failed. Try again.')
                          }
                          setActionLoading(false)
                        }}
                      />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>Or paste a URL <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.65rem', color: 'var(--slate)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>link to an external resource</span></label>
                      <input value={newResource.url} onChange={e => setNewResource({ ...newResource, url: e.target.value })} placeholder="https://..." style={inputStyle} />
                    </div>
                    {newResource.url && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <div style={{ background: 'rgba(200,136,32,0.06)', border: '1px solid rgba(200,136,32,0.2)', borderRadius: '4px', padding: '0.75rem 1rem', fontSize: '0.82rem', color: 'var(--slate)' }}>
                          Ready to save: <a href={newResource.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold)', wordBreak: 'break-all' }}>{newResource.url}</a>
                        </div>
                      </div>
                    )}
                  </div>
                  <button onClick={handleCreateResource} disabled={actionLoading} className="btn btn-primary" style={{ fontSize: '0.85rem', marginTop: '1rem' }}>
                    {actionLoading ? 'Adding...' : 'Add Resource'}
                  </button>
                </div>
              )}
              {resources.length === 0 && !showResourceForm && (
                <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem' }}>
                  <p style={{ color: 'var(--slate)', fontSize: '0.88rem', marginBottom: '1rem' }}>No resources yet.</p>
                  <button onClick={() => setShowResourceForm(true)} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>+ Add Resource</button>
                </div>
              )}
              <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
                {resources.length > 0 && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr>{['Title', 'Type', 'Program', 'Portal', 'Actions'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
                      <tbody>
                        {resources.map(r => (
                          <tr key={r.id}>
                            <td style={tdStyle}><span style={{ fontWeight: 600, color: 'var(--navy)' }}>{r.title}</span>{r.description && <span style={{ display: 'block', color: 'var(--slate)', fontSize: '0.75rem' }}>{r.description}</span>}</td>
                            <td style={tdStyle}><span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.65rem', color: 'var(--slate)', textTransform: 'uppercase' }}>{r.type}</span></td>
                            <td style={tdStyle}>{(r.programs as any)?.name || 'All'}</td>
                            <td style={tdStyle}><span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.65rem', color: 'var(--gold)', textTransform: 'uppercase' }}>{r.portal_type}</span></td>
                            <td style={tdStyle}><button onClick={() => handleDeleteResource(r.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,59,48,0.6)', fontSize: '0.75rem', cursor: 'pointer' }}>Remove</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ATTENDANCE */}
          {page === 'attendance' && (
            <div>
              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Attendance</span>
              <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '1.5rem' }}>Session Attendance</h1>
              {activeCohorts.length === 0 ? (
                <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem' }}>
                  <p style={{ color: 'var(--slate)', fontSize: '0.88rem' }}>No active cohorts. Create and activate a cohort first.</p>
                </div>
              ) : activeCohorts.map(cohort => {
                const cohortEnrollments = enrollments.filter(e => e.cohort_id === cohort.id && e.status === 'active')
                return (
                  <div key={cohort.id} style={cardStyle}>
                    <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>{cohort.name}</h3>
                    <p style={{ color: 'var(--slate)', fontSize: '0.82rem', marginBottom: '1.25rem' }}>{cohortEnrollments.length} participants enrolled</p>
                    {cohortEnrollments.length === 0 ? (
                      <p style={{ color: 'var(--slate)', fontSize: '0.85rem' }}>No participants enrolled in this cohort yet.</p>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr>
                              <th style={thStyle}>Participant</th>
                              <th style={thStyle}>Status</th>
                              <th style={thStyle}>Enrolled</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cohortEnrollments.map(e => (
                              <tr key={e.id}>
                                <td style={tdStyle}>
                                  <span style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.85rem' }}>{(e.profiles as any)?.full_name || 'Unknown'}</span>
                                  <span style={{ display: 'block', color: 'var(--slate)', fontSize: '0.75rem' }}>{(e.profiles as any)?.email}</span>
                                </td>
                                <td style={tdStyle}>{statusBadge(e.status)}</td>
                                <td style={tdStyle}><span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.65rem', color: 'var(--slate)' }}>{new Date(e.enrolled_at).toLocaleDateString()}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )
              })}
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
                    <select id="cert-user" style={inputStyle}>
                      <option value="">Select participant...</option>
                      {users.filter(u => u.role === 'impact_participant').map(u => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Program</label>
                    <select id="cert-program" style={inputStyle}>
                      <option value="">Select program...</option>
                      {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                </div>
                <button onClick={() => {
                  const userId = (document.getElementById('cert-user') as HTMLSelectElement)?.value
                  const programId = (document.getElementById('cert-program') as HTMLSelectElement)?.value
                  if (userId && programId) handleIssueCertificate(userId, programId)
                }} disabled={actionLoading} className="btn btn-primary" style={{ fontSize: '0.85rem', marginTop: '1rem' }}>
                  {actionLoading ? 'Issuing...' : 'Issue Certificate'}
                </button>
              </div>
              {certificates.length > 0 && (
                <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr>{['Participant', 'Program', 'Issued'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
                      <tbody>
                        {certificates.map(c => (
                          <tr key={c.id}>
                            <td style={tdStyle}><span style={{ fontWeight: 600, color: 'var(--navy)' }}>{(c.profiles as any)?.full_name || (c.profiles as any)?.email || 'Unknown'}</span></td>
                            <td style={tdStyle}>{(c.programs as any)?.name || 'Unknown'}</td>
                            <td style={tdStyle}><span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.65rem', color: 'var(--slate)' }}>{new Date(c.issued_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {certificates.length === 0 && <div style={{ ...cardStyle, textAlign: 'center', padding: '2rem' }}><p style={{ color: 'var(--slate)', fontSize: '0.88rem' }}>No certificates issued yet.</p></div>}
            </div>
          )}

          {/* REPORTS */}
          {page === 'reports' && (
            <div>
              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Reports</span>
              <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '1.5rem' }}>Program Reports</h1>
              <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                {[
                  { label: 'Total Users', value: String(users.length), sub: 'All accounts' },
                  { label: 'Active Cohorts', value: String(activeCohorts.length), sub: 'Currently running' },
                  { label: 'Certificates Issued', value: String(certificates.length), sub: 'All time' },
                ].map(({ label, value, sub }) => (
                  <div key={label} style={{ ...cardStyle, marginBottom: 0 }}>
                    <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.55rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '0.5rem' }}>{label}</span>
                    <div style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '2.5rem', color: 'var(--navy)', letterSpacing: '0.04em', lineHeight: 1, marginBottom: '0.25rem' }}>{value}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--slate)' }}>{sub}</div>
                  </div>
                ))}
              </div>
              <div style={cardStyle}>
                <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1rem' }}>Enrollment by Cohort</h3>
                {cohorts.length === 0 && <p style={{ color: 'var(--slate)', fontSize: '0.85rem' }}>No cohorts yet.</p>}
                {cohorts.map(c => {
                  const count = enrollments.filter(e => e.cohort_id === c.id && e.status === 'active').length
                  const max = 25
                  return (
                    <div key={c.id} style={{ marginBottom: '1.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <span style={{ color: 'var(--navy)', fontWeight: 600, fontSize: '0.88rem' }}>{c.name}</span>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                          {statusBadge(c.status)}
                          <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: 'var(--gold)' }}>{count} enrolled</span>
                        </div>
                      </div>
                      <div style={{ height: '8px', background: 'var(--mist)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min((count / max) * 100, 100)}%`, background: 'var(--gold)', borderRadius: '4px' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={cardStyle}>
                <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1rem' }}>Users by Role</h3>
                {[
                  { label: 'Impact Lab Participants', count: impactUsers.length, color: 'var(--navy)' },
                  { label: 'Coaching Clients', count: coachingUsers.length, color: 'var(--gold)' },
                  { label: 'Admins', count: users.filter(u => u.role === 'admin').length, color: 'var(--slate)' },
                ].map(({ label, count, color }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderBottom: '1px solid var(--mist)' }}>
                    <span style={{ color: 'var(--ink)', fontSize: '0.88rem' }}>{label}</span>
                    <span style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.5rem', color, letterSpacing: '0.04em' }}>{count}</span>
                  </div>
                ))}
              </div>
              <div style={cardStyle}>
                <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1rem' }}>Weekly Reps</h3>
                {reps.length === 0 && <p style={{ color: 'var(--slate)', fontSize: '0.85rem' }}>No weekly reps yet.</p>}
                {reps.map(r => (
                  <div key={r.id} style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--mist)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <span style={{ color: 'var(--navy)', fontWeight: 500, fontSize: '0.85rem' }}>Week {r.week_number} — {r.title}</span>
                      <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: 'var(--slate)' }}>{(r.cohorts as any)?.name}</span>
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