import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  const resend = new Resend(process.env.RESEND_API_KEY)

  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Generate the recovery link ourselves rather than using Supabase's
    // resetPasswordForEmail, which sends its own unbranded email that was
    // landing in spam. We send our own branded email via Resend below.
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset?type=recovery`,
      },
    })

    // Always return success to the client regardless of whether the email exists,
    // so this endpoint can't be used to enumerate registered emails.
    if (error || !data?.properties?.action_link) {
      console.error('Reset link generation error:', error)
      return NextResponse.json({ success: true })
    }

    const resetLink = data.properties.action_link

    try {
      await resend.emails.send({
        from: 'TLC Leadership <noreply@contact.tramainecrawford.com>',
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
                <a href="${resetLink}" style="display: inline-block; background: #C88820; color: #001737; padding: 0.9rem 2rem; text-decoration: none; font-weight: 700; font-size: 0.85rem; letter-spacing: 0.08em; text-transform: uppercase; border-radius: 2px;">Reset Password</a>
              </div>
              <p style="font-size: 0.85rem; color: #4A5260; line-height: 1.6; margin-bottom: 1.5rem;">If the button above doesn't work, copy and paste this link into your browser:<br/><a href="${resetLink}" style="color: #C88820; word-break: break-all;">${resetLink}</a></p>
              <p style="font-size: 0.85rem; color: #4A5260; line-height: 1.6; margin-bottom: 1.5rem;">If you didn't request this, you can safely ignore this email.</p>
              <p style="font-size: 1rem; line-height: 1.75; margin-top: 2rem; color: #4A5260;">Tramaine L. Crawford<br/>TLC Leadership Consulting &amp; Coaching</p>
            </div>
            <div style="background: #001737; padding: 1.5rem; text-align: center; margin-top: 2rem;">
              <p style="color: rgba(255,255,255,0.3); font-size: 0.75rem; margin: 0;">2001 L St NW, Suite 500, Washington, DC 20036</p>
            </div>
          </div>
        `,
      })
    } catch (emailErr) {
      console.error('Reset email error:', emailErr)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Reset request error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}