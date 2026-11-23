// Daily cohort status job (Vercel Cron, 06:00 UTC). Moves cohorts Upcoming → Active on their
// start date and Active → Completed after their end date (New York calendar date). The database
// function makes each change and records it in the activity log as a system action in one
// transaction, so repeated runs never duplicate entries. It never changes enrollments,
// completion, certificates, registrations or payments, and sends no email.
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { audit } from '@/lib/audit'

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin.rpc('system_update_cohort_statuses')
  if (error) {
    console.error('Cohort status job failed:', error.message)
    await audit(null, 'cohort.status_auto', 'cohort', null, { reason: 'daily status job failed', error: error.message.slice(0, 200) }, { outcome: 'failed', system: true, label: 'Daily cohort status job' })
    return NextResponse.json({ error: 'Status update failed' }, { status: 500 })
  }
  const rows = (data ?? []) as { cohort_name: string; from_status: string; to_status: string }[]
  return NextResponse.json({
    changed: rows.length,
    activatedCohorts: rows.filter(r => r.to_status === 'active').map(r => r.cohort_name),
    completedCohorts: rows.filter(r => r.to_status === 'completed').map(r => r.cohort_name),
  })
}
