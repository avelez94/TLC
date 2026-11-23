'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import type { AdminPanel } from '../useAdminPanel'
import { cohortAvailability, dashboardMetrics, seatsTaken } from '@/lib/admin-metrics'
import { daysFromTodayET, formatDateET, todayET } from '@/lib/business-time'
import { cardStyle, helpStyle, labelStyle, pageTitleStyle, programChoices, sectionTitleStyle, statusBadge } from './shared'

const rowStyle = { padding: '0.6rem 0', borderBottom: '1px solid var(--mist)', fontSize: '0.9rem' } as const
const emptyStyle = { color: 'var(--slate)', fontSize: '0.9rem', margin: 0, lineHeight: 1.6 } as const

/** "Tue, Nov 24" for a stored YYYY-MM-DD date (never shifted by a time zone). */
function sessionDay(date: string): string {
  const d = new Date(`${date}T12:00:00Z`)
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }).format(d)
}

export default function DashboardTab(panel: AdminPanel) {
  const { programs, cohorts, enrollments, users, inquiries, registrations, cohortSessions, checkoutEnabled } = panel
  const today = todayET()

  const m = dashboardMetrics({
    cohorts, enrollments, people: users.map(u => ({ id: u.id, role: u.role })), inquiries, registrations, today,
  })
  const showRegistrations = m.registrationsToReview > 0 || checkoutEnabled

  const programById = new Map(programs.map(p => [p.id, p]))
  const cohortById = new Map(cohorts.map(c => [c.id, c]))

  // Sessions dated today through 14 days from today (New York calendar date, compared as dates).
  const nextSessions = cohortSessions
    .filter(s => {
      if (!s.session_date) return false
      const status = cohortById.get(s.cohort_id)?.status
      if (status === 'cancelled' || status === 'archived') return false
      const days = daysFromTodayET(s.session_date)
      return days >= 0 && days <= 14
    })
    .sort((a, b) => (a.session_date! < b.session_date! ? -1 : a.session_date! > b.session_date! ? 1 : a.session_number - b.session_number))

  const running = cohorts
    .filter(c => c.status === 'active' || c.status === 'upcoming')
    .sort((a, b) => (a.status === b.status ? (a.start_date ?? '9999').localeCompare(b.start_date ?? '9999') : a.status === 'active' ? -1 : 1))

  const pathways = programChoices(programs)
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

  const tiles: { label: string; value: number; sub: ReactNode; href: string; alert?: boolean }[] = [
    { label: 'Cohorts in progress', value: m.cohortsInProgress, sub: `${m.cohortsUpcoming} upcoming`, href: '/admin/cohorts' },
    { label: 'Active participants', value: m.activeParticipants, sub: `in cohorts running now · ${m.startingParticipants} starting soon`, href: '/admin/users' },
    {
      label: 'Open inquiries', value: m.openInquiries, href: '/admin/inquiries', alert: m.followUpsDue > 0,
      sub: m.followUpsDue > 0
        ? <strong style={{ color: '#b3261e' }}>⚠ {plural(m.followUpsDue, 'follow-up')} due</strong>
        : '0 follow-ups due',
    },
  ]
  if (showRegistrations) {
    tiles.push({ label: 'Registrations to review', value: m.registrationsToReview, sub: 'waiting for you to confirm or decline', href: '/admin/registrations', alert: m.registrationsToReview > 0 })
  }

  const quickActions = [
    { label: 'Follow up on inquiries', href: '/admin/inquiries' },
    { label: 'Create a cohort', href: '/admin/cohorts' },
    { label: 'Invite or enroll a participant', href: '/admin/users?invite=1' },
    { label: 'Post an announcement', href: '/admin/announcements' },
    { label: 'Add a resource', href: '/admin/resources' },
    { label: 'Weekly reps & prompts', hint: 'open a cohort', href: '/admin/cohorts' },
  ]

  return (
    <div>
      <span style={labelStyle}>Admin</span>
      <h1 style={{ ...pageTitleStyle, marginBottom: '1.25rem' }}>Overview</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '1rem', marginBottom: '0.75rem' }}>
        {tiles.map(t => (
          <Link key={t.label} href={t.href} style={{ ...cardStyle, marginBottom: 0, display: 'block', textDecoration: 'none', color: 'inherit', borderLeft: t.alert ? '4px solid #b3261e' : cardStyle.border }}>
            <span style={labelStyle}>{t.label}</span>
            <div style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '2.5rem', color: 'var(--navy)', letterSpacing: '0.04em', lineHeight: 1, marginBottom: '0.35rem' }}>{t.value}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--slate)', lineHeight: 1.5 }}>{t.sub}</div>
          </Link>
        ))}
      </div>

      <details style={{ marginBottom: '1.5rem' }}>
        <summary style={{ cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600, color: '#8a5a10', padding: '0.4rem 0' }}>How these numbers are counted</summary>
        <ul style={{ ...helpStyle, paddingLeft: '1.2rem', margin: '0.5rem 0 0' }}>
          <li><strong>Cohorts in progress</strong>: cohorts whose status is Active (running now). Upcoming cohorts are counted separately.</li>
          <li><strong>Active participants</strong>: different people (administrators not counted) who are enrolled in a cohort that is running now. Someone in two running cohorts counts once. “Starting soon” counts people enrolled in Upcoming cohorts.</li>
          <li><strong>Open inquiries</strong>: every inquiry not marked Converted or Closed. A follow-up is due when its follow-up date is today or earlier (New York time).</li>
          {showRegistrations && <li><strong>Registrations to review</strong>: registrations with the status Pending.</li>}
          <li>A person who withdrew is never counted as active. Enrollments in a Completed or Archived cohort count as completed.</li>
          <li>All numbers come straight from the records in the database; nothing is estimated.</li>
        </ul>
      </details>

      <div className="two-col-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <section style={cardStyle} aria-labelledby="dash-next">
          <h2 id="dash-next" style={sectionTitleStyle}>Next 14 days</h2>
          {nextSessions.length === 0
            ? <p style={emptyStyle}>No sessions are scheduled between today and two weeks from now. Session dates are set in each cohort’s schedule.</p>
            : nextSessions.map(s => {
              const days = daysFromTodayET(s.session_date!)
              const cohort = cohortById.get(s.cohort_id)
              return (
                <div key={s.id} style={{ ...rowStyle, display: 'flex', gap: '0.85rem', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.72rem', color: '#8a5a10', minWidth: '6.5rem', textTransform: 'uppercase', paddingTop: '0.1rem' }}>
                    {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : sessionDay(s.session_date!)}
                  </span>
                  <span style={{ color: 'var(--ink)', flex: '1 1 10rem' }}>
                    {s.title} <span style={{ color: 'var(--slate)' }}>· {cohort?.name ?? 'Cohort'}{cohort?.status === 'draft' ? ' (draft)' : ''}</span>
                  </span>
                </div>
              )
            })}
        </section>

        <section style={cardStyle} aria-labelledby="dash-cohorts">
          <h2 id="dash-cohorts" style={sectionTitleStyle}>Cohorts open or running</h2>
          {running.length === 0 && <p style={emptyStyle}>No cohorts are running or upcoming. Create one in Cohorts and set its status to Upcoming.</p>}
          {running.map(c => {
            const taken = seatsTaken(c.id, enrollments)
            const program = programById.get(c.program_id)
            const av = cohortAvailability({ cohortStatus: c.status, capacity: c.capacity, seatsTaken: taken, pathwayEnrollmentOpen: !!program?.enrollment_open, checkoutEnabled })
            return (
              <div key={c.id} style={rowStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, color: 'var(--navy)' }}>{c.name}</span>
                  {statusBadge(av.key, av.label)}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--slate)', marginTop: '0.2rem', lineHeight: 1.5 }}>
                  {c.capacity ? `${taken} of ${c.capacity} seats taken` : `${taken} enrolled · no seat limit`}
                  {program ? ` · ${program.name}` : ''}
                  {c.start_date ? ` · starts ${formatDateET(c.start_date)}` : ''}
                </div>
                {c.capacity ? (
                  <div aria-hidden="true" style={{ height: '6px', background: 'var(--mist)', borderRadius: '3px', marginTop: '0.35rem' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, (taken / c.capacity) * 100)}%`, background: 'var(--gold)', borderRadius: '3px' }} />
                  </div>
                ) : null}
                <div style={{ fontSize: '0.8rem', color: 'var(--slate)', marginTop: '0.3rem' }}>{av.detail}</div>
              </div>
            )
          })}
        </section>
      </div>

      <div className="two-col-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <section style={cardStyle} aria-labelledby="dash-pathways">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
            <h2 id="dash-pathways" style={sectionTitleStyle}>Pathways</h2>
            <Link href="/admin/programs" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#8a5a10' }}>Manage pathways →</Link>
          </div>
          {pathways.length === 0 && <p style={emptyStyle}>No pathways have been set up yet.</p>}
          {pathways.map(p => {
            const open = !!p.enrollment_open && checkoutEnabled
            return (
              <div key={p.id} style={{ ...rowStyle, display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, color: 'var(--navy)' }}>{p.name}</span>
                <span style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  {statusBadge(p.is_public ? 'upcoming' : 'draft', p.is_public ? 'On the public page' : 'Hidden')}
                  {statusBadge(open ? 'open' : 'closed', open ? 'Enrollment open' : 'Enrollment closed')}
                </span>
                {!open && p.enrollment_open && !checkoutEnabled && (
                  <span style={{ flexBasis: '100%', fontSize: '0.8rem', color: 'var(--slate)' }}>Marked open, but online registration is off for the site, so visitors are sent to the inquiry form.</span>
                )}
              </div>
            )
          })}
        </section>

        <section style={cardStyle} aria-labelledby="dash-actions">
          <h2 id="dash-actions" style={sectionTitleStyle}>Quick actions</h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {quickActions.map(a => (
              <li key={a.label}>
                <Link href={a.href} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', padding: '0.7rem 0', borderBottom: '1px solid var(--mist)', color: 'var(--navy)', fontSize: '0.9rem', textDecoration: 'none' }}>
                  <span>{a.label}{'hint' in a && a.hint ? <span style={{ color: 'var(--slate)', fontSize: '0.8rem' }}> ({a.hint})</span> : null}</span> <span aria-hidden="true" style={{ color: '#8a5a10' }}>&#8594;</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
