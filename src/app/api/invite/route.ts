import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase-server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)

  try {
    const { email, full_name, role, program_id, cohort_id } = await request.json()

    if (!email || !role) {
      return NextResponse.json({ error: 'Email and role are required' }, { status: 400 })
    }

    // Generate the invite link ourselves (does NOT send Supabase's default email —
    // that's what was landing in spam with no branding). We send our own email below.
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        data: { full_name, role },
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset`,
      },
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const userId = data.user.id
    const inviteLink = data.properties?.action_link

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

    // Send our own branded invite email via Resend, matching the rest of the platform's emails
    if (inviteLink) {
      try {
        const roleLabel = role === 'coaching_client' ? 'Coaching Portal' : role === 'admin' ? 'Admin Panel' : 'Impact Portal'
        await resend.emails.send({
          from: 'TLC Leadership <noreply@contact.tramainecrawford.com>',
          to: email,
          subject: "You've been invited to TLC Leadership",
          html: `
            <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #1C2430;">
              <div style="background: #001737; padding: 2rem; text-align: center; margin-bottom: 2rem;">
                <h1 style="color: #C88820; font-size: 1.5rem; letter-spacing: 0.08em; margin: 0;">TLC LEADERSHIP</h1>
                <p style="color: rgba(255,255,255,0.5); font-size: 0.75rem; letter-spacing: 0.2em; text-transform: uppercase; margin: 0.5rem 0 0;">${roleLabel}</p>
              </div>
              <div style="padding: 0 1rem;">
                <p style="font-size: 1rem; line-height: 1.75; margin-bottom: 1.5rem;">Hi ${full_name || 'there'},</p>
                <p style="font-size: 1rem; line-height: 1.75; margin-bottom: 1.5rem;">You've been invited to create an account with TLC Leadership Consulting &amp; Coaching. Click below to set your password and get started.</p>
                <div style="text-align: center; margin: 2rem 0;">
                  <a href="${inviteLink}" style="display: inline-block; background: #C88820; color: #001737; padding: 0.9rem 2rem; text-decoration: none; font-weight: 700; font-size: 0.85rem; letter-spacing: 0.08em; text-transform: uppercase; border-radius: 2px;">Accept Invitation</a>
                </div>
                <p style="font-size: 0.85rem; color: #4A5260; line-height: 1.6; margin-bottom: 1.5rem;">If the button above doesn't work, copy and paste this link into your browser:<br/><a href="${inviteLink}" style="color: #C88820; word-break: break-all;">${inviteLink}</a></p>
                <p style="font-size: 1rem; line-height: 1.75; margin-bottom: 1.5rem;">If you have any questions, reach out to Tramaine directly at <a href="mailto:tramaine@tramainecrawford.com" style="color: #C88820;">tramaine@tramainecrawford.com</a> or <a href="tel:+12025991381" style="color: #C88820;">(202) 599-1381</a>.</p>
                <p style="font-size: 1rem; line-height: 1.75; margin-top: 2rem; color: #4A5260;">Tramaine L. Crawford<br/>TLC Leadership Consulting &amp; Coaching</p>
              </div>
              <div style="background: #001737; padding: 1.5rem; text-align: center; margin-top: 2rem;">
                <p style="color: rgba(255,255,255,0.3); font-size: 0.75rem; margin: 0;">2001 L St NW, Suite 500, Washington, DC 20036</p>
              </div>
            </div>
          `,
        })
      } catch (emailErr) {
        console.error('Invite email error:', emailErr)
      }
    }

    return NextResponse.json({ success: true, user: data.user })
  } catch (err) {
    console.error('Invite error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}