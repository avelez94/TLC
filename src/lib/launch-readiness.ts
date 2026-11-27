// Checkout readiness gate. Online payment for a cohort is possible only when EVERY condition
// holds, evaluated on the server at the moment of each request:
//   1. Stripe is verified: account able to take payments, TLC webhook subscribed to every event
//      this site needs, and a signed test event delivered and processed (launch_checks.stripe).
//   2. The Privacy Policy, Terms & Conditions and Refund & Cancellation Policy are all published.
//   3. The cohort is Upcoming, starts in the future and its essential setup is complete.
//   4. Its pathway is public and open for enrollment.
//   5. The price is a valid whole-dollar amount and matches the price shown.
//   6. Security configuration is complete (live key in production, webhook secret, site URL).
//   7. The site owner has approved live payments (CHECKOUT_ENABLED=true in Vercel).
// The evaluation is a pure function (tested); loadLaunchReadiness gathers the inputs.
import { POLICY_META, POLICY_SLUGS, type PolicySlug } from './policies'
import { displayedDollars, MAX_PROGRAM_PRICE_DOLLARS } from './checkout-pricing'

export interface Check { key: string; label: string; ok: boolean; detail: string; fix?: { href: string; label: string } }

export interface ReadinessInputs {
  env: { checkoutEnabled: boolean; stripeMode: 'live' | 'test' | 'unconfigured'; production: boolean; webhookSecret: boolean; siteUrl: string }
  stripeCheck: StripeCheck | null
  policies: Partial<Record<PolicySlug, { version_id: string; version_number: number; published_at: string | null }>>
  pathways: { id: string; slug: string | null; name: string; type: string | null; price: number | null; price_label: string | null; is_public: boolean | null; enrollment_open: boolean | null }[]
  cohorts: { id: string; program_id: string | null; name: string; status: string | null; start_date: string | null; end_date: string | null; capacity: number | null; zoom_link: string | null }[]
  datedSessions: Record<string, number> // cohort id → sessions with a date
  today: string // YYYY-MM-DD (Eastern)
}

export interface StripeCheck {
  verified: boolean; verified_at: string | null; livemode: boolean | null; account_id: string | null; account_ok: boolean
  events_complete: boolean; missing_events: string[]; endpoint_url: string | null; last_error?: string | null
}

export interface CohortGate { id: string; name: string; programId: string | null; status: string | null; startDate: string | null; configured: boolean; problems: Check[]; open: boolean; reasons: string[] }
export interface PathwayGate { id: string; slug: string | null; name: string; isPublic: boolean; enrollmentOpen: boolean; priceOk: boolean; priceLabel: string | null; checks: Check[]; cohorts: CohortGate[]; open: boolean }
export interface LaunchReadiness {
  global: Check[]
  policies: { slug: PolicySlug; name: string; published: boolean; versionId: string | null; version: number | null; publishedAt: string | null }[]
  pathways: PathwayGate[]
  open: boolean
  openCohortIds: string[]
  /** Reasons that block every cohort (empty when the site-wide conditions are met). */
  blockers: string[]
  /** Technical side: Stripe connected and verified, payment security set, owner switched live payments on. */
  stripePayments: { enabled: boolean; missing: string[] }
  /** What visitors can do: pay for at least one cohort right now. */
  registration: { available: boolean; waitingFor: string[] }
}

export function priceProblem(p: { type: string | null; price: number | null; price_label: string | null }): string | null {
  if (p.type !== 'cohort') return 'This program is not a cohort program.'
  if (typeof p.price !== 'number' || !Number.isInteger(p.price) || p.price <= 0 || p.price > MAX_PROGRAM_PRICE_DOLLARS) return 'Set a whole-dollar price.'
  const shown = displayedDollars(p.price_label)
  if (shown === null) return 'Set the price shown to visitors (e.g. "$149").'
  if (shown !== p.price) return `The price shown (${p.price_label}) does not match the price charged ($${p.price}).`
  return null
}

export function evaluateLaunchReadiness(i: ReadinessInputs): LaunchReadiness {
  const sc = i.stripeCheck
  const keyOk = i.env.production ? i.env.stripeMode === 'live' : i.env.stripeMode !== 'unconfigured'
  const stripeVerified = !!sc && sc.verified && sc.account_ok && sc.events_complete && sc.livemode === (i.env.stripeMode === 'live')
  const siteOk = /^https:\/\//.test(i.env.siteUrl) || (!i.env.production && /^http:\/\/(localhost|127\.0\.0\.1)/.test(i.env.siteUrl))

  const policies = POLICY_SLUGS.map(slug => {
    const p = i.policies[slug]
    return { slug, name: POLICY_META[slug].name, published: !!p, versionId: p?.version_id ?? null, version: p?.version_number ?? null, publishedAt: p?.published_at ?? null }
  })

  const global: Check[] = [
    {
      key: 'stripe_key', label: 'Stripe connection', ok: i.env.stripeMode !== 'unconfigured' && keyOk,
      detail: i.env.stripeMode === 'unconfigured' ? 'No Stripe key is configured.' : keyOk ? `Connected (${i.env.stripeMode} mode).` : 'Production must use the live Stripe key.',
    },
    {
      key: 'stripe_verified', label: 'Stripe webhook verification', ok: stripeVerified,
      detail: stripeVerified ? 'Account, webhook events and signing secret verified.'
        : !sc ? 'Not verified yet. Run the Stripe check.'
          : !sc.account_ok ? 'The Stripe account cannot take payments yet.'
            : !sc.events_complete ? `The TLC webhook is missing ${sc.missing_events.length} required event(s).`
              : sc.livemode !== (i.env.stripeMode === 'live') ? 'The verification was done in a different Stripe mode. Run the check again.'
                : 'The signed test event has not been confirmed. Run the Stripe check.',
      fix: { href: '/admin/launch#stripe', label: 'Run the Stripe check' },
    },
    { key: 'security', label: 'Payment security settings', ok: i.env.webhookSecret && siteOk, detail: !i.env.webhookSecret ? 'The webhook signing secret is not configured.' : !siteOk ? 'The site address is not configured for secure payments.' : 'Webhook secret and secure site address are set.' },
    ...policies.map(p => ({
      key: `policy_${p.slug}`, label: p.name, ok: p.published,
      detail: p.published ? `Published (version ${p.version}).` : 'Not published. Checkout stays closed until it is.',
      fix: { href: `/admin/policies?policy=${p.slug}`, label: p.published ? 'Review' : 'Write and publish' },
    })),
    {
      key: 'owner_approval', label: 'Live payments switched on (site owner)', ok: i.env.checkoutEnabled,
      detail: i.env.checkoutEnabled ? 'Switched on. Paid registration opens by itself for each cohort that meets every condition.' : 'Not switched on yet. The site owner switches live payments on once; after that, cohorts open automatically when everything else is ready.',
    },
  ]
  const globalOk = global.every(c => c.ok)

  const pathways: PathwayGate[] = i.pathways.map(p => {
    const pp = priceProblem(p)
    const checks: Check[] = [
      { key: 'public', label: 'Shown on the Impact Lab page', ok: p.is_public !== false, detail: p.is_public !== false ? 'Public.' : 'Hidden from the public page.', fix: { href: '/admin/programs', label: 'Open Pathways' } },
      { key: 'enrollment', label: 'Open for enrollment', ok: p.enrollment_open === true, detail: p.enrollment_open ? 'Open.' : 'Closed.', fix: { href: '/admin/programs', label: 'Open Pathways' } },
      { key: 'price', label: 'Price', ok: !pp, detail: pp ?? `${p.price_label} charged and shown.`, fix: { href: '/admin/programs', label: 'Open Pathways' } },
    ]
    const pathwayOk = checks.every(c => c.ok)
    const cohorts: CohortGate[] = i.cohorts.filter(c => c.program_id === p.id).map(c => {
      const sessions = i.datedSessions[c.id] ?? 0
      const fix = (section: string) => ({ href: `/admin/cohorts?cohort=${c.id}&section=${section}`, label: 'Fix in Cohorts' })
      const problems: Check[] = [
        { key: 'status', label: 'Status is Upcoming', ok: c.status === 'upcoming', detail: c.status === 'upcoming' ? 'Upcoming.' : `Status is ${c.status ?? 'not set'}; set it to Upcoming when the cohort is ready.`, fix: fix('details') },
        { key: 'dates', label: 'Start and end dates', ok: !!c.start_date && !!c.end_date && c.end_date >= c.start_date, detail: c.start_date && c.end_date ? `${c.start_date} to ${c.end_date}.` : 'Set the start and end dates.', fix: fix('details') },
        { key: 'future', label: 'Starts in the future', ok: !!c.start_date && c.start_date > i.today, detail: c.start_date && c.start_date > i.today ? 'Yes.' : 'Registration closes once a cohort has started.', fix: fix('details') },
        { key: 'capacity', label: 'Seat limit', ok: c.capacity != null && c.capacity > 0, detail: c.capacity != null ? `${c.capacity} seats.` : 'Set a seat limit.', fix: fix('details') },
        { key: 'schedule', label: 'Session schedule', ok: sessions > 0, detail: sessions > 0 ? `${sessions} dated session(s).` : 'Generate the session schedule.', fix: fix('schedule') },
        { key: 'meeting', label: 'Meeting link', ok: !!c.zoom_link?.trim(), detail: c.zoom_link?.trim() ? 'Set.' : 'Add the meeting link.', fix: fix('details') },
      ]
      const configured = problems.every(x => x.ok)
      const reasons = [
        ...global.filter(g => !g.ok).map(g => g.label),
        ...checks.filter(x => !x.ok).map(x => `${p.name}: ${x.label.toLowerCase()}`),
        ...problems.filter(x => !x.ok).map(x => `${c.name}: ${x.label.toLowerCase()}`),
      ]
      return { id: c.id, name: c.name, programId: c.program_id, status: c.status, startDate: c.start_date, configured, problems, open: globalOk && pathwayOk && configured, reasons }
    })
    return { id: p.id, slug: p.slug, name: p.name, isPublic: p.is_public !== false, enrollmentOpen: p.enrollment_open === true, priceOk: !pp, priceLabel: p.price_label, checks, cohorts, open: cohorts.some(c => c.open) }
  })

  const openCohortIds = pathways.flatMap(p => p.cohorts.filter(c => c.open).map(c => c.id))
  const technical = ['stripe_key', 'stripe_verified', 'security', 'owner_approval']
  const stripeMissing = global.filter(g => technical.includes(g.key) && !g.ok).map(g => g.label)
  const eligibleCohort = pathways.some(p => p.checks.every(c => c.ok) && p.cohorts.some(c => c.configured))
  const waitingFor = [
    ...(stripeMissing.length ? ['Stripe payments enabled'] : []),
    ...policies.filter(p => !p.published).map(p => `${p.name} published`),
    ...(eligibleCohort ? [] : ['An Upcoming cohort that is fully set up, on a pathway that is open for enrollment with its price']),
  ]
  return {
    global, policies, pathways, open: openCohortIds.length > 0, openCohortIds, blockers: global.filter(g => !g.ok).map(g => g.label),
    stripePayments: { enabled: stripeMissing.length === 0, missing: stripeMissing },
    registration: { available: openCohortIds.length > 0, waitingFor: openCohortIds.length > 0 ? [] : waitingFor },
  }
}

/** Words a visitor sees when checkout is refused (never internal detail). */
export function publicClosedMessage(r: LaunchReadiness, cohortId?: string): string {
  if (r.policies.some(p => !p.published)) return 'Online registration will open once our updated policies are published. Please contact us and we will help you enroll.'
  const cohort = r.pathways.flatMap(p => p.cohorts).find(c => c.id === cohortId)
  if (cohortId && !cohort) return 'Registration for this cohort is closed.'
  return 'Online registration for this cohort is not open right now. Please contact us and we will help you enroll.'
}
