import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getStripe } from '@/lib/stripe'
import { resolveCheckoutPrice } from '@/lib/checkout-pricing'
import { cleanLine, cleanText, clientIp, isValidEmail } from '@/lib/security'
import { rateLimit } from '@/lib/rate-limit'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
  // Owner decision 2026-11-21: online checkout stays closed until pathway pricing is set and
  // approved. Re-open by setting CHECKOUT_ENABLED=true in Vercel (Production).
  if (process.env.CHECKOUT_ENABLED !== 'true') {
    return NextResponse.json(
      { error: 'Online registration is not open right now. Please contact us and we will help you enroll.' },
      { status: 503 }
    )
  }

  if (!(await rateLimit('checkout-ip', clientIp(request.headers), 8, 600))) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // Only identity and contact fields come from the browser. Price, program name and cohort
  // name are read from the database below; any such fields in the request are ignored.
  const full_name = cleanLine(body.full_name, 120)
  const email = cleanLine(body.email, 254).toLowerCase()
  const phone = cleanLine(body.phone, 40)
  const organization = cleanLine(body.organization, 160)
  const why = cleanText(body.why, 3000)
  const program_id = typeof body.program_id === 'string' ? body.program_id : ''
  const cohort_id = typeof body.cohort_id === 'string' ? body.cohort_id : ''

  if (!full_name || !isValidEmail(email) || !UUID_RE.test(program_id) || !UUID_RE.test(cohort_id)) {
    return NextResponse.json({ error: 'Please provide your name, a valid email, and a program and cohort.' }, { status: 400 })
  }

  try {
    const [programRes, cohortRes] = await Promise.all([
      supabaseAdmin.from('programs').select('id, name, type, price, price_label').eq('id', program_id).maybeSingle(),
      supabaseAdmin.from('cohorts').select('id, program_id, name, status').eq('id', cohort_id).maybeSingle(),
    ])
    if (programRes.error || cohortRes.error) {
      console.error('Checkout: lookup failed', programRes.error?.message ?? cohortRes.error?.message)
      return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
    const program = programRes.data
    const cohort = cohortRes.data

    const pricing = resolveCheckoutPrice(program, cohort)
    if (!pricing.ok) {
      return NextResponse.json({ error: pricing.error }, { status: pricing.status })
    }

    const details = {
      full_name,
      email,
      phone: phone || null,
      organization: organization || null,
      why: why || null,
      program_id,
      cohort_id,
    }

    // One registration per person per cohort: if this email already has a paid
    // registration for the cohort, don't take a second payment; if it has an abandoned
    // unpaid one, reuse it instead of creating a duplicate.
    const { data: existing } = await supabaseAdmin
      .from('registrations')
      .select('id, payment_status')
      .eq('cohort_id', cohort_id)
      .ilike('email', email)
      .order('created_at', { ascending: false })
      .limit(5)
    if (existing?.some(r => r.payment_status === 'paid')) {
      return NextResponse.json({ error: 'You are already registered for this cohort. Check your email for your confirmation, or contact us.' }, { status: 409 })
    }
    const reusable = existing?.find(r => r.payment_status !== 'paid')

    const { data: registration, error: dbError } = reusable
      ? await supabaseAdmin.from('registrations').update(details).eq('id', reusable.id).select('id').single()
      : await supabaseAdmin.from('registrations').insert({ ...details, status: 'pending', payment_status: 'unpaid' }).select('id').single()

    if (dbError || !registration) {
      console.error('Checkout: registration insert failed', dbError?.code)
      return NextResponse.json({ error: 'Failed to save registration' }, { status: 500 })
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    const session = await getStripe().checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      allow_promotion_codes: true,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: pricing.productName, description: pricing.description },
            unit_amount: pricing.amountCents,
          },
          quantity: 1,
        },
      ],
      customer_email: email,
      success_url: `${siteUrl}/register/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/register/cancelled`,
      // The webhook reads everything else from the registration row, not from metadata.
      metadata: { registration_id: registration.id },
    })

    await supabaseAdmin
      .from('registrations')
      .update({ stripe_session_id: session.id })
      .eq('id', registration.id)

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Checkout error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
