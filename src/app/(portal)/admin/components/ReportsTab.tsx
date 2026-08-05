import type { AdminPanel } from '../useAdminPanel'
import { cardStyle, statusBadge } from './shared'

type ReportsTabProps = Pick<AdminPanel, 'users' | 'cohorts' | 'certificates' | 'enrollments' | 'reps'>

export default function ReportsTab({ users, cohorts, certificates, enrollments, reps }: ReportsTabProps) {
  const activeCohorts = cohorts.filter(c => c.status === 'active')
  const impactUsers = users.filter(u => u.role === 'impact_participant')
  const coachingUsers = users.filter(u => u.role === 'coaching_client')

  return (
    <div>
      <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Reports</span>
      <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '1.5rem' }}>Program Reports</h1>
      <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Total Users', value: String(users.length), sub: 'All accounts' },
          { label: 'Active Cohorts', value: String(activeCohorts.length), sub: 'Currently running' },
          { label: 'Certificates Issued', value: String(certificates.length), sub: 'All time' },
        ].map(({ label, value, sub }) => (
          <div key={label} style={{ ...cardStyle, marginBottom: 0 }}>
            <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.55rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '0.5rem' }}>{label}</span>
            <div style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '2.5rem', color: 'var(--navy)', letterSpacing: '0.04em', lineHeight: 1, marginBottom: '0.25rem' }}>{value}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--slate)' }}>{sub}</div>
          </div>
        ))}
      </div>
      <div style={cardStyle}>
        <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1rem' }}>Enrollment by Cohort</h3>
        {cohorts.length === 0 && <p style={{ color: 'var(--slate)', fontSize: '0.85rem' }}>No cohorts yet.</p>}
        {cohorts.map(c => {
          const count = enrollments.filter(e => e.cohort_id === c.id && e.status === 'active').length
          const max = 25
          return (
            <div key={c.id} style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span style={{ color: 'var(--navy)', fontWeight: 600, fontSize: '0.88rem' }}>{c.name}</span>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  {statusBadge(c.status)}
                  <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: 'var(--gold)' }}>{count} enrolled</span>
                </div>
              </div>
              <div style={{ height: '8px', background: 'var(--mist)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min((count / max) * 100, 100)}%`, background: 'var(--gold)', borderRadius: '4px' }} />
              </div>
            </div>
          )
        })}
      </div>
      <div style={cardStyle}>
        <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1rem' }}>Users by Role</h3>
        {[
          { label: 'Impact Lab Participants', count: impactUsers.length, color: 'var(--navy)' },
          { label: 'Coaching Clients', count: coachingUsers.length, color: 'var(--gold)' },
          { label: 'Admins', count: users.filter(u => u.role === 'admin').length, color: 'var(--slate)' },
        ].map(({ label, count, color }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderBottom: '1px solid var(--mist)' }}>
            <span style={{ color: 'var(--ink)', fontSize: '0.88rem' }}>{label}</span>
            <span style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.5rem', color, letterSpacing: '0.04em' }}>{count}</span>
          </div>
        ))}
      </div>
      <div style={cardStyle}>
        <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1rem' }}>Weekly Reps</h3>
        {reps.length === 0 && <p style={{ color: 'var(--slate)', fontSize: '0.85rem' }}>No weekly reps yet.</p>}
        {reps.map(r => (
          <div key={r.id} style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--mist)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ color: 'var(--navy)', fontWeight: 500, fontSize: '0.85rem' }}>Week {r.week_number} — {r.title}</span>
              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', color: 'var(--slate)' }}>{(r.cohorts as any)?.name}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
