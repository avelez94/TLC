'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { friendlyError, type DbError } from '@/lib/admin-errors'
import { csvDateTimeET, formatDateET, formatDateTimeET, todayET } from '@/lib/business-time'
import { downloadCsv, toCsv } from '@/lib/csv'
import { DEFAULT_PATHWAYS } from '@/lib/pathways'
import type { AdminPanel } from '../useAdminPanel'
import { InlineError, SaveStatus, useSaveStates } from './feedback'
import { cardStyle, helpStyle, inputStyle, labelStyle, pageTitleStyle, secondaryButtonStyle, statusBadge } from './shared'

interface Inquiry {
  id: string; kind: 'organization' | 'individual'; contact_name: string; organization: string | null
  email: string; phone: string | null; organization_type: string | null; pathways: string[] | null
  participants_estimate: string | null; timeline: string | null; message: string | null
  status: string; follow_up_on: string | null; created_at: string; updated_at: string
}
interface Note { id: string; body: string; created_at: string; author_id: string | null }

const STATUSES: { value: string; label: string; badge: string }[] = [
  { value: 'new', label: 'New', badge: 'active' },
  { value: 'contacted', label: 'Contacted', badge: 'upcoming' },
  { value: 'qualified', label: 'Qualified', badge: 'confirmed' },
  { value: 'follow_up', label: 'Follow-up needed', badge: 'waitlist' },
  { value: 'converted', label: 'Converted', badge: 'open' },
  { value: 'closed', label: 'Closed', badge: 'completed' },
]
const statusLabel = (v: string) => STATUSES.find(s => s.value === v)?.label ?? 'Unknown'
const isOpen = (status: string) => status !== 'converted' && status !== 'closed'
const FULL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** A complete, real calendar date with a plausible year (never a half-typed one such as 0202-…). */
function isFullDate(v: string): boolean {
  const m = FULL_DATE.exec(v)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (y < 2000 || y > 2100) return false
  const dt = new Date(Date.UTC(y, mo - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
}

const chipStyle = (on: boolean) => ({
  padding: '0.5rem 0.85rem', borderRadius: '3px', border: '1.5px solid rgba(0,23,55,0.15)', background: on ? 'var(--navy)' : 'white',
  color: on ? 'white' : 'var(--navy)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-montserrat), sans-serif',
})

export default function InquiriesTab(panel: AdminPanel) {
  const { programs, users } = panel
  const [rows, setRows] = useState<Inquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [statusFilter, setStatusFilter] = useState('open')
  const [kindFilter, setKindFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  const [notes, setNotes] = useState<Note[]>([])
  const [notesError, setNotesError] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [noteBusy, setNoteBusy] = useState(false)
  const [noteError, setNoteError] = useState<string | null>(null)

  const [followDraft, setFollowDraft] = useState<Record<string, string>>({})
  const [followHint, setFollowHint] = useState<Record<string, string | null>>({})
  const savingFollow = useRef<Record<string, string>>({})
  const saves = useSaveStates()

  const today = todayET()

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('inquiries').select('*').order('created_at', { ascending: false })
    if (error) setLoadError(`Inquiries could not be loaded: ${friendlyError(error)}`)
    else { setRows(data as Inquiry[]); setLoadError('') }
    setLoading(false)
  }, [])
  useEffect(() => { void Promise.resolve().then(load) }, [load])

  const loadNotes = useCallback(async (id: string) => {
    setNotesError(null)
    const { data, error } = await supabase.from('inquiry_notes').select('id, body, created_at, author_id').eq('inquiry_id', id).order('created_at', { ascending: false })
    if (error) { setNotesError(`Notes could not be loaded: ${friendlyError(error)}`); return }
    setNotes((data as Note[]) ?? [])
  }, [])

  const pathwayName = useCallback((slug: string) => {
    if (slug === 'unsure') return 'Not sure yet'
    return programs.find(p => p.slug === slug)?.name ?? DEFAULT_PATHWAYS.find(p => p.slug === slug)?.name ?? 'Another pathway'
  }, [programs])
  const pathwayList = (r: Inquiry) => (r.pathways ?? []).map(pathwayName).join(', ')
  const labelOf = (r: Inquiry) => (r.organization?.trim() ? r.organization : r.contact_name)
  const author = (id: string | null) => {
    const u = users.find(x => x.id === id)
    return u?.full_name || u?.email || 'An administrator'
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r =>
      (statusFilter === 'all' || (statusFilter === 'open' ? isOpen(r.status) : r.status === statusFilter)) &&
      (kindFilter === 'all' || r.kind === kindFilter) &&
      (!q || [r.contact_name, r.organization, r.email].some(v => (v ?? '').toLowerCase().includes(q))))
  }, [rows, statusFilter, kindFilter, search])

  const counts = useMemo(() => Object.fromEntries(STATUSES.map(s => [s.value, rows.filter(r => r.status === s.value).length])), [rows])
  const openCount = rows.filter(r => isOpen(r.status)).length

  /** Saves a change to one inquiry. Returns an error message, or null when saved. */
  const saveInquiry = async (r: Inquiry, patch: Partial<Pick<Inquiry, 'status' | 'follow_up_on'>>): Promise<string | null> => {
    let error: DbError | null = null
    let updated = 0
    try {
      const res = await supabase.from('inquiries').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', r.id).select('id')
      error = res.error
      updated = res.data?.length ?? 0
    } catch (e) { error = { message: e instanceof Error ? e.message : String(e) } }
    if (!error && updated === 0) error = { code: '42501', message: 'permission denied' }
    if (error) {
      const msg = friendlyError(error)
      panel.fail(`The inquiry from ${labelOf(r)} was not updated: ${msg}`)
      await panel.logFailure('inquiry.update', 'inquiry', r.id, labelOf(r), msg)
      return msg
    }
    setRows(prev => prev.map(x => x.id === r.id ? { ...x, ...patch } : x))
    await panel.fetchAll()
    return null
  }

  const changeStatus = async (r: Inquiry, status: string) => {
    if (status === r.status) return
    const previous = r.status
    setRows(prev => prev.map(x => x.id === r.id ? { ...x, status } : x)) // show the choice while it saves
    const saved = await saves.track(`status-${r.id}`, () => saveInquiry(r, { status }))
    if (!saved) setRows(prev => prev.map(x => x.id === r.id ? { ...x, status: previous } : x))
  }

  const saveFollowUp = async (r: Inquiry, value: string) => {
    const next = value || null
    if (next === (r.follow_up_on ?? null)) return
    if (savingFollow.current[r.id] === value) return
    savingFollow.current[r.id] = value
    await saves.track(`follow-${r.id}`, () => saveInquiry(r, { follow_up_on: next }))
    delete savingFollow.current[r.id]
  }

  const onFollowChange = (r: Inquiry, input: HTMLInputElement) => {
    const value = input.value
    setFollowDraft(d => ({ ...d, [r.id]: value }))
    setFollowHint(h => ({ ...h, [r.id]: null }))
    // Saves only a complete date (or a cleared field); half-typed dates wait for the field to be left.
    if (isFullDate(value) || (value === '' && !input.validity.badInput)) void saveFollowUp(r, value)
  }

  const onFollowBlur = (r: Inquiry, input: HTMLInputElement) => {
    const value = input.value
    if (input.validity.badInput || (value && !isFullDate(value))) {
      setFollowHint(h => ({ ...h, [r.id]: 'Enter a complete date (month, day and year), or clear the field. Nothing was saved.' }))
      return
    }
    void saveFollowUp(r, value)
  }

  const addNote = async (r: Inquiry) => {
    const body = noteDraft.trim()
    if (!body) return
    setNoteBusy(true); setNoteError(null)
    let error: DbError | null = null
    try {
      const res = await supabase.from('inquiry_notes').insert({ inquiry_id: r.id, author_id: panel.me.id, body }).select('id')
      error = res.error
      if (!error && !res.data?.length) error = { code: '42501', message: 'permission denied' }
    } catch (e) { error = { message: e instanceof Error ? e.message : String(e) } }
    if (error) {
      const msg = friendlyError(error)
      setNoteError(`The note was not saved: ${msg}`)
      await panel.logFailure('inquiry_note.create', 'inquiry_note', r.id, labelOf(r), msg)
    } else {
      setNoteDraft('')
      panel.ok('Note added.')
      await loadNotes(r.id)
    }
    setNoteBusy(false)
  }

  const toggle = (r: Inquiry) => {
    const next = openId === r.id ? null : r.id
    setOpenId(next)
    setNoteDraft(''); setNoteError(null); setNotes([]); setNotesError(null)
    if (next) void loadNotes(next)
  }

  const exportCsv = () => {
    const csv = toCsv(
      ['Received (ET)', 'Type', 'Status', 'Contact name', 'Organization', 'Email', 'Phone', 'Organization type', 'Pathways', 'Participants (estimate)', 'Timeline', 'Follow up on', 'Message'],
      visible.map(r => [
        csvDateTimeET(r.created_at), r.kind === 'organization' ? 'Organization' : 'Individual', statusLabel(r.status), r.contact_name, r.organization,
        r.email, r.phone, r.organization_type, (r.pathways ?? []).map(pathwayName).join('; '), r.participants_estimate, r.timeline, r.follow_up_on, r.message,
      ]),
    )
    downloadCsv(`inquiries-${todayET()}.csv`, csv)
  }

  const filters = [
    { value: 'open', label: `Open (${openCount})` },
    ...STATUSES.map(s => ({ value: s.value, label: `${s.label} (${counts[s.value] ?? 0})` })),
    { value: 'all', label: `All (${rows.length})` },
  ]

  return (
    <div>
      <span style={labelStyle}>People</span>
      <h1 style={pageTitleStyle}>Inquiries</h1>
      <p style={{ ...helpStyle, maxWidth: '46rem' }}>
        Organization and individual inquiries from the Impact Lab page. Update the status as you follow up, set a follow-up date, and keep notes here so nothing is lost.
        Changes save as soon as you make them. Times are New York time (ET).
      </p>

      <div role="group" aria-label="Filter by status" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {filters.map(f => (
          <button key={f.value} type="button" onClick={() => setStatusFilter(f.value)} aria-pressed={statusFilter === f.value} style={chipStyle(statusFilter === f.value)}>{f.label}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1.25rem' }}>
        <div style={{ flex: '1 1 240px' }}>
          <label htmlFor="inq-search" style={labelStyle}>Search</label>
          <input id="inq-search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, organization or email" style={inputStyle} />
        </div>
        <div>
          <label htmlFor="inq-kind" style={labelStyle}>Type</label>
          <select id="inq-kind" value={kindFilter} onChange={e => setKindFilter(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
            <option value="all">All</option><option value="organization">Organizations</option><option value="individual">Individuals</option>
          </select>
        </div>
        <button type="button" onClick={exportCsv} disabled={visible.length === 0} style={{ ...secondaryButtonStyle, padding: '0.75rem 1rem', opacity: visible.length ? 1 : 0.5 }}>
          Export CSV ({visible.length})
        </button>
      </div>
      <p style={{ ...helpStyle, fontSize: '0.82rem', marginTop: '-0.5rem' }}>The export includes the inquiries shown with the current filters. Notes are not exported.</p>

      {loading && <p style={{ color: 'var(--slate)' }}>Loading inquiries…</p>}
      {loadError && (
        <div role="alert" style={{ ...cardStyle, borderLeft: '3px solid #b3261e', color: '#7a1a14' }}>
          {loadError}{' '}
          <button type="button" onClick={() => { setLoading(true); void load() }} style={{ ...secondaryButtonStyle, marginLeft: '0.5rem' }}>Try again</button>
        </div>
      )}
      {!loading && !loadError && visible.length === 0 && <div style={{ ...cardStyle, textAlign: 'center', color: 'var(--slate)' }}>No inquiries match these filters.</div>}

      {visible.map(r => {
        const open = openId === r.id
        const due = !!r.follow_up_on && r.follow_up_on <= today && isOpen(r.status)
        const st = STATUSES.find(s => s.value === r.status)
        const followValue = followDraft[r.id] ?? r.follow_up_on ?? ''
        const details: [string, string | null][] = [
          ['Email', r.email], ['Phone', r.phone], ['Organization type', r.organization_type],
          ['Participants (estimate)', r.participants_estimate], ['Timeline', r.timeline], ['Pathways', pathwayList(r) || null],
        ]
        return (
          <div key={r.id} style={{ ...cardStyle, padding: 0, borderLeft: `4px solid ${due ? '#b3261e' : r.status === 'new' ? 'var(--gold)' : 'var(--mist)'}` }}>
            <button type="button" onClick={() => toggle(r)} aria-expanded={open}
              style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '1.1rem 1.25rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', fontFamily: 'inherit' }}>
              <span style={{ flex: '1 1 14rem', minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 700, color: 'var(--navy)', overflowWrap: 'anywhere' }}>{r.kind === 'organization' && r.organization ? r.organization : r.contact_name}</span>
                <span style={{ fontSize: '0.84rem', color: 'var(--slate)', lineHeight: 1.5 }}>
                  {r.kind === 'organization' ? `${r.contact_name} · Organization` : 'Individual'}
                  {pathwayList(r) ? ` · ${pathwayList(r)}` : ''} · received {formatDateTimeET(r.created_at)}
                </span>
              </span>
              <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {due && statusBadge('full', r.follow_up_on === today ? 'Follow-up due today' : 'Follow-up due')}
                {statusBadge(st?.badge ?? 'pending', statusLabel(r.status))}
                <span aria-hidden="true" style={{ color: 'var(--slate)' }}>{open ? '▴' : '▾'}</span>
              </span>
            </button>
            {open && (
              <div style={{ padding: '0 1.25rem 1.25rem', borderTop: '1px solid var(--mist)' }}>
                <div className="two-col-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginTop: '1rem' }}>
                  <dl style={{ margin: 0, display: 'grid', gap: '0.45rem', fontSize: '0.9rem', minWidth: 0 }}>
                    {details.filter(([, v]) => v).map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <dt style={{ color: 'var(--slate)', minWidth: '9.5rem' }}>{k}</dt>
                        <dd style={{ margin: 0, color: 'var(--ink)', overflowWrap: 'anywhere' }}>{k === 'Email' ? <a href={`mailto:${v}`} style={{ color: '#8a5a10' }}>{v}</a> : v}</dd>
                      </div>
                    ))}
                    {r.message && <div><dt style={{ color: 'var(--slate)' }}>Message</dt><dd style={{ margin: '0.25rem 0 0', whiteSpace: 'pre-wrap', color: 'var(--ink)', overflowWrap: 'anywhere' }}>{r.message}</dd></div>}
                  </dl>
                  <div style={{ display: 'grid', gap: '1rem', alignContent: 'start' }}>
                    <div>
                      <label htmlFor={`st-${r.id}`} style={labelStyle}>Status<SaveStatus state={saves.get(`status-${r.id}`)} /></label>
                      <select id={`st-${r.id}`} value={r.status} disabled={saves.get(`status-${r.id}`).status === 'saving'}
                        onChange={e => void changeStatus(r, e.target.value)} style={inputStyle}>
                        {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`fu-${r.id}`} style={labelStyle}>Follow up on<SaveStatus state={saves.get(`follow-${r.id}`)} /></label>
                      <input id={`fu-${r.id}`} type="date" value={followValue}
                        onChange={e => onFollowChange(r, e.currentTarget)} onBlur={e => onFollowBlur(r, e.currentTarget)} style={inputStyle} />
                      {followValue && isFullDate(followValue) && followValue === (r.follow_up_on ?? '') && (
                        <p style={{ ...helpStyle, fontSize: '0.82rem', margin: '0.35rem 0 0' }}>
                          {formatDateET(followValue, 'long')}{due ? ' (today or earlier: follow up now)' : ''}. Clear the field to remove the date.
                        </p>
                      )}
                      <InlineError message={followHint[r.id]} />
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: '1.25rem' }}>
                  <label htmlFor={`note-${r.id}`} style={labelStyle}>Add a note</label>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <input id={`note-${r.id}`} value={noteDraft} maxLength={4000} onChange={e => setNoteDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !noteBusy && noteDraft.trim()) void addNote(r) }}
                      placeholder="e.g. Called Jordan, sending proposal Friday" style={{ ...inputStyle, flex: '1 1 14rem' }} />
                    <button type="button" onClick={() => void addNote(r)} disabled={noteBusy || !noteDraft.trim()} className="btn btn-primary" style={{ fontSize: '0.82rem', padding: '0.6rem 1.1rem' }}>
                      {noteBusy ? 'Saving…' : 'Add note'}
                    </button>
                  </div>
                  <InlineError message={noteError} />
                  <InlineError message={notesError} />
                  {!notesError && notes.length === 0 && <p style={{ ...helpStyle, fontSize: '0.85rem', margin: '0.6rem 0 0' }}>No notes yet.</p>}
                  {notes.map(n => (
                    <div key={n.id} style={{ padding: '0.6rem 0', borderBottom: '1px solid var(--mist)', fontSize: '0.9rem' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--slate)' }}>{author(n.author_id)} · {formatDateTimeET(n.created_at)}</span>
                      <p style={{ margin: '0.2rem 0 0', whiteSpace: 'pre-wrap', color: 'var(--ink)', overflowWrap: 'anywhere' }}>{n.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
