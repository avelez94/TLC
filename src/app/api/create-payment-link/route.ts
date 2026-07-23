import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { Resend } from 'resend'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder')

  try {
    const { user_id, amount, description } = await request.json()

    if (!user_id || !amount || !description) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: client, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email')
      .eq('id', user_id)
      .single()

    if (profileError || !client?.email) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    const paymentLink = await stripe.paymentLinks.create({
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: description,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
    })

    await resend.emails.send({
      from: 'TLC Leadership <noreply@contact.tramainecrawford.com>',
      to: client.email,
      subject: 'Payment request from TLC Leadership Consulting & Coaching',
      html: `
        <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #1C2430;">
          <div style="background: #001737; padding: 2rem; text-align: center; margin-bottom: 2rem;">
            <h1 style="color: #C88820; font-size: 1.5rem; letter-spacing: 0.08em; margin: 0;">TLC LEADERSHIP</h1>
            <p style="color: rgba(255,255,255,0.5); font-size: 0.75rem; letter-spacing: 0.2em; text-transform: uppercase; margin: 0.5rem 0 0;">Consulting & Coaching</p>
          </div>
          <div style="padding: 0 1rem;">
            <p style="font-size: 1rem; line-height: 1.75; margin-bottom: 1.5rem;">Hi ${client.full_name || 'there'},</p>
            <p style="font-size: 1rem; line-height: 1.75; margin-bottom: 1.5rem;">Tramaine has sent you a payment request for your coaching services.</p>
            <div style="background: #F7F5F0; border-left: 3px solid #C88820; padding: 1.25rem 1.5rem; margin-bottom: 1.5rem;">
              <p style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.15em; color: #C88820; margin: 0 0 0.5rem;">Payment Request</p>
              <p style="margin: 0 0 0.25rem;">${description}</p>
              <p style="margin: 0.5rem 0 0; font-weight: 700; color: #001737;">$${amount.toFixed(2)}</p>
            </div>
            <a href="${paymentLink.url}" style="display: inline-block; background: #C88820; color: #001737; padding: 0.75rem 1.5rem; text-decoration: none; font-weight: 700; font-size: 0.85rem; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 1.5rem; border-radius: 2px;">Pay Now</a>
            <p style="font-size: 1rem; line-height: 1.75; margin-bottom: 1.5rem;">If you have any questions, you can reach Tramaine directly at <a href="mailto:tramaine@tramainecrawford.com" style="color: #C88820;">tramaine@tramainecrawford.com</a> or <a href="tel:+12025991381" style="color: #C88820;">(202) 599-1381</a>.</p>
            <p style="font-size: 1rem; line-height: 1.75; margin-top: 2rem; color: #4A5260;">Tramaine L. Crawford<br/>TLC Leadership Consulting & Coaching</p>
          </div>
          <div style="background: #001737; padding: 1.5rem; text-align: center; margin-top: 2rem;">
            <p style="color: rgba(255,255,255,0.3); font-size: 0.75rem; margin: 0;">2001 L St NW, Suite 500, Washington, DC 20036</p>
          </div>
        </div>
      `,
    })

    return NextResponse.json({ success: true, url: paymentLink.url })
  } catch (err) {
    console.error('Create payment link error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
