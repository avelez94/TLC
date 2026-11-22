import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { AdminPanel } from '../useAdminPanel'
import { cardStyle, statusBadge } from './shared'

const h3 = { fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', margin: '0 0 1rem' } as const
const label = { fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.55rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '0.5rem' } as const

export default function DashboardTab({ programs, cohorts, enrollments, registrations, cohortSessions, setShowInviteForm, setShowCohortForm, setShowAnnouncementForm, setShowRepForm, setShowResourceForm }: AdminPanel) {
  const router = useRouter()
  const [openInquiries, setOpenInquiries] = useState<number | null>(null)
  const [followUpsDue, setFollowUpsDue] = useState<number | null>(null)

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    supabase.from('inquiries').select('status, follow_up_on').then(({ data, error }) => {
      if (error || !data) return
      const open = data.filter(r => !['converted', 'closed'].includes(r.status))
      setOpenInquiries(open.length)
      setFollowUpsDue(open.filter(r => r.follow_up_on && r.follow_up_on <= today).length)
    })
  }, [])

  const activeEnrollments = enrollments.filter(e => e.status === 'active')
  const upcoming = cohorts.filter(c => c.status === 'upcoming')
  const inProgress = cohorts.filter(c => c.status === 'active')
  const pendingRegs = registrations.filter((r: { status: string }) => r.status === 'pending')
  const paidUnconfirmed = registrations.filter((r: { status: string; payment_status: string }) => r.status === 'pending' && r.payment_status === 'paid')
  const now = new Date(); const in14 = new Date(now.getTime() + 14 * 86400000)
  const nextSessions = (cohortSessions as { id: string; cohort_id: string; title: string; session_date: string | null }[])
    .filter(s => s.session_date && new Date(s.session_date + 'T23:59:59') >= now && new Date(s.session_date + 'T00:00:00') <= in14)
    .sort((a, b) => (a.session_date! < b.session_date! ? -1 : 1)).slice(0, 8)
  const cohortName = (id: string) => cohorts.find(c => c.id === id)?.name ?? 'Cohort'
  const pathways = (programs as unknown as { id: string; name: string; slug?: string | null; is_public?: boolean; enrollment_open?: boolean }[]).filter(p => p.slug)

  const stats = [
    { label: 'Cohorts in progress', value: inProgress.length, sub: `${upcoming.length} upcoming`, href: '/admin/cohorts' },
    { label: 'Active participants', value: activeEnrollments.length, sub: 'Active enrollments', href: '/admin/users' },
    { label: 'Registrations to review', value: pendingRegs.length, sub: `${paidUnconfirmed.length} paid, awaiting confirmation`, href: '/admin/registrations' },
    { label: 'Open inquiries', value: openInquiries ?? '—', sub: followUpsDue ? `${followUpsDue} follow-up${followUpsDue === 1 ? '' : 's'} due` : 'Organizations and individuals', href: '/admin/inquiries' },
  ]

  return (
    <div>
      <span style={{ ...label, fontSize: '0.6rem', marginBottom: 0 }}>Admin</span>
      <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', margin: '0.25rem 0 1.5rem' }}>Overview</h1>

      <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {stats.map(s => (
          <button key={s.label} onClick={() => router.push(s.href)} style={{ ...cardStyle, marginBottom: 0, textAlign: 'left', cursor: 'pointer', font: 'inherit' }}>
            <span style={label}>{s.label}</span>
            <div style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '2.5rem', color: 'var(--navy)', letterSpacing: '0.04em', lineHeight: 1, marginBottom: '0.25rem' }}>{s.value}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--slate)' }}>{s.sub}</div>
          </button>
        ))}
      </div>

      <div className="two-col-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div style={cardStyle}>
          <h3 style={h3}>Next 14 days</h3>
          {nextSessions.length === 0 ? <p style={{ color: 'var(--slate)', fontSize: '0.85rem' }}>No sessions scheduled in the next two weeks.</p> : nextSessions.map(s => (
            <div key={s.id} style={{ display: 'flex', gap: '1rem', padding: '0.55rem 0', borderBottom: '1px solid var(--mist)', fontSize: '0.85rem' }}>
              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.65rem', color: 'var(--gold)', minWidth: '4.5rem', textTransform: 'uppercase' }}>{new Date(s.session_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
              <span style={{ color: 'var(--ink)' }}>{s.title} <span style={{ color: 'var(--slate)' }}>· {cohortName(s.cohort_id)}</span></span>
            </div>
          ))}
        </div>
        <div style={cardStyle}>
          <h3 style={h3}>Cohorts open or running</h3>
          {[...inProgress, ...upcoming].length === 0 && <p style={{ color: 'var(--slate)', fontSize: '0.85rem' }}>No cohorts are open or running. Create one in Cohorts and set it to Upcoming.</p>}
          {[...inProgress, ...upcoming].map(c => {
            const n = activeEnrollments.filter(e => e.cohort_id === c.id).length
            return (
              <div key={c.id} style={{ padding: '0.6rem 0', borderBottom: '1px solid var(--mist)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.85rem' }}>{c.name}</span>{statusBadge(c.status)}
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--slate)' }}>{c.capacity ? `${n} of ${c.capacity} seats filled` : `${n} enrolled · no capacity set`}</span>
                {c.capacity ? <div style={{ height: '6px', background: 'var(--mist)', borderRadius: '3px', marginTop: '0.35rem' }}><div style={{ height: '100%', width: `${Math.min(100, (n / c.capacity) * 100)}%`, background: 'var(--gold)', borderRadius: '3px' }} /></div> : null}
              </div>
            )
          })}
        </div>
      </div>

      <div className="two-col-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div style={cardStyle}>
          <h3 style={h3}>Pathways</h3>
          {pathways.length === 0 && <p style={{ color: 'var(--slate)', fontSize: '0.85rem' }}>Pathway records not added yet.</p>}
          {pathways.map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', padding: '0.55rem 0', borderBottom: '1px solid var(--mist)', fontSize: '0.85rem', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, color: 'var(--navy)' }}>{p.name}</span>
              <span style={{ color: 'var(--slate)' }}>{p.is_public ? 'On public page' : 'Hidden'} · {p.enrollment_open ? 'Enrollment open' : 'Enrollment closed'}</span>
            </div>
          ))}
        </div>
        <div style={cardStyle}>
          <h3 style={h3}>Quick actions</h3>
          {[
            { label: 'Review registrations', action: () => router.push('/admin/registrations') },
            { label: 'Follow up on inquiries', action: () => router.push('/admin/inquiries') },
            { label: 'Invite or enroll a participant', action: () => { router.push('/admin/users'); setShowInviteForm(true) } },
            { label: 'Create a cohort', action: () => { router.push('/admin/cohorts'); setShowCohortForm(true) } },
            { label: 'Post an announcement', action: () => { router.push('/admin/announcements'); setShowAnnouncementForm(true) } },
            { label: 'Add a weekly rep', action: () => { router.push('/admin/reps'); setShowRepForm(true) } },
            { label: 'Add a resource', action: () => { router.push('/admin/resources'); setShowResourceForm(true) } },
          ].map(({ label: l, action }) => (
            <button key={l} onClick={action} style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '0.6rem 0', background: 'none', border: 'none', borderBottom: '1px solid var(--mist)', color: 'var(--navy)', fontSize: '0.85rem', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
              {l} <span style={{ color: 'var(--gold)' }}>&#8594;</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
