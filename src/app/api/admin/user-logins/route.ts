import { NextResponse } from 'next/server'
import { requireAdmin, supabaseAdmin } from '@/lib/supabase-server'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const lastSignIns: Record<string, string | null> = {}
    const perPage = 1000
    let page = 1

    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
      if (error) {
        console.error('List users error:', error)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
      }
      for (const user of data.users) {
        lastSignIns[user.id] = user.last_sign_in_at ?? null
      }
      if (data.users.length < perPage) break
      page += 1
    }

    return NextResponse.json({ lastSignIns })
  } catch (err) {
    console.error('User logins error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
