'use client'

// The admin home: what needs attention (from real records, each item opening the exact record),
// then upcoming sessions, cohort status and readiness, key numbers, and short how-to help.
import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import type { AdminPanel } from '../useAdminPanel'
import { cohortAvailability, dashboardMetrics, enrollmentOutcome, seatsTaken } from '@/lib/admin-metrics'
import { daysFromTodayET, formatDateET, todayET } from '@/lib/business-time'
import { attentionItems, sortAttention } from '@/lib/attention'
import { paymentAttentionItems } from '@/lib/payment-attention'
import type { AttentionItem, AttentionSeverity } from '@/lib/attention-types'
import { cohortReadiness, readinessLabel, showsReadiness } from '@/lib/cohort-readiness'
import { cardStyle, helpStyle, labelStyle, pageTitleStyle, sectionTitleStyle, statusBadge } from './shared'

const rowStyle = { padding: '0.7rem 0', borderBottom: '1px solid var(--mist)', fontSize: '0.9rem' } as const
const emptyStyle = { color: 'var(--slate)', fontSize: '0.9rem', margin: 0, lineHeight: 1.6 } as const
const linkStyle = { color: '#8a5a10', fontWeight: 600, fontSize: '0.85rem' } as const

const SEVERITY: Record<AttentionSeverity, { label: string; color: string; bg: string }> = {
  urgent: { label: 'Urgent', color: '#8c1d18', bg: '#fdecea' },
  action: { label: 'To do', color: '#8a5a10', bg: 'rgba(200,136,32,0.14)' },
  info: { label: 'For your information', color: 'var(--slate)', bg: 'var(--mist)' },
}

/** "Tue, Nov 24" for a stored YYYY-MM-DD date (never shifted by a time zone). */
function sessionDay(date: string): string {
  const d = new Date(`${date}T12:00:00Z`)
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }).format(d)
}

const HELP: { q: string; a: ReactNode; href: string; link: string }[] = [
  { q: 'Create and prepare a cohort', href: '/admin/cohorts', link: 'Go to Cohorts',
    a: <>Select <strong>+ New cohort</strong>, choose the pathway and dates, and save it as a Draft. Open it and follow its <strong>Setup checklist</strong>: each item opens the place to fix it. Set the status to Upcoming when you want to announce it.</> },
  { q: 'Invite a participant', href: '/admin/users?invite=1', link: 'Invite someone',
    a: <>In <strong>Participants</strong>, select <strong>+ Invite someone</strong>, enter their name and email, and choose a cohort. New people get a link to set their password; people who already have an account are enrolled and told by email.</> },
  { q: 'Turn an inquiry into an enrollment', href: '/admin/inquiries', link: 'Go to Inquiries',
    a: <>Open the inquiry and select <strong>Invite to a cohort</strong>. Their name and email are filled in; choose a cohort and send. For organizations, add each employee in the same place. You can then mark the inquiry Converted.</> },
  { q: 'Upload learning materials', href: '/admin/resources', link: 'Go to Resources',
    a: <>In <strong>Resources</strong>, upload a file or paste a link and choose who sees it (one cohort, a pathway, or everyone). Participants find it in their Library.</> },
  { q: 'Send or resend an invitation', href: '/admin/users?filter=not_signed_in', link: 'People not signed in',
    a: <>Open the person in <strong>Participants</strong> and select <strong>Send sign-in email</strong>. If they never set a password they get a fresh set-up link; otherwise a password reset. Failed emails show a <strong>Resend</strong> button.</> },
  { q: 'Review participation', href: '/admin/cohorts', link: 'Go to Cohorts',
    a: <>Open the cohort and its <strong>Participation</strong> section: who has submitted each weekly rep and who hasn&apos;t, without showing anyone&apos;s private reflections.</> },
  { q: 'Mark a program complete and issue a certificate', href: '/admin/cohorts', link: 'Go to Cohorts',
    a: <>Open the cohort&apos;s <strong>Completion &amp; certificates</strong> section. Mark each person complete when you are satisfied (your decision), then issue their certificate. They can download it from their portal.</> },
  { q: 'Review failed emails', href: '/admin/security#sec-email', link: 'Email delivery',
    a: <>Failed emails appear at the top of this page. Account emails can be resent with a new link; others can be marked handled after you reach the person another way. The full list is under <strong>Security &amp; activity</strong>.</> },
]

export default function DashboardTab(panel: AdminPanel) {
  const { programs, cohorts, enrollments, users, inquiries, registrations, cohortSessions, checkoutEnabled, me } = panel
  const today = todayET()
  const [showAll, setShowAll] = useState(false)

  const m = dashboardMetrics({ cohorts, enrollments, people: users.map(u => ({ id: u.id, role: u.role })), inquiries, registrations, today })
  const admins = new Set(users.filter(u => u.role === 'admin').map(u => u.id))
  const awaitingReview = enrollments.filter(e => !admins.has(e.user_id) && enrollmentOutcome(e.status, cohorts.find(c => c.id === e.cohort_id)?.status ?? null) === 'awaiting_review').length

  const readiness = {
    programs, sessions: cohortSessions, reps: panel.reps, prompts: panel.journalPrompts, resources: panel.resources,
    announcements: panel.announcements, enrollments, people: users, emailProblems: panel.emailProblems,
  }
  const paymentItems = paymentAttentionItems({ registrations, paymentRequests: panel.paymentRequests, cohorts: cohorts.map(c => ({ ...c, capacity: c.capacity ?? null })), enrollments, today })
  // A registration with a payment item (e.g. "Paid: confirm …") is listed once, by its payment item.
  const coveredRegs = new Set(paymentItems.map(i => i.href.match(/registrations\?id=([0-9a-f-]+)/)?.[1]).filter(Boolean))
  const items: AttentionItem[] = sortAttention([
    ...attentionItems({
      today, inquiries, emailProblems: panel.emailProblems, registrations, cohorts, enrollments, people: users,
      certificates: panel.certificates, readiness,
    }).filter(i => !(i.id.startsWith('registration:') && coveredRegs.has(i.id.slice('registration:'.length)))),
    ...paymentItems,
  ])
  const urgent = items.filter(i => i.severity === 'urgent').length
  const shown = showAll ? items : items.slice(0, 8)

  const cohortById = new Map(cohorts.map(c => [c.id, c]))
  const programById = new Map(programs.map(p => [p.id, p]))
  const nextSessions = cohortSessions
    .filter(s => {
      if (!s.session_date) return false
      const status = cohortById.get(s.cohort_id)?.status
      if (status === 'cancelled' || status === 'archived' || status === 'completed') return false
      const days = daysFromTodayET(s.session_date)
      return days >= 0 && days <= 14
    })
    .sort((a, b) => a.session_date!.localeCompare(b.session_date!) || a.session_number - b.session_number)

  const current = cohorts
    .filter(c => c.status === 'active' || c.status === 'upcoming' || c.status === 'draft')
    .sort((a, b) => ['active', 'upcoming', 'draft'].indexOf(a.status) - ['active', 'upcoming', 'draft'].indexOf(b.status) || (a.start_date ?? '9999').localeCompare(b.start_date ?? '9999'))

  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
  const firstName = me.name.split(' ')[0] || me.name
  const hiddenPathways = programs.filter(p => p.slug && !p.is_public).length

  const tiles: { label: string; value: number; sub: ReactNode; href: string }[] = [
    { label: 'Active participants', value: m.activeParticipants, sub: `in running cohorts · ${m.startingParticipants} starting soon`, href: '/admin/users' },
    { label: 'Cohorts running', value: m.cohortsInProgress, sub: `${m.cohortsUpcoming} upcoming`, href: '/admin/cohorts' },
    { label: 'Open inquiries', value: m.openInquiries, sub: m.followUpsDue > 0 ? <strong style={{ color: '#8c1d18' }}>{plural(m.followUpsDue, 'follow-up')} due</strong> : 'no follow-ups due', href: '/admin/inquiries' },
    { label: 'Completion to record', value: awaitingReview, sub: 'participants in finished cohorts', href: '/admin/cohorts' },
  ]
  if (m.registrationsToReview > 0 || checkoutEnabled) tiles.push({ label: 'Registrations to review', value: m.registrationsToReview, sub: 'waiting for you', href: '/admin/registrations' })

  return (
    <div>
      <span style={labelStyle}>Admin · {formatDateET(today, 'long')}</span>
      <h1 style={{ ...pageTitleStyle, marginBottom: '1.25rem' }}>Welcome, {firstName}</h1>

      {/* ------------------------------------------------ 1. needs your attention */}
      <section style={{ ...cardStyle, borderTop: `4px solid ${urgent ? '#b3261e' : items.length ? 'var(--gold)' : '#2e7d4f'}` }} aria-labelledby="dash-attention">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
          <h2 id="dash-attention" style={{ ...sectionTitleStyle, margin: 0 }}>Needs your attention</h2>
          {items.length > 0 && <span style={{ fontSize: '0.85rem', color: 'var(--slate)' }}>{plural(items.length, 'item')}{urgent ? ` · ${urgent} urgent` : ''}</span>}
        </div>
        {panel.loading ? <p style={{ ...emptyStyle, marginTop: '0.75rem' }}>Loading…</p> : items.length === 0 ? (
          <p style={{ margin: '0.75rem 0 0', fontSize: '1rem', color: '#14532d', fontWeight: 600 }}>✓ You&apos;re all caught up. Nothing needs your attention right now.</p>
        ) : (
          <>
            <ul style={{ listStyle: 'none', margin: '0.5rem 0 0', padding: 0 }}>
              {shown.map(it => {
                const sev = SEVERITY[it.severity]
                return (
                  <li key={it.id} style={{ ...rowStyle, display: 'flex', gap: '0.5rem 1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ flex: '1 1 300px', minWidth: 0 }}>
                      <span style={{ display: 'inline-block', fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.15rem 0.5rem', borderRadius: '2px', background: sev.bg, color: sev.color, marginRight: '0.5rem', verticalAlign: '0.1em' }}>{sev.label}</span>
                      <strong style={{ color: 'var(--navy)' }}>{it.title}</strong>
                      {it.detail && <span style={{ display: 'block', color: 'var(--slate)', fontSize: '0.84rem', marginTop: '0.15rem', lineHeight: 1.5 }}>{it.detail}</span>}
                    </span>
                    <Link href={it.href} className="btn btn-primary" style={{ fontSize: '0.78rem', padding: '0.55rem 0.9rem', minHeight: '40px', display: 'inline-flex', alignItems: 'center' }}>{it.actionLabel} <span aria-hidden="true">&nbsp;→</span></Link>
                  </li>
                )
              })}
            </ul>
            {items.length > 8 && (
              <button type="button" onClick={() => setShowAll(v => !v)} style={{ marginTop: '0.75rem', background: 'none', border: 'none', padding: 0, ...linkStyle, cursor: 'pointer', textDecoration: 'underline', minHeight: '40px' }}>
                {showAll ? 'Show fewer' : `Show all ${items.length}`}
              </button>
            )}
          </>
        )}
      </section>

      <div className="two-col-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        {/* ------------------------------------------------ 2. upcoming sessions */}
        <section style={{ ...cardStyle, marginBottom: 0 }} aria-labelledby="dash-next">
          <h2 id="dash-next" style={sectionTitleStyle}>Upcoming sessions · next 14 days</h2>
          {nextSessions.length === 0
            ? <p style={emptyStyle}>No sessions in the next two weeks. Session dates are set in each cohort&apos;s Schedule section.</p>
            : nextSessions.slice(0, 8).map(s => {
              const days = daysFromTodayET(s.session_date!)
              const cohort = cohortById.get(s.cohort_id)
              return (
                <div key={s.id} style={{ ...rowStyle, display: 'flex', gap: '0.85rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
                  <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.72rem', color: '#8a5a10', minWidth: '6.5rem', textTransform: 'uppercase' }}>
                    {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : sessionDay(s.session_date!)}
                  </span>
                  <span style={{ color: 'var(--ink)', flex: '1 1 10rem' }}>
                    {s.title} · <Link href={`/admin/cohorts?cohort=${s.cohort_id}&section=schedule`} style={{ color: 'var(--slate)' }}>{cohort?.name ?? 'Cohort'}{cohort?.status === 'draft' ? ' (draft)' : ''}</Link>
                  </span>
                </div>
              )
            })}
        </section>

        {/* ------------------------------------------------ 3. cohort status and readiness */}
        <section style={{ ...cardStyle, marginBottom: 0 }} aria-labelledby="dash-cohorts">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
            <h2 id="dash-cohorts" style={sectionTitleStyle}>Cohorts</h2>
            <Link href="/admin/cohorts" style={linkStyle}>All cohorts →</Link>
          </div>
          {current.length === 0 && <p style={emptyStyle}>No current cohorts. Create one in Cohorts; it starts as a Draft until you set it to Upcoming.</p>}
          {current.map(c => {
            const taken = seatsTaken(c.id, enrollments)
            const program = programById.get(c.program_id)
            const av = cohortAvailability({ cohortStatus: c.status, capacity: c.capacity, seatsTaken: taken, pathwayEnrollmentOpen: !!program?.enrollment_open, checkoutEnabled })
            const r = showsReadiness(c.status) ? cohortReadiness({ ...readiness, cohort: c }) : null
            return (
              <Link key={c.id} href={`/admin/cohorts?cohort=${c.id}&section=${r && !r.ready ? 'readiness' : 'participants'}`} style={{ ...rowStyle, display: 'block', textDecoration: 'none', color: 'inherit' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, color: 'var(--navy)' }}>{c.name}</span>
                  <span style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    {statusBadge(c.status === 'active' ? 'in_progress' : c.status, c.status === 'active' ? 'In progress' : undefined)}
                    {c.status === 'upcoming' && statusBadge(av.key, av.label)}
                    {r && statusBadge(r.ready ? 'open' : 'full', readinessLabel(r))}
                  </span>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--slate)', marginTop: '0.2rem', lineHeight: 1.5 }}>
                  {c.capacity ? `${taken} of ${c.capacity} seats` : `${taken} enrolled · no seat limit`}
                  {program ? ` · ${program.name}` : ''}
                  {c.start_date ? ` · starts ${formatDateET(c.start_date)}` : ' · no dates yet'}
                </div>
                {r && !r.ready && <div style={{ fontSize: '0.8rem', color: '#8a5a10', marginTop: '0.25rem' }}>{r.summary}</div>}
              </Link>
            )
          })}
        </section>
      </div>

      {/* ------------------------------------------------ 4. key numbers */}
      <section aria-labelledby="dash-numbers" style={{ marginBottom: '1rem' }}>
        <h2 id="dash-numbers" style={{ ...sectionTitleStyle, fontSize: '1.05rem' }}>Key numbers</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '0.75rem' }}>
          {tiles.map(t => (
            <Link key={t.label} href={t.href} style={{ ...cardStyle, marginBottom: 0, padding: '1rem 1.1rem', display: 'block', textDecoration: 'none', color: 'inherit' }}>
              <span style={{ ...labelStyle, marginBottom: '0.3rem' }}>{t.label}</span>
              <div style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '2rem', color: 'var(--navy)', letterSpacing: '0.04em', lineHeight: 1, marginBottom: '0.25rem' }}>{t.value}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--slate)', lineHeight: 1.45 }}>{t.sub}</div>
            </Link>
          ))}
        </div>
        <details style={{ marginTop: '0.5rem' }}>
          <summary style={{ cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600, color: '#8a5a10', padding: '0.4rem 0' }}>How these numbers are counted</summary>
          <ul style={{ ...helpStyle, paddingLeft: '1.2rem', margin: '0.5rem 0 0' }}>
            <li><strong>Active participants</strong>: different people (administrators not counted) enrolled in a cohort that is running now. “Starting soon” counts people in Upcoming cohorts.</li>
            <li><strong>Cohorts running</strong>: cohorts whose status is Active.</li>
            <li><strong>Open inquiries</strong>: inquiries not marked Converted or Closed. A follow-up is due when its date is today or earlier (New York time).</li>
            <li><strong>Completion to record</strong>: people still enrolled in a cohort that has finished, whose completion you have not recorded yet. Nobody is marked complete automatically.</li>
            <li>All numbers come straight from the records; nothing is estimated.</li>
          </ul>
        </details>
        <p style={{ ...helpStyle, fontSize: '0.84rem', margin: '0.5rem 0 0' }}>
          Online registration is <strong>{checkoutEnabled ? 'on' : 'off'}</strong>{checkoutEnabled ? '' : ': visitors use the inquiry form and you enroll people'}.
          {hiddenPathways > 0 ? ` ${plural(hiddenPathways, 'pathway')} hidden from the public page.` : ''} <Link href="/admin/programs" style={linkStyle}>Pathways →</Link>
        </p>
      </section>

      {/* ------------------------------------------------ 5. quick help */}
      <section style={cardStyle} aria-labelledby="dash-help">
        <h2 id="dash-help" style={sectionTitleStyle}>How do I…?</h2>
        <div>
          {HELP.map(h => (
            <details key={h.q} style={{ borderBottom: '1px solid var(--mist)' }}>
              <summary style={{ cursor: 'pointer', padding: '0.75rem 0', fontWeight: 600, color: 'var(--navy)', fontSize: '0.92rem', minHeight: '44px', display: 'flex', alignItems: 'center' }}>{h.q}</summary>
              <p style={{ ...helpStyle, margin: '0 0 0.5rem' }}>{h.a}</p>
              <p style={{ margin: '0 0 0.85rem' }}><Link href={h.href} style={linkStyle}>{h.link} →</Link></p>
            </details>
          ))}
        </div>
      </section>
    </div>
  )
}
