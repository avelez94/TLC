'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { friendlyError } from '@/lib/admin-errors'
import { describeActivity, describeChanges, type ActivityRow } from '@/lib/activity-log'
import { formatDateTimeET } from '@/lib/business-time'
import type { AdminPanel } from '../useAdminPanel'
import { InlineError } from './feedback'
import TwoStepSetup from './TwoStepSetup'
import { cardStyle, dangerLinkStyle, helpStyle, labelStyle, pageTitleStyle, secondaryButtonStyle, sectionTitleStyle, statusBadge, tdStyle, thStyle } from './shared'

interface Factor { id: string; friendly_name?: string | null; status: string; created_at: string }
interface AuditRow extends ActivityRow { id: number; actor_id: string | null; entity_id: string | null; created_at: string }
interface EmailRow { id: number; template: string; recipient: string; subject: string | null; status: string; error: string | null; created_at: string }
interface SecurityStatus { mode: string; admins: { id: string; name: string | null; enrolled: boolean }[] }

const FULL_COLUMNS = 'id, actor_id, action, entity_type, entity_id, entity_label, outcome, changes, details, created_at'
const OLD_COLUMNS = 'id, actor_id, action, entity_type, entity_id, details, created_at'

const errorBox = { ...cardStyle, borderLeft: '3px solid #b3261e', color: '#7a1a14', padding: '0.85rem 1rem', fontSize: '0.9rem', marginBottom: '0.75rem' } as const
const emptyStyle = { color: 'var(--slate)', fontSize: '0.9rem', margin: 0 } as const

const MODE_TEXT: Record<string, string> = {
  off: 'Off: two-step verification is optional. Each administrator can turn it on for their own account (strongly recommended).',
  enrolled: 'On for enrolled administrators: an administrator who has set up an authenticator must enter a code to use the admin panel. Others can still sign in with a password only.',
  required: 'Required: every administrator must enter a code from their authenticator app to use the admin panel.',
}

export default function SecurityTab(panel: AdminPanel) {
  const { me, users, programs, cohorts, checkoutEnabled } = panel

  const [factors, setFactors] = useState<Factor[]>([])
  const [factorsLoaded, setFactorsLoaded] = useState(false)
  const [factorsError, setFactorsError] = useState<string | null>(null)
  const [aal, setAal] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)

  const [status, setStatus] = useState<SecurityStatus | null>(null)
  const [statusUnavailable, setStatusUnavailable] = useState(false)

  const [resettingId, setResettingId] = useState<string | null>(null)
  const [resetError, setResetError] = useState<Record<string, string | null>>({})

  const [activity, setActivity] = useState<AuditRow[]>([])
  const [activityLoaded, setActivityLoaded] = useState(false)
  const [activityError, setActivityError] = useState<string | null>(null)
  const [oldLog, setOldLog] = useState(false)
  const [failedOnly, setFailedOnly] = useState(false)

  const [emails, setEmails] = useState<EmailRow[]>([])
  const [emailsLoaded, setEmailsLoaded] = useState(false)
  const [emailsError, setEmailsError] = useState<string | null>(null)

  const loadAuth = useCallback(async () => {
    const [{ data, error }, aalRes, statusRes] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.rpc('admin_security_status'),
    ])
    if (error) setFactorsError(`Your authenticators could not be loaded: ${friendlyError(error)}`)
    else { setFactorsError(null); setFactors(((data?.all ?? []) as Factor[]).filter(f => f.status === 'verified')) }
    setFactorsLoaded(true)
    setAal(aalRes.data?.currentLevel ?? null)
    // Older databases do not have this function yet: the table is simply hidden.
    if (statusRes.error || !statusRes.data) { setStatus(null); setStatusUnavailable(true) }
    else { setStatus(statusRes.data as SecurityStatus); setStatusUnavailable(false) }
  }, [])

  const loadActivity = useCallback(async (onlyFailed: boolean) => {
    let query = supabase.from('admin_audit_log').select(FULL_COLUMNS).order('created_at', { ascending: false }).limit(100)
    if (onlyFailed) query = query.in('outcome', ['failed', 'blocked'])
    let { data, error } = await query
    let old = false
    if (error) {
      // Before the 2d database update the log had fewer columns.
      const retry = await supabase.from('admin_audit_log').select(OLD_COLUMNS).order('created_at', { ascending: false }).limit(100)
      if (!retry.error) { old = true; data = onlyFailed ? [] : (retry.data as typeof data); error = null }
      else error = retry.error
    }
    if (error) setActivityError(`The activity log could not be loaded: ${friendlyError(error)}`)
    else { setActivityError(null); setActivity((data ?? []) as unknown as AuditRow[]) }
    setOldLog(old)
    setActivityLoaded(true)
  }, [])

  const loadEmails = useCallback(async () => {
    const { data, error } = await supabase.from('email_log').select('id, template, recipient, subject, status, error, created_at').order('created_at', { ascending: false }).limit(50)
    if (error) setEmailsError(`The email log could not be loaded: ${friendlyError(error)}`)
    else { setEmailsError(null); setEmails((data ?? []) as EmailRow[]) }
    setEmailsLoaded(true)
  }, [])

  useEffect(() => { void Promise.resolve().then(() => Promise.all([loadAuth(), loadEmails()])) }, [loadAuth, loadEmails])
  useEffect(() => { void Promise.resolve().then(() => loadActivity(failedOnly)) }, [loadActivity, failedOnly])

  const reloadAll = useCallback(async () => { await Promise.all([loadAuth(), loadActivity(failedOnly)]) }, [loadAuth, loadActivity, failedOnly])

  const mode = status?.mode ?? null
  const myTwoStepOn = factors.length > 0
  const isLast = factors.length === 1
  const removalBlocked = isLast && mode === 'required'

  const removeFactor = async (f: Factor) => {
    if (removalBlocked) return
    setRemoveError(null)
    const consequences = isLast
      ? [
        'This is your only authenticator, so two-step verification will be turned OFF for your account.',
        mode === 'enrolled' ? 'You will be able to use the admin panel with only your password until you add a new authenticator.' : 'You will sign in with only your password until you add a new authenticator.',
        'This is recorded in the activity log.',
      ]
      : ['Codes from this authenticator will stop working.', 'Your other authenticator keeps working.', 'This is recorded in the activity log.']
    if (!(await panel.confirm({ title: 'Remove this authenticator?', message: f.friendly_name || 'Authenticator', consequences, confirmLabel: 'Remove authenticator', danger: true }))) return
    setRemovingId(f.id)
    const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id })
    if (error) {
      const msg = /aal2|assurance/i.test(error.message)
        ? 'Sign out and sign in again with your current code, then try again.'
        : friendlyError(error)
      setRemoveError(`The authenticator was not removed: ${msg}`)
      panel.fail(`The authenticator was not removed: ${msg}`)
      await panel.logFailure('mfa.remove', 'person', me.id, me.name, msg)
    } else {
      await panel.logEvent('mfa.remove', 'person', me.id, me.name)
      panel.ok(isLast ? 'Authenticator removed. Two-step verification is now off for your account.' : 'Authenticator removed.')
      await reloadAll()
    }
    setRemovingId(null)
  }

  // Other administrators (from the security overview, or from the people list on older databases).
  const otherAdmins = (status?.admins ?? users.filter(u => u.role === 'admin').map(u => ({ id: u.id, name: u.full_name ?? u.email, enrolled: false })))
    .filter(a => a.id !== me.id)
  const adminName = (a: { name: string | null }) => a.name || 'Unnamed administrator'
  const canReset = myTwoStepOn && aal === 'aal2'

  const resetOther = async (a: { id: string; name: string | null }) => {
    setResetError(e => ({ ...e, [a.id]: null }))
    if (!(await panel.confirm({
      title: `Reset ${adminName(a)}’s two-step verification?`,
      message: 'Use this when they have lost the phone or app that gives them codes.',
      consequences: [
        'All of their authenticators are removed.',
        'They will sign in with their password and then set up a new authenticator.',
        'Their account, role and records are not changed.',
        'This is recorded in the activity log under your name.',
      ],
      confirmLabel: 'Reset two-step verification', danger: true,
    }))) return
    setResettingId(a.id)
    let message: string | null = null
    let serverLogged = false
    try {
      const res = await fetch('/api/admin/mfa-reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: a.id }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) { message = data.error || 'The reset did not complete. Nothing was changed.'; serverLogged = res.status === 500 }
      else panel.ok(`${adminName(a)}’s two-step verification was reset (${data.removed ?? 0} authenticator${data.removed === 1 ? '' : 's'} removed). They can now sign in with their password and set up a new one.`)
    } catch { message = 'The server could not be reached. Nothing was changed.' }
    if (message) {
      setResetError(e => ({ ...e, [a.id]: message }))
      panel.fail(message)
      if (!serverLogged) await panel.logFailure('mfa.reset', 'person', a.id, adminName(a), message)
    }
    await reloadAll()
    setResettingId(null)
  }

  const lookups = {
    program: (id: string) => programs.find(p => p.id === id)?.name,
    cohort: (id: string) => cohorts.find(c => c.id === id)?.name,
    person: (id: string) => { const u = users.find(x => x.id === id); return u ? (u.full_name || u.email || undefined) : undefined },
  }
  const who = (id: string | null) => {
    if (!id) return 'System'
    return users.some(u => u.id === id) ? panel.personName(id) : 'A removed account'
  }
  const detailsOf = (a: AuditRow) => {
    const parts = describeChanges(a, lookups)
    const d = a.details ?? {}
    if (typeof d.removed === 'number') parts.push(`${d.removed} authenticator${d.removed === 1 ? '' : 's'} removed`)
    if ((a.outcome === 'failed' || a.outcome === 'blocked') && typeof d.error === 'string') parts.push(`Reason: ${d.error}`)
    return parts.join('; ')
  }
  const outcomeBadge = (o: string | null | undefined) =>
    o === 'failed' ? statusBadge('full', 'Failed') : o === 'blocked' ? statusBadge('full', 'Blocked') : statusBadge('completed', 'Done')

  return (
    <div>
      <span style={labelStyle}>Insights &amp; security</span>
      <h1 style={pageTitleStyle}>Security &amp; activity</h1>
      <p style={{ ...helpStyle, maxWidth: '46rem' }}>Protect the admin panel, help another administrator who lost their authenticator, and see what has changed recently. Times are New York time (ET).</p>

      {/* ------------------------------------------------ your two-step verification */}
      <section style={cardStyle} aria-labelledby="sec-mine">
        <h2 id="sec-mine" style={sectionTitleStyle}>Two-step verification: your account</h2>
        {factorsError && <div role="alert" style={errorBox}>{factorsError}</div>}
        {factorsLoaded && !factorsError && (
          <p style={{ ...helpStyle, display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {myTwoStepOn ? statusBadge('open', 'On') : statusBadge('full', 'Off')}
            <span>{myTwoStepOn
              ? 'Signing in to the admin panel asks for a code from your authenticator app.'
              : 'Protect the admin panel with a code from an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password). Strongly recommended.'}</span>
          </p>
        )}
        {myTwoStepOn && aal !== 'aal2' && (
          <p style={{ ...helpStyle, color: '#8a5a10' }}>This session was signed in without a code. Sign out and sign in again with your code to remove an authenticator or reset someone else’s.</p>
        )}
        {factors.map(f => (
          <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', padding: '0.65rem 0', borderTop: '1px solid var(--mist)', fontSize: '0.9rem' }}>
            <span>{f.friendly_name || 'Authenticator'} <span style={{ color: 'var(--slate)' }}>· added {formatDateTimeET(f.created_at)}</span></span>
            <button type="button" onClick={() => void removeFactor(f)} disabled={removalBlocked || removingId !== null}
              style={{ ...dangerLinkStyle, fontSize: '0.88rem', padding: '0.4rem 0', opacity: removalBlocked ? 0.5 : 1, cursor: removalBlocked ? 'not-allowed' : 'pointer' }}>
              {removingId === f.id ? 'Removing…' : 'Remove'}
            </button>
          </div>
        ))}
        {isLast && mode === 'required' && (
          <p style={{ ...helpStyle, fontSize: '0.85rem', margin: '0.5rem 0 0' }}>The site requires two-step verification for every administrator, so your only authenticator cannot be removed. To switch phones, add the new authenticator first, then remove the old one.</p>
        )}
        {isLast && mode === 'enrolled' && (
          <p style={{ ...helpStyle, fontSize: '0.85rem', margin: '0.5rem 0 0' }}>This is your only authenticator. Removing it turns two-step verification off for your account. To switch phones, add the new one first.</p>
        )}
        <InlineError message={removeError} />
        {factorsLoaded && (
          <div style={{ marginTop: '1rem' }}>
            <TwoStepSetup key={factors.length} label={myTwoStepOn ? 'Add an authenticator' : 'Turn on two-step verification'} onDone={() => { panel.ok('Two-step verification is on for your account. You will be asked for a code each time you sign in.'); void reloadAll() }} />
          </div>
        )}
      </section>

      {/* ------------------------------------------------ administrators */}
      {!statusUnavailable && status && (
        <section style={cardStyle} aria-labelledby="sec-admins">
          <h2 id="sec-admins" style={sectionTitleStyle}>Administrators</h2>
          <p style={helpStyle}>
            <strong>Site setting now:</strong> {MODE_TEXT[status.mode] ?? MODE_TEXT.off}
          </p>
          <ul style={{ ...helpStyle, paddingLeft: '1.2rem' }}>
            <li><strong>Off</strong>: two-step verification is optional for each administrator.</li>
            <li><strong>Required</strong>: every administrator must enter a code from their authenticator app to use the admin panel.</li>
            <li>The developer will switch it to Required once both administrators have two-step verification on and recovery (below) has been tested.</li>
          </ul>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th scope="col" style={thStyle}>Administrator</th><th scope="col" style={thStyle}>Two-step verification</th></tr></thead>
              <tbody>{status.admins.map(a => (
                <tr key={a.id}>
                  <td style={tdStyle}>{adminName(a)}{a.id === me.id ? <span style={{ color: 'var(--slate)' }}> (you)</span> : null}</td>
                  <td style={tdStyle}>{a.enrolled ? statusBadge('open', 'Two-step on') : statusBadge('full', 'Not set up')}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      )}

      {/* ------------------------------------------------ recovery */}
      <section style={cardStyle} aria-labelledby="sec-recovery">
        <h2 id="sec-recovery" style={sectionTitleStyle}>Recovery: lost authenticator</h2>
        <p style={helpStyle}>
          If another administrator loses the phone or app that gives them codes, you can reset their two-step verification. They then sign in with their password and set up a new authenticator.
          To protect the site, only an administrator who is signed in with their own code can do this.
        </p>
        {!canReset && (
          <p style={{ ...helpStyle, color: '#8a5a10' }}>
            {myTwoStepOn
              ? 'Reset is unavailable because this session was signed in without a code. Sign out and sign in again with your code.'
              : 'Reset is unavailable until you turn on two-step verification for your own account (above) and sign in with your code.'}
          </p>
        )}
        {otherAdmins.length === 0 && <p style={emptyStyle}>There is no other administrator.</p>}
        {otherAdmins.map(a => (
          <div key={a.id} style={{ padding: '0.65rem 0', borderTop: '1px solid var(--mist)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, color: 'var(--navy)' }}>{adminName(a)}</span>
              <button type="button" onClick={() => void resetOther(a)} disabled={!canReset || resettingId !== null}
                style={{ ...secondaryButtonStyle, opacity: canReset ? 1 : 0.5, cursor: canReset ? 'pointer' : 'not-allowed' }}>
                {resettingId === a.id ? 'Resetting…' : 'Reset their two-step verification'}
              </button>
            </div>
            <InlineError message={resetError[a.id]} />
          </div>
        ))}
      </section>

      {/* ------------------------------------------------ activity */}
      <section style={cardStyle} aria-labelledby="sec-activity">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <h2 id="sec-activity" style={{ ...sectionTitleStyle, margin: 0 }}>Recent admin activity</h2>
          <div role="group" aria-label="Show" style={{ display: 'flex', gap: '0.4rem' }}>
            {[{ v: false, l: 'All' }, { v: true, l: 'Failed only' }].map(o => (
              <button key={o.l} type="button" aria-pressed={failedOnly === o.v} onClick={() => setFailedOnly(o.v)}
                style={{ ...secondaryButtonStyle, background: failedOnly === o.v ? 'var(--navy)' : 'white', color: failedOnly === o.v ? 'white' : 'var(--navy)' }}>{o.l}</button>
            ))}
          </div>
        </div>
        <p style={{ ...helpStyle, fontSize: '0.85rem' }}>The last 100 {failedOnly ? 'failed or blocked attempts' : 'changes'} made in the admin panel. Changes are recorded by the database itself; passwords, codes, reflections, journals and message text are never recorded.</p>
        {activityError && (
          <div role="alert" style={errorBox}>
            {activityError}{' '}
            <button type="button" onClick={() => void loadActivity(failedOnly)} style={{ ...secondaryButtonStyle, marginLeft: '0.5rem' }}>Try again</button>
          </div>
        )}
        {!activityError && activityLoaded && failedOnly && oldLog && <p style={emptyStyle}>This database does not record failed attempts yet.</p>}
        {!activityError && activityLoaded && activity.length === 0 && !(failedOnly && oldLog) && (
          <p style={emptyStyle}>{failedOnly ? 'No failed or blocked attempts recorded.' : 'No activity recorded yet.'}</p>
        )}
        {!activityError && activity.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '640px' }}>
              <thead><tr>{['When', 'Who', 'What', 'Details', 'Outcome'].map(h => <th key={h} scope="col" style={thStyle}>{h}</th>)}</tr></thead>
              <tbody>{activity.map(a => {
                const bad = a.outcome === 'failed' || a.outcome === 'blocked'
                return (
                  <tr key={a.id} style={bad ? { background: '#fdf3f2' } : undefined}>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{formatDateTimeET(a.created_at)}</td>
                    <td style={tdStyle}>{who(a.actor_id)}</td>
                    <td style={{ ...tdStyle, fontWeight: bad ? 700 : 400, color: bad ? '#8c1d18' : 'var(--ink)' }}>{describeActivity(a, lookups)}</td>
                    <td style={{ ...tdStyle, color: 'var(--slate)', overflowWrap: 'anywhere', maxWidth: '22rem' }}>{detailsOf(a)}</td>
                    <td style={tdStyle}>{outcomeBadge(a.outcome)}</td>
                  </tr>
                )
              })}</tbody>
            </table>
          </div>
        )}
      </section>

      {/* ------------------------------------------------ email delivery */}
      <section style={cardStyle} aria-labelledby="sec-email">
        <h2 id="sec-email" style={sectionTitleStyle}>Email delivery</h2>
        <p style={{ ...helpStyle, fontSize: '0.85rem' }}>
          The last 50 emails the site tried to send (invitations, notifications, confirmations).
          {checkoutEnabled ? ' A failed payment confirmation email is retried automatically.' : ''}
        </p>
        {emailsError && (
          <div role="alert" style={errorBox}>
            {emailsError}{' '}
            <button type="button" onClick={() => void loadEmails()} style={{ ...secondaryButtonStyle, marginLeft: '0.5rem' }}>Try again</button>
          </div>
        )}
        {!emailsError && emailsLoaded && emails.length === 0 && <p style={emptyStyle}>No emails recorded yet.</p>}
        {!emailsError && emails.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '560px' }}>
              <thead><tr>{['When', 'Email subject', 'To', 'Result'].map(h => <th key={h} scope="col" style={thStyle}>{h}</th>)}</tr></thead>
              <tbody>{emails.map(e => (
                <tr key={e.id} style={e.status === 'failed' ? { background: '#fdf3f2' } : undefined}>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{formatDateTimeET(e.created_at)}</td>
                  <td style={tdStyle}>{e.subject || 'Email (no subject recorded)'}</td>
                  <td style={{ ...tdStyle, overflowWrap: 'anywhere' }}>{e.recipient}</td>
                  <td style={tdStyle}>
                    {e.status === 'sent' ? statusBadge('open', 'Sent') : e.status === 'failed' ? statusBadge('full', 'Failed') : statusBadge('completed', 'Skipped')}
                    {e.error && (
                      <span style={{ display: 'block', marginTop: '0.3rem', fontSize: '0.8rem', color: e.status === 'failed' ? '#8c1d18' : 'var(--slate)', overflowWrap: 'anywhere' }}>{e.error}</span>
                    )}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
