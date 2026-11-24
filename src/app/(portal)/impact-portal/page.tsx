'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { todayET } from '@/lib/business-time'
import {
  CONTACT_EMAIL, START_HERE_KEY, assignedReps, buildMemberships, certificateFor, cohortAnnouncements, cohortResources,
  cohortSessions, cohortWeek, generalAnnouncements, generalResources, initialsOf, isForParticipants, isImpactResource,
  programName, programStateLabel, visibleReps, writeErrorMessage,
} from './_components/logic'
import { AnnouncementsList, CertificateCard, ResourcesList } from './_components/ContentLists'
import { CommunityView } from './_components/CommunityView'
import { CompletedProgramDetail, CompletedProgramsList } from './_components/CompletedPrograms'
import { Dashboard } from './_components/Dashboard'
import { JournalView } from './_components/JournalView'
import { LearningHistory } from './_components/LearningHistory'
import { MobileNav, Sidebar, TopBar } from './_components/PortalNav'
import { ProgramOverview } from './_components/ProgramOverview'
import { ProgressView } from './_components/ProgressView'
import { RepsSection } from './_components/RepsSection'
import {
  cardStyle, ContactLink, EmptyState, FinishedNote, h2Style, linkButtonStyle, mutedText, Notice, PageHeader, StatusBadge, type NoticeState,
} from './_components/ui'
import type {
  AnnouncementRow, AttendanceRow, CertificateRow, CommunityTab, EnrollmentRow, JournalEntryRow, JournalPromptRow, MemberRow,
  Membership, MessageRow, Page, PostActions, PostRow, ProfileRow, Rep, ResourceRow, SessionRow, Submission,
} from './_components/types'

// Every cohorts column a participant may read (zoom_link comes from cohort_meeting_links()).
const COHORT_COLUMNS = 'id, program_id, name, start_date, end_date, status, created_at, session_day, session_time, includes, expectations, book_title, book_image_url, book_purchase_url, description, activity_open_until'
const POST_SELECT = '*, profiles(full_name), community_likes(user_id), community_comments(*, profiles(full_name, role))'
const FALLBACK_PROMPT = 'What impact did I create this week, and how did I show up?'

interface DbError { code?: string; message?: string }
interface Rows<T> { data: T[] | null; error: DbError | null }

export default function ImpactPortal() {
  const router = useRouter()
  const mainRef = useRef<HTMLElement>(null)
  const [today] = useState(todayET)
  const [page, setPage] = useState<Page>('dashboard')
  const [communityTab, setCommunityTab] = useState<CommunityTab>('posts')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadProblems, setLoadProblems] = useState<string[]>([])

  // Everything below is limited by RLS to this participant's own rows or their cohorts' content.
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reps, setReps] = useState<Rep[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([])
  const [resources, setResources] = useState<ResourceRow[]>([])
  const [certificates, setCertificates] = useState<CertificateRow[]>([])
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [attendance, setAttendance] = useState<AttendanceRow[]>([])
  const [journalEntries, setJournalEntries] = useState<JournalEntryRow[]>([])
  const [journalPrompts, setJournalPrompts] = useState<JournalPromptRow[]>([])
  const [posts, setPosts] = useState<Record<string, PostRow[]>>({})
  const [postErrors, setPostErrors] = useState<Record<string, string>>({})
  const [members, setMembers] = useState<Record<string, MemberRow[]>>({})
  const [messages, setMessages] = useState<Record<string, MessageRow[]>>({})

  const [openRepId, setOpenRepId] = useState<string | null>(null)
  const [pastOpenId, setPastOpenId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<NoticeState | null>(null)
  const [startHereDismissed, setStartHereDismissed] = useState(true)

  // ------------------------------------------------------------------ loading

  const loadPosts = useCallback(async (cohortId: string) => {
    const { data, error } = await supabase.from('community_posts').select(POST_SELECT).eq('cohort_id', cohortId).order('created_at', { ascending: false })
    if (error) {
      setPostErrors(prev => ({ ...prev, [cohortId]: 'The community posts could not be loaded.' }))
      return
    }
    setPostErrors(prev => { const next = { ...prev }; delete next[cohortId]; return next })
    setPosts(prev => ({ ...prev, [cohortId]: (data ?? []) as PostRow[] }))
  }, [])

  const loadChat = useCallback(async (cohortId: string) => {
    const { data, error } = await supabase.from('cohort_messages').select('*, profiles(full_name)').eq('cohort_id', cohortId).order('created_at', { ascending: true })
    if (!error) setMessages(prev => ({ ...prev, [cohortId]: (data ?? []) as MessageRow[] }))
  }, [])

  const loadCommunity = useCallback(async (cohortId: string) => {
    const [membersRes] = await Promise.all([
      supabase.from('cohort_enrollments').select('user_id, status, profiles(full_name)').eq('cohort_id', cohortId).in('status', ['active', 'completed']),
      loadPosts(cohortId),
      loadChat(cohortId),
    ])
    if (!membersRes.error) setMembers(prev => ({ ...prev, [cohortId]: (membersRes.data ?? []) as unknown as MemberRow[] }))
  }, [loadPosts, loadChat])

  const fetchAll = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // Enrollments with their cohorts, once; withdrawn enrollments have no access and are left out.
    const [profileRes, enrollRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, role').eq('id', user.id).single(),
      supabase.from('cohort_enrollments').select(`*, cohorts(${COHORT_COLUMNS}, programs(*))`).eq('user_id', user.id).neq('status', 'withdrawn').order('enrolled_at', { ascending: false }),
    ])
    if (profileRes.data) setProfile({ ...(profileRes.data as Omit<ProfileRow, 'email'>), email: user.email ?? null })
    const problems: string[] = []
    if (enrollRes.error) problems.push('your programs')
    const rows = ((enrollRes.data ?? []) as EnrollmentRow[]).filter(r => r.cohorts)
    const cohortIds = [...new Set(rows.map(r => r.cohort_id))]
    const programIds = [...new Set(rows.map(r => r.cohorts?.program_id).filter((id): id is string => !!id))]
    const forCohorts = <T,>(run: () => PromiseLike<Rows<T>>): PromiseLike<Rows<T>> =>
      cohortIds.length ? run() : Promise.resolve({ data: [], error: null })

    const [linksRes, repsRes, subsRes, annRes, resRes, certRes, sessRes, journalRes, promptsRes, attRes] = await Promise.all([
      forCohorts<{ cohort_id: string; zoom_link: string | null }>(() => supabase.rpc('cohort_meeting_links')),
      forCohorts<Rep>(() => supabase.from('weekly_reps').select('*').in('cohort_id', cohortIds).order('week_number')),
      supabase.from('weekly_rep_submissions').select('*').eq('user_id', user.id),
      supabase.from('announcements').select('*').order('created_at', { ascending: false }),
      supabase.from('resources').select('*').order('created_at', { ascending: false }),
      supabase.from('certificates').select('*, programs(name)').eq('user_id', user.id).order('issued_at', { ascending: false }),
      forCohorts<SessionRow>(() => supabase.from('cohort_sessions').select('*').in('cohort_id', cohortIds).order('session_number')),
      supabase.from('journal_entries').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      programIds.length
        ? supabase.from('journal_prompts').select('*').or(`program_id.is.null,program_id.in.(${programIds.join(',')})`).order('sort_order')
        : supabase.from('journal_prompts').select('*').is('program_id', null).order('sort_order'),
      supabase.from('session_attendance').select('cohort_id, session_number, attended').eq('user_id', user.id),
    ])
    const take = <T,>(res: Rows<T>, label: string | null): T[] => {
      if (res.error && label) problems.push(label)
      return (res.data ?? []) as T[]
    }
    const list = buildMemberships(rows, take(linksRes, 'the meeting link'), today)
    setMemberships(list)
    setReps(take(repsRes, 'weekly reps'))
    setSubmissions(take(subsRes as Rows<Submission>, 'your rep reflections'))
    setAnnouncements(take(annRes as Rows<AnnouncementRow>, 'announcements'))
    setResources(take(resRes as Rows<ResourceRow>, 'materials'))
    setCertificates(take(certRes as Rows<CertificateRow>, 'certificates'))
    setSessions(take(sessRes, 'the session schedule'))
    setJournalEntries(take(journalRes as Rows<JournalEntryRow>, 'your journal'))
    setJournalPrompts(take(promptsRes as Rows<JournalPromptRow>, null))
    setAttendance(take(attRes as Rows<AttendanceRow>, 'attendance'))

    const primary = list.find(m => m.isCurrent) ?? null
    setSelectedId(primary?.cohort.id ?? null)
    if (primary) await loadCommunity(primary.cohort.id)

    try { setStartHereDismissed(window.localStorage.getItem(START_HERE_KEY) === '1') } catch { setStartHereDismissed(false) }
    setLoadProblems(problems)
    setLoading(false)
  }, [router, today, loadCommunity])

  useEffect(() => { void Promise.resolve().then(fetchAll) }, [fetchAll])

  // Poll for new chat messages every 5 seconds while the Chat tab is open.
  useEffect(() => {
    if (page !== 'community' || communityTab !== 'chat' || !selectedId) return
    const cohortId = selectedId
    const interval = setInterval(() => { void loadChat(cohortId) }, 5000)
    return () => clearInterval(interval)
  }, [page, communityTab, selectedId, loadChat])

  const reloadSubmissions = async () => {
    if (!profile) return
    const { data, error } = await supabase.from('weekly_rep_submissions').select('*').eq('user_id', profile.id)
    if (!error) setSubmissions((data ?? []) as Submission[])
  }
  const reloadJournal = async () => {
    if (!profile) return
    const { data, error } = await supabase.from('journal_entries').select('*').eq('user_id', profile.id).order('created_at', { ascending: false })
    if (!error) setJournalEntries((data ?? []) as JournalEntryRow[])
  }

  // ------------------------------------------------------------------ derived

  const currentList = memberships.filter(m => m.isCurrent)
  const pastList = memberships.filter(m => !m.isCurrent)
  const current = currentList.find(m => m.cohort.id === selectedId) ?? currentList[0] ?? null
  const otherCurrent = currentList.filter(m => m !== current)
  const submissionMap = useMemo(() => new Map(submissions.map(s => [s.rep_id, s])), [submissions])
  const submittedSet = useMemo(() => new Set(submissions.map(s => s.rep_id)), [submissions])
  const repsById = useMemo(() => new Map(reps.map(r => [r.id, r])), [reps])
  const activeCertificates = certificates.filter(c => !c.revoked_at)
  const forParticipants = announcements.filter(isForParticipants)
  const impactResources = resources.filter(isImpactResource)

  const currentReps = current ? assignedReps(reps, current.cohort.id) : []
  const currentRepList = current ? visibleReps(reps, current.cohort.id, submittedSet) : []
  const currentSessions = current ? cohortSessions(sessions, current.cohort.id) : []
  const currentAnnouncements = (current
    ? [...cohortAnnouncements(forParticipants, current.cohort.id), ...generalAnnouncements(forParticipants)]
    : generalAnnouncements(forParticipants)
  ).sort((a, b) => b.created_at.localeCompare(a.created_at))
  // "From Tramaine" counts only what it says: this cohort's announcements and ones addressed to you.
  const fromTramaineCount = currentAnnouncements.filter(a => (current && a.cohort_id === current.cohort.id) || (!!profile && a.target_user_id === profile.id)).length
  const currentResources = current ? [...cohortResources(impactResources, current.cohort), ...generalResources(impactResources)] : generalResources(impactResources)

  const currentProgramIds = new Set(currentList.map(m => m.cohort.program_id))
  const canComposeJournal = currentList.length > 0
  const programLabel = (programId: string | null) => (programId ? memberships.find(m => m.cohort.program_id === programId)?.program?.name ?? null : null)
  const cohortLabel = (cohortId: string) => {
    const m = memberships.find(x => x.cohort.id === cohortId)
    return m ? `${programName(m)} · ${m.cohort.name}` : null
  }
  const certificateForMembership = (m: Membership) => certificateFor(activeCertificates, m.cohort)

  const journalPrompt = (() => {
    const pid = current?.cohort.program_id ?? null
    const scoped = journalPrompts.filter(p => p.program_id === null || p.program_id === pid)
    if (scoped.length === 0) return FALLBACK_PROMPT
    const week = cohortWeek(current?.cohort.start_date)
    const weekMatches = scoped.filter(p => p.week_number === week)
    const exact = weekMatches.find(p => p.program_id === pid) || weekMatches.find(p => p.program_id === null)
    if (exact) return exact.prompt
    const pool = scoped.filter(p => p.week_number == null)
    return pool.length ? pool[(week - 1) % pool.length].prompt : FALLBACK_PROMPT
  })()

  // ------------------------------------------------------------------ navigation

  const navigate = (p: Page) => {
    setPage(p)
    setMobileNavOpen(false)
    setOpenRepId(null)
    if (p === 'completed') setPastOpenId(null)
    window.scrollTo({ top: 0 })
    mainRef.current?.focus({ preventScroll: true })
  }
  const openRep = (repId: string) => { navigate('reps'); setOpenRepId(repId) }
  const selectCurrent = (cohortId: string) => {
    setSelectedId(cohortId)
    if (!posts[cohortId]) void loadCommunity(cohortId)
    navigate('current')
  }
  const openPast = (cohortId: string) => {
    setPastOpenId(cohortId)
    if (!posts[cohortId]) void loadPosts(cohortId)
    window.scrollTo({ top: 0 })
    mainRef.current?.focus({ preventScroll: true })
  }
  const dismissStartHere = () => {
    setStartHereDismissed(true)
    try { window.localStorage.setItem(START_HERE_KEY, '1') } catch { /* storage unavailable: hidden for this visit only */ }
  }
  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // ------------------------------------------------------------------ writes (never silent)

  const flash = (kind: NoticeState['kind'], text: string) => {
    setNotice({ kind, text })
    if (kind === 'success') setTimeout(() => setNotice(n => (n?.text === text ? null : n)), 4000)
  }

  /** Runs one write. Updates/deletes that match no row were refused by RLS: reported, not ignored. */
  const write = async (what: string, op: () => PromiseLike<{ error: DbError | null; count?: number | null }>, success?: string, expectRows = false) => {
    setBusy(true)
    try {
      const { error, count } = await op()
      if (error || (expectRows && count === 0)) {
        flash('error', writeErrorMessage(error ?? { code: '42501' }, what))
        return false
      }
      if (success) flash('success', success)
      return true
    } catch {
      flash('error', writeErrorMessage(null, what))
      return false
    } finally {
      setBusy(false)
    }
  }

  const submitRep = async (repId: string, reflection: string) => {
    if (!profile) return false
    const ok = await write('Your reflection', () => supabase.from('weekly_rep_submissions').insert({ rep_id: repId, user_id: profile.id, reflection }), 'Rep submitted.')
    await reloadSubmissions()
    return ok
  }

  const saveJournal = async (body: string) => {
    if (!profile) return false
    const ok = await write('Your journal entry', () => supabase.from('journal_entries').insert({
      user_id: profile.id, portal_type: 'impact', program_id: current?.cohort.program_id ?? null, body, prompt_used: journalPrompt,
    }), 'Entry saved.')
    if (ok) await reloadJournal()
    return ok
  }

  const editJournal = async (id: string, body: string) => {
    const ok = await write('Your changes', () => supabase.from('journal_entries').update({ body }, { count: 'exact' }).eq('id', id), 'Entry updated.', true)
    if (ok) await reloadJournal()
    return ok
  }

  const postActionsFor = (cohortId: string): PostActions => {
    const after = async (ok: boolean) => { await loadPosts(cohortId); return ok }
    return {
      create: async body => profile ? after(await write('Your post', () => supabase.from('community_posts').insert({ user_id: profile.id, cohort_id: cohortId, body }), 'Posted.')) : false,
      edit: async (postId, body) => after(await write('Your changes', () => supabase.from('community_posts').update({ body }, { count: 'exact' }).eq('id', postId), 'Post updated.', true)),
      remove: async postId => after(await write('The deletion', () => supabase.from('community_posts').delete({ count: 'exact' }).eq('id', postId), 'Post deleted.', true)),
      like: async (postId, liked) => profile ? after(await (liked
        ? write('Your like', () => supabase.from('community_likes').delete({ count: 'exact' }).eq('post_id', postId).eq('user_id', profile.id), undefined, true)
        : write('Your like', () => supabase.from('community_likes').insert({ post_id: postId, user_id: profile.id })))) : false,
      comment: async (postId, body) => profile ? after(await write('Your comment', () => supabase.from('community_comments').insert({ post_id: postId, user_id: profile.id, body }))) : false,
    }
  }

  const sendMessage = async (content: string) => {
    if (!profile || !current) return false
    const cohortId = current.cohort.id
    const ok = await write('Your message', () => supabase.from('cohort_messages').insert({ cohort_id: cohortId, user_id: profile.id, content }))
    if (ok) await loadChat(cohortId)
    return ok
  }

  // ------------------------------------------------------------------ render

  if (loading) return (
    <div role="status" style={{ minHeight: '100vh', background: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.5rem', color: 'var(--navy)', letterSpacing: '0.08em' }}>Loading your portal...</div>
    </div>
  )

  const firstName = profile?.full_name?.split(' ')[0] || 'there'
  const initials = initialsOf(profile?.full_name)
  const pastOpen = pastOpenId ? pastList.find(m => m.cohort.id === pastOpenId) ?? null : null
  const notEnrolled = (eyebrow: string, title: string, text: string) => (
    <NotEnrolled eyebrow={eyebrow} title={title} text={text} hasPast={pastList.length > 0} onNavigate={navigate} />
  )

  return (
    <div className="ip-portal" style={{ minHeight: '100vh', fontFamily: 'var(--font-montserrat), sans-serif', background: 'var(--paper)' }}>
      <a href="#ip-main" className="ip-skip">Skip to content</a>
      <TopBar initials={initials} mobileOpen={mobileNavOpen} onToggle={() => setMobileNavOpen(o => !o)} />
      {mobileNavOpen && <MobileNav page={page} onNavigate={navigate} onSignOut={handleSignOut} />}

      <div style={{ display: 'flex', paddingTop: '64px', minHeight: '100vh' }}>
        <div className="desktop-sidebar">
          <Sidebar page={page} onNavigate={navigate} name={profile?.full_name || 'Participant'} subtitle={current ? programName(current) : 'Impact Lab'} initials={initials} onSignOut={handleSignOut} />
        </div>
        <main id="ip-main" ref={mainRef} tabIndex={-1} style={{ flex: 1, padding: 'clamp(1rem, 3vw, 2rem)', minWidth: 0, outline: 'none' }}>
          {loadProblems.length > 0 && (
            <div role="alert" style={{ ...cardStyle, borderLeft: '4px solid #8E1F1F', padding: '1rem 1.25rem' }}>
              <p style={{ color: 'var(--ink)', fontSize: '0.85rem', lineHeight: 1.6 }}>
                <strong>Some of your portal could not be loaded</strong> ({loadProblems.join(', ')}). Refresh the page; if it keeps happening, email Tramaine at <ContactLink />.
              </p>
            </div>
          )}
          <Notice notice={notice} onDismiss={() => setNotice(null)} />

          {page === 'dashboard' && (
            <Dashboard
              firstName={firstName}
              current={current}
              otherCurrent={otherCurrent}
              pastCount={pastList.length}
              certificateCount={activeCertificates.length}
              reps={currentReps}
              submissions={submissionMap}
              sessions={currentSessions}
              announcementCount={fromTramaineCount}
              today={today}
              showStartHere={!!current && submissions.length === 0 && !startHereDismissed}
              onDismissStartHere={dismissStartHere}
              navigate={navigate}
              openRep={openRep}
              selectCurrent={selectCurrent}
            />
          )}

          {page === 'current' && (current ? (
            <div>
              <PageHeader eyebrow="My Current Program" title={current.cohort.name} intro={<>{programName(current)} — <strong>{programStateLabel(current, today)}</strong></>} />
              <ProgramOverview membership={current} sessions={currentSessions} attendance={attendance} today={today} />
              {otherCurrent.length > 0 && (
                <section aria-labelledby="other-current" style={cardStyle}>
                  <h2 id="other-current" style={h2Style}>Your other current programs</h2>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {otherCurrent.map(m => (
                      <li key={m.cohort.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', padding: '0.5rem 0', borderBottom: '1px solid var(--mist)' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--ink)' }}><strong>{programName(m)}</strong> · {m.cohort.name} <StatusBadge kind="info">{programStateLabel(m, today)}</StatusBadge></span>
                        <button type="button" onClick={() => selectCurrent(m.cohort.id)} style={linkButtonStyle}>Switch to this program</button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          ) : notEnrolled('My Current Program', 'No current program', 'You are not enrolled in a program that is running or about to start.'))}

          {page === 'reps' && (current ? (
            <div>
              <PageHeader eyebrow="Weekly Reps" title="Your Reps" intro="Weekly reps are the bridge between sessions and real life. Do the rep. Reflect on what happened. Bring it back to the group." />
              <FinishedNote membership={current} />
              {currentReps.length > 0 && (
                <p style={{ ...mutedText, marginBottom: '1rem' }}>{programName(current)} · {current.cohort.name}: {currentReps.filter(r => submittedSet.has(r.id)).length} of {currentReps.length} submitted.</p>
              )}
              <RepsSection
                key={`${current.cohort.id}-${openRepId ?? ''}`}
                membership={current}
                reps={currentRepList}
                submissions={submissionMap}
                today={today}
                onSubmit={submitRep}
                busy={busy}
                initialOpenId={openRepId}
                emptyText="No weekly reps yet. Tramaine posts each rep during the program — check back after your next session."
              />
            </div>
          ) : notEnrolled('Weekly Reps', 'Your Reps', 'Weekly reps appear here while you are in a current program. Reps you submitted in past programs are in My Completed Programs and My Learning History.'))}

          {page === 'journal' && (
            <JournalView
              entries={journalEntries}
              prompt={journalPrompt}
              canCompose={canComposeJournal}
              isEditable={e => canComposeJournal && (e.program_id === null || currentProgramIds.has(e.program_id))}
              programLabel={programLabel}
              onSave={saveJournal}
              onEdit={editJournal}
              busy={busy}
              onOpenHistory={() => navigate('history')}
            />
          )}

          {page === 'community' && (current ? (
            <CommunityView
              membership={current}
              tab={communityTab}
              onTab={setCommunityTab}
              posts={posts[current.cohort.id] ?? []}
              members={members[current.cohort.id] ?? []}
              messages={messages[current.cohort.id] ?? []}
              profileId={profile?.id ?? null}
              postActions={postActionsFor(current.cohort.id)}
              onSendMessage={sendMessage}
              busy={busy}
            />
          ) : notEnrolled('Community', 'Cohort Community', 'The community opens while you are in a current program. Posts from your past programs are kept in My Completed Programs.'))}

          {page === 'announcements' && (
            <div>
              <PageHeader eyebrow="Announcements" title="Announcements" intro={current ? undefined : 'Announcements for your past cohorts are kept in My Completed Programs.'} />
              {currentAnnouncements.length === 0
                ? <EmptyState>No announcements yet. Updates from Tramaine will appear here.</EmptyState>
                : <AnnouncementsList items={currentAnnouncements} profileId={profile?.id ?? null} />}
            </div>
          )}

          {page === 'library' && (
            <div>
              <PageHeader eyebrow="Resource Library" title="Library" intro={current ? undefined : 'Materials from your past programs are kept in My Completed Programs.'} />
              {currentResources.length === 0
                ? <EmptyState>No materials yet. Tramaine adds readings and handouts here as the program goes. Questions? Email <ContactLink />.</EmptyState>
                : <ResourcesList resources={currentResources} />}
            </div>
          )}

          {page === 'progress' && (
            <ProgressView current={current} reps={currentReps} submissions={submissionMap} attendance={attendance} journalCount={journalEntries.length} today={today} onOpenRep={openRep} />
          )}

          {page === 'completed' && (pastOpen ? (
            <CompletedProgramDetail
              key={pastOpen.cohort.id}
              membership={pastOpen}
              sessions={cohortSessions(sessions, pastOpen.cohort.id)}
              attendance={attendance}
              reps={visibleReps(reps, pastOpen.cohort.id, submittedSet)}
              submissions={submissionMap}
              resources={cohortResources(impactResources, pastOpen.cohort)}
              announcements={cohortAnnouncements(forParticipants, pastOpen.cohort.id)}
              certificate={certificateForMembership(pastOpen)}
              posts={posts[pastOpen.cohort.id]}
              postsError={postErrors[pastOpen.cohort.id] ?? null}
              postActions={postActionsFor(pastOpen.cohort.id)}
              profileId={profile?.id ?? null}
              busy={busy}
              today={today}
              onSubmitRep={submitRep}
              onBack={() => navigate('completed')}
              onRetryPosts={() => void loadPosts(pastOpen.cohort.id)}
            />
          ) : (
            <CompletedProgramsList past={pastList} certificateFor={certificateForMembership} today={today} onOpen={openPast} />
          ))}

          {page === 'certificates' && (
            <div>
              <PageHeader eyebrow="History" title="My Certificates" />
              {activeCertificates.length === 0 ? (
                <EmptyState>
                  <p>Certificates appear here after Tramaine records your completion and issues one.</p>
                  <p style={{ marginTop: '0.5rem' }}>Questions about a certificate? Email <ContactLink />.</p>
                </EmptyState>
              ) : activeCertificates.map(cert => <CertificateCard key={cert.id} cert={cert} />)}
            </div>
          )}

          {page === 'history' && (
            <LearningHistory
              entries={journalEntries}
              submissions={submissions}
              repsById={repsById}
              programLabel={programLabel}
              cohortLabel={cohortLabel}
              onOpenJournal={() => navigate('journal')}
            />
          )}

          {page === 'profile' && (
            <div>
              <PageHeader eyebrow="Profile" title="Your Profile" />
              <section aria-labelledby="profile-name" style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                  <div aria-hidden="true" style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--navy)', fontWeight: 700, fontSize: '1.25rem' }}>{initials}</div>
                  <div style={{ minWidth: 0 }}>
                    <h2 id="profile-name" style={{ ...h2Style, fontSize: '1.25rem', marginBottom: 0 }}>{profile?.full_name || 'Participant'}</h2>
                    <span style={{ color: 'var(--slate)', fontSize: '0.82rem' }}>{current ? `${programName(current)} participant` : 'Impact Lab participant'}</span>
                  </div>
                </div>
                <dl style={{ margin: 0 }}>
                  {[
                    { label: 'Full Name', value: profile?.full_name },
                    { label: 'Email', value: profile?.email },
                    { label: 'Current Program', value: current ? programName(current) : null },
                    { label: 'Cohort', value: current?.cohort.name },
                    { label: 'Completed Programs', value: pastList.length ? String(pastList.length) : null },
                  ].map(({ label, value }) => value ? (
                    <div key={label} style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--mist)', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                      <dt style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--gold)' }}>{label}</dt>
                      <dd style={{ color: 'var(--ink)', fontSize: '0.88rem', fontWeight: 500, margin: 0, minWidth: 0 }}>{value}</dd>
                    </div>
                  ) : null)}
                </dl>
                <p style={{ ...mutedText, marginTop: '1rem' }}>To change your name or email, contact Tramaine at <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--gold)', fontWeight: 600 }}>{CONTACT_EMAIL}</a>.</p>
              </section>
              <button type="button" onClick={handleSignOut} className="btn btn-ghost-dark" style={{ fontSize: '0.85rem', marginTop: '1rem' }}>Sign Out</button>
            </div>
          )}
        </main>
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
        .ip-portal input:focus, .ip-portal textarea:focus, .ip-portal select:focus { border-color: var(--gold) !important; box-shadow: 0 0 0 3px rgba(200,136,32,0.25); }
        .ip-portal button:focus-visible, .ip-portal a:focus-visible { outline: 3px solid var(--gold); outline-offset: 2px; }
        .ip-portal .ip-nav-item:focus-visible { outline-offset: -3px; }
        .ip-portal main:focus, .ip-portal main:focus-visible { outline: none; }
        .ip-portal .btn { min-height: 44px; white-space: normal; text-align: center; justify-content: center; }
        .ip-portal button:disabled { cursor: not-allowed; opacity: 0.6; }
        .ip-portal p, .ip-portal li, .ip-portal h1, .ip-portal h2, .ip-portal h3, .ip-portal dd { overflow-wrap: anywhere; }
        .ip-skip { position: absolute; left: -9999px; top: 0; }
        .ip-skip:focus { left: 1rem; top: 0.5rem; z-index: 300; background: var(--gold); color: var(--navy); padding: 0.75rem 1rem; font-weight: 700; }
      `}</style>
    </div>
  )
}

/** Shown on current-program pages when the participant has no current program. */
function NotEnrolled({ eyebrow, title, text, hasPast, onNavigate }: { eyebrow: string; title: string; text: string; hasPast: boolean; onNavigate: (p: Page) => void }) {
  return (
    <div>
      <PageHeader eyebrow={eyebrow} title={title} />
      <div style={cardStyle}>
        <p style={{ ...mutedText, marginBottom: '0.75rem' }}>{text}</p>
        <p style={{ ...mutedText, marginBottom: '1rem' }}>
          To join another program, see the upcoming cohorts on the <Link href="/impact" style={{ color: 'var(--gold)', fontWeight: 600 }}>Impact Lab page</Link> or email Tramaine at <ContactLink />.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {hasPast && <button type="button" onClick={() => onNavigate('completed')} className="btn btn-ghost-dark" style={{ fontSize: '0.8rem', padding: '0.65rem 1.25rem' }}>My Completed Programs</button>}
          <button type="button" onClick={() => onNavigate('certificates')} className="btn btn-ghost-dark" style={{ fontSize: '0.8rem', padding: '0.65rem 1.25rem' }}>My Certificates</button>
        </div>
      </div>
    </div>
  )
}
