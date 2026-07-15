import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  try {
    const { full_name, email, phone, organization, why, program_id, cohort_id, program_name, cohort_name, price_label } = await request.json()

    if (!full_name || !email || !program_id || !cohort_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Save registration to Supabase
    const { error: dbError } = await supabaseAdmin
      .from('registrations')
      .insert({
        full_name,
        email,
        phone: phone || null,
        organization: organization || null,
        why: why || null,
        program_id,
        cohort_id,
        status: 'pending',
      })

    if (dbError) {
      console.error('DB error:', dbError)
      return NextResponse.json({ error: 'Failed to save registration' }, { status: 500 })
    }

    // Send confirmation email to registrant
    await resend.emails.send({
      from: 'TLC Leadership <noreply@contact.tramainecrawford.com>',
      to: email,
      subject: `You are registered for ${program_name}`,
      html: `
        <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #1C2430;">
          <div style="background: #001737; padding: 2rem; text-align: center; margin-bottom: 2rem;">
            <h1 style="color: #C88820; font-size: 1.5rem; letter-spacing: 0.08em; margin: 0;">TLC LEADERSHIP</h1>
            <p style="color: rgba(255,255,255,0.5); font-size: 0.75rem; letter-spacing: 0.2em; text-transform: uppercase; margin: 0.5rem 0 0;">Consulting & Coaching</p>
          </div>
          <div style="padding: 0 1rem;">
            <p style="font-size: 1rem; line-height: 1.75; margin-bottom: 1.5rem;">Hi ${full_name},</p>
            <p style="font-size: 1rem; line-height: 1.75; margin-bottom: 1.5rem;">Thank you for registering for <strong>${program_name}</strong>. We have received your registration and Tramaine will be in touch shortly with next steps and payment information.</p>
            <div style="background: #F7F5F0; border-left: 3px solid #C88820; padding: 1.25rem 1.5rem; margin-bottom: 1.5rem;">
              <p style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.15em; color: #C88820; margin: 0 0 0.5rem;">Your Registration</p>
              <p style="margin: 0 0 0.25rem; font-weight: 600;">${program_name}</p>
              <p style="margin: 0 0 0.25rem; color: #4A5260; font-size: 0.9rem;">${cohort_name}</p>
              ${price_label ? `<p style="margin: 0.5rem 0 0; font-weight: 700; color: #001737;">${price_label}</p>` : ''}
            </div>
            <p style="font-size: 1rem; line-height: 1.75; margin-bottom: 1.5rem;">In the meantime, if you have any questions you can reach Tramaine directly at <a href="mailto:tramaine@tramainecrawford.com" style="color: #C88820;">tramaine@tramainecrawford.com</a> or <a href="tel:+12025991381" style="color: #C88820;">(202) 599-1381</a>.</p>
            <p style="font-size: 1rem; line-height: 1.75;">We look forward to seeing you.</p>
            <p style="font-size: 1rem; line-height: 1.75; margin-top: 2rem; color: #4A5260;">Tramaine L. Crawford<br/>TLC Leadership Consulting & Coaching</p>
          </div>
          <div style="background: #001737; padding: 1.5rem; text-align: center; margin-top: 2rem;">
            <p style="color: rgba(255,255,255,0.3); font-size: 0.75rem; margin: 0;">2001 L St NW, Suite 500, Washington, DC 20036</p>
          </div>
        </div>
      `,
    })

    // Send notification email to Tramaine
    await resend.emails.send({
      from: 'TLC Platform <noreply@contact.tramainecrawford.com>',
      to: 'tramaine@tramainecrawford.com',
      subject: `New registration — ${full_name} for ${program_name}`,
      html: `
        <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #1C2430;">
          <div style="background: #001737; padding: 2rem; margin-bottom: 2rem;">
            <h1 style="color: #C88820; font-size: 1.25rem; letter-spacing: 0.08em; margin: 0;">New Registration</h1>
          </div>
          <div style="padding: 0 1rem;">
            <p style="font-size: 1rem; line-height: 1.75;">Hey Tramaine, you have a new registration.</p>
            <div style="background: #F7F5F0; border-left: 3px solid #C88820; padding: 1.25rem 1.5rem; margin: 1.5rem 0;">
              <table style="width: 100%; font-size: 0.9rem; line-height: 1.75;">
                <tr><td style="color: #C88820; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.15em; padding-bottom: 0.25rem;" colspan="2">Registration Details</td></tr>
                <tr><td style="color: #4A5260; width: 120px;">Name</td><td style="font-weight: 600;">${full_name}</td></tr>
                <tr><td style="color: #4A5260;">Email</td><td><a href="mailto:${email}" style="color: #C88820;">${email}</a></td></tr>
                ${phone ? `<tr><td style="color: #4A5260;">Phone</td><td><a href="tel:${phone}" style="color: #C88820;">${phone}</a></td></tr>` : ''}
                ${organization ? `<tr><td style="color: #4A5260;">Organization</td><td>${organization}</td></tr>` : ''}
                <tr><td style="color: #4A5260;">Program</td><td><strong>${program_name}</strong></td></tr>
                <tr><td style="color: #4A5260;">Cohort</td><td>${cohort_name}</td></tr>
                ${price_label ? `<tr><td style="color: #4A5260;">Investment</td><td><strong>${price_label}</strong></td></tr>` : ''}
              </table>
            </div>
            ${why ? `
            <div style="margin-bottom: 1.5rem;">
              <p style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.15em; color: #C88820; margin-bottom: 0.5rem;">Why they want to join</p>
              <p style="font-size: 0.9rem; line-height: 1.75; color: #4A5260; margin: 0;">${why}</p>
            </div>
            ` : ''}
            <p style="font-size: 0.9rem; color: #4A5260;">Log into your admin panel to view and manage this registration.</p>
            <a href="https://tlc-silk.vercel.app/admin" style="display: inline-block; background: #C88820; color: #001737; padding: 0.75rem 1.5rem; text-decoration: none; font-weight: 700; font-size: 0.85rem; letter-spacing: 0.08em; text-transform: uppercase; margin-top: 1rem; border-radius: 2px;">View in Admin Panel</a>
          </div>
        </div>
      `,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Registration error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
