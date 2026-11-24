// Definitions behind every number on the admin Dashboard and Reports. All values are
// computed from database records (cohorts, cohort_enrollments, profiles, inquiries,
// registrations); nothing is estimated. Documented for the owner in docs/admin-metrics.md.
//
// Enrollment outcome (records are never rewritten; the outcome is derived):
//   withdrawn       status = 'withdrawn'
//   completed       status = 'completed' (an administrator recorded completion; owner decision
//                   2026-11-23: completion is never assumed from the cohort ending)
//   awaiting_review status = 'active' in a cohort that is Completed or Archived: the cohort has
//                   finished but nobody has recorded whether this person completed it
//   cancelled       status = 'active' in a cohort that was Cancelled
//   in_progress  status = 'active' in a cohort that is Active (running now)
//   starting     status = 'active' in a cohort that is Upcoming or Draft (not started yet)
//
// Seats taken in a cohort = enrollments with status 'active' (what capacity is checked against).

export type EnrollmentOutcome = 'in_progress' | 'starting' | 'completed' | 'awaiting_review' | 'withdrawn' | 'cancelled'

export interface MetricCohort { id: string; status: string | null; capacity?: number | null; program_id?: string | null; name?: string }
export interface MetricEnrollment { id?: string; user_id: string; cohort_id: string; status: string | null }
export interface MetricPerson { id: string; role: string | null }
export interface MetricInquiry { status: string; follow_up_on: string | null; kind?: string }
export interface MetricRegistration { status: string | null }

export function enrollmentOutcome(enrollmentStatus: string | null, cohortStatus: string | null): EnrollmentOutcome {
  if (enrollmentStatus === 'withdrawn') return 'withdrawn'
  if (enrollmentStatus === 'completed') return 'completed'
  switch (cohortStatus) {
    case 'completed': case 'archived': return 'awaiting_review'
    case 'cancelled': return 'cancelled'
    case 'active': return 'in_progress'
    default: return 'starting'
  }
}

export const OUTCOME_LABEL: Record<EnrollmentOutcome, string> = {
  in_progress: 'In progress', starting: 'Starting soon', completed: 'Completed', awaiting_review: 'Finished · completion not recorded', withdrawn: 'Withdrew', cancelled: 'Cohort cancelled',
}

export function seatsTaken(cohortId: string, enrollments: MetricEnrollment[]): number {
  return enrollments.filter(e => e.cohort_id === cohortId && e.status === 'active').length
}

export interface CohortCounts { seatsTaken: number; inProgress: number; starting: number; completed: number; awaitingReview: number; withdrawn: number; cancelled: number; total: number }

export function cohortCounts(cohort: MetricCohort, enrollments: MetricEnrollment[]): CohortCounts {
  const rows = enrollments.filter(e => e.cohort_id === cohort.id)
  const by = (o: EnrollmentOutcome) => rows.filter(e => enrollmentOutcome(e.status, cohort.status) === o).length
  return {
    seatsTaken: seatsTaken(cohort.id, enrollments),
    inProgress: by('in_progress'), starting: by('starting'), completed: by('completed'), awaitingReview: by('awaiting_review'),
    withdrawn: by('withdrawn'), cancelled: by('cancelled'), total: rows.length,
  }
}

export interface DashboardMetrics {
  cohortsInProgress: number
  cohortsUpcoming: number
  /** Distinct non-admin people enrolled (status active) in a cohort that is running now. */
  activeParticipants: number
  /** Distinct non-admin people enrolled in Upcoming cohorts. */
  startingParticipants: number
  openInquiries: number
  followUpsDue: number
  registrationsToReview: number
}

const OPEN_INQUIRY = (s: string) => s !== 'converted' && s !== 'closed'

export function dashboardMetrics(input: {
  cohorts: MetricCohort[]; enrollments: MetricEnrollment[]; people: MetricPerson[]
  inquiries: MetricInquiry[]; registrations: MetricRegistration[]; today: string
}): DashboardMetrics {
  const admins = new Set(input.people.filter(p => p.role === 'admin').map(p => p.id))
  const cohortStatus = new Map(input.cohorts.map(c => [c.id, c.status]))
  const people = (outcome: EnrollmentOutcome, onlyUpcoming = false) => new Set(
    input.enrollments
      .filter(e => !admins.has(e.user_id))
      .filter(e => enrollmentOutcome(e.status, cohortStatus.get(e.cohort_id) ?? null) === outcome)
      .filter(e => !onlyUpcoming || cohortStatus.get(e.cohort_id) === 'upcoming')
      .map(e => e.user_id)).size
  return {
    cohortsInProgress: input.cohorts.filter(c => c.status === 'active').length,
    cohortsUpcoming: input.cohorts.filter(c => c.status === 'upcoming').length,
    activeParticipants: people('in_progress'),
    startingParticipants: people('starting', true),
    openInquiries: input.inquiries.filter(i => OPEN_INQUIRY(i.status)).length,
    followUpsDue: input.inquiries.filter(i => OPEN_INQUIRY(i.status) && i.follow_up_on && i.follow_up_on <= input.today).length,
    registrationsToReview: input.registrations.filter(r => r.status === 'pending').length,
  }
}

export type AvailabilityKey = 'draft' | 'closed' | 'open' | 'full' | 'in_progress' | 'completed' | 'archived' | 'cancelled'

export interface Availability { key: AvailabilityKey; label: string; detail: string }

/**
 * What a visitor can do for this cohort right now, in plain words for the owner.
 * "Open" requires all of: cohort Upcoming, pathway open for enrollment, online registration
 * switched on for the site, and a free seat.
 */
export function cohortAvailability(input: {
  cohortStatus: string | null; capacity: number | null | undefined; seatsTaken: number
  pathwayEnrollmentOpen: boolean; checkoutEnabled: boolean
}): Availability {
  const { cohortStatus, capacity, seatsTaken: taken } = input
  switch (cohortStatus) {
    case 'draft': return { key: 'draft', label: 'Draft', detail: 'Not public. Prepare it with the setup checklist, then set it to Upcoming.' }
    case 'active': return { key: 'in_progress', label: 'In progress', detail: 'Running now. Enrollment is managed here by you.' }
    case 'completed': return { key: 'completed', label: 'Completed', detail: 'Finished. Participants keep read-only access to their program history, materials and certificates.' }
    case 'archived': return { key: 'archived', label: 'Archived', detail: 'Hidden from lists. All history is kept.' }
    case 'cancelled': return { key: 'cancelled', label: 'Cancelled', detail: 'Will not run. Records are kept.' }
  }
  if (capacity != null && taken >= capacity) return { key: 'full', label: 'Full', detail: `${taken} of ${capacity} seats taken. Raise the capacity to add people.` }
  if (!input.checkoutEnabled) return { key: 'closed', label: 'Online registration off', detail: 'Online registration is off for the site. Visitors are sent to the inquiry form; you can enroll people here.' }
  if (!input.pathwayEnrollmentOpen) return { key: 'closed', label: 'Not open online', detail: 'The pathway is not open for enrollment. Visitors are sent to the inquiry form.' }
  return { key: 'open', label: 'Open for registration', detail: capacity != null ? `${capacity - taken} of ${capacity} seats left.` : 'No seat limit set.' }
}
