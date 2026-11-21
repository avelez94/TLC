import { NextResponse } from 'next/server'
import { esc, escMultiline, sendEmail, FROM_TLC, FROM_WEBSITE, OWNER_INBOX } from '@/lib/email'
import { cleanLine, cleanText, clientIp, isValidEmail } from '@/lib/security'
import { rateLimit } from '@/lib/rate-limit'

const interestLabels: Record<string, string> = {
  consulting: 'Leadership Consulting',
  coaching: 'Performance & Success Coaching',
  finders: 'The Impact Lab — Impact Finders',
  makers: 'The Impact Lab — Impact Makers',
  leaders: 'The Impact Lab — Impact Leaders',
  speaking: 'Speaking',
  other: 'Other',
}

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // Honeypot: real users never see or fill this field. Pretend success so bots don't adapt.
  if (body.company_url) return NextResponse.json({ success: true })

  const name = cleanLine(body.name, 120)
  const email = cleanLine(body.email, 254).toLowerCase()
  const phone = cleanLine(body.phone, 40)
  const org = cleanLine(body.org, 160)
  const interestKey = cleanLine(body.interest, 40)
  const message = cleanText(body.message, 5000)

  if (!name || !isValidEmail(email) || !message) {
    return NextResponse.json({ error: 'Please include your name, a valid email address, and a message.' }, { status: 400 })
  }
  if (!(await rateLimit('contact-ip', clientIp(request.headers), 5, 600)) || !(await rateLimit('contact-email', email, 3, 3600))) {
    return NextResponse.json({ error: 'Too many messages. Please wait a little while, or email tramaine@tramainecrawford.com directly.' }, { status: 429 })
  }

  const interest = interestLabels[interestKey] ?? (interestKey ? 'Other' : '')

  try {
    await sendEmail({
      from: FROM_WEBSITE,
      to: OWNER_INBOX,
      replyTo: email,
      subject: `New message from ${name}`,
      html: `
        <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #1C2430;">
          <div style="background: #001737; padding: 2rem; margin-bottom: 2rem;">
            <h1 style="color: #C88820; font-size: 1.25rem; letter-spacing: 0.08em; margin: 0;">New Contact Form Submission</h1>
          </div>
          <div style="padding: 0 1rem;">
            <div style="background: #F7F5F0; border-left: 3px solid #C88820; padding: 1.25rem 1.5rem; margin-bottom: 1.5rem;">
              <table style="width: 100%; font-size: 0.9rem; line-height: 1.75;">
                <tr><td style="color: #C88820; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.15em; padding-bottom: 0.25rem;" colspan="2">Contact Details</td></tr>
                <tr><td style="color: #4A5260; width: 140px;">Name</td><td style="font-weight: 600;">${esc(name)}</td></tr>
                <tr><td style="color: #4A5260;">Email</td><td>${esc(email)}</td></tr>
                ${phone ? `<tr><td style="color: #4A5260;">Phone</td><td>${esc(phone)}</td></tr>` : ''}
                ${org ? `<tr><td style="color: #4A5260;">Organization</td><td>${esc(org)}</td></tr>` : ''}
                ${interest ? `<tr><td style="color: #4A5260;">Interest</td><td><strong>${esc(interest)}</strong></td></tr>` : ''}
              </table>
            </div>
            <div style="margin-bottom: 1.5rem;">
              <p style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.15em; color: #C88820; margin-bottom: 0.5rem;">Message</p>
              <p style="font-size: 0.9rem; line-height: 1.75; color: #1C2430; margin: 0;">${escMultiline(message)}</p>
            </div>
            <p style="font-size: 0.85rem; color: #4A5260;">Reply directly to this email to respond to ${esc(name)}.</p>
          </div>
        </div>`,
    })

    // Auto-reply: fixed wording only. It never repeats the visitor's message, so the form
    // can't be used to send arbitrary content to arbitrary addresses.
    const firstName = cleanLine(name.split(' ')[0], 40)
    await sendEmail({
      from: FROM_TLC,
      to: email,
      subject: 'We received your message',
      html: `
        <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #1C2430;">
          <div style="background: #001737; padding: 2rem; text-align: center; margin-bottom: 2rem;">
            <h1 style="color: #C88820; font-size: 1.5rem; letter-spacing: 0.08em; margin: 0;">TLC LEADERSHIP</h1>
            <p style="color: rgba(255,255,255,0.5); font-size: 0.75rem; letter-spacing: 0.2em; text-transform: uppercase; margin: 0.5rem 0 0;">Consulting &amp; Coaching</p>
          </div>
          <div style="padding: 0 1rem;">
            <p style="font-size: 1rem; line-height: 1.75; margin-bottom: 1.5rem;">Hi ${esc(firstName)},</p>
            <p style="font-size: 1rem; line-height: 1.75; margin-bottom: 1.5rem;">Thank you for reaching out. We received your message and Tramaine will be in touch shortly.</p>
            <p style="font-size: 1rem; line-height: 1.75; margin-bottom: 1.5rem;">If you have anything urgent you can reach Tramaine directly at <a href="mailto:tramaine@tramainecrawford.com" style="color: #C88820;">tramaine@tramainecrawford.com</a> or <a href="tel:+12025991381" style="color: #C88820;">(202) 599-1381</a>.</p>
            <p style="font-size: 1rem; line-height: 1.75;">Talk soon.</p>
            <p style="font-size: 1rem; line-height: 1.75; margin-top: 2rem; color: #4A5260;">Tramaine L. Crawford<br/>TLC Leadership Consulting &amp; Coaching</p>
          </div>
          <div style="background: #001737; padding: 1.5rem; text-align: center; margin-top: 2rem;">
            <p style="color: rgba(255,255,255,0.3); font-size: 0.75rem; margin: 0;">2001 L St NW, Suite 500, Washington, DC 20036</p>
          </div>
        </div>`,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Contact form error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
