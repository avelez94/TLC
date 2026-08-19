import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Profile, Program, Cohort, WeeklyRep, Announcement, Resource, Certificate, CohortEnrollment, JournalPrompt } from '@/types'

export function useAdminPanel() {
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
  const [newSession, setNewSession] = useState({ cohort_id: '', session_number: '', title: '', session_date: '' })

  // UI state
  const [userFilter, setUserFilter] = useState('all')
  const [communityCohortFilter, setCommunityCohortFilter] = useState('all')
  const [repsCohortFilter, setRepsCohortFilter] = useState('all')
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
  const [editingRepId, setEditingRepId] = useState<string | null>(null)
  const [editRep, setEditRep] = useState({ cohort_id: '', week_number: '', title: '', instructions: '', why_it_matters: '', due_date: '' })
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [billingRate, setBillingRate] = useState('')
  const [billingHours, setBillingHours] = useState('')
  const [billingSessions, setBillingSessions] = useState('')
  const [billingMinutesPerSession, setBillingMinutesPerSession] = useState('')
  const [billingClientType, setBillingClientType] = useState<'new' | 'existing'>('existing')
  const [paymentLinkUrl, setPaymentLinkUrl] = useState('')
  const [paymentRequestLoading, setPaymentRequestLoading] = useState(false)
  const [resetEmailLoading, setResetEmailLoading] = useState(false)

  // Form state
  const [invite, setInvite] = useState({ email: '', full_name: '', role: 'impact_participant', program_id: '', cohort_id: '' })
  const [newCohort, setNewCohort] = useState({ name: '', program_id: '', start_date: '', end_date: '', zoom_link: '', status: 'upcoming' })
  const [newRep, setNewRep] = useState({ cohort_id: '', week_number: '', title: '', instructions: '', why_it_matters: '', due_date: '' })
  const [newPrompt, setNewPrompt] = useState({ prompt: '', program_id: '', week_number: '' })
  const [newCommunityPost, setNewCommunityPost] = useState({ cohort_id: '', body: '' })
  const [newAnnouncement, setNewAnnouncement] = useState({ cohort_id: '', title: '', body: '' })
  const [newResource, setNewResource] = useState({ title: '', description: '', type: 'pdf', url: '', program_id: '', topic: '', portal_type: 'impact' })

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
      userLoginsResult,
    ] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('programs').select('*').order('name'),
      supabase.from('cohorts').select('*, programs(name)').order('created_at', { ascending: false }),
      supabase.from('weekly_reps').select('*, cohorts(name)').order('week_number'),
      supabase.from('journal_prompts').select('*, programs(name)').order('sort_order'),
      supabase.from('community_posts').select('*, profiles(full_name, email, role), cohorts(name), community_likes(user_id), community_comments(*, profiles(full_name, role))').order('created_at', { ascending: false }),
      supabase.from('announcements').select('*, cohorts(name)').order('created_at', { ascending: false }),
      supabase.from('resources').select('*, programs(name)').order('created_at', { ascending: false }),
      supabase.from('certificates').select('*, profiles(full_name, email), programs(name)').order('issued_at', { ascending: false }),
      supabase.from('cohort_enrollments').select('*, profiles(full_name, email, role), cohorts(name)').order('enrolled_at', { ascending: false }),
      fetch('/api/admin/user-logins').then(r => r.ok ? r.json() : null).catch(() => null),
    ])
    const { data: registrationsData } = await supabase
      .from('registrations')
      .select('*, programs(name, price_label), cohorts(name)')
      .order('created_at', { ascending: false })
    const { data: cohortSessionsData } = await supabase
      .from('cohort_sessions')
      .select('*')
      .order('session_number')
    if (usersData) {
      const lastSignIns: Record<string, string | null> = userLoginsResult?.lastSignIns || {}
      setUsers(usersData.map(u => ({ ...u, last_sign_in_at: lastSignIns[u.id] ?? null })))
    }
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
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

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

  const handleUpdateRep = async (id: string) => {
    if (!editRep.title.trim() || !editRep.cohort_id) return
    setActionLoading(true)
    const { error } = await supabase.from('weekly_reps').update({
      cohort_id: editRep.cohort_id,
      week_number: parseInt(editRep.week_number) || 1,
      title: editRep.title,
      instructions: editRep.instructions || null,
      why_it_matters: editRep.why_it_matters || null,
      due_date: editRep.due_date || null,
    }).eq('id', id)
    if (!error) {
      showSuccess('Rep updated.')
      setEditingRepId(null)
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
    const isNew = billingClientType === 'new'
    const sessions = parseInt(billingSessions)
    const minutesPerSession = parseInt(billingMinutesPerSession)
    const hours = parseFloat(billingHours)
    const totalHours = isNew ? (sessions * minutesPerSession) / 60 : hours
    if (!rate || !totalHours || !user.email) return
    if (isNew && (!sessions || !minutesPerSession)) return
    if (!isNew && !hours) return
    setPaymentRequestLoading(true)
    setPaymentLinkUrl('')
    try {
      const res = await fetch('/api/create-payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          amount: Math.round(rate * totalHours * 100) / 100,
          client_type: billingClientType,
          ...(isNew ? { sessions, minutes_per_session: minutesPerSession } : { hours }),
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

  const handleSendResetEmail = async (email: string) => {
    if (!email) return
    setResetEmailLoading(true)
    try {
      const res = await fetch('/api/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (data.error) {
        showSuccess(`Failed to send reset email: ${data.error}`)
      } else {
        showSuccess(`Password reset email sent to ${email}.`)
      }
    } catch {
      showSuccess('Failed to send reset email. Please try again.')
    }
    setResetEmailLoading(false)
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

  return {
    loading,
    users, programs, cohorts, reps, journalPrompts, communityPosts, announcements, resources, certificates, enrollments, registrations, cohortSessions,
    expandedRegistration, setExpandedRegistration, registrationFilter, setRegistrationFilter,
    newSession, setNewSession,
    userFilter, setUserFilter,
    communityCohortFilter, setCommunityCohortFilter,
    repsCohortFilter, setRepsCohortFilter,
    expandedComments, commentDrafts, setCommentDrafts,
    showInviteForm, setShowInviteForm,
    showCohortForm, setShowCohortForm,
    showRepForm, setShowRepForm,
    showPromptForm, setShowPromptForm,
    showAnnouncementForm, setShowAnnouncementForm,
    showResourceForm, setShowResourceForm,
    expandedUser, setExpandedUser,
    expandedProgram, setExpandedProgram,
    expandedCohort, setExpandedCohort,
    editingRepId, setEditingRepId,
    editRep, setEditRep,
    inviteLoading, inviteSuccess, inviteError,
    actionLoading, setActionLoading,
    successMsg,
    billingRate, setBillingRate, billingHours, setBillingHours, billingSessions, setBillingSessions, billingMinutesPerSession, setBillingMinutesPerSession, billingClientType, setBillingClientType,
    paymentLinkUrl, setPaymentLinkUrl, paymentRequestLoading,
    resetEmailLoading,
    invite, setInvite,
    newCohort, setNewCohort,
    newRep, setNewRep,
    newPrompt, setNewPrompt,
    newCommunityPost, setNewCommunityPost,
    newAnnouncement, setNewAnnouncement,
    newResource, setNewResource,

    fetchAll,
    showSuccess,
    handleInvite,
    handleCreateCohort,
    handleCreateRep,
    handleUpdateRep,
    handleCreatePrompt,
    handleDeletePrompt,
    handleCreateCommunityPost,
    handleDeleteCommunityPost,
    toggleComments,
    handleDeleteComment,
    handleAddComment,
    handleCreateAnnouncement,
    handleDeleteAnnouncement,
    handleCreateResource,
    handleDeleteResource,
    handleIssueCertificate,
    handleUpdateUserRole,
    handleUpdateHourlyRate,
    handleSendPaymentRequest,
    handleSendResetEmail,
    handleUpdateCohortStatus,
    handleUpdateRegistrationStatus,
    handleGenerateSchedule,
    handleAddSession,
    handleDeleteSession,
    handleConfirmAndInvite,
  }
}

export type AdminPanel = ReturnType<typeof useAdminPanel>
