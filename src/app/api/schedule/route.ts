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
    const { full_name, email, phone, reason, booking_date, booking_time, date_label, time_label } = await request.json()

    if (!full_name || !email || !phone || !booking_date || !booking_time) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check slot is still available
    const { data: existing } = await supabaseAdmin
      .from('bookings')
      .select('id')
      .eq('booking_date', booking_date)
      .eq('booking_time', booking_time)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'This time slot was just booked. Please select another time.' }, { status: 409 })
    }

    // Save booking
    const { error: dbError } = await supabaseAdmin.from('bookings').insert({
      full_name,
      email,
      phone,
      reason: reason || null,
      booking_date,
      booking_time,
      status: 'confirmed',
    })

    if (dbError) {
      return NextResponse.json({ error: 'Failed to save booking' }, { status: 500 })
    }

    // Email to Tramaine
    await resend.emails.send({
      from: 'TLC Platform <noreply@contact.tramainecrawford.com>',
      to: 'tramaine@tramainecrawford.com',
      replyTo: email,
      subject: `New appointment: ${full_name} on ${date_label} at ${time_label}`,
      html: `
        <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #1C2430;">
          <div style="background: #001737; padding: 2rem; margin-bottom: 2rem;">
            <h1 style="color: #C88820; font-size: 1.25rem; letter-spacing: 0.08em; margin: 0;">New Appointment Booked</h1>
          </div>
          <div style="padding: 0 1rem;">
            <p style="font-size: 1rem; line-height: 1.75;">You have a new 15 minute phone call scheduled.</p>
            <div style="background: #F7F5F0; border-left: 3px solid #C88820; padding: 1.25rem 1.5rem; margin: 1.5rem 0;">
              <table style="width: 100%; font-size: 0.9rem; line-height: 1.9;">
                <tr><td style="color: #4A5260; width: 120px;">Name</td><td style="font-weight: 600;">${full_name}</td></tr>
                <tr><td style="color: #4A5260;">Phone</td><td><a href="tel:${phone}" style="color: #C88820;">${phone}</a></td></tr>
                <tr><td style="color: #4A5260;">Email</td><td><a href="mailto:${email}" style="color: #C88820;">${email}</a></td></tr>
                <tr><td style="color: #4A5260;">Date</td><td><strong>${date_label}</strong></td></tr>
                <tr><td style="color: #4A5260;">Time</td><td><strong>${time_label} ET</strong></td></tr>
                ${reason ? `<tr><td style="color: #4A5260; vertical-align: top; padding-top: 0.25rem;">Topic</td><td>${reason}</td></tr>` : ''}
              </table>
            </div>
            <p style="font-size: 0.9rem; color: #4A5260;">You can view all upcoming appointments in your admin panel.</p>
            <a href="https://tlc-silk.vercel.app/admin" style="display: inline-block; background: #C88820; color: #001737; padding: 0.75rem 1.5rem; text-decoration: none; font-weight: 700; font-size: 0.85rem; letter-spacing: 0.08em; text-transform: uppercase; margin-top: 1rem; border-radius: 2px;">View Calendar</a>
          </div>
        </div>
      `,
    })

    // Confirmation email to client
    await resend.emails.send({
      from: 'TLC Leadership <noreply@contact.tramainecrawford.com>',
      to: email,
      subject: `Your appointment is confirmed`,
      html: `
        <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #1C2430;">
          <div style="background: #001737; padding: 2rem; text-align: center; margin-bottom: 2rem;">
            <h1 style="color: #C88820; font-size: 1.5rem; letter-spacing: 0.08em; margin: 0;">TLC LEADERSHIP</h1>
            <p style="color: rgba(255,255,255,0.5); font-size: 0.75rem; letter-spacing: 0.2em; text-transform: uppercase; margin: 0.5rem 0 0;">Consulting and Coaching</p>
          </div>
          <div style="padding: 0 1rem;">
            <p style="font-size: 1rem; line-height: 1.75; margin-bottom: 1.5rem;">Hi ${full_name},</p>
            <p style="font-size: 1rem; line-height: 1.75; margin-bottom: 1.5rem;">Your appointment with Tramaine is confirmed. Here are your details:</p>
            <div style="background: #F7F5F0; border-left: 3px solid #C88820; padding: 1.5rem; margin-bottom: 1.5rem;">
              <p style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.15em; color: #C88820; margin-bottom: 0.75rem;">Appointment Details</p>
              <p style="font-size: 1rem; font-weight: 700; color: #001737; margin-bottom: 0.25rem;">${date_label}</p>
              <p style="font-size: 1rem; font-weight: 700; color: #C88820; margin-bottom: 0.25rem;">${time_label} ET</p>
              <p style="font-size: 0.85rem; color: #4A5260;">15 minute phone call</p>
            </div>
            <p style="font-size: 1rem; line-height: 1.75; margin-bottom: 1.5rem;">Tramaine will call you at <strong>${phone}</strong> at your appointment time. Please make sure you are available at that number.</p>
            <p style="font-size: 1rem; line-height: 1.75; margin-bottom: 1.5rem;">If you need to reach out before then you can email <a href="mailto:tramaine@tramainecrawford.com" style="color: #C88820;">tramaine@tramainecrawford.com</a> or call <a href="tel:+12025991381" style="color: #C88820;">(202) 599-1381</a>.</p>
            <p style="font-size: 1rem; line-height: 1.75;">Talk soon.</p>
            <p style="font-size: 1rem; line-height: 1.75; margin-top: 2rem; color: #4A5260;">Tramaine L. Crawford<br/>TLC Leadership Consulting and Coaching</p>
          </div>
          <div style="background: #001737; padding: 1.5rem; text-align: center; margin-top: 2rem;">
            <p style="color: rgba(255,255,255,0.3); font-size: 0.75rem; margin: 0;">2001 L St NW, Suite 500, Washington, DC 20036</p>
          </div>
        </div>
      `,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Booking error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}