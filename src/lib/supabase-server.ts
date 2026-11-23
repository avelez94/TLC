import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { assertSafeEnvironment } from './env-guard'
import { normalizeRole } from './access'

assertSafeEnvironment(process.env)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Server client — use only in server components, route handlers and server actions.
// Acts as the signed-in user, so RLS applies.
export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {}
      },
    },
  })
}

// Service-role client — bypasses RLS. Server only; never import from a client component.
export const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

export type AdminMfaMode = 'off' | 'enrolled' | 'required'

/** The site-wide two-step setting for administrators (database setting `admin_mfa_mode`). */
export async function getAdminMfaMode(): Promise<AdminMfaMode> {
  try {
    const { data, error } = await supabaseAdmin.rpc('admin_mfa_mode')
    if (error) return 'off' // before migration 2d
    return data === 'required' || data === 'enrolled' ? data : 'off'
  } catch {
    return 'off'
  }
}

/**
 * The signed-in user and their role from `profiles` (never from user-editable metadata).
 * Two-step verification:
 *  - an account with a verified authenticator must have used it this session (aal2), always;
 *  - when the site setting is 'required', an admin without an authenticator must set one up
 *    before using the admin area (`mfaEnrollRequired`).
 */
export async function getSessionUserWithRole() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()
  const role = normalizeRole(profile?.role)
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  const mfaEnrolled = aal?.nextLevel === 'aal2'
  const mfaVerified = aal?.currentLevel === 'aal2'
  const mfaSatisfied = !aal || !mfaEnrolled || mfaVerified
  const mfaMode = role === 'admin' ? await getAdminMfaMode() : 'off'
  const mfaEnrollRequired = role === 'admin' && mfaMode === 'required' && !mfaEnrolled
  return {
    user, role, mfaSatisfied, mfaEnrolled, mfaVerified, mfaMode, mfaEnrollRequired,
    name: (profile?.full_name as string | null) || user.email || 'Administrator',
    email: (profile?.email as string | null) ?? user.email ?? null,
  }
}

// Verifies the request's session belongs to a user with role 'admin'.
// Returns the authenticated user, or null if unauthenticated / not an admin.
// Use in API routes that perform admin-only actions.
export async function requireAdmin() {
  const session = await getSessionUserWithRole()
  if (!session || session.role !== 'admin' || !session.mfaSatisfied || session.mfaEnrollRequired) return null
  return session.user
}
