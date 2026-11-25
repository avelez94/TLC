// Admin: create a payment request (mainly for organizations), for one inquiry.
//   payment_link → Stripe Product + Price + Payment Link (single use); share the link yourself
//   invoice      → Stripe Customer + Invoice, finalized and emailed to the payer by Stripe
//   offline      → no Stripe; mark it paid by hand when the check / transfer arrives
// The amount is typed by the administrator (cents); nothing is priced automatically.
// The record is saved as a draft first, so a Stripe failure never loses it (press Send again).
import { NextResponse } from 'next/server'
import { requireAdmin, supabaseAdmin } from '@/lib/supabase-server'
import { cleanLine, cleanText, isValidEmail } from '@/lib/security'
import { todayET } from '@/lib/business-time'
import { sendPaymentRequest, type PaymentRequestRecord } from '@/lib/payments'
import { audit } from '@/lib/audit'
import { fail, paymentDeps, stripeFailure, UUID_RE } from './deps'
import { STRIPE_WRITES_OFF_MESSAGE, stripeWritesAllowed } from '@/lib/stripe'

const METHODS = new Set(['payment_link', 'invoice', 'offline'])
const MAX_REQUEST_CENTS = 10_000_000 // $100,000 guard against a mistyped amount
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return fail(401, 'Unauthorized')
  let body: Record<string, unknown>
  try { body = await request.json() } catch { return fail(400, 'Invalid request') }

  const uuid = (v: unknown) => (typeof v === 'string' && UUID_RE.test(v) ? v : null)
  const inquiry_id = uuid(body.inquiry_id)
  const registration_id = uuid(body.registration_id)
  const cohort_id = uuid(body.cohort_id)
  const method = typeof body.method === 'string' && METHODS.has(body.method) ? body.method as PaymentRequestRecord['method'] : null
  const payer_name = cleanLine(body.payer_name, 160)
  const payer_email = cleanLine(body.payer_email, 254).toLowerCase() || null
  const description = cleanLine(body.description, 300)
  const notes = cleanText(body.notes, 2000) || null
  const amount_cents = body.amount_cents
  const seats = body.seats == null || body.seats === '' ? null : body.seats
  const due_date = typeof body.due_date === 'string' && body.due_date ? body.due_date : null

  if (!inquiry_id && !registration_id) return fail(400, 'A payment request must belong to an inquiry or a registration.')
  if (!method) return fail(400, 'Choose how they will pay: payment link, Stripe invoice, or offline.')
  if (!payer_name) return fail(400, 'Enter who is paying (person or organization).')
  if (!description) return fail(400, 'Enter what the payment is for.')
  if (payer_email && !isValidEmail(payer_email)) return fail(400, 'Enter a valid email address for the payer.')
  if (typeof amount_cents !== 'number' || !Number.isInteger(amount_cents) || amount_cents < 100 || amount_cents > MAX_REQUEST_CENTS) {
    return fail(400, `Enter an amount between $1.00 and $${(MAX_REQUEST_CENTS / 100).toLocaleString('en-US')}.`)
  }
  if (seats !== null && (typeof seats !== 'number' || !Number.isInteger(seats) || seats < 1 || seats > 500)) return fail(400, 'Seats must be a whole number between 1 and 500.')
  if (due_date && (!DATE_RE.test(due_date) || Number.isNaN(Date.parse(due_date)))) return fail(400, 'Enter the due date as a date.')
  if (due_date && due_date < todayET()) return fail(400, 'The due date is in the past.')
  if (method !== 'offline' && !stripeWritesAllowed()) return fail(403, STRIPE_WRITES_OFF_MESSAGE)
  if (method === 'invoice' && !payer_email) return fail(400, 'A Stripe invoice is emailed to the payer, so their email address is needed.')
  if (method === 'invoice' && !due_date) return fail(400, 'Choose a due date for the invoice.')

  const checks = await Promise.all([
    inquiry_id ? supabaseAdmin.from('inquiries').select('id').eq('id', inquiry_id).maybeSingle() : Promise.resolve({ data: true }),
    registration_id ? supabaseAdmin.from('registrations').select('id').eq('id', registration_id).maybeSingle() : Promise.resolve({ data: true }),
    cohort_id ? supabaseAdmin.from('cohorts').select('id').eq('id', cohort_id).maybeSingle() : Promise.resolve({ data: true }),
  ])
  if (!checks[0].data) return fail(404, 'That inquiry no longer exists.')
  if (!checks[1].data) return fail(404, 'That registration no longer exists.')
  if (!checks[2].data) return fail(404, 'That cohort no longer exists.')

  const { data: draft, error } = await supabaseAdmin.from('payment_requests').insert({
    inquiry_id, registration_id, cohort_id, payer_name, payer_email, description, method, seats, amount_cents, currency: 'usd',
    status: 'draft', due_date, notes, created_by: admin.id,
  }).select('*').single()
  if (error || !draft) return fail(500, `The payment request could not be saved: ${error?.message ?? 'unknown error'}.`)
  const label = `${payer_name} — ${description}`
  await audit(admin.id, 'payment_request.create', 'payment_request', draft.id, { method, amount_cents, seats }, { label })

  if (body.send === false) return NextResponse.json({ ok: true, request: draft, message: 'Saved as a draft. Press Send when you are ready.' })
  try {
    const sent = await sendPaymentRequest(paymentDeps(), draft as PaymentRequestRecord)
    await audit(admin.id, 'payment_request.send', 'payment_request', sent.id, { method, stripe_object_id: sent.stripe_object_id }, { label })
    const message = method === 'invoice' ? `Stripe has emailed the invoice to ${payer_email}.`
      : method === 'payment_link' ? 'The payment link is ready. Copy it and send it to the payer; nothing was emailed.'
      : 'Recorded as an offline payment. Mark it paid when the payment arrives.'
    return NextResponse.json({ ok: true, request: sent, message })
  } catch (e) {
    await audit(admin.id, 'payment_request.send', 'payment_request', draft.id, { method }, { label, outcome: 'failed' })
    const res = stripeFailure(e)
    const data = await res.json()
    return NextResponse.json({ ...data, request: draft, error: `${data.error} The request was saved as “Not sent”; press Send to try again.` }, { status: res.status })
  }
}
