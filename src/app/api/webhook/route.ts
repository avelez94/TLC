import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { Resend } from 'resend'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder')
  const resend = new Resend(process.env.RESEND_API_KEY)

  const body = await request.text()
  const signature = request.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET || 'whsec_placeholder')
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const registrationId = session.metadata?.registration_id
    const programName = session.metadata?.program_name
    const cohortName = session.metadata?.cohort_name
    const fullName = session.metadata?.full_name
    const email = session.metadata?.email

    if (registrationId) {
      await supabaseAdmin
        .from('registrations')
        .update({
          payment_status: 'paid',
          amount_paid: session.amount_total ? session.amount_total / 100 : null,
        })
        .eq('id', registrationId)

      // Confirmation email to participant
      try {
        await resend.emails.send({
          from: 'TLC Leadership <noreply@contact.tramainecrawford.com>',
          to: email!,
          subject: 'Your Impact Lab registration is confirmed',
          html: `
            <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #1C2430;">
              <div style="background: #001737; padding: 2rem; text-align: center; margin-bottom: 2rem;">
                <h1 style="color: #C88820; font-size: 1.5rem; letter-spacing: 0.08em; margin: 0;">TLC LEADERSHIP</h1>
                <p style="color: rgba(255,255,255,0.5); font-size: 0.75rem; letter-spacing: 0.2em; text-transform: uppercase; margin: 0.5rem 0 0;">The Impact Lab</p>
              </div>
              <div style="padding: 0 1rem;">
                <p style="font-size: 1rem; line-height: 1.75; margin-bottom: 1.5rem;">Hi ${fullName},</p>
                <p style="font-size: 1rem; line-height: 1.75; margin-bottom: 1.5rem;">Thank you for registering for The Impact Lab. Your registration has been received successfully.</p>
                <div style="background: #F7F5F0; border-left: 3px solid #C88820; padding: 1.5rem; margin-bottom: 1.5rem;">
                  <p style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.15em; color: #C88820; margin-bottom: 0.75rem;">Your Registration</p>
                  <p style="font-size: 1rem; font-weight: 700; color: #001737; margin-bottom: 0.25rem;">${programName}</p>
                  <p style="font-size: 0.9rem; color: #4A5260; margin-bottom: 0;">${cohortName}</p>
                </div>
                <p style="font-size: 1rem; line-height: 1.75; margin-bottom: 1.5rem;">You will receive your Learning Hub invitation and program details shortly.</p>
                <p style="font-size: 1rem; line-height: 1.75; margin-bottom: 1.5rem;">In the meantime, if you have any questions reach out to Tramaine directly at <a href="mailto:tramaine@tramainecrawford.com" style="color: #C88820;">tramaine@tramainecrawford.com</a> or <a href="tel:+12025991381" style="color: #C88820;">(202) 599-1381</a>.</p>
                <p style="font-size: 1rem; line-height: 1.75;">We look forward to seeing you.</p>
                <p style="font-size: 1rem; line-height: 1.75; margin-top: 2rem; color: #4A5260;">Tramaine L. Crawford<br/>TLC Leadership Consulting &amp; Coaching</p>
              </div>
              <div style="background: #001737; padding: 1.5rem; text-align: center; margin-top: 2rem;">
                <p style="color: rgba(255,255,255,0.3); font-size: 0.75rem; margin: 0;">2001 L St NW, Suite 500, Washington, DC 20036</p>
              </div>
            </div>
          `,
        })
      } catch (emailErr) {
        console.error('Participant email error:', emailErr)
      }

      // Notification to Tramaine
      try {
        await resend.emails.send({
          from: 'TLC Platform <noreply@contact.tramainecrawford.com>',
          to: 'tramaine@tramainecrawford.com',
          subject: `New Impact Lab registration — ${fullName}`,
          html: `
            <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #1C2430;">
              <div style="background: #001737; padding: 2rem; margin-bottom: 2rem;">
                <h1 style="color: #C88820; font-size: 1.25rem; letter-spacing: 0.08em; margin: 0;">New Registration</h1>
                <p style="color: rgba(255,255,255,0.5); font-size: 0.75rem; margin: 0.5rem 0 0;">Payment received</p>
              </div>
              <div style="padding: 0 1rem;">
                <p style="font-size: 1rem; line-height: 1.75;">A new participant has registered and payment has been received. Review their registration in the admin panel, assign them to their cohort, and click Confirm &amp; Send Invitation to give them access to their Learning Hub.</p>
                <div style="background: #F7F5F0; border-left: 3px solid #C88820; padding: 1.25rem 1.5rem; margin: 1.5rem 0;">
                  <table style="width: 100%; font-size: 0.9rem; line-height: 1.9;">
                    <tr><td style="color: #4A5260; width: 120px;">Name</td><td style="font-weight: 600;">${fullName}</td></tr>
                    <tr><td style="color: #4A5260;">Email</td><td><a href="mailto:${email}" style="color: #C88820;">${email}</a></td></tr>
                    <tr><td style="color: #4A5260;">Program</td><td><strong>${programName}</strong></td></tr>
                    <tr><td style="color: #4A5260;">Cohort</td><td>${cohortName}</td></tr>
                    <tr><td style="color: #4A5260;">Amount Paid</td><td><strong>$${session.amount_total ? session.amount_total / 100 : '0'}</strong></td></tr>
                  </table>
                </div>
                <a href="https://tlc-silk.vercel.app/admin" style="display: inline-block; background: #C88820; color: #001737; padding: 0.75rem 1.5rem; text-decoration: none; font-weight: 700; font-size: 0.85rem; letter-spacing: 0.08em; text-transform: uppercase; margin-top: 1rem; border-radius: 2px;">Review in Admin Panel</a>
              </div>
            </div>
          `,
        })
      } catch (emailErr) {
        console.error('Admin email error:', emailErr)
      }
    }
  }

  return NextResponse.json({ received: true })
}