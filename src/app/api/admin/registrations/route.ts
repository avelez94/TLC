// Admin: payment settings the registration screens need (no secrets): whether the server's
// Stripe key is a test or live key (for dashboard links), the owner's enroll-on-payment
// setting, and whether online checkout is switched on.
import { NextResponse } from 'next/server'
import { createServerSupabaseClient, requireAdmin } from '@/lib/supabase-server'
import { stripeMode, stripeWritesAllowed } from '@/lib/stripe'
import { checkoutEnabled } from '@/lib/pathways'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  let enroll: 'review' | 'automatic' = 'review'
  try {
    const supabase = await createServerSupabaseClient()
    const { data } = await supabase.rpc('enroll_on_payment_mode')
    if (data === 'automatic') enroll = 'automatic'
  } catch { /* before migration 2e: review */ }
  return NextResponse.json({ ok: true, stripe_mode: stripeMode(), stripe_writes: stripeWritesAllowed(), enroll_on_payment: enroll, checkout_enabled: checkoutEnabled() })
}
