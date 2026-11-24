// Decides what a Stripe Checkout session may charge, using only records read from the
// database on the server. Nothing the browser sends about price or names is used.
import type Stripe from 'stripe'

export interface PricingProgram {
  id: string
  name: string
  type: string | null
  price: number | null // whole US dollars (programs.price is an integer column)
  price_label?: string | null // what the public page displays, e.g. "$97"
}

export interface PricingCohort {
  id: string
  program_id: string | null
  name: string
  status: string | null
}

export type PricingResult =
  | { ok: true; amountCents: number; productName: string; description: string }
  | { ok: false; status: number; error: string }

/** Cohorts the public register page offers for sign-up. */
export const REGISTRABLE_COHORT_STATUSES = ['upcoming'] as const

/** Upper bound as a guard against a mistyped price (e.g. 9700 instead of 97). */
export const MAX_PROGRAM_PRICE_DOLLARS = 10000

export function resolveCheckoutPrice(program: PricingProgram | null, cohort: PricingCohort | null): PricingResult {
  if (!program || !cohort) {
    return { ok: false, status: 404, error: 'That program or cohort is no longer available.' }
  }
  if (program.type !== 'cohort') {
    return { ok: false, status: 400, error: 'This program is not available for online registration.' }
  }
  if (cohort.program_id !== program.id) {
    return { ok: false, status: 400, error: 'That cohort does not belong to the selected program.' }
  }
  if (!REGISTRABLE_COHORT_STATUSES.includes((cohort.status ?? '') as (typeof REGISTRABLE_COHORT_STATUSES)[number])) {
    return { ok: false, status: 409, error: 'Registration for this cohort is closed.' }
  }
  const price = program.price
  if (typeof price !== 'number' || !Number.isInteger(price) || price <= 0 || price > MAX_PROGRAM_PRICE_DOLLARS) {
    return { ok: false, status: 400, error: 'Online payment is not available for this program. Please contact us to register.' }
  }
  // Never charge an amount different from the one the page shows. (Found 2026-11-21: two
  // programs were configured to charge $149/$197 while displaying "$97".)
  const displayed = displayedDollars(program.price_label)
  if (displayed !== null && displayed !== price) {
    return { ok: false, status: 409, error: 'Online payment for this program is temporarily unavailable. Please contact us to register.' }
  }
  return { ok: true, amountCents: price * 100, productName: program.name, description: cohort.name }
}

/** Dollar amount in a label like "$97" or "$1,250 per person"; null if the label has none. */
export function displayedDollars(label: string | null | undefined): number | null {
  const match = label?.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/)
  if (!match) return null
  const value = Number(match[1].replace(/,/g, ''))
  return Number.isFinite(value) ? value : null
}

// ------------------------------------------------------------------ seats during checkout
/**
 * How long a Checkout Session stays open. Stripe's minimum is 30 minutes after creation; one
 * extra minute keeps a slightly fast server clock from being rejected.
 */
export const CHECKOUT_WINDOW_SECONDS = 31 * 60

export interface SeatRegistration {
  id: string
  status: string | null
  payment_status: string | null
  checkout_expires_at?: string | null
}

/**
 * Registrations that hold a seat without (yet) having an enrollment:
 *  - an open checkout that has not expired (someone is paying right now), and
 *  - paid, complimentary or bank-processing registrations waiting for the owner to confirm
 *    (in "review" mode a payment does not enroll anyone until the owner confirms).
 * Confirmed registrations are not counted here: their seat is the enrollment itself.
 */
export function registrationHoldsSeat(r: SeatRegistration, now: Date): boolean {
  if (r.status === 'confirmed' || r.status === 'declined') return false
  const ps = r.payment_status ?? 'unpaid'
  if (ps === 'unpaid') return !!r.checkout_expires_at && new Date(r.checkout_expires_at).getTime() > now.getTime()
  return ps === 'paid' || ps === 'complimentary' || ps === 'pending' || ps === 'partially_refunded'
}

export interface SeatCheck { full: boolean; enrolled: number; held: number; capacity: number | null }

/** Whether one more person may start paying for this cohort. */
export function checkoutSeatCheck(input: {
  capacity: number | null | undefined; activeEnrollments: number; registrations: SeatRegistration[]; now: Date; excludeRegistrationId?: string | null
}): SeatCheck {
  const held = input.registrations.filter(r => r.id !== input.excludeRegistrationId && registrationHoldsSeat(r, input.now)).length
  const capacity = input.capacity ?? null
  return { full: capacity != null && input.activeEnrollments + held >= capacity, enrolled: input.activeEnrollments, held, capacity }
}

/** The Checkout Session for one registration. Amount and names come from resolveCheckoutPrice. */
export function checkoutSessionParams(i: {
  registrationId: string; cohortId: string; email: string; siteUrl: string; expiresAt: number
  pricing: { amountCents: number; productName: string; description: string }
}): Stripe.Checkout.SessionCreateParams {
  return {
    mode: 'payment',
    payment_method_types: ['card'],
    allow_promotion_codes: true,
    line_items: [{
      price_data: { currency: 'usd', product_data: { name: i.pricing.productName, description: i.pricing.description }, unit_amount: i.pricing.amountCents },
      quantity: 1,
    }],
    customer_email: i.email,
    client_reference_id: i.registrationId,
    expires_at: i.expiresAt,
    // Stripe emails the receipt (live mode); our confirmation email is not a receipt.
    payment_intent_data: { receipt_email: i.email, metadata: { registration_id: i.registrationId }, description: `${i.pricing.productName} — ${i.pricing.description}`.slice(0, 500) },
    success_url: `${i.siteUrl}/register/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${i.siteUrl}/register/cancelled`,
    // Set only here, on the server; the webhook trusts it because the event is signed.
    metadata: { registration_id: i.registrationId, expected_amount_cents: String(i.pricing.amountCents), cohort_id: i.cohortId },
  }
}
