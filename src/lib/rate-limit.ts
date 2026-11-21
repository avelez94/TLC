import { supabaseAdmin } from './supabase-server'
import { createRateLimiter, type RateLimiter } from './security'

const fallbacks = new Map<string, RateLimiter>()

/**
 * Rate limit shared by every server instance, stored in Postgres
 * (public.rate_limit_hit, service role only). If the database call fails, falls back to a
 * per-instance in-memory limiter so the form keeps working with weaker protection.
 */
export async function rateLimit(scope: string, key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc('rate_limit_hit', {
    p_key: `${scope}:${key}`,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  })
  if (!error && typeof data === 'boolean') return data

  console.warn(`[rate-limit] durable limiter unavailable (${error?.code ?? 'no data'}); using in-memory fallback`)
  let limiter = fallbacks.get(scope)
  if (!limiter) {
    limiter = createRateLimiter({ limit, windowMs: windowSeconds * 1000 })
    fallbacks.set(scope, limiter)
  }
  return limiter.hit(key)
}
