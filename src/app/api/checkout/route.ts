import { Resend } from 'resend'
import { NextResponse } from 'next/server'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  try {
    const { name, email, phone, org, interest, message } = await request.json()

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const interestLabels: Record<string, string> = {
      consulting: 'Leadership Consulting',
      coaching: 'Performance & Success Coaching',
      finders: 'The Impact Lab — Impact Finders',
      makers: 'The Impact Lab — Impact Makers',
      leaders: 'The Impact Lab — Impact Leaders',
      speaking: 'Speaking',
      other: 'Other',
    }

    await resend.emails.send({
      from: 'TLC Website <onboarding@resend.dev>',
      to: 'tramaine@tramainecrawford.com',
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
                <tr><td style="color: #4A5260; width: 140px;">Name</td><td style="font-weight: 600;">${name}</td></tr>
                <tr><td style="color: #4A5260;">Email</td><td><a href="mailto:${email}" style="color: #C88820;">${email}</a></td></tr>
                ${phone ? `<tr><td style="color: #4A5260;">Phone</td><td><a href="tel:${phone}" style="color: #C88820;">${phone}</a></td></tr>` : ''}
                ${org ? `<tr><td style="color: #4A5260;">Organization</td><td>${org}</td></tr>` : ''}
                ${interest ? `<tr><td style="color: #4A5260;">Interest</td><td><strong>${interestLabels[interest] || interest}</strong></td></tr>` : ''}
              </table>
            </div>
            <div style="margin-bottom: 1.5rem;">
              <p style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.15em; color: #C88820; margin-bottom: 0.5rem;">Message</p>
              <p style="font-size: 0.9rem; line-height: 1.75; color: #1C2430; margin: 0;">${message}</p>
            </div>
            <p style="font-size: 0.85rem; color: #4A5260;">Reply directly to this email to respond to ${name}.</p>
          </div>
        </div>
      `,
    })

    // Send confirmation to the person who reached out
    await resend.emails.send({
      from: 'TLC Leadership <onboarding@resend.dev>',
      to: email,
      subject: 'We received your message',
      html: `
        <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #1C2430;">
          <div style="background: #001737; padding: 2rem; text-align: center; margin-bottom: 2rem;">
            <h1 style="color: #C88820; font-size: 1.5rem; letter-spacing: 0.08em; margin: 0;">TLC LEADERSHIP</h1>
            <p style="color: rgba(255,255,255,0.5); font-size: 0.75rem; letter-spacing: 0.2em; text-transform: uppercase; margin: 0.5rem 0 0;">Consulting & Coaching</p>
          </div>
          <div style="padding: 0 1rem;">
            <p style="font-size: 1rem; line-height: 1.75; margin-bottom: 1.5rem;">Hi ${name},</p>
            <p style="font-size: 1rem; line-height: 1.75; margin-bottom: 1.5rem;">Thank you for reaching out. We received your message and Tramaine will be in touch shortly.</p>
            <p style="font-size: 1rem; line-height: 1.75; margin-bottom: 1.5rem;">If you have anything urgent you can reach Tramaine directly at <a href="mailto:tramaine@tramainecrawford.com" style="color: #C88820;">tramaine@tramainecrawford.com</a> or <a href="tel:+12025991381" style="color: #C88820;">(202) 599-1381</a>.</p>
            <p style="font-size: 1rem; line-height: 1.75;">Talk soon.</p>
            <p style="font-size: 1rem; line-height: 1.75; margin-top: 2rem; color: #4A5260;">Tramaine L. Crawford<br/>TLC Leadership Consulting & Coaching</p>
          </div>
          <div style="background: #001737; padding: 1.5rem; text-align: center; margin-top: 2rem;">
            <p style="color: rgba(255,255,255,0.3); font-size: 0.75rem; margin: 0;">2001 L St NW, Suite 500, Washington, DC 20036</p>
          </div>
        </div>
      `,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Contact form error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}