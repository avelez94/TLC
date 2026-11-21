// Decides what a Stripe Checkout session may charge, using only records read from the
// database on the server. Nothing the browser sends about price or names is used.

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
