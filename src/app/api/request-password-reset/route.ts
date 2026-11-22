import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { esc, sendEmail, FROM_TLC } from '@/lib/email'
import { cleanLine, clientIp, isValidEmail } from '@/lib/security'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(request: Request) {
  let email = ''
  try {
    const body = await request.json()
    email = cleanLine(body?.email, 254).toLowerCase()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
  }
  if (!(await rateLimit('reset-ip', clientIp(request.headers), 5, 900))) {
    return NextResponse.json({ error: 'Too many requests. Please wait a few minutes and try again.' }, { status: 429 })
  }
  // Per-address limit returns the normal response so it can't be used to probe accounts.
  if (!(await rateLimit('reset-email', email, 3, 3600))) return NextResponse.json({ success: true })

  try {
    // Generate the recovery link ourselves rather than using Supabase's resetPasswordForEmail,
    // which sends its own unbranded email that was landing in spam.
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset?type=recovery` },
    })

    // Always return success so this endpoint can't be used to enumerate registered emails.
    if (error || !data?.properties?.action_link) return NextResponse.json({ success: true })

    const resetLink = data.properties.action_link
    try {
      await sendEmail({
      template: 'password_reset',
        from: FROM_TLC,
        to: email,
        subject: 'Reset your TLC Leadership password',
        html: `
          <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #1C2430;">
            <div style="background: #001737; padding: 2rem; text-align: center; margin-bottom: 2rem;">
              <h1 style="color: #C88820; font-size: 1.5rem; letter-spacing: 0.08em; margin: 0;">TLC LEADERSHIP</h1>
              <p style="color: rgba(255,255,255,0.5); font-size: 0.75rem; letter-spacing: 0.2em; text-transform: uppercase; margin: 0.5rem 0 0;">Password Reset</p>
            </div>
            <div style="padding: 0 1rem;">
              <p style="font-size: 1rem; line-height: 1.75; margin-bottom: 1.5rem;">Hi,</p>
              <p style="font-size: 1rem; line-height: 1.75; margin-bottom: 1.5rem;">We received a request to reset your password. Click below to choose a new one.</p>
              <div style="text-align: center; margin: 2rem 0;">
                <a href="${esc(resetLink)}" style="display: inline-block; background: #C88820; color: #001737; padding: 0.9rem 2rem; text-decoration: none; font-weight: 700; font-size: 0.85rem; letter-spacing: 0.08em; text-transform: uppercase; border-radius: 2px;">Reset Password</a>
              </div>
              <p style="font-size: 0.85rem; color: #4A5260; line-height: 1.6; margin-bottom: 1.5rem;">If the button above doesn't work, copy and paste this link into your browser:<br/><a href="${esc(resetLink)}" style="color: #C88820; word-break: break-all;">${esc(resetLink)}</a></p>
              <p style="font-size: 0.85rem; color: #4A5260; line-height: 1.6; margin-bottom: 1.5rem;">If you didn't request this, you can safely ignore this email.</p>
              <p style="font-size: 1rem; line-height: 1.75; margin-top: 2rem; color: #4A5260;">Tramaine L. Crawford<br/>TLC Leadership Consulting &amp; Coaching</p>
            </div>
            <div style="background: #001737; padding: 1.5rem; text-align: center; margin-top: 2rem;">
              <p style="color: rgba(255,255,255,0.3); font-size: 0.75rem; margin: 0;">2001 L St NW, Suite 500, Washington, DC 20036</p>
            </div>
          </div>`,
      })
    } catch (emailErr) {
      console.error('Reset email error:', emailErr instanceof Error ? emailErr.message : emailErr)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Reset request error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
