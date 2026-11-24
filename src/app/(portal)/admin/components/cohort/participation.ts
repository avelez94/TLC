// Pure calculations behind the Participation, Attendance and Completion sections.
// Participation rows come from admin_cohort_participation (rep, person, when): they never
// contain what anyone wrote. Nothing here decides completion; the numbers only inform it.
// Runtime imports must stay relative (unit tests import this file directly).

export interface ParticipationRow { rep_id: string; user_id: string; submitted_at: string | null }
export interface Participant { userId: string; name: string; enrollmentId: string; status: string }
export interface RepLite { id: string; cohort_id: string; week_number: number; title: string; due_date: string | null; archived_at?: string | null }

/**
 * The people a cohort's reps are assigned to: enrolled (not withdrawn) and not administrators.
 * Sorted by name.
 */
export function assignedParticipants(
  cohortId: string,
  enrollments: { id: string; cohort_id: string; user_id: string; status: string | null; profiles?: { full_name?: string | null; role?: string | null } | null }[],
  people: { id: string; role: string | null; full_name?: string | null; email?: string | null }[],
): Participant[] {
  const byId = new Map(people.map(p => [p.id, p]))
  return enrollments
    .filter(e => e.cohort_id === cohortId && e.status !== 'withdrawn')
    .filter(e => (byId.get(e.user_id)?.role ?? e.profiles?.role) !== 'admin')
    .map(e => ({
      userId: e.user_id, enrollmentId: e.id, status: e.status ?? 'active',
      name: e.profiles?.full_name || byId.get(e.user_id)?.full_name || byId.get(e.user_id)?.email || 'Unnamed participant',
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export const currentReps = <T extends RepLite>(cohortId: string, reps: T[]): T[] =>
  reps.filter(r => r.cohort_id === cohortId && !r.archived_at)
    .sort((a, b) => a.week_number - b.week_number || a.title.localeCompare(b.title))

export const isOverdue = (rep: { due_date: string | null }, today: string) => !!rep.due_date && rep.due_date < today

export interface RepParticipation<T extends RepLite = RepLite> {
  rep: T
  assigned: number
  submitted: { userId: string; name: string; at: string | null }[]
  outstanding: { userId: string; name: string; overdue: boolean }[]
  overdue: number
}

export function repParticipation<T extends RepLite>(reps: T[], participants: Participant[], rows: ParticipationRow[], today: string): RepParticipation<T>[] {
  return reps.map(rep => {
    const when = new Map(rows.filter(r => r.rep_id === rep.id).map(r => [r.user_id, r.submitted_at]))
    const submitted = participants.filter(p => when.has(p.userId)).map(p => ({ userId: p.userId, name: p.name, at: when.get(p.userId) ?? null }))
    const late = isOverdue(rep, today)
    const outstanding = participants.filter(p => !when.has(p.userId)).map(p => ({ userId: p.userId, name: p.name, overdue: late }))
    return { rep, assigned: participants.length, submitted, outstanding, overdue: late ? outstanding.length : 0 }
  })
}

export interface PersonParticipation { userId: string; name: string; submitted: number; total: number; overdue: number }

export function personParticipation(participants: Participant[], reps: RepLite[], rows: ParticipationRow[], today: string): PersonParticipation[] {
  const done = new Set(rows.map(r => `${r.rep_id}:${r.user_id}`))
  return participants.map(p => {
    const mine = reps.filter(r => done.has(`${r.id}:${p.userId}`)).length
    const overdue = reps.filter(r => !done.has(`${r.id}:${p.userId}`) && isOverdue(r, today)).length
    return { userId: p.userId, name: p.name, submitted: mine, total: reps.length, overdue }
  })
}

/** Sessions with at least one attendance entry: only these count as "recorded". */
export function recordedSessions(cohortId: string, attendance: { cohort_id: string; session_number: number }[]): Set<number> {
  return new Set(attendance.filter(a => a.cohort_id === cohortId).map(a => a.session_number))
}

export function personAttendance(cohortId: string, userId: string, attendance: { cohort_id: string; session_number: number; user_id: string; attended: boolean }[]) {
  const recorded = recordedSessions(cohortId, attendance)
  const attended = new Set(attendance.filter(a => a.cohort_id === cohortId && a.user_id === userId && a.attended && recorded.has(a.session_number)).map(a => a.session_number)).size
  return { attended, recorded: recorded.size }
}
