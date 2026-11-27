'use client'

// Admin → Launch readiness: the same server-side gate checkout uses, shown as a checklist with
// where to fix each item. Nothing here switches payments on by itself.
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import type { Check, LaunchReadiness, StripeCheck } from '@/lib/launch-readiness'
import { formatDateTimeET } from '@/lib/business-time'
import { useAdminPanelContext } from '../AdminPanelContext'
import { cardStyle, helpStyle, pageTitleStyle, secondaryButtonStyle, sectionTitleStyle } from '../components/shared'

const ok = { bg: '#e8f5ec', color: '#14532d', label: 'Done' }
const todo = { bg: '#fdf3e1', color: '#7a4a06', label: 'To do' }
const blocked = { bg: '#fdecea', color: '#8c1d18', label: 'Blocked' }
const chip = (s: { bg: string; color: string; label: string }, text?: string) => (
  <span style={{ display: 'inline-block', fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.2rem 0.55rem', borderRadius: '3px', background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>{text ?? s.label}</span>
)
const fixLink = { color: '#8a5a10', fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap' as const }

function Row({ c }: { c: Check }) {
  return (
    <li style={{ display: 'flex', gap: '0.75rem 1rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.7rem 0', borderBottom: '1px solid var(--mist)' }}>
      <span style={{ width: '5.5rem', flexShrink: 0 }}>{chip(c.ok ? ok : todo)}</span>
      <span style={{ flex: '1 1 260px', minWidth: 0 }}>
        <strong style={{ color: 'var(--navy)', fontSize: '0.92rem' }}>{c.label}</strong>
        <span style={{ display: 'block', color: 'var(--slate)', fontSize: '0.85rem', lineHeight: 1.5 }}>{c.detail}</span>
      </span>
      {!c.ok && c.fix && <Link href={c.fix.href} style={fixLink}>{c.fix.label} →</Link>}
    </li>
  )
}

export default function LaunchPage() {
  const panel = useAdminPanelContext()
  const [data, setData] = useState<{ readiness: LaunchReadiness; stripe: StripeCheck | null } | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [stripeReport, setStripeReport] = useState<{ account?: { name: string | null; charges_enabled: boolean; payouts_enabled: boolean; requirements_due: string[] }; webhook_endpoints?: { url: string; status: string; this_site: boolean; missing_events?: string[] }[] } | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/launch-readiness', { cache: 'no-store' })
      if (!r.ok) throw new Error()
      setData(await r.json()); setError('')
    } catch { setError('Launch readiness could not be loaded. Reload the page to try again.') }
  }, [])
  useEffect(() => { void Promise.resolve().then(load) }, [load])

  const runCheck = async () => {
    setBusy('check')
    try {
      const r = await fetch('/api/admin/stripe-status', { cache: 'no-store' })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error)
      setStripeReport(j); await load()
      panel.ok(j.check?.events_complete ? 'Stripe checked.' : 'Stripe checked: the TLC webhook is missing required events.')
    } catch (e) { panel.fail(e instanceof Error && e.message ? e.message : 'Stripe could not be checked.') }
    setBusy(null)
  }
  const addEvents = async () => {
    const yes = await panel.confirm({ title: 'Add the required events to the TLC webhook?', message: 'Only the webhook for this website changes. Other webhooks on the Stripe account (Rising Sons Academy) are not touched.', consequences: ['Stripe will also tell this site about failed payments, expired checkouts, refunds and invoices.'], confirmLabel: 'Add events' })
    if (!yes) return
    setBusy('events')
    try {
      const r = await fetch('/api/admin/stripe-status', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'configure-webhook' }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error)
      panel.ok(j.changed ? `Added ${j.added.length} event(s) to the TLC webhook.` : 'The TLC webhook already has every required event.')
      await runCheck()
    } catch (e) { panel.fail(e instanceof Error && e.message ? e.message : 'The webhook could not be updated.') }
    setBusy(null)
  }
  const verify = async () => {
    setBusy('verify')
    try {
      const r = await fetch('/api/admin/stripe-status', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'webhook-test' }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error)
      let result: { verified?: boolean; delivered?: boolean } = {}
      for (let i = 0; i < 12; i++) {
        await new Promise(res => setTimeout(res, 2500))
        const g = await fetch(`/api/admin/stripe-status?session=${encodeURIComponent(j.session)}`, { cache: 'no-store' })
        result = await g.json()
        if (result.delivered) break
      }
      await load()
      if (result.verified) panel.ok('Verified: Stripe delivered a signed test event and this site processed it. No payment was made.')
      else if (result.delivered) panel.fail('The test event arrived, but the account or webhook events are not complete yet. See the Stripe section.')
      else panel.fail('The test event has not arrived yet. Make sure the TLC webhook includes checkout.session.expired, then try again.')
    } catch (e) { panel.fail(e instanceof Error && e.message ? e.message : 'The verification could not run.') }
    setBusy(null)
  }

  if (error) return <div><h1 style={pageTitleStyle}>Launch readiness</h1><p role="alert" style={helpStyle}>{error}</p></div>
  if (!data) return <div><h1 style={pageTitleStyle}>Launch readiness</h1><p style={helpStyle}>Loading…</p></div>
  const { readiness: r, stripe } = data
  const openCohorts = r.pathways.flatMap(p => p.cohorts.filter(c => c.open).map(c => ({ ...c, pathway: p.name })))
  const upcoming = r.pathways.flatMap(p => p.cohorts.map(c => ({ ...c, pathway: p.name })))

  return (
    <div style={{ maxWidth: '980px' }}>
      <h1 style={pageTitleStyle}>Launch readiness</h1>
      <p style={helpStyle}>Online payment opens for a cohort only when everything below is done. The website checks this itself every time someone tries to pay, so a missing item always blocks payment, with no exceptions.</p>

      <section aria-labelledby="lr-status" style={{ ...cardStyle, borderTop: `4px solid ${r.open ? '#1E6B3A' : '#B3261E'}` }}>
        <h2 id="lr-status" style={sectionTitleStyle}>{r.open ? `Payments are open for ${openCohorts.length} cohort${openCohorts.length === 1 ? '' : 's'}` : 'Payments are blocked'}</h2>
        {r.open ? (
          <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--navy)', lineHeight: 1.7 }}>{openCohorts.map(c => <li key={c.id}>{c.pathway}: {c.name}</li>)}</ul>
        ) : (
          <>
            <p style={{ ...helpStyle, marginBottom: '0.5rem' }}>Visitors see “enrollment closed” and use the inquiry form. Still needed:</p>
            <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--navy)', lineHeight: 1.7, fontSize: '0.92rem' }}>
              {r.blockers.map(b => <li key={b}>{b}</li>)}
              {r.blockers.length === 0 && <li>At least one cohort that is Upcoming, fully set up, and on a pathway that is open for enrollment (see below).</li>}
            </ul>
          </>
        )}
      </section>

      <section aria-labelledby="lr-site" style={cardStyle}>
        <h2 id="lr-site" style={sectionTitleStyle}>Site-wide</h2>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>{r.global.map(c => <Row key={c.key} c={c} />)}</ul>
      </section>

      <section id="stripe" aria-labelledby="lr-stripe" style={cardStyle}>
        <h2 id="lr-stripe" style={sectionTitleStyle}>Stripe</h2>
        <p style={helpStyle}>
          {stripe?.verified ? `Verified ${formatDateTimeET(stripe.verified_at)}.` : 'Not verified yet.'}{' '}
          The check reads the Stripe account and webhooks. The verification creates a $1.00 checkout that nobody sees and cancels it at once: no customer, no payment. It proves Stripe can reach this site with the correct signature.
        </p>
        {stripe && (
          <ul style={{ margin: '0 0 1rem', paddingLeft: '1.2rem', fontSize: '0.88rem', color: 'var(--navy)', lineHeight: 1.7 }}>
            <li>Account able to take payments: {stripe.account_ok ? 'yes' : 'no'}</li>
            <li>TLC webhook events: {stripe.events_complete ? 'complete' : `missing ${stripe.missing_events.join(', ')}`}</li>
          </ul>
        )}
        {stripeReport?.webhook_endpoints && (
          <div style={{ fontSize: '0.85rem', color: 'var(--slate)', margin: '0 0 1rem', lineHeight: 1.6 }}>
            Webhooks on the shared Stripe account:
            <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.2rem' }}>
              {stripeReport.webhook_endpoints.map(e => <li key={e.url}>{e.url} · {e.status}{e.this_site ? ' · this website' : ' · another organization (never changed here)'}</li>)}
            </ul>
          </div>
        )}
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={runCheck} disabled={!!busy} style={{ ...secondaryButtonStyle, minHeight: '44px' }}>{busy === 'check' ? 'Checking…' : 'Run Stripe check'}</button>
          {stripe && !stripe.events_complete && <button type="button" onClick={addEvents} disabled={!!busy} style={{ ...secondaryButtonStyle, minHeight: '44px' }}>{busy === 'events' ? 'Updating…' : 'Add missing webhook events'}</button>}
          <button type="button" onClick={verify} disabled={!!busy} className="btn btn-primary" style={{ fontSize: '0.8rem', minHeight: '44px' }}>{busy === 'verify' ? 'Verifying (about 30 seconds)…' : 'Verify webhook (no charge)'}</button>
        </div>
      </section>

      <section aria-labelledby="lr-policies" style={cardStyle}>
        <h2 id="lr-policies" style={sectionTitleStyle}>Policies</h2>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {r.policies.map(p => (
            <li key={p.slug} style={{ display: 'flex', gap: '0.75rem 1rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.7rem 0', borderBottom: '1px solid var(--mist)' }}>
              <span style={{ width: '5.5rem', flexShrink: 0 }}>{chip(p.published ? ok : todo, p.published ? 'Published' : 'Draft')}</span>
              <span style={{ flex: '1 1 260px', color: 'var(--navy)', fontWeight: 600, fontSize: '0.92rem' }}>{p.name}{p.published && <span style={{ color: 'var(--slate)', fontWeight: 400 }}> · version {p.version}, {formatDateTimeET(p.publishedAt)}</span>}</span>
              <Link href={`/admin/policies?policy=${p.slug}`} style={fixLink}>{p.published ? 'Review' : 'Write and publish'} →</Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="lr-cohorts" style={cardStyle}>
        <h2 id="lr-cohorts" style={sectionTitleStyle}>Pathways and upcoming cohorts</h2>
        {r.pathways.map(p => (
          <div key={p.id} style={{ padding: '0.75rem 0 1rem', borderBottom: '1px solid var(--mist)' }}>
            <div style={{ display: 'flex', gap: '0.5rem 1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <strong style={{ color: 'var(--navy)' }}>{p.name}</strong>
              {chip(p.enrollmentOpen ? ok : todo, p.enrollmentOpen ? 'Enrollment open' : 'Enrollment closed')}
              {chip(p.priceOk ? ok : blocked, p.priceOk ? (p.priceLabel ?? 'Price set') : 'Price problem')}
              {!p.isPublic && chip(blocked, 'Hidden')}
              <Link href="/admin/programs" style={fixLink}>Pathways →</Link>
            </div>
            {p.cohorts.length === 0 ? (
              <p style={{ ...helpStyle, margin: '0.5rem 0 0' }}>No draft or upcoming cohort. <Link href="/admin/cohorts" style={fixLink}>Create one in Cohorts →</Link></p>
            ) : (
              <ul style={{ listStyle: 'none', margin: '0.5rem 0 0', padding: 0 }}>
                {p.cohorts.map(c => (
                  <li key={c.id} style={{ padding: '0.4rem 0 0.4rem 1rem', borderLeft: '3px solid var(--mist)', marginBottom: '0.4rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem 1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ color: 'var(--navy)', fontWeight: 600, fontSize: '0.9rem' }}>{c.name}</span>
                      {chip(c.open ? ok : c.configured ? todo : blocked, c.open ? 'Taking payments' : c.configured ? 'Set up' : 'Setup incomplete')}
                      <Link href={`/admin/cohorts?cohort=${c.id}&section=readiness`} style={fixLink}>Open checklist →</Link>
                    </div>
                    {c.problems.some(x => !x.ok) && (
                      <ul style={{ margin: '0.3rem 0 0', paddingLeft: '1.1rem', fontSize: '0.84rem', color: 'var(--slate)', lineHeight: 1.6 }}>
                        {c.problems.filter(x => !x.ok).map(x => <li key={x.key}>{x.label}: {x.detail}</li>)}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        {upcoming.length === 0 && <p style={{ ...helpStyle, marginTop: '0.75rem' }}>Payments can only open for a cohort that is Upcoming, starts in the future and has dates, a seat limit, a schedule and a meeting link.</p>}
      </section>
    </div>
  )
}
