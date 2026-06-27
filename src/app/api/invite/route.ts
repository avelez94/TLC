import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const { email, full_name, role, program_id, cohort_id } = await request.json()

    if (!email || !role) {
      return NextResponse.json({ error: 'Email and role are required' }, { status: 400 })
    }

    // Send invite email via Supabase — user sets their own password
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { full_name, role },
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset`,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const userId = data.user.id

    // Update their profile with name, role, and program
    await supabaseAdmin
      .from('profiles')
      .update({ full_name, role })
      .eq('id', userId)

    // If impact participant and a cohort was selected, enroll them
    if (role === 'impact_participant' && cohort_id) {
      const { error: enrollError } = await supabaseAdmin
        .from('cohort_enrollments')
        .insert({
          user_id: userId,
          cohort_id,
          status: 'active',
        })

      if (enrollError) {
        console.error('Enrollment error:', enrollError)
      }
    }

    // If coaching client and a program was selected, create initial coaching session placeholder
    if (role === 'coaching_client' && program_id) {
      // Get Tramaine's admin profile to use as coach_id
      const { data: adminProfile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('role', 'admin')
        .single()

      if (adminProfile) {
        await supabaseAdmin
          .from('coaching_sessions')
          .insert({
            client_id: userId,
            coach_id: adminProfile.id,
            title: 'Foundation Session',
            status: 'upcoming',
          })
      }
    }

    return NextResponse.json({ success: true, user: data.user })
  } catch (err) {
    console.error('Invite error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}