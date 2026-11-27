import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase-server'
import { loadLaunchReadiness, loadStripeCheck } from '@/lib/launch-server'

// Admin → Launch readiness: the same gate checkout uses, with the reasons and where to fix them.
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Not authorized' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } })
  const [readiness, stripe] = await Promise.all([loadLaunchReadiness(), loadStripeCheck()])
  return NextResponse.json({ readiness, stripe }, { headers: { 'Cache-Control': 'private, no-store' } })
}
