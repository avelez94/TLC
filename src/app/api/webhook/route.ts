// Stripe webhook. The raw body is verified against STRIPE_WEBHOOK_SECRET before anything is
// read; then src/lib/payments.ts records the event once (stripe_events) and applies it.
// Answers 500 only when Stripe should deliver the event again (database problem, or a
// notification email that failed and still has to be sent).
import Stripe from 'stripe'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getStripe } from '@/lib/stripe'
import { deliverEmail, FROM_TLC, FROM_PLATFORM, OWNER_INBOX } from '@/lib/email'
import { sendAccessEmail } from '@/lib/account-access'
import { audit } from '@/lib/audit'
import { processStripeEvent, readEnrollMode, verifyStripeEvent } from '@/lib/payments'

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('Webhook: STRIPE_WEBHOOK_SECRET is not configured')
    return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  }

  const body = await request.text()
  // Signature checks need no API key: Stripe.webhooks works without a client.
  const event = verifyStripeEvent(Stripe, body, request.headers.get('stripe-signature'), webhookSecret)
  if (!event) return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })

  let stripe: Stripe | null = null
  try { stripe = getStripe() } catch { /* receipts and refund matching need the key; payments are still recorded */ }

  const result = await processStripeEvent(event, {
    db: supabaseAdmin, stripe, deliverEmail, sendAccessEmail, audit,
    enrollMode: () => readEnrollMode(supabaseAdmin),
    emails: { fromTlc: FROM_TLC, fromPlatform: FROM_PLATFORM, ownerInbox: OWNER_INBOX },
  })
  if (result.httpStatus >= 500) console.error(`Webhook: ${event.type} ${event.id} → ${result.outcome}${result.detail ? ` (${result.detail})` : ''}`)
  return NextResponse.json({ received: true, outcome: result.outcome, ...(result.duplicate ? { duplicate: true } : {}) }, { status: result.httpStatus })
}
