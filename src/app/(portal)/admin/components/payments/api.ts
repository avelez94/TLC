'use client'

import { useEffect, useState } from 'react'

export interface PaymentSettings {
  stripeMode: 'test' | 'live' | 'unconfigured'; enrollOnPayment: 'review' | 'automatic'; checkoutEnabled: boolean
  /** Whether payment links / invoices may be created in Stripe (false while live payments are switched off). */
  stripeWrites: boolean
}

let cached: PaymentSettings | null = null

/** Server facts the payment screens need (Stripe test/live mode, enroll-on-payment setting). */
export function usePaymentSettings(): PaymentSettings | null {
  const [settings, setSettings] = useState<PaymentSettings | null>(cached)
  useEffect(() => {
    if (cached) return
    let live = true
    fetch('/api/admin/registrations').then(r => (r.ok ? r.json() : null)).then(d => {
      if (!d?.ok || !live) return
      cached = { stripeMode: d.stripe_mode, enrollOnPayment: d.enroll_on_payment, checkoutEnabled: !!d.checkout_enabled, stripeWrites: d.stripe_writes === true }
      setSettings(cached)
    }).catch(() => {})
    return () => { live = false }
  }, [])
  return settings
}

export interface AdminResult<T = unknown> { ok: boolean; message: string; data?: T }

/** POST to an admin payment route; never throws, always returns a message to show. */
export async function postAdmin<T = Record<string, unknown>>(url: string, body: Record<string, unknown>): Promise<AdminResult<T>> {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data.ok === false) return { ok: false, message: data.error || 'The change was not saved (server error).', data }
    return { ok: true, message: data.message || 'Saved.', data }
  } catch {
    return { ok: false, message: 'The server could not be reached. Refresh the page and check the record before trying again.' }
  }
}
