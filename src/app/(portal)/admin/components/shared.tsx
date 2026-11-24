import type { Program } from '@/types'

export type Page = 'dashboard' | 'registrations' | 'inquiries' | 'users' | 'programs' | 'cohorts' | 'reps' | 'prompts' | 'community' | 'announcements' | 'resources' | 'certificates' | 'reports' | 'security'

export type NavGroup = 'Overview' | 'People' | 'Programs' | 'Participant experience' | 'Insights & security'

// Grouped by task. Weekly reps and journal prompts live inside each cohort; certificates
// inside each participant. Their full-list pages still exist (linked from those screens).
export const navItems: { id: Page; label: string; icon: string; group: NavGroup }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '⊞', group: 'Overview' },
  { id: 'inquiries', label: 'Inquiries', icon: '✉️', group: 'People' },
  { id: 'users', label: 'Participants', icon: '👥', group: 'People' },
  { id: 'registrations', label: 'Registration history', icon: '📥', group: 'People' },
  { id: 'programs', label: 'Pathways', icon: '🎯', group: 'Programs' },
  { id: 'cohorts', label: 'Cohorts', icon: '📅', group: 'Programs' },
  { id: 'announcements', label: 'Announcements', icon: '📢', group: 'Participant experience' },
  { id: 'resources', label: 'Resources', icon: '📚', group: 'Participant experience' },
  { id: 'community', label: 'Community', icon: '💬', group: 'Participant experience' },
  { id: 'reports', label: 'Reports', icon: '📈', group: 'Insights & security' },
  { id: 'security', label: 'Security & activity', icon: '🔒', group: 'Insights & security' },
]

/** Pages that live inside another section highlight that section in the menu. */
export const navParent: Partial<Record<string, Page>> = { reps: 'cohorts', prompts: 'cohorts', certificates: 'users' }

export const isPathway = (p: Program) => !!p.slug && p.pathway_number != null

/** The three pathways (by number), optionally followed by historical programs. */
export function programChoices(programs: Program[], includeHistorical = false): Program[] {
  const pathways = programs.filter(isPathway).sort((a, b) => (a.pathway_number ?? 0) - (b.pathway_number ?? 0))
  if (!includeHistorical) return pathways
  return [...pathways, ...programs.filter(p => !isPathway(p)).sort((a, b) => a.name.localeCompare(b.name))]
}

export const pageTitleStyle = { fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', margin: '0.25rem 0 0.5rem' }
export const sectionTitleStyle = { fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.3rem', color: 'var(--navy)', letterSpacing: '0.04em', margin: '0 0 0.5rem' }
export const helpStyle = { color: 'var(--slate)', fontSize: '0.9rem', lineHeight: 1.6, margin: '0 0 1rem' }
export const linkButtonStyle = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#8a5a10', textDecoration: 'underline', fontFamily: 'var(--font-montserrat), sans-serif' }
export const dangerLinkStyle = { ...linkButtonStyle, color: '#b3261e' }
export const secondaryButtonStyle = { padding: '0.55rem 1rem', background: 'white', border: '1.5px solid rgba(0,23,55,0.2)', borderRadius: '3px', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem', color: 'var(--navy)', fontFamily: 'var(--font-montserrat), sans-serif' }

export const cardStyle = { background: 'white', borderRadius: '6px', border: '1px solid rgba(0,23,55,0.08)', padding: '1.5rem', marginBottom: '1.25rem' }
export const inputStyle = { width: '100%', padding: '0.75rem 1rem', border: '1.5px solid rgba(0,23,55,0.15)', borderRadius: '4px', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.9rem', color: 'var(--ink)', background: 'white', outline: 'none' }
export const labelStyle = { fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.66rem', letterSpacing: '0.16em', textTransform: 'uppercase' as const, color: '#8a5a10', display: 'block', marginBottom: '0.5rem' }
export const thStyle = { fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: 'var(--slate)', padding: '0.65rem 1rem', textAlign: 'left' as const, borderBottom: '1px solid var(--mist)', background: 'var(--paper)' }
export const tdStyle = { padding: '0.85rem 1rem', fontSize: '0.85rem', color: 'var(--ink)', borderBottom: '1px solid var(--mist)', verticalAlign: 'middle' as const }

export const roleBadge = (role: string) => {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    admin: { bg: 'rgba(200,136,32,0.15)', color: '#8a5a10', label: 'Admin' },
    coaching_client: { bg: 'rgba(0,23,55,0.08)', color: 'var(--navy)', label: 'Coaching' },
    impact_participant: { bg: 'rgba(10,37,71,0.06)', color: 'var(--slate)', label: 'Impact Lab' },
  }
  const s = map[role] || map.impact_participant
  return <span style={{ ...s, fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.2rem 0.6rem', borderRadius: '2px' }}>{s.label}</span>
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Active', completed: 'Completed', upcoming: 'Upcoming', pending: 'Pending', withdrawn: 'Withdrawn', draft: 'Draft',
  archived: 'Archived', cancelled: 'Cancelled', confirmed: 'Confirmed', waitlist: 'Waitlist', declined: 'Declined',
  open: 'Open for registration', closed: 'Online registration off', full: 'Full', in_progress: 'In progress', starting: 'Starting soon',
}

export const statusBadge = (status: string, label?: string) => {
  const map: Record<string, { bg: string; color: string }> = {
    active: { bg: 'rgba(200,136,32,0.12)', color: '#8a5a10' },
    in_progress: { bg: 'rgba(200,136,32,0.12)', color: '#8a5a10' },
    open: { bg: '#e8f5ec', color: '#14532d' },
    closed: { bg: 'rgba(0,23,55,0.06)', color: 'var(--navy)' },
    full: { bg: '#fdecea', color: '#8c1d18' },
    starting: { bg: 'rgba(0,23,55,0.06)', color: 'var(--navy)' },
    completed: { bg: 'var(--mist)', color: 'var(--slate)' },
    upcoming: { bg: 'rgba(0,23,55,0.06)', color: 'var(--navy)' },
    pending: { bg: 'rgba(0,23,55,0.06)', color: 'var(--slate)' },
    withdrawn: { bg: 'rgba(179,38,30,0.08)', color: '#b3261e' },
    draft: { bg: 'var(--mist)', color: 'var(--slate)' },
    archived: { bg: 'var(--mist)', color: 'var(--slate)' },
    cancelled: { bg: 'rgba(179,38,30,0.08)', color: '#b3261e' },
    confirmed: { bg: 'rgba(200,136,32,0.12)', color: '#8a5a10' },
    waitlist: { bg: 'rgba(0,23,55,0.06)', color: 'var(--navy)' },
    declined: { bg: 'rgba(179,38,30,0.08)', color: '#b3261e' },
  }
  const s = map[status] || { bg: 'var(--mist)', color: 'var(--slate)' }
  return <span style={{ ...s, fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.2rem 0.6rem', borderRadius: '2px', whiteSpace: 'nowrap' }}>{label ?? STATUS_LABEL[status] ?? status}</span>
}
