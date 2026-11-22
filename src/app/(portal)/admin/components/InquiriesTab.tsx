import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { AdminPanel } from '../useAdminPanel'
import { cardStyle, inputStyle, labelStyle } from './shared'

interface Inquiry {
  id: string; kind: 'organization' | 'individual'; contact_name: string; organization: string | null
  email: string; phone: string | null; organization_type: string | null; pathways: string[]
  participants_estimate: string | null; timeline: string | null; message: string | null
  status: string; follow_up_on: string | null; created_at: string; updated_at: string
}
interface Note { id: string; body: string; created_at: string; author_id: string | null }

const STATUSES: { value: string; label: string }[] = [
  { value: 'new', label: 'New' }, { value: 'contacted', label: 'Contacted' }, { value: 'qualified', label: 'Qualified' },
  { value: 'follow_up', label: 'Follow-up needed' }, { value: 'converted', label: 'Converted' }, { value: 'closed', label: 'Closed' },
]
const PATHWAY_NAMES: Record<string, string> = { 'emerging-leaders': 'Emerging Leaders', 'new-leaders': 'New Leaders', 'practicing-leaders': 'Practicing Leaders', unsure: 'Not sure yet' }
const statusLabel = (v: string) => STATUSES.find(s => s.value === v)?.label ?? v
const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

function csvCell(v: unknown) {
  const s = Array.isArray(v) ? v.join('; ') : v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export default function InquiriesTab({ users, showSuccess, logAction }: AdminPanel) {
  const [rows, setRows] = useState<Inquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [statusFilter, setStatusFilter] = useState('open')
  const [kindFilter, setKindFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [noteDraft, setNoteDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('inquiries').select('*').order('created_at', { ascending: false })
    if (error) setLoadError('Inquiries could not be loaded. If this persists, the database update for inquiries may not be applied yet.')
    else { setRows(data as Inquiry[]); setLoadError('') }
    setLoading(false)
  }, [])
  useEffect(() => { void Promise.resolve().then(load) }, [load])

  const loadNotes = async (id: string) => {
    const { data } = await supabase.from('inquiry_notes').select('id, body, created_at, author_id').eq('inquiry_id', id).order('created_at', { ascending: false })
    setNotes((data as Note[]) ?? [])
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r =>
      (statusFilter === 'all' || (statusFilter === 'open' ? !['converted', 'closed'].includes(r.status) : r.status === statusFilter)) &&
      (kindFilter === 'all' || r.kind === kindFilter) &&
      (!q || [r.contact_name, r.organization, r.email].some(v => (v ?? '').toLowerCase().includes(q))))
  }, [rows, statusFilter, kindFilter, search])

  const counts = useMemo(() => Object.fromEntries(STATUSES.map(s => [s.value, rows.filter(r => r.status === s.value).length])), [rows])
  const today = new Date().toISOString().slice(0, 10)

  const update = async (r: Inquiry, patch: Partial<Inquiry>, label: string) => {
    setSaving(true)
    const { error } = await supabase.from('inquiries').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', r.id)
    if (error) showSuccess(`Could not save: ${error.message}`)
    else { showSuccess(label); await logAction('inquiry.update', 'inquiry', r.id, patch as Record<string, unknown>); await load() }
    setSaving(false)
  }

  const addNote = async (r: Inquiry) => {
    if (!noteDraft.trim()) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('inquiry_notes').insert({ inquiry_id: r.id, author_id: user?.id, body: noteDraft.trim() })
    if (error) showSuccess(`Could not add the note: ${error.message}`)
    else { setNoteDraft(''); await loadNotes(r.id) }
    setSaving(false)
  }

  const exportCsv = () => {
    const cols: (keyof Inquiry)[] = ['created_at', 'kind', 'status', 'contact_name', 'organization', 'email', 'phone', 'organization_type', 'pathways', 'participants_estimate', 'timeline', 'follow_up_on', 'message']
    const csv = [cols.join(','), ...visible.map(r => cols.map(c => csvCell(r[c])).join(','))].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a'); a.href = url; a.download = `inquiries-${today}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  const author = (id: string | null) => users.find(u => u.id === id)?.full_name ?? 'Admin'

  return (
    <div>
      <span style={labelStyle}>Leads</span>
      <h1 style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--navy)', letterSpacing: '0.04em', margin: '0.25rem 0 0.5rem' }}>Inquiries</h1>
      <p style={{ color: 'var(--slate)', fontSize: '0.9rem', marginBottom: '1.25rem', lineHeight: 1.6 }}>Organizational and individual inquiries from the Impact Lab page. Update the status as you follow up and keep notes here so nothing is lost.</p>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {[{ value: 'open', label: `Open (${rows.filter(r => !['converted', 'closed'].includes(r.status)).length})` }, ...STATUSES.map(s => ({ value: s.value, label: `${s.label} (${counts[s.value] ?? 0})` })), { value: 'all', label: `All (${rows.length})` }].map(f => (
          <button key={f.value} onClick={() => setStatusFilter(f.value)} aria-pressed={statusFilter === f.value}
            style={{ padding: '0.4rem 0.8rem', borderRadius: '2px', border: '1.5px solid rgba(0,23,55,0.15)', background: statusFilter === f.value ? 'var(--navy)' : 'white', color: statusFilter === f.value ? 'white' : 'var(--navy)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>{f.label}</button>
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
        <button onClick={exportCsv} disabled={visible.length === 0} className="btn btn-ghost-dark" style={{ fontSize: '0.8rem', padding: '0.65rem 1.1rem' }}>Export CSV ({visible.length})</button>
      </div>

      {loading && <p style={{ color: 'var(--slate)' }}>Loading inquiries…</p>}
      {loadError && <div style={{ ...cardStyle, borderLeft: '3px solid #b3261e', color: '#7a1a14' }}>{loadError}</div>}
      {!loading && !loadError && visible.length === 0 && <div style={{ ...cardStyle, textAlign: 'center', color: 'var(--slate)' }}>No inquiries match these filters.</div>}

      {visible.map(r => {
        const open = openId === r.id
        const overdue = r.follow_up_on && r.follow_up_on <= today && !['converted', 'closed'].includes(r.status)
        return (
          <div key={r.id} style={{ ...cardStyle, padding: 0, borderLeft: `4px solid ${r.status === 'new' ? 'var(--gold)' : 'var(--mist)'}` }}>
            <button onClick={() => { const next = open ? null : r.id; setOpenId(next); setNoteDraft(''); if (next) loadNotes(next) }} aria-expanded={open}
              style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '1.1rem 1.25rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', fontFamily: 'inherit' }}>
              <span>
                <span style={{ display: 'block', fontWeight: 700, color: 'var(--navy)' }}>{r.kind === 'organization' && r.organization ? r.organization : r.contact_name}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--slate)' }}>{r.kind === 'organization' ? `${r.contact_name} · ` : 'Individual · '}{r.pathways.map(p => PATHWAY_NAMES[p] ?? p).join(', ')} · {fmt(r.created_at)}</span>
              </span>
              <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {overdue && <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#b3261e' }}>Follow-up due</span>}
                <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.2rem 0.6rem', borderRadius: '2px', background: r.status === 'new' ? 'rgba(200,136,32,0.12)' : 'var(--mist)', color: r.status === 'new' ? 'var(--gold)' : 'var(--slate)' }}>{statusLabel(r.status)}</span>
              </span>
            </button>
            {open && (
              <div style={{ padding: '0 1.25rem 1.25rem', borderTop: '1px solid var(--mist)' }}>
                <div className="two-col-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginTop: '1rem' }}>
                  <dl style={{ margin: 0, display: 'grid', gap: '0.4rem', fontSize: '0.85rem' }}>
                    {([['Email', r.email], ['Phone', r.phone], ['Organization type', r.organization_type], ['Participants', r.participants_estimate], ['Timeline', r.timeline]] as const).filter(([, v]) => v).map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', gap: '0.5rem' }}><dt style={{ color: 'var(--slate)', minWidth: '9rem' }}>{k}</dt><dd style={{ margin: 0, color: 'var(--ink)' }}>{k === 'Email' ? <a href={`mailto:${v}`} style={{ color: 'var(--gold)' }}>{v}</a> : v}</dd></div>
                    ))}
                    {r.message && <div><dt style={{ color: 'var(--slate)' }}>Message</dt><dd style={{ margin: '0.25rem 0 0', whiteSpace: 'pre-wrap', color: 'var(--ink)' }}>{r.message}</dd></div>}
                  </dl>
                  <div style={{ display: 'grid', gap: '0.85rem', alignContent: 'start' }}>
                    <div>
                      <label htmlFor={`st-${r.id}`} style={labelStyle}>Status</label>
                      <select id={`st-${r.id}`} value={r.status} disabled={saving} onChange={e => update(r, { status: e.target.value }, `Marked as ${statusLabel(e.target.value)}.`)} style={inputStyle}>
                        {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`fu-${r.id}`} style={labelStyle}>Follow up on</label>
                      <input id={`fu-${r.id}`} type="date" defaultValue={r.follow_up_on ?? ''} disabled={saving} onChange={e => update(r, { follow_up_on: e.target.value || null }, e.target.value ? 'Follow-up date saved.' : 'Follow-up date cleared.')} style={inputStyle} />
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: '1.25rem' }}>
                  <label htmlFor={`note-${r.id}`} style={labelStyle}>Notes</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input id={`note-${r.id}`} value={noteDraft} maxLength={4000} onChange={e => setNoteDraft(e.target.value)} placeholder="e.g. Called Jordan, sending proposal Friday" style={{ ...inputStyle, flex: 1 }} />
                    <button onClick={() => addNote(r)} disabled={saving || !noteDraft.trim()} className="btn btn-primary" style={{ fontSize: '0.78rem', padding: '0.5rem 1rem' }}>Add note</button>
                  </div>
                  {notes.map(n => (
                    <div key={n.id} style={{ padding: '0.6rem 0', borderBottom: '1px solid var(--mist)', fontSize: '0.85rem' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--slate)' }}>{author(n.author_id)} · {fmt(n.created_at)}</span>
                      <p style={{ margin: '0.2rem 0 0', whiteSpace: 'pre-wrap', color: 'var(--ink)' }}>{n.body}</p>
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
