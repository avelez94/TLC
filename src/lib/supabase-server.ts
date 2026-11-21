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

/** The signed-in user and their role from `profiles` (never from user-editable metadata). */
export async function getSessionUserWithRole() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  return { user, role: normalizeRole(profile?.role) }
}

// Verifies the request's session belongs to a user with role 'admin'.
// Returns the authenticated user, or null if unauthenticated / not an admin.
// Use in API routes that perform admin-only actions.
export async function requireAdmin() {
  const session = await getSessionUserWithRole()
  if (!session || session.role !== 'admin') return null
  return session.user
}
