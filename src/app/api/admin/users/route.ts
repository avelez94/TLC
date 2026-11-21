import { NextResponse } from 'next/server'
import { requireAdmin, supabaseAdmin } from '@/lib/supabase-server'

// Full user records for the admin panel. Signed-in users can only read directory columns
// of profiles directly (see the phase-2 privacy migration), so contact details, hourly
// rates and last sign-in come from here, behind the server-side admin check.
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profiles, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, phone, organization, role, avatar_url, timezone, hourly_rate, created_at')
    .order('created_at', { ascending: false })
  if (error) {
    console.error('Admin users: profile query failed', error.code)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }

  const lastSignIns: Record<string, string | null> = {}
  const perPage = 1000
  for (let page = 1; ; page++) {
    const { data, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    if (listError) break
    for (const u of data.users) lastSignIns[u.id] = u.last_sign_in_at ?? null
    if (data.users.length < perPage) break
  }

  return NextResponse.json({
    users: (profiles ?? []).map(p => ({ ...p, last_sign_in_at: lastSignIns[p.id] ?? null })),
  })
}
