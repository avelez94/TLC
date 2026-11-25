// While online payments are switched off, a LIVE Stripe key must never create or change anything
// in Stripe. Runs against a local build started the way production is configured today:
//   STRIPE_SECRET_KEY=sk_live_placeholder… (fake; never valid), CHECKOUT_ENABLED unset, and
//   STRIPE_API_BASE pointing at the local stripe-mock (so even a bug could not reach Stripe).
//   set -a; . /tmp/tlc-local-stack/env.local; set +a
//   LIVE_SITE_URL=http://localhost:3997 STRIPE_MOCK_LOG=/tmp/tlc-local-stack/stripe-mock.log node --test tests/e2e/payments-off.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServerClient } from '@supabase/ssr'

const SITE = process.env.LIVE_SITE_URL ?? 'http://localhost:3997'
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const MOCK_LOG = process.env.STRIPE_MOCK_LOG ?? '/tmp/tlc-local-stack/stripe-mock.log'
assert.ok(URL_?.startsWith('http://127.0.0.1'), 'local stack only')
const mockRequests = () => { try { return (readFileSync(MOCK_LOG, 'utf8').match(/^Request: /gm) ?? []).length } catch { return 0 } }

async function admin() {
  const jar = new Map()
  const c = createServerClient(URL_, ANON, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: cs => cs.forEach(x => x.value ? jar.set(x.name, x.value) : jar.delete(x.name)) } })
  const { error } = await c.auth.signInWithPassword({ email: 'admin1@example.test', password: 'LocalTest-only-1!' })
  assert.equal(error, null)
  const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ')
  const inquiryId = (await c.from('inquiries').select('id').limit(1).single()).data?.id
  assert.ok(inquiryId, 'a seed inquiry exists')
  call.inquiryId = inquiryId
  return call
  async function call(p, body, method = 'POST') {
    const r = await fetch(SITE + p, { method, redirect: 'manual', headers: { cookie: cookie(), 'content-type': 'application/json', origin: SITE }, body: body ? JSON.stringify(body) : undefined })
    return { status: r.status, body: await r.json().catch(() => ({})) }
  }
}

test('live key + payments off: no invoice, payment link or checkout can be created; offline still works', async () => {
  const call = await admin()
  const before = mockRequests()
  const settings = await call('/api/admin/registrations', null, 'GET')
  assert.equal(settings.status, 200)
  assert.equal(settings.body.stripe_mode, 'live'); assert.equal(settings.body.checkout_enabled, false)
  assert.equal(settings.body.stripe_writes, false, 'the screens are told Stripe actions are off')

  const base = { inquiry_id: call.inquiryId, payer_name: 'TEST Payments-off check', payer_email: 'payments-off@example.test', description: 'TEST seats', amount_cents: 50000, due_date: '2099-01-31' }
  const invoice = await call('/api/admin/payment-requests', { ...base, method: 'invoice' })
  assert.equal(invoice.status, 403, JSON.stringify(invoice.body)); assert.match(invoice.body.error, /switched off/)
  const link = await call('/api/admin/payment-requests', { ...base, method: 'payment_link' })
  assert.equal(link.status, 403)
  const offline = await call('/api/admin/payment-requests', { ...base, method: 'offline', due_date: null })
  assert.equal(offline.status, 200, JSON.stringify(offline.body)); assert.equal(offline.body.request.status, 'open')

  const checkout = await fetch(SITE + '/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json', origin: SITE }, body: JSON.stringify({ email: 'x@example.test', full_name: 'X', program_id: '00000000-0000-0000-0000-000000000000' }) })
  assert.equal(checkout.status, 503, 'public checkout closed')
  assert.equal(mockRequests(), before, 'nothing was sent to the Stripe API')

  // Clean up the offline TEST request (cancel is allowed: it has no Stripe object).
  const v = await call(`/api/admin/payment-requests/${offline.body.request.id}`, { action: 'void' })
  assert.equal(v.status, 200)
})
