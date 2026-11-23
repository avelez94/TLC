import { NextResponse } from 'next/server'
import { requireAdmin, supabaseAdmin } from '@/lib/supabase-server'
import { esc, sendEmail, FROM_TLC } from '@/lib/email'
import { cleanLine, isValidEmail } from '@/lib/security'
import { audit } from '@/lib/audit'

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

    // Never create an account for a cohort that has no free seat (the database enforces the
    // limit too; checking first avoids leaving an account without an enrollment).
    const warnings: string[] = []
    if (cohort_id) {
      const { data: cohort } = await supabaseAdmin.from('cohorts').select('name, capacity').eq('id', cohort_id).maybeSingle()
      if (!cohort) return NextResponse.json({ error: 'That cohort no longer exists.' }, { status: 400 })
      if (cohort.capacity != null) {
        const { count } = await supabaseAdmin.from('cohort_enrollments').select('id', { count: 'exact', head: true }).eq('cohort_id', cohort_id).eq('status', 'active')
        if ((count ?? 0) >= cohort.capacity) {
          return NextResponse.json({ error: `${cohort.name} is full (${count} of ${cohort.capacity} seats taken). Raise the capacity in Cohorts first.` }, { status: 409 })
        }
      }
    }

    // Returning participant: the account already exists, so enroll them instead of inviting.
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles').select('id, full_name, role').ilike('email', email).maybeSingle()
    if (existingProfile) {
      if (role !== 'impact_participant' || !cohort_id) {
        return NextResponse.json({ error: 'This email already has an account. To add them to a cohort, choose Impact Lab participant and a cohort, or open them in Participants and use “Enroll in a cohort”.' }, { status: 409 })
      }
      const { error: enrollError } = await supabaseAdmin
        .from('cohort_enrollments')
        .upsert({ user_id: existingProfile.id, cohort_id, status: 'active' }, { onConflict: 'cohort_id,user_id' })
      if (enrollError) {
        console.error('Invite: returning enrollment failed', enrollError.code)
        const full = enrollError.details === 'cohort_full'
        return NextResponse.json({ error: full ? enrollError.message : 'Could not enroll the returning participant.' }, { status: full ? 409 : 500 })
      }
      await audit(admin.id, 'enrollment.returning', 'enrollment', existingProfile.id, { cohort_id }, { label: existingProfile.full_name || email })
      const { data: cohort } = await supabaseAdmin.from('cohorts').select('name').eq('id', cohort_id).maybeSingle()
      try {
        await sendEmail({
          template: 'enrollment_returning',
          from: FROM_TLC,
          to: email,
          subject: 'You are enrolled in your next Impact Lab cohort',
          html: `
            <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #1C2430;">
              <div style="background: #001737; padding: 2rem; text-align: center; margin-bottom: 2rem;"><h1 style="color: #C88820; font-size: 1.5rem; letter-spacing: 0.08em; margin: 0;">THE IMPACT LAB</h1></div>
              <div style="padding: 0 1rem; font-size: 1rem; line-height: 1.75;">
                <p>Hi ${esc(existingProfile.full_name || full_name || 'there')},</p>
                <p>Welcome back. You are enrolled in <strong>${esc(cohort?.name ?? 'your new cohort')}</strong>. Sign in with your existing account to see your sessions and materials.</p>
                <div style="text-align: center; margin: 2rem 0;"><a href="https://tramainecrawford.com/login" style="display: inline-block; background: #C88820; color: #001737; padding: 0.9rem 2rem; text-decoration: none; font-weight: 700; font-size: 0.85rem; letter-spacing: 0.08em; text-transform: uppercase; border-radius: 2px;">Sign In</a></div>
                <p style="margin-top: 2rem; color: #4A5260;">Tramaine L. Crawford<br/>TLC Leadership Consulting &amp; Coaching</p>
              </div>
            </div>`,
        })
      } catch (emailErr) {
        console.error('Invite: returning email failed', emailErr instanceof Error ? emailErr.message : emailErr)
        warnings.push('They are enrolled, but the "you are enrolled" email could not be sent. Let them know directly.')
      }
      return NextResponse.json({ success: true, returning: true, warnings, user: { id: existingProfile.id, email } })
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
    if (profileError) {
      console.error('Invite: profile update failed', profileError.code)
      warnings.push(`The account was created, but its role could not be set to ${role}. Check it in Participants & Users.`)
    }

    if (role === 'impact_participant' && cohort_id) {
      const { error: enrollError } = await supabaseAdmin
        .from('cohort_enrollments')
        .insert({ user_id: userId, cohort_id, status: 'active' })
      if (enrollError) {
        console.error('Invite: enrollment failed', enrollError.code)
        warnings.push(`The account was created, but enrolling them in the cohort failed${enrollError.details === 'cohort_full' ? ' (the cohort is full)' : ''}. Enroll them from the cohort's Participants section.`)
      }
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
      template: 'invite',
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
        warnings.push('The account was created, but the invitation email could not be sent. Use "Send password email" on their record.')
      }
    } else {
      warnings.push('The account was created, but no invitation link was produced. Use "Send password email" on their record.')
    }

    await audit(admin.id, 'user.invite', 'person', userId, { role, cohort_id, warnings: warnings.length }, { label: full_name || email })
    return NextResponse.json({ success: true, warnings, user: { id: userId, email } })
  } catch (err) {
    console.error('Invite error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
