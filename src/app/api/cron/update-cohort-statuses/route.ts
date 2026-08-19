import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date().toISOString().split('T')[0]

  // Upcoming -> Active: cohorts whose start date has arrived
  const { data: activated, error: activateError } = await supabaseAdmin
    .from('cohorts')
    .update({ status: 'active' })
    .eq('status', 'upcoming')
    .lte('start_date', today)
    .select('id, name')

  if (activateError) {
    console.error('Error activating cohorts:', activateError)
  }

  // Active -> Completed: cohorts whose end date has passed
  const { data: completed, error: completeError } = await supabaseAdmin
    .from('cohorts')
    .update({ status: 'completed' })
    .eq('status', 'active')
    .lt('end_date', today)
    .select('id, name')

  if (completeError) {
    console.error('Error completing cohorts:', completeError)
  }

  return NextResponse.json({
    activated: activated?.length || 0,
    activatedCohorts: activated?.map(c => c.name) || [],
    completed: completed?.length || 0,
    completedCohorts: completed?.map(c => c.name) || [],
  })
}