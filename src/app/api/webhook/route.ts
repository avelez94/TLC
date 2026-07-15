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

      try {
        await resend.emails.send({
          from: 'TLC Platform <noreply@contact.tramainecrawford.com>',
          to: 'tramaine@tramainecrawford.com',
          subject: `Payment received for ${programName}`,
          html: `
            <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #1C2430;">
              <div style="background: #001737; padding: 2rem; margin-bottom: 2rem;">
                <h1 style="color: #C88820; font-size: 1.25rem; letter-spacing: 0.08em; margin: 0;">Payment Received</h1>
              </div>
              <div style="padding: 0 1rem;">
                <p style="font-size: 1rem; line-height: 1.75;">Good news Tramaine, payment just came through.</p>
                <div style="background: #F7F5F0; border-left: 3px solid #C88820; padding: 1.25rem 1.5rem; margin: 1.5rem 0;">
                  <table style="width: 100%; font-size: 0.9rem; line-height: 1.75;">
                    <tr><td style="color: #4A5260; width: 120px;">Name</td><td style="font-weight: 600;">${fullName}</td></tr>
                    <tr><td style="color: #4A5260;">Email</td><td><a href="mailto:${email}" style="color: #C88820;">${email}</a></td></tr>
                    <tr><td style="color: #4A5260;">Program</td><td><strong>${programName}</strong></td></tr>
                    <tr><td style="color: #4A5260;">Cohort</td><td>${cohortName}</td></tr>
                    <tr><td style="color: #4A5260;">Amount Paid</td><td><strong>$${session.amount_total ? session.amount_total / 100 : '0'}</strong></td></tr>
                  </table>
                </div>
                <p style="font-size: 0.9rem; color: #4A5260;">Go to the admin panel to confirm this registration and send their portal invite.</p>
                <a href="https://tlc-silk.vercel.app/admin" style="display: inline-block; background: #C88820; color: #001737; padding: 0.75rem 1.5rem; text-decoration: none; font-weight: 700; font-size: 0.85rem; letter-spacing: 0.08em; text-transform: uppercase; margin-top: 1rem; border-radius: 2px;">Confirm in Admin Panel</a>
              </div>
            </div>
          `,
        })
      } catch (emailErr) {
        console.error('Email error:', emailErr)
      }
    }
  }

  return NextResponse.json({ received: true })
}