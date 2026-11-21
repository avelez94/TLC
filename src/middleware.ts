import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { canAccess, homeForRole, isProtectedPath, normalizeRole } from '@/lib/access'
import { assertSafeEnvironment } from '@/lib/env-guard'

// Note: Next.js 16 deprecates `middleware` in favour of `proxy`. Renaming also switches the
// runtime from edge to Node.js, so it is left as a separate, tested change.
export async function middleware(request: NextRequest) {
  assertSafeEnvironment(process.env)
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl
  const isProtected = isProtectedPath(pathname)

  if (isProtected && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && (isProtected || pathname === '/login')) {
    // Role comes from profiles (readable by its owner under RLS), never from user metadata.
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    const role = normalizeRole(profile?.role)

    if (pathname === '/login' || !canAccess(pathname, role)) {
      return NextResponse.redirect(new URL(homeForRole(role), request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
