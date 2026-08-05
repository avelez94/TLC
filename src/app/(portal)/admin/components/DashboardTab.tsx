import type { AdminPanel } from '../useAdminPanel'
import { cardStyle, thStyle, tdStyle, statusBadge, type Page } from './shared'

interface DashboardTabProps extends AdminPanel {
  setPage: (page: Page) => void
}

export default function DashboardTab({ users, programs, cohorts, enrollments, setPage, setShowInviteForm, setShowCohortForm, setShowAnnouncementForm, setShowRepForm, setShowResourceForm }: DashboardTabProps) {
  const activeCohorts = cohorts.filter(c => c.status === 'active')
  const impactUsers = users.filter(u => u.role === 'impact_participant')
  const coachingUsers = users.filter(u => u.role === 'coaching_client')

  return (
    <div>
      <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)' }}>Admin</span>
      <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', marginTop: '0.25rem', marginBottom: '1.5rem' }}>Overview</h1>
      <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Total Users', value: String(users.length), sub: 'All accounts' },
          { label: 'Impact Lab', value: String(impactUsers.length), sub: 'Participants' },
          { label: 'Coaching Clients', value: String(coachingUsers.length), sub: 'Active clients' },
          { label: 'Active Cohorts', value: String(activeCohorts.length), sub: 'Currently running' },
        ].map(({ label, value, sub }) => (
          <div key={label} style={{ ...cardStyle, marginBottom: 0 }}>
            <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.55rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '0.5rem' }}>{label}</span>
            <div style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '2.5rem', color: 'var(--navy)', letterSpacing: '0.04em', lineHeight: 1, marginBottom: '0.25rem' }}>{value}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--slate)' }}>{sub}</div>
          </div>
        ))}
      </div>
      <div className="two-col-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={cardStyle}>
          <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1rem' }}>Active Cohorts</h3>
          {activeCohorts.length === 0 && <p style={{ color: 'var(--slate)', fontSize: '0.85rem' }}>No active cohorts yet.</p>}
          {activeCohorts.map(c => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0', borderBottom: '1px solid var(--mist)', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <p style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.85rem' }}>{c.name}</p>
                <p style={{ color: 'var(--slate)', fontSize: '0.75rem' }}>{enrollments.filter(e => e.cohort_id === c.id && e.status === 'active').length} enrolled</p>
              </div>
              {statusBadge(c.status)}
            </div>
          ))}
        </div>
        <div style={cardStyle}>
          <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1rem' }}>Quick Actions</h3>
          {[
            { label: 'Review registrations', action: () => setPage('registrations') },
            { label: 'Invite a user', action: () => { setPage('users'); setShowInviteForm(true) } },
            { label: 'Create a cohort', action: () => { setPage('cohorts'); setShowCohortForm(true) } },
            { label: 'Post an announcement', action: () => { setPage('announcements'); setShowAnnouncementForm(true) } },
            { label: 'Add a weekly rep', action: () => { setPage('reps'); setShowRepForm(true) } },
            { label: 'Add a resource', action: () => { setPage('resources'); setShowResourceForm(true) } },
            { label: 'Issue a certificate', action: () => setPage('certificates') },
          ].map(({ label, action }) => (
            <button key={label} onClick={action} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '0.6rem 0', background: 'none', border: 'none', borderBottom: '1px solid var(--mist)', color: 'var(--navy)', fontSize: '0.85rem', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 500 }}>
              {label} <span style={{ color: 'var(--gold)' }}>&#8594;</span>
            </button>
          ))}
        </div>
      </div>
      <div style={cardStyle}>
        <h3 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '0.04em', marginBottom: '1rem' }}>Programs</h3>
        {programs.length === 0 && <p style={{ color: 'var(--slate)', fontSize: '0.85rem' }}>No programs yet. Create one in the Programs section.</p>}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Program', 'Type', 'Cohorts', 'Status'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
            <tbody>
              {programs.map(p => (
                <tr key={p.id}>
                  <td style={tdStyle}><span style={{ fontWeight: 600, color: 'var(--navy)' }}>{p.name}</span></td>
                  <td style={tdStyle}><span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.65rem', color: 'var(--slate)', textTransform: 'uppercase' }}>{p.type}</span></td>
                  <td style={tdStyle}>{cohorts.filter(c => c.program_id === p.id).length}</td>
                  <td style={tdStyle}>{statusBadge('active')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
