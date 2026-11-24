// Admin actions on one payment request:
//   send       create the Stripe side of a draft (payment link / invoice) and open it
//   refresh    read the current state from Stripe and record it (changes nothing in Stripe)
//   mark_paid  offline requests only: record a payment that arrived outside Stripe, with a note
//   void       cancel an unpaid request (voids the invoice / switches the link off in Stripe)
// Refunds are never made here: refund in Stripe and the refund is recorded by the webhook.
import { NextResponse } from 'next/server'
import { requireAdmin, supabaseAdmin } from '@/lib/supabase-server'
import { cleanText } from '@/lib/security'
import { todayET } from '@/lib/business-time'
import { audit } from '@/lib/audit'
import { refreshPaymentRequest, sendPaymentRequest, voidPaymentRequest, type PaymentRequestRecord } from '@/lib/payments'
import { fail, paymentDeps, stripeFailure, UUID_RE } from '../deps'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) return fail(401, 'Unauthorized')
  const { id } = await params
  if (!UUID_RE.test(id)) return fail(400, 'Invalid request')
  let body: Record<string, unknown>
  try { body = await request.json() } catch { return fail(400, 'Invalid request') }

  const { data: row } = await supabaseAdmin.from('payment_requests').select('*').eq('id', id).maybeSingle()
  if (!row) return fail(404, 'That payment request no longer exists.')
  const pr = row as PaymentRequestRecord & { notes: string | null }
  const label = `${pr.payer_name} — ${pr.description}`
  const deps = paymentDeps()

  try {
    switch (body.action) {
      case 'send': {
        const sent = await sendPaymentRequest(deps, pr)
        await audit(admin.id, 'payment_request.send', 'payment_request', id, { method: pr.method, stripe_object_id: sent.stripe_object_id }, { label })
        return NextResponse.json({ ok: true, request: sent, message: pr.method === 'invoice' ? `Stripe has emailed the invoice to ${pr.payer_email}.` : pr.method === 'payment_link' ? 'The payment link is ready to copy and send.' : 'Opened.' })
      }
      case 'refresh': {
        const { record, summary } = await refreshPaymentRequest(deps, pr)
        if (record.status !== pr.status) await audit(admin.id, 'payment_request.refresh', 'payment_request', id, { from: pr.status, to: record.status }, { label })
        return NextResponse.json({ ok: true, request: record, message: summary })
      }
      case 'void': {
        const done = await voidPaymentRequest(deps, pr)
        await audit(admin.id, 'payment_request.void', 'payment_request', id, { method: pr.method }, { label })
        return NextResponse.json({ ok: true, request: done, message: pr.method === 'invoice' && pr.stripe_object_id ? 'Cancelled. The invoice is void in Stripe.' : pr.method === 'payment_link' && pr.stripe_object_id ? 'Cancelled. The payment link no longer accepts payments.' : 'Cancelled.' })
      }
      case 'mark_paid': {
        if (pr.method !== 'offline') return fail(409, 'Only offline requests are marked paid here. For Stripe payments press Refresh; if they paid another way, record it in Stripe first (Invoice → Mark as paid).')
        if (!['open', 'partially_paid', 'failed'].includes(pr.status)) return fail(409, `This request is ${pr.status}; it cannot be marked paid.`)
        const note = cleanText(body.note, 500)
        if (!note) return fail(400, 'Add a note saying how it was paid (for example “Check #1042”).')
        const remaining = Math.max(0, pr.amount_cents - pr.amount_paid_cents)
        const amount = body.amount_cents == null ? remaining : body.amount_cents
        if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 1 || amount > pr.amount_cents * 2) return fail(400, 'Enter the amount received.')
        const paidOn = typeof body.paid_on === 'string' && DATE_RE.test(body.paid_on) ? body.paid_on : todayET()
        if (paidOn > todayET()) return fail(400, 'The payment date cannot be in the future.')
        const total = pr.amount_paid_cents + amount
        const status = total >= pr.amount_cents ? 'paid' : 'partially_paid'
        const stamp = `[${paidOn}] Marked paid ${(amount / 100).toFixed(2)} by an administrator: ${note}`
        const { data, error } = await supabaseAdmin.from('payment_requests').update({
          status, amount_paid_cents: total, paid_at: new Date(`${paidOn}T12:00:00-05:00`).toISOString(), updated_at: new Date().toISOString(),
          notes: (pr.notes ? `${pr.notes}\n${stamp}` : stamp).slice(-2000),
        }).eq('id', id).eq('status', pr.status).select('*').single()
        if (error || !data) return fail(409, 'The request changed while you were editing it. Refresh the page and try again.')
        await audit(admin.id, 'payment_request.mark_paid', 'payment_request', id, { amount_cents: amount, paid_on: paidOn, status }, { label })
        return NextResponse.json({ ok: true, request: data, message: status === 'paid' ? 'Recorded as paid.' : `Recorded ${(amount / 100).toFixed(2)}; ${((pr.amount_cents - total) / 100).toFixed(2)} is still outstanding.` })
      }
      default:
        return fail(400, 'Unknown action.')
    }
  } catch (e) {
    await audit(admin.id, `payment_request.${String(body.action).slice(0, 20)}`, 'payment_request', id, {}, { label, outcome: 'failed' })
    return stripeFailure(e)
  }
}
