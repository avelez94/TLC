import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder')

  try {
    const { full_name, email, phone, organization, why, program_id, cohort_id, program_name, cohort_name, price } = await request.json()

    if (!full_name || !email || !program_id || !cohort_id || !price) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: registration, error: dbError } = await supabaseAdmin
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
        payment_status: 'unpaid',
      })
      .select()
      .single()

    if (dbError || !registration) {
      console.error('DB error:', dbError)
      return NextResponse.json({ error: 'Failed to save registration' }, { status: 500 })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      allow_promotion_codes: true,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: program_name,
              description: cohort_name,
            },
            unit_amount: price * 100,
          },
          quantity: 1,
        },
      ],
      customer_email: email,
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/register/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/register/cancelled`,
      metadata: {
        registration_id: registration.id,
        program_name,
        cohort_name,
        full_name,
        email,
      },
    })

    await supabaseAdmin
      .from('registrations')
      .update({ stripe_session_id: session.id })
      .eq('id', registration.id)

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Checkout error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}