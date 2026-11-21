import Stripe from 'stripe'
import { assertSafeEnvironment } from './env-guard'

let client: Stripe | null = null

/** Stripe client that refuses to start without a key (no placeholder fallbacks). */
export function getStripe(): Stripe {
  assertSafeEnvironment(process.env)
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured')
  client ??= new Stripe(key)
  return client
}
