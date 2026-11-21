// Which signed-in roles may open which protected areas. Used by middleware; the database
// (RLS) and API routes enforce the same rules independently.

export type AppRole = 'admin' | 'coaching_client' | 'impact_participant'

const AREA_ROLES: { prefix: string; roles: AppRole[] }[] = [
  { prefix: '/admin', roles: ['admin'] },
  { prefix: '/impact-portal', roles: ['impact_participant', 'admin'] },
  { prefix: '/coaching-portal', roles: ['coaching_client', 'admin'] },
]

function matches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + '/')
}

export function isProtectedPath(pathname: string): boolean {
  return AREA_ROLES.some(a => matches(pathname, a.prefix))
}

export function normalizeRole(role: unknown): AppRole {
  return role === 'admin' || role === 'coaching_client' ? role : 'impact_participant'
}

export function canAccess(pathname: string, role: AppRole): boolean {
  const area = AREA_ROLES.find(a => matches(pathname, a.prefix))
  return area ? area.roles.includes(role) : true
}

export function homeForRole(role: AppRole): string {
  if (role === 'admin') return '/admin'
  if (role === 'coaching_client') return '/coaching-portal'
  return '/impact-portal'
}
