'use client'

// Invite one person (individual inquiry) or several employees (organization inquiry) into a
// cohort without retyping: names and emails start from the inquiry, existing accounts are
// recognised before anything is sent, seats are checked, and every person's result is shown.
// The inquiry is only marked Converted when Tramaine chooses to, after a successful enrollment.
import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { AdminPanel, InviteResult } from '../../useAdminPanel'
import { supabase } from '@/lib/supabase'
import { enrollableCohortChoices } from '../people/common'
import { parsePeople, EMAIL_RE, type PersonRow as Row } from '@/lib/people-list'
import { InlineError } from '../feedback'
import { helpStyle, inputStyle, labelStyle, secondaryButtonStyle, statusBadge, tdStyle, thStyle } from '../shared'

interface Inquiry { id: string; kind: 'organization' | 'individual'; contact_name: string; organization: string | null; email: string; status: string; participants_estimate: string | null }
interface Outcome { name: string; email: string; ok: boolean; text: string; tone: 'ok' | 'warn' | 'fail' }


export default function EnrollFromInquiry({ panel, inquiry, onConverted, onNoteAdded }: { panel: AdminPanel; inquiry: Inquiry; onConverted: () => Promise<void> | void; onNoteAdded?: () => Promise<void> | void }) {
  const isOrg = inquiry.kind === 'organization'
  const [cohortId, setCohortId] = useState(inquiry ? (enrollableCohortChoices(panel).find(c => !c.full)?.cohort.id ?? '') : '')
  const [single, setSingle] = useState<Row>({ name: inquiry.contact_name, email: inquiry.email })
  const [list, setList] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<Outcome[] | null>(null)

  const choices = enrollableCohortChoices(panel)
  const choice = choices.find(c => c.cohort.id === cohortId)
  const parsed = useMemo(() => isOrg ? parsePeople(list) : { rows: [single], problems: [] }, [isOrg, list, single])

  // What will happen for each person, before anything is sent.
  const preview = parsed.rows.map((r, i) => {
    const dupe = parsed.rows.findIndex(x => x.email === r.email) !== i
    const account = panel.users.find(u => (u.email ?? '').toLowerCase() === r.email.toLowerCase())
    const enr = account && cohortId ? panel.enrollments.find(e => e.user_id === account.id && e.cohort_id === cohortId) : undefined
    let plan: string; let takesSeat = true
    if (dupe) { plan = 'Listed twice: will be skipped'; takesSeat = false }
    else if (!account) plan = 'New: an account is created and an invitation sent'
    else if (account.role !== 'impact_participant') { plan = `Has a ${account.role === 'admin' ? 'administrator' : 'coaching'} account: enroll them from Participants instead`; takesSeat = false }
    else if (enr?.status === 'active' || enr?.status === 'completed') { plan = 'Already enrolled in this cohort: nothing will change'; takesSeat = false }
    else if (enr?.status === 'withdrawn') plan = 'Withdrew from this cohort before: will be re-enrolled'
    else plan = account.last_sign_in_at ? 'Has an account: enrolled and told by email' : 'Has an account but never signed in: enrolled and sent a set-up link'
    return { ...r, dupe, account, plan, takesSeat }
  })
  const seatsNeeded = preview.filter(p => p.takesSeat).length
  const seatsLeft = choice?.cohort.capacity != null ? choice.cohort.capacity - panel.enrollments.filter(e => e.cohort_id === cohortId && e.status === 'active').length : null
  const overCapacity = seatsLeft != null && seatsNeeded > seatsLeft

  const label = inquiry.organization || inquiry.contact_name
  const addNote = async (body: string): Promise<boolean> => {
    const { error: e } = await supabase.from('inquiry_notes').insert({ inquiry_id: inquiry.id, author_id: panel.me.id, body: body.slice(0, 4000) })
    if (!e) await onNoteAdded?.()
    return !e
  }

  const send = async () => {
    setError(null); setResults(null)
    if (!choice) { setError('Choose a cohort.'); return }
    if (choice.full) { setError(`${choice.cohort.name} is full. Raise its capacity in Cohorts first.`); return }
    const todo = preview.filter(p => !p.dupe)
    if (todo.length === 0) { setError(isOrg ? 'Add at least one person (name and email, one per line).' : 'Enter a name and a valid email.'); return }
    if (!isOrg && (!single.name.trim() || !EMAIL_RE.test(single.email.trim()))) { setError('Enter their name and a valid email.'); return }
    if (parsed.problems.length) { setError(`Fix these lines first: ${parsed.problems.join(' ')}`); return }
    if (overCapacity) { setError(`${choice.cohort.name} has ${seatsLeft} seat${seatsLeft === 1 ? '' : 's'} left, but ${seatsNeeded} people need one. Raise the capacity or remove some people.`); return }
    const reenroll = todo.some(p => p.plan.startsWith('Withdrew'))
    const yes = await panel.confirm({
      title: todo.length === 1 ? `Invite ${todo[0].name} to ${choice.cohort.name}?` : `Invite ${todo.length} people to ${choice.cohort.name}?`,
      message: todo.map(p => `${p.name} (${p.email})`).join(', '),
      consequences: [
        'New people get an email to set their password; people with an account are enrolled and told by email.',
        ...(reenroll ? ['Someone who withdrew earlier is re-enrolled.'] : []),
        'You will see the result for each person. The inquiry is not marked Converted unless you choose to.',
      ],
      confirmLabel: todo.length === 1 ? 'Send invitation' : `Invite ${todo.length} people`,
    })
    if (!yes) return
    setBusy(true)
    const out: Outcome[] = []
    for (const p of todo) {
      const r: InviteResult = await panel.invitePerson({ email: p.email, full_name: p.name, role: 'impact_participant', program_id: '', cohort_id: choice.cohort.id, inquiry_id: inquiry.id, reenroll: p.plan.startsWith('Withdrew') })
      const tone: Outcome['tone'] = !r.ok ? 'fail' : r.emailStatus === 'failed' || r.warnings.length ? 'warn' : 'ok'
      out.push({ name: p.name, email: p.email, ok: r.ok && r.outcome !== 'account_created', tone, text: [r.message, ...r.warnings].join(' ') })
    }
    const okCount = out.filter(o => o.ok).length
    const emailProblems = out.filter(o => o.ok && o.tone === 'warn').length
    const saved = await addNote(`${okCount} of ${out.length} ${out.length === 1 ? 'person' : 'people'} invited/enrolled in ${choice.cohort.name}.\n` + out.map(o => `• ${o.name} (${o.email}): ${o.ok ? 'done' : 'not done'}. ${o.text}`).join('\n'))
    setResults(out)
    setBusy(false)
    const where = saved ? 'Details are below and saved as a note.' : 'Details are below (the note could not be saved; copy them into a note).'
    if (okCount === out.length && emailProblems === 0) panel.ok(`${okCount === 1 ? out[0].name + ' is' : `All ${okCount} people are`} enrolled in ${choice.cohort.name}. ${where}`)
    else if (okCount === out.length) panel.fail(`${okCount === 1 ? out[0].name + ' is' : `All ${okCount} people are`} enrolled, but ${emailProblems === 1 ? '1 email was' : `${emailProblems} emails were`} not sent. Use Resend on the person's record. ${where}`)
    else panel.fail(`${out.length - okCount} of ${out.length} could not be completed. See the results below; the others are done.`)
    if (isOrg) setList('')
    await panel.fetchAll()
  }

  const markConverted = async () => {
    const { error: e } = await supabase.from('inquiries').update({ status: 'converted', updated_at: new Date().toISOString() }).eq('id', inquiry.id).select('id')
    if (e) { panel.fail(`The inquiry was not updated: ${e.message}`); return }
    panel.ok(`The inquiry from ${label} is marked Converted.`)
    await onConverted()
  }

  const anyOk = results?.some(r => r.ok)

  return (
    <div style={{ border: '1px solid var(--mist)', borderRadius: '6px', padding: '1rem', background: 'var(--paper)' }}>
      <h4 style={{ margin: '0 0 0.35rem', fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.1rem', letterSpacing: '0.05em', color: 'var(--navy)' }}>
        {isOrg ? 'Enroll employees in a cohort' : 'Invite to a cohort'}
      </h4>
      <p style={{ ...helpStyle, fontSize: '0.85rem', margin: '0 0 0.85rem' }}>
        {isOrg
          ? <>Add the people {label} wants to enroll{inquiry.participants_estimate ? ` (they estimated ${inquiry.participants_estimate})` : ''}. Paste one per line: <em>Name, email</em>. Existing accounts are recognised and nobody is invited twice.</>
          : <>Their name and email come from the inquiry. If they already have an account they are enrolled instead of invited.</>}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '0.75rem' }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label htmlFor={`enr-cohort-${inquiry.id}`} style={labelStyle}>Cohort</label>
          <select id={`enr-cohort-${inquiry.id}`} value={cohortId} onChange={e => { setCohortId(e.target.value); setError(null) }} style={inputStyle}>
            <option value="">Choose a cohort…</option>
            {choices.map(c => <option key={c.cohort.id} value={c.cohort.id} disabled={c.full}>{c.label}</option>)}
          </select>
          {choices.length === 0 && <p style={{ ...helpStyle, fontSize: '0.82rem', margin: '0.35rem 0 0' }}>No draft, upcoming or running cohorts. <Link href="/admin/cohorts" style={{ color: '#8a5a10', fontWeight: 600 }}>Create one in Cohorts →</Link></p>}
        </div>
        {isOrg ? (
          <div style={{ gridColumn: '1 / -1' }}>
            <label htmlFor={`enr-list-${inquiry.id}`} style={labelStyle}>People (one per line: Name, email)</label>
            <textarea id={`enr-list-${inquiry.id}`} value={list} onChange={e => { setList(e.target.value); setError(null) }} rows={5}
              placeholder={'Jordan Lee, jordan@example.org\nSam Rivera, sam@example.org'} style={{ ...inputStyle, fontFamily: 'var(--font-montserrat), sans-serif', resize: 'vertical' }} />
            <button type="button" onClick={() => setList(l => `${l}${l && !l.endsWith('\n') ? '\n' : ''}${inquiry.contact_name}, ${inquiry.email}`)} style={{ ...secondaryButtonStyle, marginTop: '0.4rem', minHeight: '40px' }}>
              + Add the contact ({inquiry.contact_name})
            </button>
          </div>
        ) : (
          <>
            <div>
              <label htmlFor={`enr-name-${inquiry.id}`} style={labelStyle}>Name</label>
              <input id={`enr-name-${inquiry.id}`} value={single.name} onChange={e => setSingle(s => ({ ...s, name: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label htmlFor={`enr-email-${inquiry.id}`} style={labelStyle}>Email</label>
              <input id={`enr-email-${inquiry.id}`} type="email" value={single.email} onChange={e => setSingle(s => ({ ...s, email: e.target.value.trim() }))} style={inputStyle} />
            </div>
          </>
        )}
      </div>

      {parsed.problems.length > 0 && <ul style={{ margin: '0.6rem 0 0', paddingLeft: '1.1rem', color: '#8c1d18', fontSize: '0.85rem' }}>{parsed.problems.map(p => <li key={p}>{p}</li>)}</ul>}

      {preview.length > 0 && cohortId && (
        <div style={{ marginTop: '0.85rem', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '420px', background: 'white' }}>
            <caption style={{ textAlign: 'left', fontSize: '0.85rem', color: overCapacity ? '#8c1d18' : 'var(--slate)', padding: '0 0 0.4rem' }}>
              What will happen{seatsLeft != null ? ` · ${seatsNeeded} of ${seatsLeft} remaining seats needed` : ' · no seat limit'}{overCapacity ? ': not enough seats' : ''}
            </caption>
            <thead><tr><th scope="col" style={thStyle}>Person</th><th scope="col" style={thStyle}>Plan</th></tr></thead>
            <tbody>{preview.map((p, i) => (
              <tr key={`${p.email}-${i}`}>
                <td style={tdStyle}><strong>{p.name}</strong><span style={{ display: 'block', color: 'var(--slate)', fontSize: '0.8rem', overflowWrap: 'anywhere' }}>{p.email}</span></td>
                <td style={{ ...tdStyle, color: p.takesSeat ? 'var(--ink)' : 'var(--slate)' }}>{p.plan}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.85rem', alignItems: 'center' }}>
        <button type="button" onClick={() => void send()} disabled={busy || !cohortId || seatsNeeded === 0} className="btn btn-primary" style={{ fontSize: '0.82rem', padding: '0.65rem 1.1rem' }}>
          {busy ? 'Working…' : isOrg ? `Invite ${seatsNeeded || ''} ${seatsNeeded === 1 ? 'person' : 'people'}`.replace('  ', ' ') : 'Send invitation'}
        </button>
        {!cohortId && <span style={{ fontSize: '0.82rem', color: 'var(--slate)' }}>Choose a cohort first.</span>}
        {cohortId && seatsNeeded === 0 && preview.length > 0 && <span style={{ fontSize: '0.82rem', color: 'var(--slate)' }}>Nobody in the list needs an invitation.</span>}
      </div>
      <InlineError message={error} />

      {results && (
        <div role="status" style={{ marginTop: '1rem' }}>
          <strong style={{ color: 'var(--navy)', fontSize: '0.92rem' }}>Results ({results.filter(r => r.ok).length} of {results.length} done)</strong>
          <ul style={{ listStyle: 'none', margin: '0.4rem 0 0', padding: 0 }}>
            {results.map(r => (
              <li key={r.email} style={{ padding: '0.5rem 0', borderTop: '1px solid var(--mist)', fontSize: '0.86rem', lineHeight: 1.5 }}>
                {statusBadge(r.tone === 'ok' ? 'open' : r.tone === 'warn' ? 'pending' : 'full', r.tone === 'ok' ? 'Done' : r.tone === 'warn' ? 'Done, check email' : 'Not done')}{' '}
                <strong>{r.name}</strong> ({r.email}): {r.text}
              </li>
            ))}
          </ul>
          {anyOk && inquiry.status !== 'converted' && (
            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button type="button" onClick={() => void markConverted()} style={{ ...secondaryButtonStyle, minHeight: '44px' }}>Mark this inquiry Converted</button>
              <span style={{ fontSize: '0.82rem', color: 'var(--slate)' }}>{isOrg ? 'Or keep it open while more employees are added.' : 'Optional; you can also do it later.'}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
