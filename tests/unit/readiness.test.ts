import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cohortReadiness, readinessLabel, showsReadiness, type ReadinessInput } from '../../src/lib/cohort-readiness'
import {
  assignedParticipants, currentReps, personAttendance, personParticipation, recordedSessions, repParticipation,
} from '../../src/app/(portal)/admin/components/cohort/participation'

const C = 'c1'
const P = 'p1'

/** A cohort with every essential and recommended item done. */
function complete(): ReadinessInput {
  return {
    cohort: { id: C, program_id: P, name: 'New Leaders — Spring', start_date: '2027-01-05', end_date: '2027-02-09', capacity: 12, zoom_link: 'https://zoom.us/j/1', book_title: 'Atomic Habits' },
    programs: [{ id: P }],
    sessions: [{ cohort_id: C, session_date: '2027-01-05' }],
    reps: [{ cohort_id: C, archived_at: null }],
    prompts: [{ program_id: P }],
    resources: [{ cohort_id: C, program_id: null }],
    announcements: [{ cohort_id: C }],
    enrollments: [{ cohort_id: C, user_id: 'u1', status: 'active' }],
    people: [{ id: 'u1', role: 'impact_participant', last_sign_in_at: '2026-11-20T10:00:00Z' }],
    emailProblems: [],
  }
}
const item = (r: ReturnType<typeof cohortReadiness>, key: string) => [...r.essentials, ...r.recommended].find(i => i.key === key)!

test('readiness: everything set is ready', () => {
  const r = cohortReadiness(complete())
  assert.equal(r.ready, true)
  assert.equal(r.missingEssential, 0)
  assert.equal(r.summary, 'Ready: all essential setup is done.')
  assert.equal(readinessLabel(r), 'Ready')
  assert.deepEqual(r.essentials.map(i => i.key), ['pathway', 'name', 'dates', 'capacity', 'schedule', 'meeting_link'])
  assert.deepEqual(r.recommended.map(i => i.key), ['reps', 'prompts', 'resources', 'reading', 'welcome', 'access'])
  assert.ok(r.recommended.every(i => i.done))
})

test('readiness: two missing essentials read as "almost ready" with the steps', () => {
  const input = complete()
  input.cohort.zoom_link = null
  input.sessions = []
  const r = cohortReadiness(input)
  assert.equal(r.ready, false)
  assert.equal(r.missingEssential, 2)
  assert.equal(r.summary, 'Your cohort is almost ready. Generate the session schedule and add a meeting link.')
  assert.equal(readinessLabel(r), 'Needs setup · 2 items')
  assert.equal(item(r, 'schedule').section, 'schedule')
  assert.equal(item(r, 'meeting_link').section, 'details')
})

test('readiness: essentials each have their own rule', () => {
  const base = complete()
  const check = (mutate: (i: ReadinessInput) => void, key: string) => {
    const input = structuredClone(base)
    mutate(input)
    const r = cohortReadiness(input)
    assert.equal(item(r, key).done, false, key)
    assert.equal(r.missingEssential, 1, key)
  }
  check(i => { i.cohort.program_id = null }, 'pathway')
  check(i => { i.programs = [] }, 'pathway') // a pathway id that no longer exists
  check(i => { i.cohort.name = '  ' }, 'name')
  check(i => { i.cohort.end_date = null }, 'dates')
  check(i => { i.cohort.capacity = null }, 'capacity')
  check(i => { i.sessions = [{ cohort_id: C, session_date: null }] }, 'schedule') // sessions without dates do not count
  check(i => { i.sessions = [{ cohort_id: 'other', session_date: '2027-01-05' }] }, 'schedule')
  check(i => { i.cohort.zoom_link = '' }, 'meeting_link')
})

test('readiness: missing dates name exactly what is missing', () => {
  const input = complete()
  input.cohort.start_date = null
  assert.equal(item(cohortReadiness(input), 'dates').hint, 'Set the start date.')
  input.cohort.end_date = null
  assert.match(cohortReadiness(input).summary, /Set the start and end dates\./)
})

test('readiness: three or more missing essentials say "needs setup"', () => {
  const input = complete()
  input.cohort.capacity = null
  input.cohort.zoom_link = null
  input.sessions = []
  const r = cohortReadiness(input)
  assert.equal(r.summary, 'Your cohort needs setup (3 essential items). Set a seat limit, generate the session schedule and add a meeting link.')
})

test('readiness: recommended items never make a cohort not ready', () => {
  const input = complete()
  input.reps = [{ cohort_id: C, archived_at: '2026-11-01T00:00:00Z' }] // archived reps do not count
  input.prompts = [{ program_id: 'another-pathway' }]
  input.resources = []
  input.announcements = [{ cohort_id: null }] // "everyone" announcements are not a welcome for this cohort
  input.cohort.book_title = null
  const r = cohortReadiness(input)
  assert.equal(r.ready, true)
  for (const k of ['reps', 'prompts', 'resources', 'reading', 'welcome']) assert.equal(item(r, k).done, false, k)
  assert.match(r.summary, /^Ready: all essential setup is done\. Optional: add weekly reps and add journal prompts \(3 more\)\.$/)
})

test('readiness: general prompts and pathway resources count', () => {
  const input = complete()
  input.prompts = [{ program_id: null }]
  input.resources = [{ cohort_id: null, program_id: P }]
  const r = cohortReadiness(input)
  assert.equal(item(r, 'prompts').done, true)
  assert.equal(item(r, 'resources').done, true)
})

test('readiness: "everyone enrolled can sign in"', () => {
  // Nobody enrolled yet: not done, invite people.
  const empty = complete()
  empty.enrollments = []
  assert.equal(item(cohortReadiness(empty), 'access').done, false)
  assert.equal(item(cohortReadiness(empty), 'access').hint, 'Invite participants.')

  // Never signed in, but no failed email: fine (invitation on its way).
  const pending = complete()
  pending.people = [{ id: 'u1', role: 'impact_participant', last_sign_in_at: null }]
  assert.equal(item(cohortReadiness(pending), 'access').done, true)

  // Never signed in and the email bounced: not done.
  const bounced = structuredClone(pending)
  bounced.emailProblems = [{ related_user_id: 'u1', status: 'bounced', resolved_at: null }]
  const r = cohortReadiness(bounced)
  assert.equal(item(r, 'access').done, false)
  assert.match(item(r, 'access').hint, /^1 person has not signed in/)
  assert.equal(r.ready, true, 'recommended only')

  // Resolved problems, signed-in people, withdrawn people and admins are ignored.
  const ok = structuredClone(bounced)
  ok.emailProblems = [{ related_user_id: 'u1', status: 'failed', resolved_at: '2026-11-21T00:00:00Z' }]
  assert.equal(item(cohortReadiness(ok), 'access').done, true)
  const signedIn = structuredClone(bounced)
  signedIn.people = [{ id: 'u1', role: 'impact_participant', last_sign_in_at: '2026-11-22T00:00:00Z' }]
  assert.equal(item(cohortReadiness(signedIn), 'access').done, true)
  const withdrawn = structuredClone(bounced)
  withdrawn.enrollments = [{ cohort_id: C, user_id: 'u1', status: 'withdrawn' }, { cohort_id: C, user_id: 'u2', status: 'active' }]
  withdrawn.people.push({ id: 'u2', role: 'impact_participant', last_sign_in_at: '2026-11-22T00:00:00Z' })
  assert.equal(item(cohortReadiness(withdrawn), 'access').done, true)
  const adminOnly = structuredClone(bounced)
  adminOnly.people = [{ id: 'u1', role: 'admin', last_sign_in_at: null }]
  assert.equal(item(cohortReadiness(adminOnly), 'access').hint, 'Invite participants.', 'admins are not participants')
})

test('readiness is shown only for Draft, Upcoming and In progress cohorts', () => {
  assert.deepEqual(['draft', 'upcoming', 'active', 'completed', 'archived', 'cancelled'].map(showsReadiness), [true, true, true, false, false, false])
})

// ---------------------------------------------------------------- participation (no reflection text)
const enrollments = [
  { id: 'e1', cohort_id: C, user_id: 'avery', status: 'active', profiles: { full_name: 'Avery Brooks', role: 'impact_participant' } },
  { id: 'e2', cohort_id: C, user_id: 'blake', status: 'completed', profiles: { full_name: 'Blake Chen', role: 'impact_participant' } },
  { id: 'e3', cohort_id: C, user_id: 'casey', status: 'withdrawn', profiles: { full_name: 'Casey Diaz', role: 'impact_participant' } },
  { id: 'e4', cohort_id: C, user_id: 'admin', status: 'active', profiles: { full_name: 'Admin', role: 'admin' } },
  { id: 'e5', cohort_id: 'other', user_id: 'dana', status: 'active', profiles: { full_name: 'Dana', role: 'impact_participant' } },
]
const people = [{ id: 'admin', role: 'admin' }, { id: 'avery', role: 'impact_participant' }, { id: 'blake', role: 'impact_participant' }]
const reps = [
  { id: 'r2', cohort_id: C, week_number: 2, title: 'Two', due_date: '2026-11-30', archived_at: null },
  { id: 'r1', cohort_id: C, week_number: 1, title: 'One', due_date: '2026-11-10', archived_at: null },
  { id: 'r0', cohort_id: C, week_number: 0, title: 'Old', due_date: null, archived_at: '2026-11-01T00:00:00Z' },
]
const rows = [
  { rep_id: 'r1', user_id: 'avery', submitted_at: '2026-11-09T15:00:00Z' },
  { rep_id: 'r1', user_id: 'casey', submitted_at: '2026-11-09T15:00:00Z' }, // withdrew: not counted
]

test('participation: assigned = enrolled, not withdrawn, not admins', () => {
  assert.deepEqual(assignedParticipants(C, enrollments, people).map(p => p.name), ['Avery Brooks', 'Blake Chen'])
})

test('participation: per rep submitted / outstanding / overdue', () => {
  const list = assignedParticipants(C, enrollments, people)
  const current = currentReps(C, reps)
  assert.deepEqual(current.map(r => r.id), ['r1', 'r2'], 'archived reps excluded, sorted by week')
  const [one, two] = repParticipation(current, list, rows, '2026-11-23')
  assert.equal(one.assigned, 2)
  assert.deepEqual(one.submitted.map(s => s.name), ['Avery Brooks'])
  assert.deepEqual(one.outstanding.map(s => [s.name, s.overdue]), [['Blake Chen', true]])
  assert.equal(one.overdue, 1)
  assert.equal(two.submitted.length, 0)
  assert.equal(two.overdue, 0, 'not due yet')
})

test('participation: per person totals', () => {
  const list = assignedParticipants(C, enrollments, people)
  const totals = personParticipation(list, currentReps(C, reps), rows, '2026-11-23')
  assert.deepEqual(totals.map(t => [t.name, t.submitted, t.total, t.overdue]), [['Avery Brooks', 1, 2, 0], ['Blake Chen', 0, 2, 1]])
})

test('attendance: only recorded sessions count', () => {
  const att = [
    { cohort_id: C, session_number: 1, user_id: 'avery', attended: true },
    { cohort_id: C, session_number: 2, user_id: 'blake', attended: false },
    { cohort_id: C, session_number: 2, user_id: 'avery', attended: true },
    { cohort_id: 'other', session_number: 3, user_id: 'avery', attended: true },
  ]
  assert.deepEqual([...recordedSessions(C, att)].sort(), [1, 2])
  assert.deepEqual(personAttendance(C, 'avery', att), { attended: 2, recorded: 2 })
  assert.deepEqual(personAttendance(C, 'blake', att), { attended: 0, recorded: 2 })
})
