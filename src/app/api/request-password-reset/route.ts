import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { deliverEmail, FROM_TLC } from '@/lib/email'
import { passwordResetEmail } from '@/lib/email-templates'
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
    const { subject, html } = passwordResetEmail({ link: resetLink })
    // Logged against the person (when they have an account) so admins can see a failure.
    const r = await deliverEmail({ template: 'password_reset', from: FROM_TLC, to: email, subject, html,
      related: { userId: data.user?.id ?? null, type: 'person', id: data.user?.id ?? null } })
    if (r.status === 'failed') console.error('Reset email error:', r.error)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Reset request error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
