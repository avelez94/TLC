import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { Resend } from 'resend'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY)

function describeSessions(hours: number): string {
  const numberWords: Record<number, string> = { 1: 'One', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six' }
  if (hours === 1.5) return 'One 90-minute coaching session'
  if (hours === 0.5) return 'One 30-minute coaching session'
  if (Number.isInteger(hours) && hours >= 1) {
    const word = numberWords[hours] || String(hours)
    return `${word} 60-minute coaching session${hours === 1 ? '' : 's'}`
  }
  return `${hours} hours of coaching`
}

function emailShell(bodyHtml: string) {
  return `
    <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #1C2430;">
      <div style="background: #001737; padding: 2rem; text-align: center; margin-bottom: 2rem;">
        <h1 style="color: #C88820; font-size: 1.5rem; letter-spacing: 0.08em; margin: 0;">TLC LEADERSHIP</h1>
        <p style="color: rgba(255,255,255,0.5); font-size: 0.75rem; letter-spacing: 0.2em; text-transform: uppercase; margin: 0.5rem 0 0;">Consulting & Coaching</p>
      </div>
      <div style="padding: 0 1rem;">
        ${bodyHtml}
      </div>
      <div style="background: #001737; padding: 1.5rem; text-align: center; margin-top: 2rem;">
        <p style="color: rgba(255,255,255,0.3); font-size: 0.75rem; margin: 0;">2001 L St NW, Suite 500, Washington, DC 20036</p>
      </div>
    </div>
  `
}

function newClientEmail(name: string, sessionDescription: string, amount: number, paymentUrl: string) {
  return emailShell(`
    <p style="font-size: 1rem; line-height: 1.75; margin-bottom: 1.5rem;">Hi ${name},</p>
    <p style="font-size: 1rem; line-height: 1.75; margin-bottom: 1.5rem;">Thank you for choosing TLC Leadership Consulting & Coaching.</p>
    <p style="font-size: 1rem; line-height: 1.75; margin-bottom: 1.5rem;">Your coaching engagement has been confirmed. To reserve your coaching sessions, please complete the payment request below.</p>
    <div style="background: #F7F5F0; border-left: 3px solid #C88820; padding: 1.25rem 1.5rem; margin-bottom: 1.5rem;">
      <p style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.15em; color: #C88820; margin: 0 0 0.5rem;">Coaching Engagement</p>
      <p style="margin: 0 0 0.5rem;">${sessionDescription}</p>
      <p style="margin: 0; font-weight: 700; color: #001737;">Investment: $${amount.toFixed(2)}</p>
    </div>
    <a href="${paymentUrl}" style="display: inline-block; background: #C88820; color: #001737; padding: 0.75rem 1.5rem; text-decoration: none; font-weight: 700; font-size: 0.85rem; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 1.5rem; border-radius: 2px;">Pay Now</a>
    <p style="font-size: 1rem; line-height: 1.75; margin-bottom: 1.5rem;">Once your payment is received, you'll receive a welcome email with your next steps, including your coaching agreement (if applicable), intake questionnaire, and information to help you prepare for your first session.</p>
    <p style="font-size: 1rem; line-height: 1.75; margin-bottom: 1.5rem;">If you have any questions, please don't hesitate to reach out. I look forward to working with you.</p>
    <p style="font-size: 1rem; line-height: 1.75; margin-top: 2rem; color: #4A5260;">Tramaine L. Crawford<br/>TLC Leadership Consulting & Coaching</p>
    <p style="font-size: 0.9rem; line-height: 1.75; color: #4A5260;"><a href="mailto:tramaine@tramainecrawford.com" style="color: #C88820;">tramaine@tramainecrawford.com</a><br/><a href="tel:+12025991381" style="color: #C88820;">(202) 599-1381</a></p>
  `)
}

function existingClientEmail(name: string, hours: number, amount: number, paymentUrl: string) {
  return emailShell(`
    <p style="font-size: 1rem; line-height: 1.75; margin-bottom: 1.5rem;">Hi ${name},</p>
    <p style="font-size: 1rem; line-height: 1.75; margin-bottom: 1.5rem;">I hope you're doing well.</p>
    <p style="font-size: 1rem; line-height: 1.75; margin-bottom: 1.5rem;">This is a friendly reminder to submit your payment for your upcoming coaching session. You can complete your payment using the link below.</p>
    <div style="background: #F7F5F0; border-left: 3px solid #C88820; padding: 1.25rem 1.5rem; margin-bottom: 1.5rem;">
      <p style="margin: 0 0 0.5rem;">Coaching Session - ${hours} hours</p>
      <p style="margin: 0; font-weight: 700; color: #001737;">Amount Due: $${amount.toFixed(2)}</p>
    </div>
    <a href="${paymentUrl}" style="display: inline-block; background: #C88820; color: #001737; padding: 0.75rem 1.5rem; text-decoration: none; font-weight: 700; font-size: 0.85rem; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 1.5rem; border-radius: 2px;">Pay Now</a>
    <p style="font-size: 1rem; line-height: 1.75; margin-bottom: 1.5rem;">Once your payment is received, your session will be confirmed.</p>
    <p style="font-size: 1rem; line-height: 1.75; margin-bottom: 1.5rem;">If you have any questions, please let me know. I look forward to continuing our work together.</p>
    <p style="font-size: 1rem; line-height: 1.75; margin-top: 2rem; color: #4A5260;">Tramaine L. Crawford<br/>TLC Leadership Consulting & Coaching</p>
    <p style="font-size: 0.9rem; line-height: 1.75; color: #4A5260;"><a href="mailto:tramaine@tramainecrawford.com" style="color: #C88820;">tramaine@tramainecrawford.com</a><br/><a href="tel:+12025991381" style="color: #C88820;">(202) 599-1381</a></p>
  `)
}

export async function POST(request: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder')

  try {
    const { user_id, amount, hours, client_type } = await request.json()

    if (!user_id || !amount || !hours || (client_type !== 'new' && client_type !== 'existing')) {
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

    const productName = client_type === 'new'
      ? `Coaching Engagement — ${describeSessions(hours)}`
      : `Coaching Session — ${hours} hour${hours === 1 ? '' : 's'}`

    const paymentLink = await stripe.paymentLinks.create({
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: productName,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
    })

    const name = client.full_name || 'there'
    const subject = client_type === 'new'
      ? 'Your Coaching Engagement — Payment Request'
      : 'Payment Request – Leadership Coaching'
    const html = client_type === 'new'
      ? newClientEmail(name, describeSessions(hours), amount, paymentLink.url)
      : existingClientEmail(name, hours, amount, paymentLink.url)

    await resend.emails.send({
      from: 'TLC Leadership <noreply@contact.tramainecrawford.com>',
      to: client.email,
      subject,
      html,
    })

    return NextResponse.json({ success: true, url: paymentLink.url })
  } catch (err) {
    console.error('Create payment link error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
