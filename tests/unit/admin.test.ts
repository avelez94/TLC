import { test } from 'node:test'
import assert from 'node:assert/strict'
import { csvCell, toCsv } from '../../src/lib/csv'
import { todayET, formatDateET, formatDateTimeET, csvDateTimeET, daysFromTodayET } from '../../src/lib/business-time'
import { enrollmentOutcome, dashboardMetrics, cohortCounts, cohortAvailability } from '../../src/lib/admin-metrics'
import { describeActivity, describeChanges } from '../../src/lib/activity-log'
import { mergePathways, countWord, checkoutEnabled, DEFAULT_PATHWAYS, type PathwayRow } from '../../src/lib/pathways'

// ---------------------------------------------------------------- CSV
test('CSV neutralises spreadsheet formulas from public form input', () => {
  for (const evil of ['=HYPERLINK("http://x","click")', '+1+1', '-2+3', '@SUM(A1)', '\tcmd', '\r=1']) {
    assert.ok(csvCell(evil).replace(/^"/, '').startsWith("'"), `${JSON.stringify(evil)} is prefixed`)
  }
  assert.equal(csvCell(-5), '-5', 'real numbers are not altered')
  assert.equal(csvCell('Plain text'), 'Plain text')
})

test('CSV quotes commas, quotes and line breaks; Excel-compatible encoding', () => {
  assert.equal(csvCell('Smith, Jane'), '"Smith, Jane"')
  assert.equal(csvCell('He said "hi"'), '"He said ""hi"""')
  assert.equal(csvCell('line1\nline2'), '"line1\nline2"')
  assert.equal(csvCell(null), '')
  assert.equal(csvCell(true), 'Yes')
  const csv = toCsv(['Name', 'Note'], [['Zoë — Lead', 'a,b']])
  assert.ok(csv.startsWith('﻿'), 'starts with UTF-8 byte-order mark')
  assert.ok(csv.includes('\r\n'), 'CRLF line endings')
  assert.equal(csv, '﻿Name,Note\r\nZoë — Lead,"a,b"\r\n')
})

// ---------------------------------------------------------------- dates (America/New_York)
test('"today" is the New York date, not the UTC date', () => {
  // 8:30 PM ET on Nov 22 is already Nov 23 in UTC.
  const evening = new Date('2026-11-23T01:30:00Z')
  assert.equal(todayET(evening), '2026-11-22')
  assert.equal(daysFromTodayET('2026-11-22', evening), 0)
  assert.equal(daysFromTodayET('2026-11-21', evening), -1)
})

test('calendar dates are never shifted; timestamps are shown in ET', () => {
  assert.equal(formatDateET('2027-01-05'), 'Jan 5, 2027')
  assert.equal(formatDateET('2026-11-23T01:30:00Z'), 'Nov 22, 2026')
  assert.equal(formatDateTimeET('2026-11-23T01:30:00Z'), 'Nov 22, 2026, 8:30 PM ET')
  assert.equal(csvDateTimeET('2026-07-01T16:05:00Z'), '2026-07-01 12:05', 'daylight saving time handled')
  assert.equal(formatDateET(null), '')
})

// ---------------------------------------------------------------- metrics
test('enrollment outcomes follow the documented definitions', () => {
  assert.equal(enrollmentOutcome('active', 'active'), 'in_progress')
  assert.equal(enrollmentOutcome('active', 'upcoming'), 'starting')
  // A finished cohort does not complete anyone: completion is recorded by an administrator.
  assert.equal(enrollmentOutcome('active', 'completed'), 'awaiting_review')
  assert.equal(enrollmentOutcome('active', 'archived'), 'awaiting_review')
  assert.equal(enrollmentOutcome('completed', 'completed'), 'completed')
  assert.equal(enrollmentOutcome('completed', 'active'), 'completed')
  assert.equal(enrollmentOutcome('withdrawn', 'completed'), 'withdrawn')
  assert.equal(enrollmentOutcome('active', 'cancelled'), 'cancelled')
})

test('Active participants counts distinct non-admin people in running cohorts only', () => {
  const cohorts = [{ id: 'old', status: 'completed' }, { id: 'now', status: 'active' }, { id: 'next', status: 'upcoming' }]
  const enrollments = [
    // six people from a finished cohort (the audit's "6") no longer count
    ...['a', 'b', 'c', 'd', 'e', 'f'].map(u => ({ user_id: u, cohort_id: 'old', status: 'active' })),
    { user_id: 'a', cohort_id: 'now', status: 'active' },
    { user_id: 'g', cohort_id: 'now', status: 'active' },
    { user_id: 'h', cohort_id: 'now', status: 'withdrawn' },
    { user_id: 'admin1', cohort_id: 'now', status: 'active' },
    { user_id: 'i', cohort_id: 'next', status: 'active' },
  ]
  const m = dashboardMetrics({
    cohorts, enrollments, people: [{ id: 'admin1', role: 'admin' }],
    inquiries: [{ status: 'new', follow_up_on: null }, { status: 'contacted', follow_up_on: '2026-11-22' }, { status: 'closed', follow_up_on: '2026-11-01' }],
    registrations: [{ status: 'confirmed' }, { status: 'pending' }], today: '2026-11-22',
  })
  assert.equal(m.activeParticipants, 2)
  assert.equal(m.startingParticipants, 1)
  assert.equal(m.cohortsInProgress, 1)
  assert.equal(m.cohortsUpcoming, 1)
  assert.equal(m.openInquiries, 2)
  assert.equal(m.followUpsDue, 1, 'due today counts; closed inquiries do not')
  assert.equal(m.registrationsToReview, 1)
})

test('cohort counts separate completed, awaiting review, withdrawn and seats taken', () => {
  const c = cohortCounts({ id: 'x', status: 'completed' }, [
    { user_id: 'a', cohort_id: 'x', status: 'active' }, { user_id: 'b', cohort_id: 'x', status: 'withdrawn' },
    { user_id: 'd', cohort_id: 'x', status: 'completed' }, { user_id: 'c', cohort_id: 'y', status: 'active' },
  ])
  assert.deepEqual([c.completed, c.awaitingReview, c.withdrawn, c.seatsTaken, c.total], [1, 1, 1, 1, 3])
})

test('cohort availability tells the owner whether enrollment is closed, open, full or finished', () => {
  const base = { cohortStatus: 'upcoming', capacity: 10, seatsTaken: 3, pathwayEnrollmentOpen: true, checkoutEnabled: false }
  assert.equal(cohortAvailability(base).key, 'closed', 'checkout off means closed even if the pathway is open')
  assert.equal(cohortAvailability({ ...base, checkoutEnabled: true }).key, 'open')
  assert.equal(cohortAvailability({ ...base, checkoutEnabled: true, pathwayEnrollmentOpen: false }).key, 'closed')
  assert.equal(cohortAvailability({ ...base, seatsTaken: 10 }).key, 'full')
  assert.equal(cohortAvailability({ ...base, cohortStatus: 'draft' }).key, 'draft')
  assert.equal(cohortAvailability({ ...base, cohortStatus: 'archived' }).key, 'archived')
})

// ---------------------------------------------------------------- activity log wording
test('activity log entries read as sentences, never raw codes', () => {
  assert.equal(describeActivity({ action: 'cohort.update', entity_type: 'cohort', entity_label: 'Fall 2027', changes: { status: { from: 'draft', to: 'upcoming' } } }),
    'Changed cohort “Fall 2027” status from Draft to Upcoming')
  assert.equal(describeActivity({ action: 'person.update', entity_type: 'person', entity_label: 'Pat Two', changes: { role: { from: 'impact_participant', to: 'admin' } } }),
    'Changed Pat Two’s role from Impact Lab participant to Administrator')
  assert.equal(describeActivity({ action: 'enrollment.update', entity_type: 'enrollment', entity_label: 'Pat — Fall', changes: { status: { from: 'active', to: 'withdrawn' } } }),
    'Withdrew “Pat — Fall”')
  assert.equal(describeActivity({ action: 'resource.delete', entity_type: 'resource', entity_label: 'Guide' }), 'Deleted resource “Guide”')
  assert.equal(describeActivity({ action: 'weekly_rep.archive', entity_type: 'weekly_rep', entity_label: 'Week 1: Listen' }), 'Archived weekly rep “Week 1: Listen”')
  assert.equal(describeActivity({ action: 'enrollment.create', entity_type: 'enrollment', entity_label: 'Pat — Fall', outcome: 'failed' }), 'Failed: Enrolled “Pat — Fall”')
  assert.equal(describeActivity({ action: 'cohort.status', entity_type: 'cohort' }), 'Changed a cohort status', 'older entries still readable')
  assert.deepEqual(describeChanges({ action: 'cohort.update', entity_type: 'cohort', changes: { capacity: { from: null, to: 12 }, zoom_link: { changed: true } } }),
    ['capacity: empty → 12', 'meeting link changed'])
  assert.deepEqual(describeChanges({ action: 'cohort.update', entity_type: 'cohort', changes: { program_id: { from: 'p1', to: 'p2' } } }, { program: id => ({ p1: 'New Leaders', p2: 'Emerging Leaders' } as Record<string, string>)[id] }),
    ['pathway: New Leaders → Emerging Leaders'])
})

// ---------------------------------------------------------------- pathways (public page)
const row = (slug: string, extra: Partial<PathwayRow> = {}): PathwayRow => ({
  id: slug, slug, pathway_number: null, name: '', tagline: null, opening_statement: null, audience: null, description: null,
  leadership_goal: null, keywords: null, price_label: null, enrollment_open: false, is_public: true, ...extra,
})

test('a hidden pathway disappears from the public page (no fallback text)', () => {
  const shown = mergePathways([row('emerging-leaders'), row('new-leaders', { is_public: false }), row('practicing-leaders')])
  assert.deepEqual(shown.map(p => p.slug), ['emerging-leaders', 'practicing-leaders'])
  // Visitors cannot read hidden rows at all, so a missing row is also hidden.
  assert.deepEqual(mergePathways([row('practicing-leaders')]).map(p => p.slug), ['practicing-leaders'])
  assert.equal(mergePathways(null).length, DEFAULT_PATHWAYS.length, 'database unreachable: approved copy')
  assert.equal(countWord(2), 'Two')
})

test('prices are never public while online registration is off', () => {
  const open = row('new-leaders', { enrollment_open: true, price_label: '$250' })
  assert.equal(mergePathways([open])[0].priceLabel, null, 'checkout off: no price')
  assert.equal(mergePathways([open])[0].enrollmentOpen, false)
  assert.equal(mergePathways([open], { checkoutEnabled: true })[0].priceLabel, '$250')
  assert.equal(mergePathways([row('new-leaders', { price_label: '$250' })], { checkoutEnabled: true })[0].priceLabel, null, 'pathway closed: no price')
  assert.equal(checkoutEnabled({}), false)
  assert.equal(checkoutEnabled({ CHECKOUT_ENABLED: 'true' }), true)
  assert.equal(checkoutEnabled({ CHECKOUT_ENABLED: '1' }), false)
})
