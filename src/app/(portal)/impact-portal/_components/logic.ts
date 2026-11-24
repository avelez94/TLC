// Pure rules for the participant portal. The access rules mirror the database
// (supabase/migrations/20261124000000_workflow_integration.sql) so the screen never offers
// an action the database will refuse.
import { BUSINESS_TZ, daysFromTodayET, formatDateET } from '@/lib/business-time'
import type {
  AnnouncementRow, CertificateRow, CohortRow, EnrollmentRow, Membership, Rep, ResourceRow, SessionRow,
} from './types'

export const CONTACT_EMAIL = 'tramaine@tramainecrawford.com'
export const START_HERE_KEY = 'impact-portal:start-here-dismissed'

/** Cohort statuses in which an active member can still take part. */
const OPEN_STATUSES = ['upcoming', 'active']
/** Cohort statuses that mean the program has ended. */
const FINISHED_STATUSES = ['completed', 'archived', 'cancelled']

export function reopenedUntil(cohort: CohortRow, today: string): string | null {
  const until = cohort.activity_open_until
  return until && until >= today ? until : null
}

/** app_private.can_participate: active enrollment AND (cohort upcoming/active OR reopened). */
export function canWriteIn(enrollmentStatus: string, cohort: CohortRow, today: string): boolean {
  return enrollmentStatus === 'active' && (OPEN_STATUSES.includes(cohort.status) || reopenedUntil(cohort, today) !== null)
}

export function buildMemberships(rows: EnrollmentRow[], links: { cohort_id: string; zoom_link: string | null }[], today: string): Membership[] {
  const list: Membership[] = []
  for (const e of rows) {
    const c = e.cohorts
    if (!c || e.status === 'withdrawn') continue
    const isCurrent = e.status === 'active' && !FINISHED_STATUSES.includes(c.status)
    list.push({
      enrollmentId: e.id,
      enrollmentStatus: e.status,
      completedAt: e.completed_at ?? null,
      cohort: c,
      program: c.programs,
      isCurrent,
      canWrite: canWriteIn(e.status, c, today),
      reopenedUntil: isCurrent ? null : (e.status === 'active' ? reopenedUntil(c, today) : null),
      zoomLink: links.find(l => l.cohort_id === c.id)?.zoom_link ?? null,
    })
  }
  // Current: the running cohort first, then the soonest to start. Past: most recent first.
  const startKey = (m: Membership) => m.cohort.start_date ?? '9999-12-31'
  const current = list.filter(m => m.isCurrent).sort((a, b) =>
    Number(b.cohort.status === 'active') - Number(a.cohort.status === 'active') || startKey(a).localeCompare(startKey(b)))
  const past = list.filter(m => !m.isCurrent).sort((a, b) =>
    (b.cohort.end_date ?? b.cohort.start_date ?? '').localeCompare(a.cohort.end_date ?? a.cohort.start_date ?? ''))
  return [...current, ...past]
}

export function programName(m: Membership | null | undefined): string {
  return m?.program?.name || m?.cohort.name || 'Impact Lab program'
}

/** In progress / Starting <date> / Finished — completion review pending / Completed on <date>. */
export function programStateLabel(m: Membership, today: string): string {
  if (m.enrollmentStatus === 'completed') {
    return m.completedAt ? `Completed on ${formatDateET(m.completedAt, 'long')}` : 'Completed'
  }
  const c = m.cohort
  if (c.status === 'cancelled') return 'Cancelled'
  if (FINISHED_STATUSES.includes(c.status)) return 'Finished — completion review pending'
  if (c.status === 'upcoming' || c.status === 'draft' || (c.start_date && c.start_date > today)) {
    return c.start_date ? `Starting ${formatDateET(c.start_date, 'long')}` : 'Starting soon'
  }
  return 'In progress'
}

// ------------------------------------------------------------------ weekly reps

export type RepStateKind = 'submitted' | 'due' | 'open' | 'overdue' | 'not-submitted'
export interface RepState { kind: RepStateKind; label: string }

/** Reps that count toward progress: assigned and not archived by an admin. */
export function assignedReps(reps: Rep[], cohortId: string): Rep[] {
  return reps.filter(r => r.cohort_id === cohortId && !r.archived_at).sort(byWeek)
}

/** Reps to list for a cohort: assigned ones plus archived ones this participant answered. */
export function visibleReps(reps: Rep[], cohortId: string, submitted: Set<string>): Rep[] {
  return reps.filter(r => r.cohort_id === cohortId && (!r.archived_at || submitted.has(r.id))).sort(byWeek)
}

function byWeek(a: Rep, b: Rep): number {
  return (a.week_number ?? 0) - (b.week_number ?? 0) || (a.due_date ?? '').localeCompare(b.due_date ?? '')
}

export function repState(rep: Rep, submitted: boolean, canWrite: boolean, today: string): RepState {
  if (submitted) return { kind: 'submitted', label: 'Submitted' }
  if (!canWrite) return { kind: 'not-submitted', label: 'Not submitted' }
  if (!rep.due_date) return { kind: 'open', label: 'Open' }
  if (rep.due_date < today) return { kind: 'overdue', label: 'Overdue' }
  return { kind: 'due', label: `Due ${formatDateET(rep.due_date, 'long')}` }
}

/** The rep due soonest that is not submitted and not overdue; otherwise the latest overdue one. */
export function thisWeeksRep(reps: Rep[], submitted: Set<string>, today: string): { rep: Rep; overdue: boolean } | null {
  const open = reps.filter(r => !submitted.has(r.id))
  const upcoming = open.filter(r => !r.due_date || r.due_date >= today).sort((a, b) => {
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
    if (a.due_date) return -1
    if (b.due_date) return 1
    return (a.week_number ?? 0) - (b.week_number ?? 0)
  })
  if (upcoming[0]) return { rep: upcoming[0], overdue: false }
  const overdue = open.filter(r => r.due_date && r.due_date < today).sort((a, b) => (b.due_date ?? '').localeCompare(a.due_date ?? ''))
  return overdue[0] ? { rep: overdue[0], overdue: true } : null
}

// ------------------------------------------------------------------ sessions

export function cohortSessions(sessions: SessionRow[], cohortId: string): SessionRow[] {
  return sessions.filter(s => s.cohort_id === cohortId).sort((a, b) => a.session_number - b.session_number)
}

export function nextSession(sessions: SessionRow[], today: string): SessionRow | null {
  return sessions
    .filter(s => s.session_date && s.session_date >= today)
    .sort((a, b) => (a.session_date ?? '').localeCompare(b.session_date ?? ''))[0] ?? null
}

/** "Tuesdays at 7:00 PM ET" */
export function sessionTimeLabel(day: string | null | undefined, time: string | null | undefined): string | null {
  if (!day || !time) return null
  const [h, m] = time.split(':').map(Number)
  if (Number.isNaN(h)) return null
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${day}s at ${h % 12 || 12}:${String(m || 0).padStart(2, '0')} ${ampm} ET`
}

/** Week of the program (1-based) by New York date; 1 before the start. */
export function cohortWeek(startDate: string | null | undefined): number {
  if (!startDate) return 1
  const elapsed = -daysFromTodayET(startDate)
  return Math.max(1, Math.floor(elapsed / 7) + 1)
}

// ------------------------------------------------------------------ content scoping

/** Announcements meant for Impact Lab participants (not ones aimed at coaching clients). */
export function isForParticipants(a: AnnouncementRow): boolean {
  return !a.target_role || a.target_role === 'impact_participant'
}

export function cohortAnnouncements(all: AnnouncementRow[], cohortId: string): AnnouncementRow[] {
  return all.filter(a => a.cohort_id === cohortId)
}

/** Announcements not tied to a cohort: for everyone, or addressed to this participant. */
export function generalAnnouncements(all: AnnouncementRow[]): AnnouncementRow[] {
  return all.filter(a => a.cohort_id === null)
}

/** Materials for a cohort: its own resources and its pathway's. */
export function cohortResources(all: ResourceRow[], cohort: CohortRow): ResourceRow[] {
  return all.filter(r => r.cohort_id === cohort.id || (r.cohort_id === null && r.program_id === cohort.program_id))
}

export function generalResources(all: ResourceRow[]): ResourceRow[] {
  return all.filter(r => r.cohort_id === null && r.program_id === null)
}

export function isImpactResource(r: ResourceRow): boolean {
  return !r.portal_type || r.portal_type === 'impact' || r.portal_type === 'both'
}

export function certificateFor(certs: CertificateRow[], cohort: CohortRow): CertificateRow | null {
  return certs.find(c => c.cohort_id === cohort.id)
    ?? certs.find(c => c.cohort_id === null && c.program_id === cohort.program_id)
    ?? null
}

export function certificatePdfHref(id: string, inline = false): string {
  return `/api/certificates/${encodeURIComponent(id)}/pdf${inline ? '?inline=1' : ''}`
}

// ------------------------------------------------------------------ formatting and errors

/** "Nov 22, 2026, 8:13 PM ET" for a timestamp, in New York time. */
export function timeET(value: string): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${new Intl.DateTimeFormat('en-US', { timeZone: BUSINESS_TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d)} ET`
}

export function initialsOf(name: string | null | undefined): string {
  return (name || '').split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 3) || '?'
}

interface DbError { code?: string; message?: string }

/** A sentence a participant can act on; never a raw database message. */
export function writeErrorMessage(error: DbError | null | undefined, what: string): string {
  if (error?.code === '23505') return `${what} was already saved.`
  const msg = (error?.message || '').toLowerCase()
  if (error?.code === '42501' || msg.includes('row-level security') || msg.includes('permission')) {
    return `${what} could not be saved because this program is read-only now. If you think this is a mistake, email Tramaine at ${CONTACT_EMAIL}.`
  }
  return `${what} could not be saved. Check your connection and try again.`
}
