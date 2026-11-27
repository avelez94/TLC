import { NextResponse, type NextRequest } from 'next/server'
import type Stripe from 'stripe'
import { requireAdmin, supabaseAdmin } from '@/lib/supabase-server'
import { getStripe, stripeMode } from '@/lib/stripe'
import { HANDLED_EVENTS } from '@/lib/payments'
import { TLC_STRIPE_APP } from '@/lib/checkout-pricing'
import { audit } from '@/lib/audit'
import { loadStripeCheck, saveStripeCheck } from '@/lib/launch-server'
import type { StripeCheck } from '@/lib/launch-readiness'

// Stripe setup for administrators, run on the server with the site's own key (never returned).
// TLC and Rising Sons Academy share the Stripe account: only the endpoint whose URL is this
// site's webhook is ever read for completeness or changed; every other endpoint is listed for
// information and left untouched.
//  GET                         → account, webhook endpoints, required events (read only); refreshes
//                                 the saved check (a previous verification stays valid only while
//                                 the account and the TLC endpoint are still complete).
//  GET ?session=cs_…           → whether the test event reached this site; on success records the
//                                 verification that the checkout gate requires.
//  POST {action:'configure-webhook'} → adds the missing required events to the TLC endpoint only.
//  POST {action:'webhook-test'}      → $1.00 Checkout Session, never shown, expired at once (no
//                                 customer, no payment); Stripe sends checkout.session.expired.
export const runtime = 'nodejs'
const NO_STORE = { 'Cache-Control': 'private, no-store' }
const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/+$/, '')
const webhookUrl = () => `${siteUrl()}/api/webhook`
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE })

function missingFor(e: Stripe.WebhookEndpoint): string[] {
  return e.enabled_events.includes('*') ? [] : HANDLED_EVENTS.filter(t => !e.enabled_events.includes(t))
}

async function snapshot(stripe: Stripe) {
  const [account, endpoints] = await Promise.all([stripe.accounts.retrieveCurrent(), stripe.webhookEndpoints.list({ limit: 50 })])
  const tlc = endpoints.data.find(e => e.url.replace(/\/+$/, '') === webhookUrl()) ?? null
  const accountOk = !!account.charges_enabled && !!account.details_submitted && !account.requirements?.disabled_reason
  return { account, endpoints: endpoints.data, tlc, accountOk, missing: tlc ? missingFor(tlc) : [...HANDLED_EVENTS], eventsComplete: !!tlc && tlc.status === 'enabled' && missingFor(tlc).length === 0 }
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return json({ error: 'Not authorized' }, 401)
  const mode = stripeMode()
  if (mode === 'unconfigured') return json({ mode })
  const stripe = getStripe()

  const session = request.nextUrl.searchParams.get('session')
  if (session) {
    if (!/^cs_(live|test)_[A-Za-z0-9]+$/.test(session)) return json({ error: 'Invalid session id' }, 400)
    const events = await stripe.events.list({ type: 'checkout.session.expired', limit: 25 })
    const ev = events.data.find(e => (e.data.object as { id?: string }).id === session)
    if (!ev) return json({ session, event: null, verified: false, note: 'Stripe has not sent the event yet. Try again in a few seconds.' })
    const { data: row } = await supabaseAdmin.from('stripe_events').select('outcome, processed_at').eq('id', ev.id).maybeSingle()
    const delivered = ev.pending_webhooks === 0 && !!row?.processed_at && row.outcome === 'webhook_test_received'
    let verified = false
    if (delivered) {
      const s = await snapshot(stripe)
      verified = s.accountOk && s.eventsComplete
      await saveStripeCheck({
        verified, verified_at: verified ? new Date().toISOString() : null, livemode: ev.livemode, account_id: s.account.id,
        account_ok: s.accountOk, events_complete: s.eventsComplete, missing_events: s.missing, endpoint_url: s.tlc?.url ?? null,
      }, admin.id)
      await audit(admin.id, 'stripe.verified', 'stripe', s.account.id, { livemode: ev.livemode, verified }, { label: 'Stripe webhook verification', outcome: verified ? 'success' : 'failed' })
    }
    return json({ session, event: ev.id, livemode: ev.livemode, stripe_pending_deliveries: ev.pending_webhooks, received_by_site: !!row, outcome: row?.outcome ?? null, delivered, verified })
  }

  const s = await snapshot(stripe)
  const prev = await loadStripeCheck()
  const stillValid = !!prev?.verified && prev.account_id === s.account.id && prev.livemode === (mode === 'live') && s.accountOk && s.eventsComplete
  const check: StripeCheck = {
    verified: stillValid, verified_at: stillValid ? prev!.verified_at : null, livemode: mode === 'live', account_id: s.account.id,
    account_ok: s.accountOk, events_complete: s.eventsComplete, missing_events: s.missing, endpoint_url: s.tlc?.url ?? null,
  }
  await saveStripeCheck(check, admin.id)
  const { count: eventsRecorded } = await supabaseAdmin.from('stripe_events').select('id', { count: 'exact', head: true })
  return json({
    mode, checkout_enabled: process.env.CHECKOUT_ENABLED === 'true', site_webhook_url: webhookUrl(), check,
    account: {
      id: s.account.id, name: s.account.business_profile?.name ?? s.account.settings?.dashboard?.display_name ?? null,
      country: s.account.country, default_currency: s.account.default_currency,
      charges_enabled: s.account.charges_enabled, payouts_enabled: s.account.payouts_enabled, details_submitted: s.account.details_submitted,
      requirements_due: s.account.requirements?.currently_due ?? [], disabled_reason: s.account.requirements?.disabled_reason ?? null,
      statement_descriptor: s.account.settings?.payments?.statement_descriptor ?? null,
    },
    required_events: HANDLED_EVENTS,
    webhook_endpoints: s.endpoints.map(e => {
      const ours = e.id === s.tlc?.id
      // Every endpoint's subscriptions are listed (read only) so changes can be audited; only the TLC endpoint is ever updated.
      return { url: e.url, status: e.status, livemode: e.livemode, this_site: ours, enabled_events: [...e.enabled_events].sort(), ...(ours ? { missing_events: missingFor(e) } : {}) }
    }),
    webhook_secret_configured: !!process.env.STRIPE_WEBHOOK_SECRET,
    events_recorded_by_site: eventsRecorded ?? 0,
  })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return json({ error: 'Not authorized' }, 401)
  const body = await request.json().catch(() => ({}))
  if (stripeMode() === 'unconfigured') return json({ error: 'Stripe is not configured' }, 409)
  const stripe = getStripe()

  if (body?.action === 'configure-webhook') {
    const s = await snapshot(stripe)
    if (!s.tlc) return json({ error: `No webhook endpoint for ${webhookUrl()} exists in Stripe. Create it in the Stripe dashboard first.` }, 409)
    const before = s.tlc.enabled_events
    if (before.includes('*') || missingFor(s.tlc).length === 0) return json({ changed: false, enabled_events: before })
    const enabled = [...new Set([...before, ...HANDLED_EVENTS])] as Stripe.WebhookEndpointUpdateParams.EnabledEvent[]
    const updated = await stripe.webhookEndpoints.update(s.tlc.id, { enabled_events: enabled })
    await audit(admin.id, 'stripe.webhook_events', 'stripe', s.tlc.id, { added: missingFor(s.tlc), url: s.tlc.url }, { label: 'Added the required events to the TLC Stripe webhook' })
    return json({ changed: true, url: updated.url, added: missingFor(s.tlc), enabled_events: updated.enabled_events })
  }

  if (body?.action === 'webhook-test') {
    const site = siteUrl() || 'https://tramainecrawford.com'
    const s = await stripe.checkout.sessions.create({
      mode: 'payment', payment_method_types: ['card'],
      line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: 100, product_data: { name: 'TLC webhook connection test (not for sale)' } } }],
      success_url: `${site}/register`, cancel_url: `${site}/register`,
      metadata: { app: TLC_STRIPE_APP, webhook_test: 'true' },
    })
    await stripe.checkout.sessions.expire(s.id)
    await audit(admin.id, 'stripe.webhook_test', 'stripe', s.id, { livemode: s.livemode }, { label: 'Stripe webhook connection test (no charge)' })
    return json({ session: s.id, livemode: s.livemode, expired: true })
  }

  return json({ error: 'Unknown action' }, 400)
}
