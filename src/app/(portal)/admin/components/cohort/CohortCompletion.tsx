// Completion & certificates. Completion is Tramaine's decision for each participant: the
// weekly-rep and attendance numbers are shown only to inform it. Nothing is marked complete
// and no certificate is issued unless an administrator chooses to.
import { useState } from 'react'
import type { Certificate } from '@/types'
import { formatDateET, todayET } from '@/lib/business-time'
import { InlineError } from '../feedback'
import { dangerLinkStyle, inputStyle, labelStyle, linkButtonStyle, secondaryButtonStyle, statusBadge } from '../shared'
import { inlineLinkStyle, metaStyle, panelBoxStyle, plural, smallButtonStyle, subheadStyle, type CohortSectionProps } from './ui'
import { assignedParticipants, currentReps, personAttendance } from './participation'
import { useCohortParticipation } from './useParticipation'
import { SignatureNote, useCertificateSignature } from '../certificates/SignatureSettings'

type RowAction = { kind: 'complete' | 'issue' | 'revoke'; enrollmentId: string } | null
interface BulkResult { name: string; ok: boolean; message: string }

const pdfHref = (id: string, inline = false) => `/api/certificates/${id}/pdf${inline ? '?inline=1' : ''}`

export default function CohortCompletion({ panel, cohort }: CohortSectionProps) {
  const participation = useCohortParticipation(cohort.id)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [action, setAction] = useState<RowAction>(null)
  const [note, setNote] = useState('')
  const [reason, setReason] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rowErrors, setRowErrors] = useState<Record<string, string | null>>({})
  const signature = useCertificateSignature().value
  const [bulkBusy, setBulkBusy] = useState<string | null>(null)
  const [results, setResults] = useState<{ title: string; items: BulkResult[]; skipped: number } | null>(null)

  const today = todayET()
  // Completed and Archived cohorts have ended; an In progress one has not until its end date passes.
  const notEnded = cohort.status === 'active' && (!cohort.end_date || cohort.end_date >= today)
  const endWarning = notEnded
    ? `This cohort has not ended yet${cohort.end_date ? ` (it ends ${formatDateET(cohort.end_date)})` : ''}. You can still record completion now if you are sure.`
    : null

  const people = assignedParticipants(cohort.id, panel.enrollments, panel.users)
  const reps = currentReps(cohort.id, panel.reps)
  const submittedBy = (userId: string) => participation.rows
    ? reps.filter(r => participation.rows!.some(x => x.rep_id === r.id && x.user_id === userId)).length
    : null

  const certsFor = (userId: string): Certificate[] => panel.certificates.filter(c => c.user_id === userId && c.cohort_id === cohort.id)
  const enrollment = (id: string) => panel.enrollments.find(e => e.id === id)
  const adminName = (id: string | null | undefined) => !id ? null : id === panel.me.id ? panel.me.name : panel.users.find(u => u.id === id)?.full_name || 'an administrator'

  const rows = people.map(p => {
    const e = enrollment(p.enrollmentId)
    const certs = certsFor(p.userId)
    const valid = certs.find(c => !c.revoked_at) ?? null
    const completed = p.status === 'completed'
    return {
      p, e, certs, valid, completed,
      canComplete: p.status === 'active',
      canIssue: completed && certs.length === 0,
      revokedOnly: completed && certs.length > 0 && !valid,
    }
  })
  const eligibleComplete = rows.filter(r => selected.has(r.p.enrollmentId) && r.canComplete)
  const eligibleIssue = rows.filter(r => selected.has(r.p.enrollmentId) && r.canIssue)
  const allSelected = rows.length > 0 && rows.every(r => selected.has(r.p.enrollmentId))

  const toggleSelect = (id: string, on: boolean) => setSelected(prev => { const next = new Set(prev); if (on) next.add(id); else next.delete(id); return next })
  const openAction = (next: RowAction) => { setAction(next); setNote(''); setReason('') }
  const runRow = async (enrollmentId: string, fn: () => Promise<string | null>) => {
    setBusyId(enrollmentId)
    const err = await fn()
    setRowErrors(prev => ({ ...prev, [enrollmentId]: err }))
    setBusyId(null)
    if (!err) setAction(null)
  }

  const undo = async (enrollmentId: string, name: string) => {
    if (!(await panel.confirm({
      title: `Undo completion for ${name}?`,
      message: `${name} will be listed as enrolled in ${cohort.name} again.`,
      consequences: ['The completion date, the name of who recorded it and the note are cleared.', 'You can mark them complete again later.'],
      confirmLabel: 'Undo completion',
      danger: true,
    }))) return
    await runRow(enrollmentId, () => panel.handleUndoCompletion(enrollmentId))
  }

  const revoke = async (enrollmentId: string, cert: Certificate, name: string) => {
    if (!reason.trim()) { setRowErrors(prev => ({ ...prev, [enrollmentId]: 'Give a short reason (kept in the record).' })); return }
    if (!(await panel.confirm({
      title: `Revoke certificate ${cert.certificate_number ?? ''}?`,
      message: `${name}’s certificate for ${cohort.name}.`,
      consequences: ['They no longer see it in their portal.', 'The record and your reason are kept.', 'A new certificate for this cohort cannot be issued from this screen afterwards.'],
      confirmLabel: 'Revoke certificate',
      danger: true,
    }))) return
    await runRow(enrollmentId, () => panel.handleRevokeCertificate(cert.id, reason))
  }

  const bulkComplete = async () => {
    const list = eligibleComplete
    if (!list.length) return
    const skipped = selected.size - list.length
    if (!(await panel.confirm({
      title: `Mark ${plural(list.length, 'participant')} complete?`,
      message: list.map(r => r.p.name).join(', '),
      consequences: [
        ...(endWarning ? [endWarning] : []),
        'Each is recorded with today’s date and your name. You can undo each one individually.',
        ...(skipped > 0 ? [`${plural(skipped, 'selected person', 'selected people')} already completed will be skipped.`] : []),
      ],
      confirmLabel: 'Mark complete',
    }))) return
    setBulkBusy('complete')
    const items: BulkResult[] = []
    for (const r of list) {
      const err = await panel.handleCompleteEnrollment(r.p.enrollmentId, undefined, { quiet: true })
      items.push({ name: r.p.name, ok: !err, message: err ?? 'Marked complete.' })
    }
    await panel.fetchAll()
    setBulkBusy(null)
    setResults({ title: 'Mark selected complete', items, skipped })
    setSelected(new Set())
  }

  const bulkIssue = async () => {
    const list = eligibleIssue
    if (!list.length) return
    const skipped = selected.size - list.length
    if (!(await panel.confirm({
      title: `Issue ${plural(list.length, 'certificate')}?`,
      message: list.map(r => r.p.name).join(', '),
      consequences: [
        'Each person can view and download their certificate in their portal right away.',
        signature?.approved ? `Each certificate carries the approved signature of ${signature.signer_name}.` : 'The certificates have no signature (the signature design is not approved yet).',
        ...(skipped > 0 ? [`${plural(skipped, 'selected person', 'selected people')} without recorded completion, or who already have a certificate, will be skipped.`] : []),
      ],
      confirmLabel: 'Issue certificates',
    }))) return
    setBulkBusy('issue')
    const items: BulkResult[] = []
    for (const r of list) {
      const err = await panel.handleIssueCertificate(r.p.userId, cohort.id, null, { quiet: true })
      items.push({ name: r.p.name, ok: !err, message: err ?? 'Certificate issued.' })
    }
    await panel.fetchAll()
    setBulkBusy(null)
    setResults({ title: 'Issue certificates to selected', items, skipped })
    setSelected(new Set())
  }

  const completedCount = rows.filter(r => r.completed).length
  const certCount = rows.filter(r => r.valid).length

  return (
    <div>
      <p style={{ color: 'var(--ink)', fontSize: '0.9rem', lineHeight: 1.6, margin: '0 0 0.5rem' }}>
        Whether someone completed the program is your decision. The weekly reps and attendance numbers are here to inform it; nothing is marked complete
        and no certificate is issued unless you choose to.
      </p>
      <p style={{ ...metaStyle, margin: '0 0 0.75rem' }}>
        {completedCount} of {plural(rows.length, 'participant')} completed · {plural(certCount, 'certificate')} issued.
        {participation.error && <> Weekly rep numbers could not be loaded ({participation.error}). <button type="button" onClick={() => void participation.reload()} style={{ ...linkButtonStyle, fontSize: '0.85rem' }}>Try again</button></>}
      </p>

      {rows.length === 0 ? <p style={metaStyle}>Nobody is enrolled in this cohort.</p> : (
        <>
          <div style={{ ...panelBoxStyle, marginTop: 0, marginBottom: '0.75rem' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem', color: 'var(--navy)', fontWeight: 600, cursor: 'pointer' }}>
              <input type="checkbox" checked={allSelected} onChange={e => setSelected(e.target.checked ? new Set(rows.map(r => r.p.enrollmentId)) : new Set())} style={{ width: '18px', height: '18px' }} />
              Select everyone ({selected.size} selected)
            </label>
            {selected.size > 0 && (
              <div style={{ marginTop: '0.75rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-primary" onClick={() => void bulkComplete()} disabled={!eligibleComplete.length || !!bulkBusy} style={smallButtonStyle}>
                    {bulkBusy === 'complete' ? 'Marking…' : `Mark selected complete (${eligibleComplete.length})`}
                  </button>
                  <button type="button" onClick={() => void bulkIssue()} disabled={!eligibleIssue.length || !!bulkBusy} style={{ ...secondaryButtonStyle, minHeight: '40px' }}>
                    {bulkBusy === 'issue' ? 'Issuing…' : `Issue certificates to selected (${eligibleIssue.length})`}
                  </button>
                </div>
                <p style={{ ...metaStyle, fontSize: '0.8rem', margin: '0.4rem 0 0' }}>Only eligible people are included: completion can be marked for people still in progress; certificates go to people whose completion is recorded and who have none yet.</p>
                {eligibleIssue.length > 0 && <SignatureNote signature={signature} />}
              </div>
            )}
          </div>

          {results && (
            <div role="status" style={{ ...panelBoxStyle, marginTop: 0, marginBottom: '0.75rem', background: 'white' }}>
              <h4 style={subheadStyle}>{results.title}: {results.items.filter(i => i.ok).length} done{results.items.some(i => !i.ok) ? `, ${results.items.filter(i => !i.ok).length} not done` : ''}</h4>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.86rem', lineHeight: 1.7 }}>
                {results.items.map((i, idx) => (
                  <li key={`${idx}-${i.name}`} style={{ color: i.ok ? 'var(--ink)' : '#8c1d18' }}>
                    <strong>{i.ok ? 'Done' : 'Not done'}:</strong> {i.name} — {i.message}
                  </li>
                ))}
              </ul>
              {results.skipped > 0 && <p style={{ ...metaStyle, margin: '0.4rem 0 0' }}>{plural(results.skipped, 'selected person was', 'selected people were')} not eligible and skipped.</p>}
              <button type="button" onClick={() => setResults(null)} style={{ ...linkButtonStyle, marginTop: '0.5rem' }}>Dismiss</button>
            </div>
          )}

          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {rows.map(({ p, e, valid, completed, canComplete, canIssue, revokedOnly, certs }) => {
              const busy = busyId === p.enrollmentId
              const submitted = submittedBy(p.userId)
              const att = personAttendance(cohort.id, p.userId, panel.attendance)
              const mine = action?.enrollmentId === p.enrollmentId ? action.kind : null
              const fid = (f: string) => `completion-${p.enrollmentId}-${f}`
              const badge = completed ? 'Completed' : cohort.status === 'active' ? 'In progress' : 'Finished · not recorded'
              const statusText = completed
                ? `Completed${e?.completed_at ? ` on ${formatDateET(e.completed_at)}` : ''}${adminName(e?.completed_by) ? ` by ${adminName(e?.completed_by)}` : ''}.`
                : cohort.status === 'active' ? null : 'The cohort has finished; completion is not recorded yet.'
              return (
                <li key={p.enrollmentId} style={{ borderBottom: '1px solid var(--mist)', padding: '0.85rem 0' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <input type="checkbox" checked={selected.has(p.enrollmentId)} onChange={ev => toggleSelect(p.enrollmentId, ev.target.checked)}
                      aria-label={`Select ${p.name}`} style={{ width: '20px', height: '20px', marginTop: '0.15rem', flexShrink: 0 }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem 1rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
                        <span style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.93rem', overflowWrap: 'anywhere' }}>{p.name}</span>
                        {statusBadge(completed ? 'completed' : cohort.status === 'active' ? 'in_progress' : 'pending', badge)}
                      </div>
                      {statusText && <p style={{ ...metaStyle, margin: '0.2rem 0 0', color: 'var(--ink)' }}>{statusText}</p>}
                      <p style={{ ...metaStyle, margin: '0.2rem 0 0' }}>
                        Weekly reps: {submitted == null ? (participation.loading ? 'loading…' : 'not available') : `${submitted} of ${reps.length} submitted`}
                        {att.recorded > 0 && <> · Attendance: {att.attended} of {plural(att.recorded, 'recorded session')}</>}
                      </p>
                      {completed && e?.completion_note && <p style={{ ...metaStyle, margin: '0.2rem 0 0', fontStyle: 'italic', overflowWrap: 'anywhere' }}>Note: {e.completion_note}</p>}

                      {valid && (
                        <p style={{ margin: '0.35rem 0 0', fontSize: '0.86rem', color: 'var(--ink)' }}>
                          Certificate <strong>{valid.certificate_number ?? '(number pending)'}</strong>
                          {valid.issued_at && <span style={{ color: 'var(--slate)' }}> · issued {formatDateET(valid.issued_at)}</span>}
                          {' · '}<a href={pdfHref(valid.id, true)} target="_blank" rel="noopener noreferrer" style={inlineLinkStyle}>View<span className="sr-only"> certificate for {p.name} (opens in a new tab)</span></a>
                          {' · '}<a href={pdfHref(valid.id)} style={inlineLinkStyle}>Download<span className="sr-only"> certificate for {p.name}</span></a>
                        </p>
                      )}
                      {revokedOnly && (
                        <p style={{ ...metaStyle, margin: '0.35rem 0 0' }}>
                          Certificate {certs[0].certificate_number ?? ''} was revoked{certs[0].revoked_at ? ` on ${formatDateET(certs[0].revoked_at)}` : ''}. A new one cannot be issued from here.
                        </p>
                      )}

                      <div style={{ display: 'flex', gap: '0.5rem 1.25rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.5rem' }}>
                        {canComplete && !mine && (
                          <button type="button" onClick={() => openAction({ kind: 'complete', enrollmentId: p.enrollmentId })} disabled={busy} style={{ ...secondaryButtonStyle, minHeight: '40px' }}>Mark complete</button>
                        )}
                        {canIssue && !mine && (
                          <button type="button" onClick={() => openAction({ kind: 'issue', enrollmentId: p.enrollmentId })} disabled={busy} style={{ ...secondaryButtonStyle, minHeight: '40px' }}>Issue certificate</button>
                        )}
                        {completed && !valid && !mine && (
                          <button type="button" onClick={() => void undo(p.enrollmentId, p.name)} disabled={busy} style={{ ...linkButtonStyle, padding: '0.5rem 0' }}>{busy ? 'Working…' : 'Undo completion'}</button>
                        )}
                        {completed && valid && <span style={{ ...metaStyle, fontSize: '0.8rem' }}>To undo completion, revoke the certificate first.</span>}
                      </div>

                      {mine === 'complete' && (
                        <div style={{ ...panelBoxStyle, marginTop: '0.6rem' }}>
                          <h4 style={subheadStyle}>Mark {p.name} complete?</h4>
                          {endWarning && <p role="note" style={{ ...metaStyle, color: '#8c1d18', margin: '0 0 0.6rem' }}><strong>Note:</strong> {endWarning}</p>}
                          <label htmlFor={fid('note')} style={labelStyle}>Note (optional)</label>
                          <textarea id={fid('note')} value={note} onChange={ev => setNote(ev.target.value)} rows={2} maxLength={500} style={{ ...inputStyle, resize: 'vertical' }}
                            placeholder="e.g. Completed all sessions; make-up rep for week 3 accepted" />
                          <p style={{ ...metaStyle, fontSize: '0.8rem', margin: '0.3rem 0 0' }}>Recorded with today’s date and your name. You can undo it later.</p>
                          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void runRow(p.enrollmentId, () => panel.handleCompleteEnrollment(p.enrollmentId, note))} style={smallButtonStyle}>
                              {busy ? 'Saving…' : 'Mark complete'}
                            </button>
                            <button type="button" onClick={() => setAction(null)} disabled={busy} style={secondaryButtonStyle}>Cancel</button>
                          </div>
                        </div>
                      )}

                      {mine === 'issue' && (
                        <div style={{ ...panelBoxStyle, marginTop: '0.6rem' }}>
                          <h4 style={subheadStyle}>Issue a certificate to {p.name}?</h4>
                          <p style={{ ...metaStyle, margin: 0 }}>For {cohort.name}. The number, names, pathway and completion date are filled in automatically. They can view and download it in their portal right away.</p>
                          <SignatureNote signature={signature} />
                          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void runRow(p.enrollmentId, () => panel.handleIssueCertificate(p.userId, cohort.id, null))} style={smallButtonStyle}>
                              {busy ? 'Issuing…' : 'Issue certificate'}
                            </button>
                            <button type="button" onClick={() => setAction(null)} disabled={busy} style={secondaryButtonStyle}>Cancel</button>
                          </div>
                        </div>
                      )}

                      {valid && (
                        <details style={{ marginTop: '0.5rem' }} open={mine === 'revoke' || undefined}>
                          <summary style={{ ...metaStyle, fontSize: '0.8rem', cursor: 'pointer', padding: '0.3rem 0' }}>Certificate options</summary>
                          {mine === 'revoke' ? (
                            <div style={{ ...panelBoxStyle, marginTop: '0.4rem', borderColor: 'rgba(179,38,30,0.3)' }}>
                              <label htmlFor={fid('reason')} style={labelStyle}>Reason for revoking (kept in the record)</label>
                              <input id={fid('reason')} value={reason} onChange={ev => setReason(ev.target.value)} maxLength={300} style={inputStyle} placeholder="e.g. Issued by mistake" />
                              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
                                <button type="button" onClick={() => void revoke(p.enrollmentId, valid, p.name)} disabled={busy} style={{ ...secondaryButtonStyle, color: '#b3261e', borderColor: 'rgba(179,38,30,0.4)', minHeight: '40px' }}>
                                  {busy ? 'Revoking…' : 'Revoke certificate'}
                                </button>
                                <button type="button" onClick={() => setAction(null)} disabled={busy} style={secondaryButtonStyle}>Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <button type="button" onClick={() => openAction({ kind: 'revoke', enrollmentId: p.enrollmentId })} style={{ ...dangerLinkStyle, fontSize: '0.8rem', padding: '0.4rem 0' }}>Revoke this certificate…</button>
                          )}
                        </details>
                      )}
                      <InlineError message={rowErrors[p.enrollmentId]} />
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
