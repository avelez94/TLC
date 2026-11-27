import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getStripe } from '@/lib/stripe'
import { CHECKOUT_WINDOW_SECONDS, checkoutSeatCheck, checkoutSessionParams, resolveCheckoutPrice } from '@/lib/checkout-pricing'
import { cleanLine, cleanText, clientIp, isValidEmail } from '@/lib/security'
import { rateLimit } from '@/lib/rate-limit'
import { likeExact } from '@/lib/payments'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// A registration in one of these payment states already holds (or is paying for) the place.
const SETTLED = new Set(['paid', 'complimentary', 'partially_refunded'])
// Abandoned attempts that can be reused for a new checkout (owner decision still open).
const REUSABLE_PAYMENT = new Set(['unpaid', 'expired', 'failed'])
const REUSABLE_STATUS = new Set(['pending', 'waitlist'])

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
      supabaseAdmin.from('programs').select('id, name, type, price, price_label, is_public, enrollment_open').eq('id', program_id).maybeSingle(),
      supabaseAdmin.from('cohorts').select('id, program_id, name, status, capacity').eq('id', cohort_id).maybeSingle(),
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

    // Already enrolled in this cohort (a returning participant may pay for a different cohort).
    const { data: account } = await supabaseAdmin.from('profiles').select('id').ilike('email', likeExact(email)).maybeSingle()
    if (account) {
      const { data: enrolled } = await supabaseAdmin.from('cohort_enrollments').select('id')
        .eq('cohort_id', cohort_id).eq('user_id', account.id).in('status', ['active', 'completed']).maybeSingle()
      if (enrolled) return NextResponse.json({ error: 'You are already enrolled in this cohort. Sign in to your Learning Hub, or contact us.' }, { status: 409 })
    }

    // One registration per person per cohort: never take a second payment; reuse an
    // abandoned unpaid attempt instead of creating a duplicate.
    const { data: mine } = await supabaseAdmin
      .from('registrations')
      .select('id, status, payment_status, stripe_session_id, checkout_expires_at')
      .eq('cohort_id', cohort_id)
      .ilike('email', likeExact(email))
      .order('created_at', { ascending: false })
      .limit(10)
    if (mine?.some(r => SETTLED.has(r.payment_status ?? '') && r.status !== 'declined')) {
      return NextResponse.json({ error: 'You are already registered for this cohort. Check your email for your confirmation, or contact us.' }, { status: 409 })
    }
    if (mine?.some(r => r.payment_status === 'pending')) {
      return NextResponse.json({ error: 'Your payment for this cohort is still being processed. Please check your email, or contact us.' }, { status: 409 })
    }
    const reusable = mine?.find(r => REUSABLE_PAYMENT.has(r.payment_status ?? 'unpaid') && REUSABLE_STATUS.has(r.status ?? 'pending'))

    // Seats: active enrollments + checkouts still open + payments awaiting confirmation.
    const now = new Date()
    if (cohort?.capacity != null) {
      const [{ count: active }, { data: others }] = await Promise.all([
        supabaseAdmin.from('cohort_enrollments').select('id', { count: 'exact', head: true }).eq('cohort_id', cohort_id).eq('status', 'active'),
        supabaseAdmin.from('registrations').select('id, status, payment_status, checkout_expires_at').eq('cohort_id', cohort_id)
          .in('payment_status', ['unpaid', 'pending', 'paid', 'complimentary', 'partially_refunded']).in('status', ['pending', 'waitlist']),
      ])
      const seats = checkoutSeatCheck({ capacity: cohort.capacity, activeEnrollments: active ?? 0, registrations: others ?? [], now, excludeRegistrationId: reusable?.id })
      if (seats.full) {
        return NextResponse.json({ error: 'This cohort is full. Please contact us to join the waitlist or a later cohort.' }, { status: 409 })
      }
    }

    const stripe = getStripe()
    // An older checkout for the reused registration is closed first, so it cannot also be paid.
    if (reusable?.stripe_session_id && reusable.checkout_expires_at && new Date(reusable.checkout_expires_at) > now) {
      try {
        await stripe.checkout.sessions.expire(reusable.stripe_session_id)
      } catch {
        const old = await stripe.checkout.sessions.retrieve(reusable.stripe_session_id).catch(() => null)
        if (old?.status === 'complete') {
          return NextResponse.json({ error: 'Your earlier payment for this cohort went through. Check your email for your confirmation.' }, { status: 409 })
        }
      }
    }

    // The seat is held from here (checkout_expires_at), before the Stripe session exists.
    const expiresAt = Math.floor(now.getTime() / 1000) + CHECKOUT_WINDOW_SECONDS
    const details = {
      full_name, email, phone: phone || null, organization: organization || null, why: why || null, program_id, cohort_id,
      payment_status: 'unpaid', payment_error: null, checkout_expires_at: new Date(expiresAt * 1000).toISOString(),
    }
    const { data: registration, error: dbError } = reusable
      ? await supabaseAdmin.from('registrations').update(details).eq('id', reusable.id).select('id').single()
      : await supabaseAdmin.from('registrations').insert({ ...details, status: 'pending' }).select('id').single()

    if (dbError || !registration) {
      console.error('Checkout: registration insert failed', dbError?.code)
      return NextResponse.json({ error: 'Failed to save registration' }, { status: 500 })
    }

    let session
    try {
      session = await stripe.checkout.sessions.create(checkoutSessionParams({
        registrationId: registration.id, cohortId: cohort_id, email, siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? '', expiresAt, pricing,
      }))
    } catch (err) {
      // No checkout was opened, so the seat is not held.
      await supabaseAdmin.from('registrations').update({ checkout_expires_at: null }).eq('id', registration.id)
      throw err
    }

    const { error: linkError } = await supabaseAdmin
      .from('registrations')
      .update({ stripe_session_id: session.id, checkout_expires_at: new Date(session.expires_at * 1000).toISOString() })
      .eq('id', registration.id)
    // Not fatal: the webhook finds the registration from the session's metadata.
    if (linkError) console.error('Checkout: could not store the session id', linkError.code)

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Checkout error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
