import Stripe from 'stripe'
import { assertSafeEnvironment, isProductionDeployment } from './env-guard'

let client: Stripe | null = null

/**
 * Local testing only: STRIPE_API_BASE (e.g. http://127.0.0.1:12111 for stripe-mock) points the
 * client at a mock server. Ignored in production, so a stray variable can never redirect
 * live payment calls.
 */
function localApiOverride(env: Record<string, string | undefined>): { host: string; port: number; protocol: 'http' | 'https' } | null {
  if (isProductionDeployment(env) || !env.STRIPE_API_BASE) return null
  try {
    const u = new URL(env.STRIPE_API_BASE)
    if (u.hostname !== '127.0.0.1' && u.hostname !== 'localhost') return null
    return { host: u.hostname, port: Number(u.port || (u.protocol === 'https:' ? 443 : 80)), protocol: u.protocol === 'https:' ? 'https' : 'http' }
  } catch {
    return null
  }
}

/** Stripe client that refuses to start without a key (no placeholder fallbacks). */
export function getStripe(): Stripe {
  assertSafeEnvironment(process.env)
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured')
  client ??= new Stripe(key, { maxNetworkRetries: 2, ...(localApiOverride(process.env) ?? {}) })
  return client
}

export type StripeMode = 'test' | 'live' | 'unconfigured'

/** Which Stripe account mode the server's key belongs to (never exposes the key itself). */
export function stripeMode(key = process.env.STRIPE_SECRET_KEY): StripeMode {
  if (!key) return 'unconfigured'
  if (/^(sk|rk)_live_/.test(key)) return 'live'
  if (/^(sk|rk)_test_/.test(key)) return 'test'
  return 'unconfigured'
}

/**
 * Whether the admin portal may CREATE or CHANGE anything in Stripe (payment links, invoices,
 * cancelling them). Test-mode keys: always (development). Live keys: only once online payments
 * are switched on (CHECKOUT_ENABLED=true), so nothing can create a real invoice or charge while
 * checkout is disabled. Reading from Stripe (refresh, "check payment") is never blocked.
 */
export function stripeWritesAllowed(env: Record<string, string | undefined> = process.env): boolean {
  const mode = stripeMode(env.STRIPE_SECRET_KEY)
  if (mode === 'test') return true
  return mode === 'live' && env.CHECKOUT_ENABLED === 'true'
}
export const STRIPE_WRITES_OFF_MESSAGE = 'Stripe payment links and invoices are switched off while online payments are disabled. Use an offline payment request, or ask for payments to be switched on first.'
