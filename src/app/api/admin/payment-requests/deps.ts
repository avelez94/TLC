// Server-only wiring for the payment helpers in src/lib/payments.ts (admin routes).
// Not a route: only route.ts files are served.
import type Stripe from 'stripe'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getStripe } from '@/lib/stripe'
import { deliverEmail, FROM_TLC, FROM_PLATFORM, OWNER_INBOX } from '@/lib/email'
import { sendAccessEmail } from '@/lib/account-access'
import { audit } from '@/lib/audit'
import { PaymentRequestError, readEnrollMode, type PaymentDeps } from '@/lib/payments'

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function paymentDeps(): PaymentDeps {
  let stripe: Stripe | null = null
  try { stripe = getStripe() } catch { /* not configured: Stripe actions report it */ }
  return {
    db: supabaseAdmin, stripe, deliverEmail, sendAccessEmail, audit,
    enrollMode: () => readEnrollMode(supabaseAdmin),
    emails: { fromTlc: FROM_TLC, fromPlatform: FROM_PLATFORM, ownerInbox: OWNER_INBOX },
  }
}

export const fail = (status: number, error: string, extra: Record<string, unknown> = {}) => NextResponse.json({ ok: false, error, ...extra }, { status })

/** Plain-language error for the admin, without leaking keys or internals. */
export function stripeFailure(e: unknown) {
  if (e instanceof PaymentRequestError) return fail(e.status, e.message)
  const err = e as { type?: string; message?: string; statusCode?: number }
  if (err?.type && String(err.type).startsWith('Stripe')) {
    const msg = err.type === 'StripeConnectionError' ? 'Stripe could not be reached. Try again in a moment.'
      : err.type === 'StripeAuthenticationError' ? 'The server’s Stripe key was refused. Check the Stripe settings in Vercel.'
      : `Stripe refused the request: ${String(err.message ?? 'unknown error').slice(0, 200)}`
    return fail(502, msg)
  }
  console.error('Payment admin error:', e instanceof Error ? e.message : e)
  return fail(500, 'Something went wrong on the server. Refresh the page and check the record before trying again.')
}
