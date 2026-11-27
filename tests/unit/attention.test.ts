import { test } from 'node:test'
import assert from 'node:assert/strict'
import { attentionItems, type AttentionInput } from '../../src/lib/attention'
import { parsePeople } from '../../src/lib/people-list'

const TODAY = '2026-11-24'
const base = (over: Partial<AttentionInput> = {}): AttentionInput => ({
  today: TODAY, inquiries: [], emailProblems: [], registrations: [], cohorts: [], enrollments: [], people: [], certificates: [],
  readiness: { programs: [{ id: 'p1' }], sessions: [], reps: [], prompts: [], resources: [], announcements: [], enrollments: [], people: [], emailProblems: [] },
  ...over,
})
const cohort = (over: Record<string, unknown>) => ({ id: 'c1', program_id: 'p1', name: 'Spring', start_date: null, end_date: null, capacity: 8, zoom_link: 'https://x', book_title: null, status: 'upcoming', ...over }) as AttentionInput['cohorts'][number]

test('nothing to do gives an empty list (the dashboard then says "all caught up")', () => {
  assert.deepEqual(attentionItems(base()), [])
})

test('new inquiries and overdue follow-ups link to the exact inquiry; closed ones never appear', () => {
  const items = attentionItems(base({ inquiries: [
    { id: 'i1', status: 'new', follow_up_on: null, kind: 'individual', contact_name: 'Morgan', organization: null, created_at: '2026-11-20T10:00:00Z' },
    { id: 'i2', status: 'contacted', follow_up_on: '2026-11-20', kind: 'organization', contact_name: 'Riley', organization: 'Example Library', created_at: '2026-11-01T10:00:00Z' },
    { id: 'i3', status: 'closed', follow_up_on: '2026-11-01', kind: 'individual', contact_name: 'Quinn', organization: null, created_at: '2026-11-01T10:00:00Z' },
  ] }))
  assert.equal(items.length, 2)
  assert.equal(items[0].severity, 'urgent', 'overdue follow-up first')
  assert.equal(items[0].href, '/admin/inquiries?id=i2')
  assert.match(items[0].title, /Example Library/)
  assert.equal(items[1].href, '/admin/inquiries?id=i1')
})

test('failed account emails open the person; other failed emails open the email log; handled ones are hidden', () => {
  const items = attentionItems(base({
    people: [{ id: 'u1', role: 'impact_participant', email: 'a@x.test', full_name: 'Avery', last_sign_in_at: null }],
    emailProblems: [
      { id: 7, template: 'invite', recipient: 'a@x.test', status: 'failed', related_user_id: 'u1', created_at: '2026-11-23T10:00:00Z' },
      { id: 8, template: 'inquiry_ack', recipient: 'b@x.test', status: 'bounced', created_at: '2026-11-23T11:00:00Z' },
      { id: 9, template: 'invite', recipient: 'c@x.test', status: 'failed', related_user_id: 'u1', resolved_at: '2026-11-23T12:00:00Z', created_at: '2026-11-23T09:00:00Z' },
    ],
  }))
  assert.deepEqual(items.map(i => i.href), ['/admin/users?person=u1', '/admin/security?email=8'])
  assert.match(items[0].title, /Invitation was not delivered: Avery/)
})

test('a cohort starting soon with missing essentials links to its checklist and names what is missing', () => {
  const items = attentionItems(base({ cohorts: [cohort({ start_date: '2026-11-30', end_date: '2027-01-30', zoom_link: null })] }))
  const it = items.find(i => i.id === 'cohort-setup:c1')!
  assert.equal(it.severity, 'urgent', 'starts within a week')
  assert.equal(it.href, '/admin/cohorts?cohort=c1&section=readiness')
  assert.match(it.title, /starts in 6 days/)
  assert.match(it.detail!, /meeting link/)
})

test('cohorts far in the future are not flagged', () => {
  assert.equal(attentionItems(base({ cohorts: [cohort({ start_date: '2027-06-01', zoom_link: null })] })).length, 0)
})

test('a finished cohort asks for completion review; it never marks anyone complete', () => {
  const input = base({
    cohorts: [cohort({ id: 'old', name: 'Fall 2026', status: 'completed', start_date: '2026-08-18', end_date: '2026-09-29' })],
    people: [{ id: 'u1', role: 'impact_participant', email: null, full_name: 'A', last_sign_in_at: '2026-09-01T00:00:00Z' }, { id: 'u2', role: 'impact_participant', email: null, full_name: 'B', last_sign_in_at: '2026-09-01T00:00:00Z' }],
    enrollments: [{ cohort_id: 'old', user_id: 'u1', status: 'active' }, { cohort_id: 'old', user_id: 'u2', status: 'completed' }],
  })
  const items = attentionItems(input)
  const review = items.find(i => i.id === 'completion:old')!
  assert.match(review.title, /record completion for 1 participant/)
  assert.equal(review.href, '/admin/cohorts?cohort=old&section=completion')
  assert.ok(items.some(i => i.id === 'certificates:old'), 'completed without certificate is listed for information')
  assert.equal(input.enrollments[0].status, 'active', 'input records are not changed')
})

test('participants who have not signed in 3+ days after enrolling are flagged per cohort', () => {
  const items = attentionItems(base({
    cohorts: [cohort({ status: 'active', start_date: '2026-11-01', end_date: '2026-12-20' })],
    readiness: { ...base().readiness, sessions: [{ cohort_id: 'c1', session_date: '2026-11-05' }] },
    people: [{ id: 'u1', role: 'impact_participant', email: null, full_name: 'Avery', last_sign_in_at: null }, { id: 'u2', role: 'impact_participant', email: null, full_name: 'Casey', last_sign_in_at: null }],
    enrollments: [{ cohort_id: 'c1', user_id: 'u1', status: 'active', enrolled_at: '2026-11-10T00:00:00Z' }, { cohort_id: 'c1', user_id: 'u2', status: 'active', enrolled_at: '2026-11-23T00:00:00Z' }],
  }))
  const it = items.find(i => i.id === 'cohort-signin:c1')!
  assert.match(it.title, /1 participant in Spring has not signed in yet/)
  assert.match(it.detail!, /Avery/)
})

test('pending registrations link to the registration', () => {
  const items = attentionItems(base({ registrations: [{ id: 'r1', full_name: 'Sam', email: 's@x', status: 'pending', cohort_id: null, created_at: '2026-11-22T00:00:00Z' }] }))
  assert.equal(items[0].href, '/admin/registrations?id=r1')
})

test('pasted employee lists accept common formats and report bad lines', () => {
  const { rows, problems } = parsePeople('Jordan Lee, Jordan@Example.org\nSam Rivera <sam@example.org>\n\nno-email here\nlonely@example.org')
  assert.deepEqual(rows, [{ name: 'Jordan Lee', email: 'jordan@example.org' }, { name: 'Sam Rivera', email: 'sam@example.org' }])
  assert.equal(problems.length, 2)
  assert.match(problems[0], /Line 3: no valid email/)
  assert.match(problems[1], /Line 4: add the person's name/)
})

test('a closed completion review silences completion and certificate reminders for that cohort only', () => {
  const people = [{ id: 'u1', role: 'impact_participant', email: null, full_name: 'A', last_sign_in_at: '2026-09-01T00:00:00Z' }, { id: 'u2', role: 'impact_participant', email: null, full_name: 'B', last_sign_in_at: '2026-09-01T00:00:00Z' }]
  const enrollments = [{ cohort_id: 'fall', user_id: 'u1', status: 'active' }, { cohort_id: 'fall', user_id: 'u2', status: 'completed' },
    { cohort_id: 'other', user_id: 'u1', status: 'active' }]
  const fall = cohort({ id: 'fall', name: 'Fall 2026', status: 'completed', start_date: '2026-08-18', end_date: '2026-09-29' })
  const other = cohort({ id: 'other', name: 'Winter 2027', status: 'completed', start_date: '2026-11-01', end_date: '2026-11-20' })
  const open = attentionItems(base({ cohorts: [fall, other], people, enrollments }))
  assert.ok(open.some(i => i.id === 'completion:fall') && open.some(i => i.id === 'certificates:fall'), 'reminders while the review is open')
  const closedFall = { ...fall, completion_review_closed_at: '2026-11-27T12:00:00Z' }
  const input = base({ cohorts: [closedFall, other], people, enrollments })
  const closed = attentionItems(input)
  assert.equal(closed.some(i => i.id.endsWith(':fall')), false, 'no completion or certificate reminder for the closed cohort')
  assert.ok(closed.some(i => i.id === 'completion:other'), 'other finished cohorts still remind')
  assert.deepEqual(input.enrollments.map(e => e.status), ['active', 'completed', 'active'], 'nobody’s completion status changes')
})
