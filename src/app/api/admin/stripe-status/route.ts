import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin, supabaseAdmin } from '@/lib/supabase-server'
import { getStripe, stripeMode } from '@/lib/stripe'
import { HANDLED_EVENTS } from '@/lib/payments'
import { audit } from '@/lib/audit'

// Payment setup check for administrators, run on the server with the site's own Stripe key
// (the key is never returned).
//  GET                  → the Stripe account, its webhook endpoints and the events this site
//                          needs, read only.
//  GET ?session=cs_…    → whether the test event for that session reached this site.
//  POST {action:'webhook-test'} → creates a $1.00 Checkout Session that is never shown to
//                          anyone and immediately expires it. No customer, no payment, no
//                          charge; Stripe then sends "checkout.session.expired" to the webhook,
//                          which proves the endpoint and its signing secret end to end. The
//                          event carries no registration, so the site records it and ignores it.
export const runtime = 'nodejs'
const NO_STORE = { 'Cache-Control': 'private, no-store' }
const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/+$/, '')

export async function GET(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Not authorized' }, { status: 401, headers: NO_STORE })
  const mode = stripeMode()
  if (mode === 'unconfigured') return NextResponse.json({ mode }, { headers: NO_STORE })
  const stripe = getStripe()

  const session = request.nextUrl.searchParams.get('session')
  if (session) {
    if (!/^cs_(live|test)_[A-Za-z0-9]+$/.test(session)) return NextResponse.json({ error: 'Invalid session id' }, { status: 400, headers: NO_STORE })
    const events = await stripe.events.list({ type: 'checkout.session.expired', limit: 25 })
    const ev = events.data.find(e => (e.data.object as { id?: string }).id === session)
    if (!ev) return NextResponse.json({ session, event: null, note: 'Stripe has not created the event yet. Try again in a few seconds.' }, { headers: NO_STORE })
    const { data: row } = await supabaseAdmin.from('stripe_events').select('id, type, outcome, processed_at, received_at').eq('id', ev.id).maybeSingle()
    return NextResponse.json({
      session, event: ev.id, livemode: ev.livemode,
      stripe_pending_deliveries: ev.pending_webhooks, // 0 = every endpoint answered with success
      received_by_site: !!row, processed: !!row?.processed_at, outcome: row?.outcome ?? null,
    }, { headers: NO_STORE })
  }

  const [account, endpoints, { count: eventsRecorded }] = await Promise.all([
    stripe.accounts.retrieveCurrent(),
    stripe.webhookEndpoints.list({ limit: 20 }),
    supabaseAdmin.from('stripe_events').select('id', { count: 'exact', head: true }),
  ])
  const expected = `${siteUrl()}/api/webhook`
  return NextResponse.json({
    mode, checkout_enabled: process.env.CHECKOUT_ENABLED === 'true', site_webhook_url: expected,
    account: {
      id: account.id, name: account.business_profile?.name ?? account.settings?.dashboard?.display_name ?? null,
      country: account.country, default_currency: account.default_currency,
      charges_enabled: account.charges_enabled, payouts_enabled: account.payouts_enabled, details_submitted: account.details_submitted,
      requirements_due: account.requirements?.currently_due ?? [], disabled_reason: account.requirements?.disabled_reason ?? null,
      statement_descriptor: account.settings?.payments?.statement_descriptor ?? null,
    },
    required_events: HANDLED_EVENTS,
    webhook_endpoints: endpoints.data.map(e => ({
      url: e.url, status: e.status, livemode: e.livemode, api_version: e.api_version,
      points_to_this_site: e.url.replace(/\/+$/, '') === expected,
      missing_events: e.enabled_events.includes('*') ? [] : HANDLED_EVENTS.filter(t => !e.enabled_events.includes(t)),
    })),
    webhook_secret_configured: !!process.env.STRIPE_WEBHOOK_SECRET,
    events_recorded_by_site: eventsRecorded ?? 0,
  }, { headers: NO_STORE })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Not authorized' }, { status: 401, headers: NO_STORE })
  const body = await request.json().catch(() => ({}))
  if (body?.action !== 'webhook-test') return NextResponse.json({ error: 'Unknown action' }, { status: 400, headers: NO_STORE })
  if (stripeMode() === 'unconfigured') return NextResponse.json({ error: 'Stripe is not configured' }, { status: 409, headers: NO_STORE })
  const stripe = getStripe()
  const site = siteUrl() || 'https://tramainecrawford.com'
  const s = await stripe.checkout.sessions.create({
    mode: 'payment', payment_method_types: ['card'],
    line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: 100, product_data: { name: 'Webhook connection test (not for sale)' } } }],
    success_url: `${site}/register`, cancel_url: `${site}/register`,
    metadata: { webhook_test: 'true' },
  })
  await stripe.checkout.sessions.expire(s.id)
  await audit(admin.id, 'stripe.webhook_test', 'stripe', s.id, { livemode: s.livemode }, { label: 'Stripe webhook connection test (no charge)' })
  return NextResponse.json({ session: s.id, livemode: s.livemode, expired: true }, { headers: NO_STORE })
}
