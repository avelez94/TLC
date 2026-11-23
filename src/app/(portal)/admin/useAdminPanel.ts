import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { STORAGE_PREFIX } from '@/lib/resource-links'
import { friendlyError, type DbError } from '@/lib/admin-errors'
import type { Profile, Program, Cohort, WeeklyRep, Announcement, Resource, Certificate, CohortEnrollment, JournalPrompt } from '@/types'
import { useFeedback } from './components/feedback'

// Every cohorts column except zoom_link, which signed-in users cannot read directly.
const COHORT_COLUMNS = 'id, program_id, name, start_date, end_date, status, created_at, session_day, session_time, includes, expectations, book_title, book_image_url, book_purchase_url, description, capacity'

export interface AdminIdentity { id: string; name: string; email: string | null }
export interface AdminPanelOptions { me: AdminIdentity; checkoutEnabled: boolean }

export interface InquiryLite { id: string; status: string; follow_up_on: string | null; kind: string }
export interface RegistrationRow {
  id: string; full_name: string; email: string; phone: string | null; organization: string | null; why: string | null
  program_id: string | null; cohort_id: string | null; status: string; payment_status: string | null; amount_paid: number | null
  created_at: string; confirmation_email_sent_at?: string | null; owner_notified_at?: string | null
  programs?: { name: string; price_label: string | null } | null; cohorts?: { name: string } | null
}
export interface CommunityCommentRow { id: string; post_id: string; user_id: string; body: string; created_at: string; profiles?: { full_name: string | null; role: string } | null }
export interface CommunityPostRow {
  id: string; cohort_id: string; user_id: string; body: string; created_at: string
  profiles?: { full_name: string | null; role: string } | null; cohorts?: { name: string } | null
  community_likes?: { user_id: string }[]; community_comments?: CommunityCommentRow[]
}
export interface CohortSession { id: string; cohort_id: string; session_number: number; title: string; session_date: string | null }
export interface RepInput { cohort_id: string; week_number: string; title: string; instructions: string; why_it_matters: string; due_date: string }
export interface InviteInput { email: string; full_name: string; role: string; program_id: string; cohort_id: string }

export function useAdminPanel({ me, checkoutEnabled }: AdminPanelOptions) {
  const { notify, confirm } = useFeedback()
  const [loading, setLoading] = useState(true)       // first load only: the page shows "Loading…"
  const [refreshing, setRefreshing] = useState(false) // later refreshes keep the page (and open sections) in place
  const loadedOnce = useRef(false)

  const [users, setUsers] = useState<Profile[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [reps, setReps] = useState<WeeklyRep[]>([])
  const [reflectionCounts, setReflectionCounts] = useState<Record<string, number>>({})
  const [journalPrompts, setJournalPrompts] = useState<JournalPrompt[]>([])
  const [communityPosts, setCommunityPosts] = useState<CommunityPostRow[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [enrollments, setEnrollments] = useState<CohortEnrollment[]>([])
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([])
  const [inquiries, setInquiries] = useState<InquiryLite[]>([])
  const [cohortSessions, setCohortSessions] = useState<CohortSession[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  const ok = useCallback((msg: string) => notify('success', msg), [notify])
  const fail = useCallback((msg: string) => notify('error', msg), [notify])

  // Successful changes are recorded by the database itself. Failed or blocked attempts are
  // recorded here (best effort) so the activity log shows them too.
  const logFailure = useCallback(async (action: string, entityType: string, entityId: string | null, label: string | null, error: string) => {
    await supabase.from('admin_audit_log').insert({
      actor_id: me.id, action, entity_type: entityType, entity_id: entityId, entity_label: label?.slice(0, 200) ?? null,
      outcome: 'failed', details: { error: error.slice(0, 300) },
    })
  }, [me.id])
  /** Events that are not table changes (two-step verification). */
  const logEvent = useCallback(async (action: string, entityType: string, entityId: string | null, label: string | null = null) => {
    await supabase.from('admin_audit_log').insert({ actor_id: me.id, action, entity_type: entityType, entity_id: entityId, entity_label: label, outcome: 'success', details: {} })
  }, [me.id])

  const fetchAll = useCallback(async () => {
    if (loadedOnce.current) setRefreshing(true)
    const [
      usersRes, programsRes, cohortsRes, repsRes, promptsRes, postsRes, annRes, resRes, certsRes, enrRes, linksRes, regRes, sessRes, inqRes, countsRes,
    ] = await Promise.all([
      // Full user records (contact details, last sign-in) come from an admin-only route.
      fetch('/api/admin/users').then(r => r.ok ? r.json() : null).then(d => ({ data: d?.users as Profile[] | undefined, error: d ? null : { message: 'Could not load people.' } })).catch(() => ({ data: undefined, error: { message: 'Could not load people.' } })),
      supabase.from('programs').select('*').order('name'),
      supabase.from('cohorts').select(`${COHORT_COLUMNS}, programs(name)`).order('created_at', { ascending: false }),
      supabase.from('weekly_reps').select('*, cohorts(name)').order('week_number'),
      supabase.from('journal_prompts').select('*, programs(name)').order('sort_order'),
      supabase.from('community_posts').select('*, profiles(full_name, role), cohorts(name), community_likes(user_id), community_comments(*, profiles(full_name, role))').order('created_at', { ascending: false }),
      supabase.from('announcements').select('*, cohorts(name)').order('created_at', { ascending: false }),
      supabase.from('resources').select('*, programs(name)').order('created_at', { ascending: false }),
      supabase.from('certificates').select('*, profiles(full_name), programs(name)').order('issued_at', { ascending: false }),
      supabase.from('cohort_enrollments').select('*, profiles(full_name, role), cohorts(name)').order('enrolled_at', { ascending: false }),
      supabase.rpc('cohort_meeting_links'),
      supabase.from('registrations').select('*, programs(name, price_label), cohorts(name)').order('created_at', { ascending: false }),
      supabase.from('cohort_sessions').select('*').order('session_number'),
      supabase.from('inquiries').select('id, status, follow_up_on, kind'),
      supabase.rpc('admin_rep_reflection_counts'),
    ])
    const failed = [usersRes, programsRes, cohortsRes, enrRes, regRes].find(r => r.error)
    setLoadError(failed ? friendlyError(failed.error as DbError, 'Some information could not be loaded.') : null)

    const emailById: Record<string, string | null> = {}
    if (usersRes.data) { setUsers(usersRes.data); for (const u of usersRes.data) emailById[u.id] = u.email }
    if (programsRes.data) setPrograms(programsRes.data as Program[])
    if (cohortsRes.data) {
      const links: Record<string, string> = {}
      for (const l of (linksRes.data as { cohort_id: string; zoom_link: string }[] | null) ?? []) if (l.zoom_link) links[l.cohort_id] = l.zoom_link
      setCohorts((cohortsRes.data as unknown as Cohort[]).map(c => ({ ...c, zoom_link: links[c.id] ?? null })))
    }
    if (repsRes.data) setReps(repsRes.data as WeeklyRep[])
    if (countsRes.data) setReflectionCounts(Object.fromEntries((countsRes.data as { rep_id: string; reflections: number }[]).map(r => [r.rep_id, r.reflections])))
    if (promptsRes.data) setJournalPrompts(promptsRes.data as JournalPrompt[])
    if (postsRes.data) setCommunityPosts(postsRes.data as CommunityPostRow[])
    if (annRes.data) setAnnouncements(annRes.data as Announcement[])
    if (resRes.data) setResources(resRes.data as Resource[])
    // Re-attach emails (admin-only data) to embedded profiles for display.
    const withEmail = <T extends { user_id: string; profiles?: unknown }>(rows: T[]) =>
      rows.map(r => ({ ...r, profiles: r.profiles ? { ...(r.profiles as object), email: emailById[r.user_id] ?? null } : r.profiles }))
    if (certsRes.data) setCertificates(withEmail(certsRes.data) as Certificate[])
    if (enrRes.data) setEnrollments(withEmail(enrRes.data) as CohortEnrollment[])
    if (regRes.data) setRegistrations(regRes.data as RegistrationRow[])
    if (sessRes.data) setCohortSessions(sessRes.data as CohortSession[])
    if (inqRes.data) setInquiries(inqRes.data as InquiryLite[])
    loadedOnce.current = true
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { void Promise.resolve().then(fetchAll) }, [fetchAll])

  const personName = (id: string) => users.find(u => u.id === id)?.full_name || users.find(u => u.id === id)?.email || 'this person'
  const cohortName = (id: string) => cohorts.find(c => c.id === id)?.name ?? 'this cohort'

  /** Runs a write; on failure shows the error, records it, and returns the message. */
  const run = async (
    write: () => PromiseLike<{ error: DbError | null }>,
    opts: { success?: string; action: string; entity: string; id?: string | null; label?: string | null; refresh?: boolean },
  ): Promise<string | null> => {
    let error: DbError | null = null
    try { ({ error } = await write()) } catch (e) { error = { message: e instanceof Error ? e.message : String(e) } }
    if (error) {
      const msg = friendlyError(error)
      fail(msg)
      await logFailure(opts.action, opts.entity, opts.id ?? null, opts.label ?? null, msg)
      return msg
    }
    if (opts.success) ok(opts.success)
    if (opts.refresh !== false) await fetchAll()
    return null
  }

  // ------------------------------------------------------------------ people
  const handleInvite = async (input: InviteInput): Promise<string | null> => {
    try {
      const res = await fetch('/api/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) {
        const msg = data.error || 'The invitation could not be sent.'
        fail(msg)
        return msg
      }
      const warnings: string[] = data.warnings ?? []
      if (data.returning) ok(`${input.full_name || input.email} already had an account and is now enrolled. They were emailed to sign in.`)
      else ok(`Invitation emailed to ${input.email}. They will set their own password.`)
      for (const w of warnings) fail(w)
      await fetchAll()
      return null
    } catch {
      const msg = 'The site could not reach the server. Nothing was sent; please try again.'
      fail(msg)
      return msg
    }
  }

  const handleUpdateUserRole = async (userId: string, role: string) => run(
    () => supabase.from('profiles').update({ role }).eq('id', userId),
    { success: 'Role updated.', action: 'person.update', entity: 'person', id: userId, label: personName(userId) },
  )

  const handleUpdateHourlyRate = async (userId: string, value: string): Promise<string | null> => {
    const rate = value.trim() === '' ? null : Number(value)
    if (rate !== null && (!Number.isFinite(rate) || rate < 0 || rate > 10000)) return 'Enter an amount between 0 and 10,000, or leave it empty.'
    return run(() => supabase.from('profiles').update({ hourly_rate: rate }).eq('id', userId),
      { action: 'person.update', entity: 'person', id: userId, label: personName(userId) })
  }

  const handleSendResetEmail = async (email: string) => {
    if (!email) return
    try {
      const res = await fetch('/api/request-password-reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) fail(`The reset email was not sent: ${data.error || 'server error'}`)
      else ok(`Password reset email sent to ${email}.`)
    } catch { fail('The reset email was not sent: the server could not be reached.') }
  }

  const handleSendPaymentRequest = async (user: Profile, body: Record<string, unknown>): Promise<string | null> => {
    try {
      const res = await fetch('/api/create-payment-link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: user.id, ...body }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) { fail(`The payment request was not sent: ${data.error || 'server error'}`); return null }
      ok(`Payment request sent to ${user.email}.`)
      return data.url as string
    } catch { fail('The payment request was not sent: the server could not be reached.'); return null }
  }

  // ------------------------------------------------------------------ enrollment
  const handleEnrollUser = async (userId: string, cohortId: string): Promise<string | null> => {
    if (!userId || !cohortId) return 'Choose a person and a cohort.'
    const existing = enrollments.find(e => e.user_id === userId && e.cohort_id === cohortId)
    if (existing?.status === 'active') { const m = `${personName(userId)} is already enrolled in ${cohortName(cohortId)}.`; fail(m); return m }
    return run(
      () => existing
        ? supabase.from('cohort_enrollments').update({ status: 'active' }).eq('id', existing.id)
        : supabase.from('cohort_enrollments').insert({ user_id: userId, cohort_id: cohortId, status: 'active' }),
      { success: `${personName(userId)} ${existing ? 're-enrolled in' : 'enrolled in'} ${cohortName(cohortId)}.`, action: 'enrollment.create', entity: 'enrollment', id: existing?.id, label: `${personName(userId)} — ${cohortName(cohortId)}` },
    )
  }

  const handleWithdrawEnrollment = async (enrollmentId: string) => {
    const e = enrollments.find(x => x.id === enrollmentId)
    return run(() => supabase.from('cohort_enrollments').update({ status: 'withdrawn' }).eq('id', enrollmentId),
      { success: 'Marked as withdrawn. Their history and certificates are kept.', action: 'enrollment.update', entity: 'enrollment', id: enrollmentId, label: e ? `${personName(e.user_id)} — ${cohortName(e.cohort_id)}` : null })
  }

  // ------------------------------------------------------------------ cohorts
  const handleCreateCohort = async (input: { name: string; program_id: string; start_date: string; end_date: string; zoom_link: string; status: string; capacity: string }): Promise<string | null> => {
    if (!input.name.trim()) return 'Give the cohort a name.'
    if (!input.program_id) return 'Choose the pathway this cohort belongs to.'
    if (input.start_date && input.end_date && input.end_date < input.start_date) return 'The end date is before the start date.'
    const capacity = input.capacity.trim() === '' ? null : Number(input.capacity)
    if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1 || capacity > 500)) return 'Capacity must be a whole number from 1 to 500, or empty for no limit.'
    const prog = programs.find(p => p.id === input.program_id)
    return run(() => supabase.from('cohorts').insert({
      name: input.name.trim(), program_id: input.program_id, start_date: input.start_date || null, end_date: input.end_date || null,
      zoom_link: input.zoom_link.trim() || null, status: input.status, capacity,
      session_day: prog?.session_day || null, session_time: prog?.session_time || null,
    }), { success: `Cohort "${input.name.trim()}" created.`, action: 'cohort.create', entity: 'cohort', label: input.name })
  }

  /** Auto-saved cohort fields. Returns an error message for the field's save indicator. */
  const handleUpdateCohortField = async (cohortId: string, patch: Record<string, unknown>): Promise<string | null> => {
    const c = cohorts.find(x => x.id === cohortId)
    if ('capacity' in patch && patch.capacity !== null) {
      const n = Number(patch.capacity)
      if (!Number.isInteger(n) || n < 1 || n > 500) return 'Capacity must be a whole number from 1 to 500, or empty for no limit.'
      patch = { ...patch, capacity: n }
    }
    const nextStart = ('start_date' in patch ? patch.start_date : c?.start_date) as string | null
    const nextEnd = ('end_date' in patch ? patch.end_date : c?.end_date) as string | null
    if (nextStart && nextEnd && nextEnd < nextStart) return 'The end date is before the start date.'
    if ('name' in patch && !String(patch.name).trim()) return 'The name cannot be empty.'
    let error: DbError | null = null
    try { ({ error } = await supabase.from('cohorts').update(patch).eq('id', cohortId)) } catch (e) { error = { message: String(e) } }
    if (error) {
      const msg = friendlyError(error)
      await logFailure('cohort.update', 'cohort', cohortId, c?.name ?? null, msg)
      return msg
    }
    setCohorts(prev => prev.map(x => x.id === cohortId ? { ...x, ...patch } as Cohort : x))
    return null
  }

  const handleUpdateCohortStatus = async (cohortId: string, status: string) => run(
    () => supabase.from('cohorts').update({ status }).eq('id', cohortId),
    { success: status === 'archived' ? 'Cohort archived. Its history is kept.' : 'Cohort status updated.', action: 'cohort.update', entity: 'cohort', id: cohortId, label: cohortName(cohortId) },
  )

  const cohortHasHistory = (cohortId: string) =>
    enrollments.some(e => e.cohort_id === cohortId) || registrations.some(r => r.cohort_id === cohortId) || certificates.some(c => c.cohort_id === cohortId)
    || reps.some(r => r.cohort_id === cohortId && (reflectionCounts[r.id] ?? 0) > 0)

  const handleDeleteCohort = async (cohortId: string) => {
    if (cohortHasHistory(cohortId)) {
      const m = 'This cohort has participants, registrations, certificates or reflections, so it cannot be deleted. Archive it instead to keep its history.'
      fail(m); return m
    }
    return run(() => supabase.from('cohorts').delete().eq('id', cohortId),
      { success: 'Cohort deleted.', action: 'cohort.delete', entity: 'cohort', id: cohortId, label: cohortName(cohortId) })
  }

  const handleDuplicateCohort = async (cohortId: string) => {
    const o = cohorts.find(c => c.id === cohortId)
    if (!o) return 'Cohort not found.'
    return run(() => supabase.from('cohorts').insert({
      name: `${o.name} (Copy)`, program_id: o.program_id, start_date: null, end_date: null, zoom_link: o.zoom_link || null,
      status: 'draft', capacity: o.capacity ?? null, session_day: o.session_day || null, session_time: o.session_time || null,
      description: o.description || null, includes: o.includes || null, expectations: o.expectations || null,
      book_title: o.book_title || null, book_image_url: o.book_image_url || null, book_purchase_url: o.book_purchase_url || null,
    }), { success: `Copied as "${o.name} (Copy)" (Draft, no dates). Set its dates, then generate its schedule.`, action: 'cohort.create', entity: 'cohort', label: `${o.name} (Copy)` })
  }

  // ------------------------------------------------------------------ schedule
  /** The weekly dates between the cohort's start and end on its session day. */
  const scheduleDates = (cohortId: string): { dates: string[]; problem: string | null } => {
    const c = cohorts.find(x => x.id === cohortId)
    if (!c?.start_date || !c?.end_date) return { dates: [], problem: 'Set a start date and an end date first.' }
    const day = c.session_day || programs.find(p => p.id === c.program_id)?.session_day
    if (!day) return { dates: [], problem: 'Set a session day first.' }
    const target = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(day)
    const cur = new Date(`${c.start_date}T12:00:00Z`)
    const end = new Date(`${c.end_date}T12:00:00Z`)
    while (cur.getUTCDay() !== target) cur.setUTCDate(cur.getUTCDate() + 1)
    const dates: string[] = []
    while (cur <= end) { dates.push(cur.toISOString().slice(0, 10)); cur.setUTCDate(cur.getUTCDate() + 7) }
    return { dates, problem: dates.length ? null : `No ${day}s fall between those dates.` }
  }

  const handleGenerateSchedule = async (cohortId: string): Promise<string | null> => {
    const { dates, problem } = scheduleDates(cohortId)
    if (problem) { fail(problem); return problem }
    const del = await supabase.from('cohort_sessions').delete().eq('cohort_id', cohortId)
    if (del.error) { const m = friendlyError(del.error); fail(`The schedule was not replaced: ${m}`); await logFailure('session.delete', 'session', null, cohortName(cohortId), m); return m }
    return run(() => supabase.from('cohort_sessions').insert(dates.map((d, i) => ({ cohort_id: cohortId, session_number: i + 1, title: `Session ${i + 1}`, session_date: d }))),
      { success: `Schedule created: ${dates.length} weekly sessions.`, action: 'session.create', entity: 'session', label: cohortName(cohortId) })
  }

  const handleAddSession = async (cohortId: string, input: { session_number: string; title: string; session_date: string }): Promise<string | null> => {
    if (!input.title.trim()) return 'Give the session a title.'
    const n = parseInt(input.session_number, 10)
    if (!Number.isInteger(n) || n < 1) return 'Enter the session number (1, 2, 3…).'
    return run(() => supabase.from('cohort_sessions').insert({ cohort_id: cohortId, session_number: n, title: input.title.trim(), session_date: input.session_date || null }),
      { success: 'Session added.', action: 'session.create', entity: 'session', label: cohortName(cohortId) })
  }

  const handleUpdateSession = async (id: string, patch: { title?: string; session_date?: string | null }): Promise<string | null> => {
    if (patch.title !== undefined && !patch.title.trim()) return 'The title cannot be empty.'
    const { error } = await supabase.from('cohort_sessions').update(patch).eq('id', id)
    if (error) { const m = friendlyError(error); await logFailure('session.update', 'session', id, null, m); return m }
    setCohortSessions(prev => prev.map(s => s.id === id ? { ...s, ...patch } as CohortSession : s))
    return null
  }

  const handleDeleteSession = async (id: string) => run(() => supabase.from('cohort_sessions').delete().eq('id', id),
    { success: 'Session removed.', action: 'session.delete', entity: 'session', id })

  // ------------------------------------------------------------------ weekly reps and prompts
  const validRep = (r: RepInput) => !r.cohort_id ? 'Choose a cohort.' : !r.title.trim() ? 'Give the rep a title.'
    : !(parseInt(r.week_number, 10) >= 1) ? 'Enter the week number (1, 2, 3…).' : null
  const repRow = (r: RepInput) => ({ cohort_id: r.cohort_id, week_number: parseInt(r.week_number, 10), title: r.title.trim(), instructions: r.instructions.trim() || null, why_it_matters: r.why_it_matters.trim() || null, due_date: r.due_date || null })

  const handleCreateRep = async (r: RepInput) => validRep(r) ?? run(() => supabase.from('weekly_reps').insert(repRow(r)),
    { success: 'Weekly rep added.', action: 'weekly_rep.create', entity: 'weekly_rep', label: r.title })
  const handleUpdateRep = async (id: string, r: RepInput) => validRep(r) ?? run(() => supabase.from('weekly_reps').update(repRow(r)).eq('id', id),
    { success: 'Weekly rep updated.', action: 'weekly_rep.update', entity: 'weekly_rep', id, label: r.title })

  /** Archives a rep that has reflections (they are kept); deletes one that has none. */
  const handleRemoveRep = async (id: string) => {
    const rep = reps.find(r => r.id === id)
    const { data, error } = await supabase.rpc('admin_remove_rep', { p_rep: id })
    if (error) { const m = friendlyError(error); fail(m); await logFailure('weekly_rep.delete', 'weekly_rep', id, rep?.title ?? null, m); return m }
    ok(data === 'archived' ? 'Archived. Participants’ reflections are kept, and it no longer appears as a current rep.' : 'Weekly rep deleted.')
    await fetchAll()
    return null
  }
  const handleRestoreRep = async (id: string) => run(() => supabase.from('weekly_reps').update({ archived_at: null }).eq('id', id),
    { success: 'Weekly rep restored.', action: 'weekly_rep.update', entity: 'weekly_rep', id })

  const handleCreatePrompt = async (input: { prompt: string; program_id: string; week_number: string }) => {
    if (!input.prompt.trim()) return 'Write the prompt first.'
    const sort = journalPrompts.reduce((m, p) => Math.max(m, p.sort_order), 0) + 1
    return run(() => supabase.from('journal_prompts').insert({ prompt: input.prompt.trim(), program_id: input.program_id || null, week_number: input.week_number ? parseInt(input.week_number, 10) : null, sort_order: sort }),
      { success: 'Journal prompt added.', action: 'journal_prompt.create', entity: 'journal_prompt', label: input.prompt })
  }
  const handleDeletePrompt = async (id: string) => run(() => supabase.from('journal_prompts').delete().eq('id', id),
    { success: 'Journal prompt deleted. Journal entries already written are not affected.', action: 'journal_prompt.delete', entity: 'journal_prompt', id })

  // ------------------------------------------------------------------ communications
  const handleCreateAnnouncement = async (input: { audience: string; title: string; body: string }) => {
    if (!input.audience) return 'Choose who should see this announcement.'
    if (!input.title.trim()) return 'Give the announcement a title.'
    return run(() => supabase.from('announcements').insert({ cohort_id: input.audience === 'all' ? null : input.audience, title: input.title.trim(), body: input.body.trim() || null, created_by: me.id }),
      { success: 'Announcement posted. It appears in the participant portal (no email is sent).', action: 'announcement.create', entity: 'announcement', label: input.title })
  }
  const handleDeleteAnnouncement = async (id: string) => run(() => supabase.from('announcements').delete().eq('id', id),
    { success: 'Announcement deleted.', action: 'announcement.delete', entity: 'announcement', id })

  const handleCreateCommunityPost = async (cohortId: string, body: string) => {
    if (!cohortId) return 'Choose a cohort.'
    if (!body.trim()) return 'Write a message first.'
    return run(() => supabase.from('community_posts').insert({ user_id: me.id, cohort_id: cohortId, body: body.trim() }),
      { success: 'Posted to the cohort community.', action: 'community_post.create', entity: 'community_post', label: cohortName(cohortId) })
  }
  const handleDeleteCommunityPost = async (id: string) => run(() => supabase.from('community_posts').delete().eq('id', id),
    { success: 'Post deleted.', action: 'community_post.delete', entity: 'community_post', id })
  const handleAddComment = async (postId: string, body: string) => {
    if (!body.trim()) return 'Write a comment first.'
    return run(() => supabase.from('community_comments').insert({ post_id: postId, user_id: me.id, body: body.trim() }),
      { success: 'Comment added.', action: 'community_comment.create', entity: 'community_comment' })
  }
  const handleDeleteComment = async (id: string) => run(() => supabase.from('community_comments').delete().eq('id', id),
    { success: 'Comment deleted.', action: 'community_comment.delete', entity: 'community_comment', id })

  // ------------------------------------------------------------------ resources and certificates
  const handleCreateResource = async (input: { title: string; description: string; type: string; url: string; program_id: string; cohort_id: string; topic: string; portal_type: string }) => {
    if (!input.title.trim()) return 'Give the resource a title.'
    if (!input.url.trim()) return 'Upload a file or paste a link.'
    return run(() => supabase.from('resources').insert({
      title: input.title.trim(), description: input.description.trim() || null, type: input.type, url: input.url.trim(),
      program_id: input.program_id || null, cohort_id: input.cohort_id || null, topic: input.topic.trim() || null, portal_type: input.portal_type,
    }), { success: 'Resource added.', action: 'resource.create', entity: 'resource', label: input.title })
  }
  const handleDeleteResource = async (id: string) => {
    const resource = resources.find(r => r.id === id)
    const msg = await run(() => supabase.from('resources').delete().eq('id', id),
      { action: 'resource.delete', entity: 'resource', id, label: resource?.title ?? null, refresh: false })
    if (msg) return msg
    // Remove an uploaded file too, so private files are not left behind in storage.
    if (resource?.url?.startsWith(STORAGE_PREFIX)) {
      const { error } = await supabase.storage.from('resources').remove([resource.url.slice(STORAGE_PREFIX.length)])
      if (error) fail('The resource was removed, but its file could not be deleted from storage. It is not visible to anyone.')
    }
    ok('Resource removed. Participants no longer see it.')
    await fetchAll()
    return null
  }

  const handleIssueCertificate = async (userId: string, programId: string, cohortId: string | null) => {
    if (!userId || !programId) return 'Choose a person and a pathway or program.'
    if (certificates.some(c => c.user_id === userId && c.program_id === programId && (c.cohort_id ?? null) === (cohortId ?? null))) {
      const m = `${personName(userId)} already has this certificate.`; fail(m); return m
    }
    return run(() => supabase.from('certificates').insert({ user_id: userId, program_id: programId, cohort_id: cohortId, requirements_met: {} }),
      { success: `Certificate issued to ${personName(userId)}. They can see it in their portal.`, action: 'certificate.create', entity: 'certificate', label: personName(userId) })
  }

  // ------------------------------------------------------------------ registrations (history)
  const handleUpdateRegistrationStatus = async (id: string, status: string) => {
    const r = registrations.find(x => x.id === id)
    return run(() => supabase.from('registrations').update({ status }).eq('id', id),
      { success: 'Registration updated.', action: 'registration.update', entity: 'registration', id, label: r?.full_name ?? null })
  }

  /** Confirms a registration and gives the person access (invite, or enroll a returning account). */
  const handleConfirmAndInvite = async (reg: RegistrationRow) => {
    if (!reg.cohort_id) { const m = 'This registration has no cohort, so there is nothing to enroll them in.'; fail(m); return m }
    let res: Response, data: { error?: string; returning?: boolean; warnings?: string[] }
    try {
      res = await fetch('/api/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: reg.email, full_name: reg.full_name, role: 'impact_participant', program_id: reg.program_id, cohort_id: reg.cohort_id }) })
      data = await res.json().catch(() => ({}))
    } catch { const m = 'The server could not be reached. Nothing was changed.'; fail(m); return m }
    if (!res.ok || data.error) {
      // Access was not given, so the registration is NOT marked confirmed.
      const m = `Not confirmed: ${data.error || 'the invitation failed'}. Nothing was changed.`
      fail(m); await logFailure('registration.update', 'registration', reg.id, reg.full_name, m); return m
    }
    const upd = await supabase.from('registrations').update({ status: 'confirmed' }).eq('id', reg.id)
    if (upd.error) { const m = `${reg.full_name} was enrolled, but the registration could not be marked confirmed: ${friendlyError(upd.error)}`; fail(m); await fetchAll(); return m }
    ok(data.returning ? `${reg.full_name} confirmed and enrolled (existing account; sign-in email sent).` : `${reg.full_name} confirmed and invited.`)
    for (const w of data.warnings ?? []) fail(w)
    await fetchAll()
    return null
  }

  return {
    me, checkoutEnabled, loading, refreshing, loadError,
    users, programs, cohorts, reps, reflectionCounts, journalPrompts, communityPosts, announcements, resources, certificates,
    enrollments, registrations, inquiries, cohortSessions,
    notify, confirm, ok, fail, fetchAll, logEvent, logFailure, personName, cohortName, scheduleDates, cohortHasHistory,
    handleInvite, handleUpdateUserRole, handleUpdateHourlyRate, handleSendResetEmail, handleSendPaymentRequest,
    handleEnrollUser, handleWithdrawEnrollment,
    handleCreateCohort, handleUpdateCohortField, handleUpdateCohortStatus, handleDeleteCohort, handleDuplicateCohort,
    handleGenerateSchedule, handleAddSession, handleUpdateSession, handleDeleteSession,
    handleCreateRep, handleUpdateRep, handleRemoveRep, handleRestoreRep, handleCreatePrompt, handleDeletePrompt,
    handleCreateAnnouncement, handleDeleteAnnouncement, handleCreateCommunityPost, handleDeleteCommunityPost, handleAddComment, handleDeleteComment,
    handleCreateResource, handleDeleteResource, handleIssueCertificate,
    handleUpdateRegistrationStatus, handleConfirmAndInvite,
  }
}

export type AdminPanel = ReturnType<typeof useAdminPanel>
