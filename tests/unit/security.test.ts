import { test } from 'node:test'
import assert from 'node:assert/strict'
import { escapeHtml, escapeMultiline, cleanLine, cleanText, isValidEmail, safeHttpUrl, createRateLimiter, clientIp } from '../../src/lib/security'
import { resolveCheckoutPrice } from '../../src/lib/checkout-pricing'
import { canAccess, homeForRole, isProtectedPath, normalizeRole } from '../../src/lib/access'
import { environmentProblems, assertSafeEnvironment, emailRecipient, PRODUCTION_SUPABASE_REF } from '../../src/lib/env-guard'

// ---------------------------------------------------------------- email encoding
test('escapeHtml neutralises markup, attributes and links', () => {
  const payload = `<a href="https://evil.example">Click</a><script>alert(1)</script>' onmouseover='x`
  const out = escapeHtml(payload)
  assert.ok(!out.includes('<'), 'no raw <')
  assert.ok(!out.includes('>'), 'no raw >')
  assert.ok(!out.includes('"'), 'no raw double quote')
  assert.ok(!out.includes("'"), 'no raw single quote')
  assert.equal(escapeHtml('Tom & Jerry'), 'Tom &amp; Jerry')
  assert.equal(escapeHtml(null), '')
  assert.equal(escapeHtml(97), '97')
})

test('escapeMultiline keeps line breaks but escapes content', () => {
  assert.equal(escapeMultiline('a<b\nc'), 'a&lt;b<br/>c')
})

test('cleanLine collapses newlines (no header/layout injection) and caps length', () => {
  assert.equal(cleanLine('Jane\r\nBcc: x@y.z', 100), 'Jane Bcc: x@y.z')
  assert.equal(cleanLine('a'.repeat(500), 120).length, 120)
  assert.equal(cleanLine(42, 10), '')
})

test('cleanText strips control characters and caps length', () => {
  assert.equal(cleanText('hi\u0000there\n', 100), 'hithere')
  assert.equal(cleanText('x'.repeat(10), 3), 'xxx')
})

test('isValidEmail', () => {
  assert.ok(isValidEmail('jane@example.org'))
  for (const bad of ['', 'jane', 'jane@', '@x.org', 'a b@x.org', 'x@y', '<x@y.org>', 'x@y.org\nBcc:z@w.org']) {
    assert.ok(!isValidEmail(bad), bad)
  }
})

test('safeHttpUrl allows only http(s)', () => {
  assert.equal(safeHttpUrl('amazon.com/book'), 'https://amazon.com/book')
  assert.equal(safeHttpUrl('https://x.org/a?b=1'), 'https://x.org/a?b=1')
  assert.equal(safeHttpUrl('javascript:alert(1)'), null)
  assert.equal(safeHttpUrl('data:text/html,hi'), null)
  assert.equal(safeHttpUrl(''), null)
})

test('rate limiter allows up to the limit per window, then resets', () => {
  const rl = createRateLimiter({ limit: 2, windowMs: 1000 })
  assert.ok(rl.hit('ip', 0))
  assert.ok(rl.hit('ip', 10))
  assert.ok(!rl.hit('ip', 20))
  assert.ok(rl.hit('other', 20), 'keys are independent')
  assert.ok(rl.hit('ip', 1001), 'window resets')
})

test('clientIp reads the first forwarded address', () => {
  assert.equal(clientIp(new Headers({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' })), '1.2.3.4')
  assert.equal(clientIp(new Headers()), 'unknown')
})

// ---------------------------------------------------------------- checkout pricing
const program = { id: 'p1', name: 'Impact Makers', type: 'cohort', price: 97, is_public: true, enrollment_open: true }
const cohort = { id: 'c1', program_id: 'p1', name: 'Spring 2027', status: 'upcoming' }

test('price comes only from the program record', () => {
  const r = resolveCheckoutPrice(program, cohort)
  assert.deepEqual(r, { ok: true, amountCents: 9700, productName: 'Impact Makers', description: 'Spring 2027' })
})

test('checkout refuses a pathway that is hidden or not open for enrollment', () => {
  assert.deepEqual(resolveCheckoutPrice({ ...program, enrollment_open: false }, cohort).ok, false)
  assert.deepEqual(resolveCheckoutPrice({ ...program, enrollment_open: null }, cohort).ok, false)
  assert.deepEqual(resolveCheckoutPrice({ ...program, is_public: false }, cohort).ok, false)
  const r = resolveCheckoutPrice({ ...program, enrollment_open: false }, cohort)
  assert.equal(!r.ok && r.status, 409)
})

test('checkout rejects mismatched, closed, unpriced or missing records', () => {
  assert.equal(resolveCheckoutPrice(program, { ...cohort, program_id: 'other' }).ok, false)
  assert.equal(resolveCheckoutPrice(program, { ...cohort, status: 'active' }).ok, false)
  assert.equal(resolveCheckoutPrice(program, { ...cohort, status: 'completed' }).ok, false)
  assert.equal(resolveCheckoutPrice({ ...program, price: null }, cohort).ok, false)
  assert.equal(resolveCheckoutPrice({ ...program, price: 0 }, cohort).ok, false)
  assert.equal(resolveCheckoutPrice({ ...program, price: -5 }, cohort).ok, false)
  assert.equal(resolveCheckoutPrice({ ...program, price: 97.5 }, cohort).ok, false)
  assert.equal(resolveCheckoutPrice({ ...program, price: 1_000_000 }, cohort).ok, false)
  assert.equal(resolveCheckoutPrice({ ...program, type: 'coaching' }, cohort).ok, false)
  assert.equal(resolveCheckoutPrice(null, cohort).ok, false)
  assert.equal(resolveCheckoutPrice(program, null).ok, false)
})

// ---------------------------------------------------------------- route access
test('protected areas require the right role', () => {
  assert.ok(isProtectedPath('/admin'))
  assert.ok(isProtectedPath('/admin/users'))
  assert.ok(!isProtectedPath('/administrator-guide'), 'prefix must be a whole segment')
  assert.ok(!isProtectedPath('/impact'))

  assert.ok(canAccess('/admin/users', 'admin'))
  assert.ok(!canAccess('/admin/users', 'impact_participant'))
  assert.ok(!canAccess('/admin', 'coaching_client'))
  assert.ok(canAccess('/impact-portal', 'impact_participant'))
  assert.ok(!canAccess('/impact-portal', 'coaching_client'))
  assert.ok(canAccess('/coaching-portal', 'coaching_client'))
  assert.ok(!canAccess('/coaching-portal', 'impact_participant'))
  assert.ok(canAccess('/impact', 'impact_participant'))
})

test('unknown roles are treated as the least-privileged role', () => {
  assert.equal(normalizeRole('superuser'), 'impact_participant')
  assert.equal(normalizeRole(undefined), 'impact_participant')
  assert.equal(homeForRole(normalizeRole('admin')), '/admin')
})

// ---------------------------------------------------------------- environment guard
const prodUrl = `https://${PRODUCTION_SUPABASE_REF}.supabase.co`

test('preview and local dev refuse production database and live Stripe', () => {
  assert.equal(environmentProblems({ VERCEL_ENV: 'preview', NEXT_PUBLIC_SUPABASE_URL: prodUrl }).length, 1)
  assert.equal(environmentProblems({ NODE_ENV: 'development', STRIPE_SECRET_KEY: 'sk_live_x' }).length, 1)
  assert.throws(() => assertSafeEnvironment({ NODE_ENV: 'development', NEXT_PUBLIC_SUPABASE_URL: prodUrl }), /PRODUCTION Supabase/)
  assert.equal(environmentProblems({ NODE_ENV: 'development', NEXT_PUBLIC_SUPABASE_URL: 'https://devref.supabase.co', STRIPE_SECRET_KEY: 'sk_test_x' }).length, 0)
  assert.equal(environmentProblems({ VERCEL_ENV: 'preview', NEXT_PUBLIC_SUPABASE_URL: prodUrl, ALLOW_PRODUCTION_SERVICES: 'true' }).length, 0)
})

test('production is never blocked', () => {
  assert.doesNotThrow(() => assertSafeEnvironment({ VERCEL_ENV: 'production', NODE_ENV: 'production', NEXT_PUBLIC_SUPABASE_URL: prodUrl, STRIPE_SECRET_KEY: 'sk_live_x' }))
  assert.doesNotThrow(() => assertSafeEnvironment({ NODE_ENV: 'production', NEXT_PUBLIC_SUPABASE_URL: prodUrl }), 'browser bundle in production')
})

test('email goes to real recipients only outside known test environments', () => {
  assert.equal(emailRecipient({ VERCEL_ENV: 'production' }, 'a@b.org'), 'a@b.org')
  assert.equal(emailRecipient({ NODE_ENV: 'production' }, 'a@b.org'), 'a@b.org', 'unknown env never suppresses mail')
  assert.equal(emailRecipient({ VERCEL_ENV: 'preview', EMAIL_TEST_RECIPIENT: 't@x.org' }, 'a@b.org'), 't@x.org')
  assert.equal(emailRecipient({ NODE_ENV: 'development' }, 'a@b.org'), null)
})

// ---------------------------------------------------------------- displayed vs charged price
import { displayedDollars } from '../../src/lib/checkout-pricing'
import { sanitizeRichText, safeHref } from '../../src/lib/sanitize-html'

test('checkout refuses when the displayed price differs from the charged price', () => {
  assert.equal(displayedDollars('$97'), 97)
  assert.equal(displayedDollars('$1,250 per person'), 1250)
  assert.equal(displayedDollars('Request a Quote'), null)
  assert.equal(resolveCheckoutPrice({ ...program, price: 149, price_label: '$97' }, cohort).ok, false)
  assert.equal(resolveCheckoutPrice({ ...program, price: 97, price_label: '$97' }, cohort).ok, true)
  assert.equal(resolveCheckoutPrice({ ...program, price: 97, price_label: null }, cohort).ok, true)
})

test('rich text without a DOM falls back to escaped plain text', () => {
  const out = sanitizeRichText('<p>Hi</p><script>alert(1)</script><img src=x onerror=alert(1)>')
  assert.ok(!out.includes('<'), out)
  assert.equal(safeHref('javascript:alert(1)'), undefined)
  assert.equal(safeHref('https://zoom.us/j/1'), 'https://zoom.us/j/1')
})

// ---------------------------------------------------------------- pathways
import { mergePathways, DEFAULT_PATHWAYS, LEGACY_ANCHORS } from '../../src/lib/pathways'

test('pathways fall back to approved copy and never show price unless enrollment is open', () => {
  assert.deepEqual(mergePathways(null).map(p => p.slug), ['emerging-leaders', 'new-leaders', 'practicing-leaders'])
  const row = { id: 'x', slug: 'new-leaders', pathway_number: 2, name: 'New Leaders', tagline: 'Edited tagline', opening_statement: null, audience: null, description: null, leadership_goal: null, keywords: 'A, B', price_label: '$450', enrollment_open: false, is_public: true }
  const merged = mergePathways([row])
  const nl = merged.find(p => p.slug === 'new-leaders')!
  assert.equal(nl.tagline, 'Edited tagline')
  assert.deepEqual(nl.focus, ['A', 'B'])
  assert.equal(nl.openingStatement, DEFAULT_PATHWAYS[1].openingStatement, 'empty fields keep approved copy')
  assert.equal(nl.priceLabel, null, 'closed enrollment hides price')
  assert.equal(mergePathways([{ ...row, enrollment_open: true }], { checkoutEnabled: true }).find(p => p.slug === 'new-leaders')!.priceLabel, '$450')
  // 2026-11-23: a hidden pathway is removed, not replaced by the approved default copy.
  assert.equal(mergePathways([{ ...row, is_public: false, tagline: 'Hidden' }]).find(p => p.slug === 'new-leaders'), undefined)
  assert.equal(LEGACY_ANCHORS.makers, 'new-leaders')
})
