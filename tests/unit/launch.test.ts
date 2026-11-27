import { test } from 'node:test'
import assert from 'node:assert/strict'
import type Stripe from 'stripe'
import { evaluateLaunchReadiness, publicClosedMessage, priceProblem, type ReadinessInputs } from '../../src/lib/launch-readiness'
import { cleanPolicyContent, publishProblems, safePolicyHref, stableJson, POLICY_SLUGS, type PolicyContent } from '../../src/lib/policies'
import { belongsToTlc, processStripeEvent, type PaymentDeps } from '../../src/lib/payments'
import { checkoutSessionParams, TLC_STRIPE_APP } from '../../src/lib/checkout-pricing'

// ------------------------------------------------------------------ launch gate
const published = { version_id: '11111111-1111-4111-8111-111111111111', version_number: 1, published_at: '2026-11-28T15:00:00Z' }
const PATHWAY = { id: 'p-new', slug: 'new-leaders', name: 'New Leaders', type: 'cohort', price: 149, price_label: '$149', is_public: true, enrollment_open: true }
const COHORT = { id: 'c-spring', program_id: 'p-new', name: 'New Leaders - Spring 2027', status: 'upcoming', start_date: '2027-02-02', end_date: '2027-03-16', capacity: 12, zoom_link: 'https://zoom.us/j/1' }
const ready = (): ReadinessInputs => ({
  env: { checkoutEnabled: true, stripeMode: 'live', production: true, webhookSecret: true, siteUrl: 'https://tramainecrawford.com' },
  stripeCheck: { verified: true, verified_at: '2026-11-28T15:00:00Z', livemode: true, account_id: 'acct_1', account_ok: true, events_complete: true, missing_events: [], endpoint_url: 'https://tramainecrawford.com/api/webhook' },
  policies: { privacy: published, terms: { ...published, version_id: '22222222-2222-4222-8222-222222222222' }, refund: { ...published, version_id: '33333333-3333-4333-8333-333333333333' } },
  pathways: [PATHWAY], cohorts: [COHORT], datedSessions: { 'c-spring': 6 }, today: '2026-11-28',
})
const open = (i: ReadinessInputs) => evaluateLaunchReadiness(i).openCohortIds.includes('c-spring')

test('gate: every condition met → the cohort can take payments', () => {
  const r = evaluateLaunchReadiness(ready())
  assert.equal(r.open, true)
  assert.deepEqual(r.openCohortIds, ['c-spring'])
  assert.deepEqual(r.blockers, [])
})

test('gate: each missing condition alone blocks payment, with a reason', () => {
  const cases: [string, (i: ReadinessInputs) => void][] = [
    ['owner has not approved live payments', i => { i.env.checkoutEnabled = false }],
    ['Stripe not verified', i => { i.stripeCheck = null }],
    ['webhook events incomplete', i => { i.stripeCheck = { ...i.stripeCheck!, events_complete: false, missing_events: ['charge.refunded'] } }],
    ['account cannot take payments', i => { i.stripeCheck = { ...i.stripeCheck!, account_ok: false } }],
    ['verified in test mode, now live', i => { i.stripeCheck = { ...i.stripeCheck!, livemode: false } }],
    ['production with a test key', i => { i.env.stripeMode = 'test' }],
    ['no webhook secret', i => { i.env.webhookSecret = false }],
    ['insecure site URL', i => { i.env.siteUrl = 'http://tramainecrawford.com' }],
    ...POLICY_SLUGS.map(s => [`${s} policy unpublished`, (i: ReadinessInputs) => { delete i.policies[s] }] as [string, (i: ReadinessInputs) => void]),
    ['pathway closed for enrollment', i => { i.pathways = [{ ...PATHWAY, enrollment_open: false }] }],
    ['pathway hidden', i => { i.pathways = [{ ...PATHWAY, is_public: false }] }],
    ['price shown differs from price charged', i => { i.pathways = [{ ...PATHWAY, price_label: '$97' }] }],
    ['no price', i => { i.pathways = [{ ...PATHWAY, price: null }] }],
    ['cohort still a draft', i => { i.cohorts = [{ ...COHORT, status: 'draft' }] }],
    ['cohort already started', i => { i.today = '2027-02-02' }],
    ['no seat limit', i => { i.cohorts = [{ ...COHORT, capacity: null }] }],
    ['no schedule', i => { i.datedSessions = {} }],
    ['no meeting link', i => { i.cohorts = [{ ...COHORT, zoom_link: ' ' }] }],
    ['no dates', i => { i.cohorts = [{ ...COHORT, start_date: null }] }],
  ]
  for (const [name, change] of cases) {
    const i = ready(); change(i)
    const r = evaluateLaunchReadiness(i)
    assert.equal(open(i), false, name)
    assert.equal(r.open, false, name)
    const cohort = r.pathways[0]?.cohorts[0]
    assert.ok(!cohort || cohort.reasons.length > 0, `${name}: has a reason`)
  }
})

test('gate: blank or unpublished policies never open payments; the visitor message says why', () => {
  const i = ready(); i.policies = {}
  const r = evaluateLaunchReadiness(i)
  assert.equal(r.open, false)
  assert.ok(r.blockers.includes('Privacy Policy') && r.blockers.includes('Terms & Conditions') && r.blockers.includes('Refund & Cancellation Policy'))
  assert.match(publicClosedMessage(r, 'c-spring'), /policies are published/)
  assert.match(publicClosedMessage(evaluateLaunchReadiness(ready()), 'c-unknown'), /closed/)
})

test('price rule: whole dollars, and the shown price must equal the charged price', () => {
  assert.equal(priceProblem({ type: 'cohort', price: 149, price_label: '$149' }), null)
  assert.ok(priceProblem({ type: 'cohort', price: 149, price_label: '$97' }))
  assert.ok(priceProblem({ type: 'cohort', price: 149.5, price_label: '$149.50' }))
  assert.ok(priceProblem({ type: 'coaching', price: 149, price_label: '$149' }))
  assert.ok(priceProblem({ type: 'cohort', price: 149, price_label: null }))
})

// ------------------------------------------------------------------ policies
const real: PolicyContent = {
  title: 'Refund & Cancellation Policy',
  intro: [{ type: 'p', c: [{ t: 'This policy explains how cancellations and refunds work for The Impact Lab cohorts.' }] }],
  sections: [
    { id: 'cancel', heading: 'Cancelling your registration', body: [{ type: 'p', c: [{ t: 'Participants may cancel their registration by emailing us before the first session of the cohort.' }] }] },
    { id: 'refunds', heading: 'Refunds', body: [{ type: 'ul', items: [[{ t: 'Refunds are issued to the original payment method.' }], [{ t: 'Processing can take five to ten business days.' }]] }] },
  ],
}

test('policies: blank, skeleton or placeholder wording cannot be published', () => {
  assert.ok(publishProblems({ title: '', intro: [], sections: [] }).length >= 2)
  assert.ok(publishProblems({ ...real, sections: [{ id: 'a', heading: 'Refunds', body: [] }] }).some(p => /no wording/.test(p)))
  assert.ok(publishProblems({ ...real, sections: [{ id: 'a', heading: '', body: real.sections[0].body }] }).some(p => /needs a heading/.test(p)))
  assert.ok(publishProblems({ ...real, intro: [{ type: 'p', c: [{ t: 'Contact [Company Name] for details.' }] }] }).some(p => /placeholder/.test(p)))
  assert.ok(publishProblems({ ...real, intro: [{ type: 'p', c: [{ t: 'Lorem ipsum dolor sit amet.' }] }] }).some(p => /placeholder/.test(p)))
  assert.ok(publishProblems({ title: 'Terms', intro: [], sections: [{ id: 'a', heading: 'Terms', body: [{ type: 'p', c: [{ t: 'Short.' }] }] }] }).some(p => /very short/.test(p)))
  assert.deepEqual(publishProblems(real), [])
})

test('policies: content from the browser is reduced to the allowed structure; unsafe links are dropped', () => {
  const r = cleanPolicyContent({
    title: '  Terms  ', extra: 'ignored', intro: [{ type: 'script', c: [{ t: 'x' }] }, { type: 'p', c: [{ t: '<b>not html</b>', b: 'yes', onclick: 'x', href: 'javascript:alert(1)' }] }],
    sections: [{ id: 'a b!', heading: 'H', body: [{ type: 'ol', items: [[{ t: 'one', href: 'https://example.com/x' }], []] }] }, { id: 'dup', heading: 'B', body: [] }, { id: 'dup', heading: 'C', body: [] }],
  })
  assert.ok(r.ok)
  if (!r.ok) return
  assert.equal(r.content.title, 'Terms')
  assert.deepEqual(r.content.intro, [{ type: 'p', c: [{ t: '<b>not html</b>' }] }], 'unknown block dropped; text kept as text; bad link and fake flags dropped')
  assert.deepEqual(r.content.sections[0].body, [{ type: 'ol', items: [[{ t: 'one', href: 'https://example.com/x' }]] }])
  assert.match(r.content.sections[0].id, /^[a-z0-9-]+$/i)
  assert.notEqual(r.content.sections[1].id, r.content.sections[2].id, 'section ids stay unique')
  assert.equal(safePolicyHref('javascript:alert(1)'), undefined)
  assert.equal(safePolicyHref('data:text/html,x'), undefined)
  assert.equal(safePolicyHref('mailto:contact@tramainecrawford.com'), 'mailto:contact@tramainecrawford.com')
  assert.equal(stableJson({ b: 1, a: [2, { d: 1, c: 2 }] }), stableJson({ a: [2, { c: 2, d: 1 }], b: 1 }))
})

// ------------------------------------------------------------------ shared Stripe account
function ownerDb(existing: Record<string, string[]>) {
  const queries: string[] = []
  const db = {
    from(table: string) {
      let col = '', val = ''
      const c: Record<string, unknown> = {}
      c.select = () => c
      c.eq = (k: string, v: string) => { col = k; val = v; return c }
      c.limit = () => { queries.push(`${table}.${col}=${val}`); return Promise.resolve({ data: (existing[`${table}.${col}`] ?? []).includes(val) ? [{ id: val }] : [], error: null }) }
      c.insert = () => Promise.resolve({ error: null })
      c.update = () => ({ eq: () => Promise.resolve({ error: null }) })
      return c
    },
  }
  return { db, queries }
}
const ev = (type: string, object: Record<string, unknown>) => ({ id: `evt_${Math.random()}`, type, data: { object } }) as unknown as Stripe.Event
const deps = (db: unknown) => ({ db, stripe: null, audit: async () => {} }) as unknown as PaymentDeps

test('shared Stripe account: Rising Sons Academy events are never treated as TLC payments', async () => {
  const { db, queries } = ownerDb({})
  const rising = [
    ev('checkout.session.completed', { id: 'cs_live_rs1', metadata: { registration_id: 'RSA-2026-0042', student: 'x' }, payment_link: null }),
    ev('checkout.session.completed', { id: 'cs_live_rs2', metadata: { registration_id: '9b2f0c1e-1111-4222-8333-444455556666' }, payment_link: null }),
    ev('payment_intent.payment_failed', { id: 'pi_live_rs', metadata: { registration_id: 'RSA-7' } }),
    ev('invoice.paid', { id: 'in_live_rs', metadata: { payment_request_id: 'tuition-9' } }),
    ev('charge.refunded', { id: 'ch_live_rs', payment_intent: 'pi_live_rs' }),
  ]
  for (const e of rising) assert.equal(await belongsToTlc(e, deps(db)), false, e.type)
  assert.ok(!queries.some(q => q.includes('RSA-') || q.includes('tuition-')), 'a non-UUID id is never used in a database query')
  const out = await processStripeEvent(rising[0], deps(db))
  assert.equal(out.outcome, 'ignored_other_business')
  assert.equal(out.httpStatus, 200, 'acknowledged, so Stripe does not retry or disable the TLC endpoint')
})

test('shared Stripe account: TLC events are recognised by the TLC tag or by TLC records', async () => {
  const reg = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
  const { db } = ownerDb({ 'registrations.id': [reg], 'registrations.stripe_session_id': ['cs_live_tlc_old'], 'payment_requests.stripe_object_id': ['in_live_tlc', 'plink_tlc'] })
  assert.equal(await belongsToTlc(ev('checkout.session.completed', { id: 'cs_live_new', metadata: { app: TLC_STRIPE_APP } }), deps(db)), true)
  assert.equal(await belongsToTlc(ev('checkout.session.completed', { id: 'cs_x', metadata: { registration_id: reg } }), deps(db)), true)
  assert.equal(await belongsToTlc(ev('checkout.session.expired', { id: 'cs_live_tlc_old', metadata: {} }), deps(db)), true)
  assert.equal(await belongsToTlc(ev('checkout.session.completed', { id: 'cs_y', metadata: {}, payment_link: 'plink_tlc' }), deps(db)), true)
  assert.equal(await belongsToTlc(ev('invoice.paid', { id: 'in_live_tlc', metadata: {} }), deps(db)), true)
  assert.equal(await belongsToTlc(ev('payment_intent.payment_failed', { id: 'pi_z', metadata: { app: TLC_STRIPE_APP, registration_id: reg } }), deps(db)), true)
})

test('every Checkout Session this site creates carries the TLC tag (session and payment)', () => {
  const p = checkoutSessionParams({ registrationId: 'r1', cohortId: 'c1', email: 'pat@example.test', siteUrl: 'https://site.test', expiresAt: 2_000_000, pricing: { amountCents: 14900, productName: 'New Leaders', description: 'Spring' } })
  assert.equal(p.metadata?.app, TLC_STRIPE_APP)
  assert.equal((p.payment_intent_data?.metadata as Record<string, string>).app, TLC_STRIPE_APP)
})
