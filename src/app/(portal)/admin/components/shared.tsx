export type Page = 'dashboard' | 'registrations' | 'users' | 'programs' | 'cohorts' | 'reps' | 'prompts' | 'community' | 'announcements' | 'resources' | 'certificates' | 'reports'

export const navItems: { id: Page; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '⊞' },
  { id: 'registrations', label: 'Registrations', icon: '📥' },
  { id: 'users', label: 'Users', icon: '👥' },
  { id: 'programs', label: 'Programs', icon: '🎯' },
  { id: 'cohorts', label: 'Cohorts', icon: '📅' },
  { id: 'reps', label: 'Weekly Reps', icon: '⚡' },
  { id: 'prompts', label: 'Journal Prompts', icon: '📝' },
  { id: 'community', label: 'Community', icon: '💬' },
  { id: 'announcements', label: 'Announcements', icon: '📢' },
  { id: 'resources', label: 'Resources', icon: '📚' },
  { id: 'certificates', label: 'Certificates', icon: '🏆' },
  { id: 'reports', label: 'Reports', icon: '📈' },
]

export const cardStyle = { background: 'white', borderRadius: '6px', border: '1px solid rgba(0,23,55,0.08)', padding: '1.5rem', marginBottom: '1.25rem' }
export const inputStyle = { width: '100%', padding: '0.75rem 1rem', border: '1.5px solid rgba(0,23,55,0.15)', borderRadius: '4px', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.9rem', color: 'var(--ink)', background: 'white', outline: 'none' }
export const labelStyle = { fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: 'var(--gold)', display: 'block', marginBottom: '0.5rem' }
export const thStyle = { fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: 'var(--slate)', padding: '0.65rem 1rem', textAlign: 'left' as const, borderBottom: '1px solid var(--mist)', background: 'var(--paper)' }
export const tdStyle = { padding: '0.85rem 1rem', fontSize: '0.85rem', color: 'var(--ink)', borderBottom: '1px solid var(--mist)', verticalAlign: 'middle' as const }

export const roleBadge = (role: string) => {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    admin: { bg: 'rgba(200,136,32,0.15)', color: 'var(--gold)', label: 'Admin' },
    coaching_client: { bg: 'rgba(0,23,55,0.08)', color: 'var(--navy)', label: 'Coaching' },
    impact_participant: { bg: 'rgba(10,37,71,0.06)', color: 'var(--slate)', label: 'Impact Lab' },
  }
  const s = map[role] || map.impact_participant
  return <span style={{ ...s, fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.2rem 0.6rem', borderRadius: '2px' }}>{s.label}</span>
}

export const statusBadge = (status: string) => {
  const map: Record<string, { bg: string; color: string }> = {
    active: { bg: 'rgba(200,136,32,0.1)', color: 'var(--gold)' },
    completed: { bg: 'var(--mist)', color: 'var(--slate)' },
    upcoming: { bg: 'rgba(0,23,55,0.06)', color: 'var(--navy)' },
    pending: { bg: 'rgba(0,23,55,0.06)', color: 'var(--slate)' },
    withdrawn: { bg: 'rgba(255,59,48,0.08)', color: '#ff6b6b' },
  }
  const s = map[status] || map.active
  return <span style={{ ...s, fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.2rem 0.6rem', borderRadius: '2px' }}>{status}</span>
}
