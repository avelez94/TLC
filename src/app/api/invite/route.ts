import { NextResponse } from 'next/server'
import { requireAdmin, supabaseAdmin } from '@/lib/supabase-server'
import { esc, sendEmail, FROM_TLC } from '@/lib/email'
import { cleanLine, isValidEmail } from '@/lib/security'

const ALLOWED_ROLES = ['impact_participant', 'coaching_client', 'admin'] as const
type InviteRole = (typeof ALLOWED_ROLES)[number]
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const email = cleanLine(body.email, 254).toLowerCase()
    const full_name = cleanLine(body.full_name, 120)
    const role = body.role as InviteRole
    const program_id = typeof body.program_id === 'string' && UUID_RE.test(body.program_id) ? body.program_id : null
    const cohort_id = typeof body.cohort_id === 'string' && UUID_RE.test(body.cohort_id) ? body.cohort_id : null

    if (!isValidEmail(email) || !ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: 'A valid email and role are required' }, { status: 400 })
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

    // The new-user trigger always creates a participant profile; set the intended role here
    // with the service role (the only path allowed to change roles besides an admin session).
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ full_name: full_name || null, role })
      .eq('id', userId)
    if (profileError) console.error('Invite: profile update failed', profileError.code)

    if (role === 'impact_participant' && cohort_id) {
      const { error: enrollError } = await supabaseAdmin
        .from('cohort_enrollments')
        .insert({ user_id: userId, cohort_id, status: 'active' })
      if (enrollError) console.error('Invite: enrollment failed', enrollError.code)
    }

    // Coaching clients start with a placeholder session owned by the inviting admin.
    if (role === 'coaching_client' && program_id) {
      await supabaseAdmin
        .from('coaching_sessions')
        .insert({ client_id: userId, coach_id: admin.id, title: 'Foundation Session', status: 'upcoming' })
    }

    if (inviteLink) {
      try {
        const roleLabel = role === 'coaching_client' ? 'Coaching Portal' : role === 'admin' ? 'Admin Panel' : 'Impact Portal'
        await sendEmail({
          from: FROM_TLC,
          to: email,
          subject: "You've been invited to TLC Leadership",
          html: `
            <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #1C2430;">
              <div style="background: #001737; padding: 2rem; text-align: center; margin-bottom: 2rem;">
                <h1 style="color: #C88820; font-size: 1.5rem; letter-spacing: 0.08em; margin: 0;">TLC LEADERSHIP</h1>
                <p style="color: rgba(255,255,255,0.5); font-size: 0.75rem; letter-spacing: 0.2em; text-transform: uppercase; margin: 0.5rem 0 0;">${esc(roleLabel)}</p>
              </div>
              <div style="padding: 0 1rem;">
                <p style="font-size: 1rem; line-height: 1.75; margin-bottom: 1.5rem;">Hi ${esc(full_name || 'there')},</p>
                <p style="font-size: 1rem; line-height: 1.75; margin-bottom: 1.5rem;">You've been invited to create an account with TLC Leadership Consulting &amp; Coaching. Click below to set your password and get started.</p>
                <div style="text-align: center; margin: 2rem 0;">
                  <a href="${esc(inviteLink)}" style="display: inline-block; background: #C88820; color: #001737; padding: 0.9rem 2rem; text-decoration: none; font-weight: 700; font-size: 0.85rem; letter-spacing: 0.08em; text-transform: uppercase; border-radius: 2px;">Accept Invitation</a>
                </div>
                <p style="font-size: 0.85rem; color: #4A5260; line-height: 1.6; margin-bottom: 1.5rem;">If the button above doesn't work, copy and paste this link into your browser:<br/><a href="${esc(inviteLink)}" style="color: #C88820; word-break: break-all;">${esc(inviteLink)}</a></p>
                <p style="font-size: 1rem; line-height: 1.75; margin-bottom: 1.5rem;">If you have any questions, reach out to Tramaine directly at <a href="mailto:tramaine@tramainecrawford.com" style="color: #C88820;">tramaine@tramainecrawford.com</a> or <a href="tel:+12025991381" style="color: #C88820;">(202) 599-1381</a>.</p>
                <p style="font-size: 1rem; line-height: 1.75; margin-top: 2rem; color: #4A5260;">Tramaine L. Crawford<br/>TLC Leadership Consulting &amp; Coaching</p>
              </div>
              <div style="background: #001737; padding: 1.5rem; text-align: center; margin-top: 2rem;">
                <p style="color: rgba(255,255,255,0.3); font-size: 0.75rem; margin: 0;">2001 L St NW, Suite 500, Washington, DC 20036</p>
              </div>
            </div>`,
        })
      } catch (emailErr) {
        console.error('Invite email error:', emailErr instanceof Error ? emailErr.message : emailErr)
      }
    }

    return NextResponse.json({ success: true, user: { id: userId, email } })
  } catch (err) {
    console.error('Invite error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
