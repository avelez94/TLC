// Cohorts: one run of a pathway with its own dates, participants, schedule, weekly reps,
// journal prompts and registration-page content. Everything about a cohort is managed in
// its card. Open cards and sections stay open while data refreshes after a save.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import type { Cohort, CohortStatus } from '@/types'
import { cohortAvailability, seatsTaken } from '@/lib/admin-metrics'
import { formatDateET } from '@/lib/business-time'
import type { AdminPanel } from '../useAdminPanel'
import { InlineError } from './feedback'
import { cardStyle, helpStyle, pageTitleStyle, secondaryButtonStyle, statusBadge } from './shared'
import CohortDetails from './cohort/CohortDetails'
import CohortParticipants from './cohort/CohortParticipants'
import CohortSchedule from './cohort/CohortSchedule'
import CohortReps from './cohort/CohortReps'
import CohortPrompts from './cohort/CohortPrompts'
import { CohortContent, CohortReading } from './cohort/CohortContent'
import CreateCohortForm from './cohort/CreateCohortForm'
import { STATUS_CONFIRM, Section, eyebrowStyle, metaStyle, plural } from './cohort/ui'

type Filter = 'current' | 'finished' | 'archived'
type SectionKey = 'details' | 'participants' | 'schedule' | 'reps' | 'prompts' | 'content' | 'reading'

const FILTERS: { key: Filter; label: string; statuses: CohortStatus[] }[] = [
  { key: 'current', label: 'Current', statuses: ['active', 'upcoming', 'draft'] },
  { key: 'finished', label: 'Finished', statuses: ['completed', 'cancelled'] },
  { key: 'archived', label: 'Archived', statuses: ['archived'] },
]
const filterFor = (status: CohortStatus): Filter => FILTERS.find(f => f.statuses.includes(status))?.key ?? 'current'
const CURRENT_GROUPS: { status: CohortStatus; title: string }[] = [
  { status: 'active', title: 'Running now' }, { status: 'upcoming', title: 'Upcoming' }, { status: 'draft', title: 'Drafts (not public)' },
]

const byStart = (a: Cohort, b: Cohort) => (a.start_date ?? '9999').localeCompare(b.start_date ?? '9999') || a.name.localeCompare(b.name)
const byEndDesc = (a: Cohort, b: Cohort) => (b.end_date ?? '').localeCompare(a.end_date ?? '') || a.name.localeCompare(b.name)

function dateRange(c: Cohort) {
  if (c.start_date && c.end_date) return `${formatDateET(c.start_date)} – ${formatDateET(c.end_date)}`
  if (c.start_date) return `Starts ${formatDateET(c.start_date)}`
  if (c.end_date) return `Ends ${formatDateET(c.end_date)}`
  return 'No dates yet'
}

const menuItemStyle = { display: 'block', width: '100%', textAlign: 'left' as const, padding: '0.75rem 1rem', background: 'none', border: 'none', color: 'var(--navy)', fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'var(--font-montserrat), sans-serif' }

function CohortCard({ panel, cohort, open, onToggle, isSectionOpen, toggleSection, onCopied }: {
  panel: AdminPanel; cohort: Cohort; open: boolean; onToggle: () => void
  isSectionOpen: (k: SectionKey) => boolean; toggleSection: (k: SectionKey) => void; onCopied: (name: string) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [menuOpen])

  const program = panel.programs.find(p => p.id === cohort.program_id)
  const taken = seatsTaken(cohort.id, panel.enrollments)
  const seats = cohort.capacity != null ? `${taken} of ${cohort.capacity} seats` : `${taken} enrolled, no limit`
  const availability = cohortAvailability({
    cohortStatus: cohort.status, capacity: cohort.capacity, seatsTaken: taken,
    pathwayEnrollmentOpen: program?.enrollment_open ?? false, checkoutEnabled: panel.checkoutEnabled,
  })
  const hasHistory = panel.cohortHasHistory(cohort.id)

  const sessions = panel.cohortSessions.filter(s => s.cohort_id === cohort.id).length
  const reps = panel.reps.filter(r => r.cohort_id === cohort.id && !r.archived_at).length
  const prompts = panel.journalPrompts.filter(p => p.program_id === null || p.program_id === cohort.program_id).length

  const act = async (key: string, fn: () => Promise<string | null>) => {
    setMenuOpen(false)
    setBusy(key)
    setActionError(null)
    const err = await fn()
    setBusy(null)
    setActionError(err)
    return err
  }

  const duplicate = async () => {
    const err = await act('duplicate', () => panel.handleDuplicateCohort(cohort.id))
    if (!err) onCopied(`${cohort.name} (Copy)`)
  }
  const archive = async () => {
    setMenuOpen(false)
    const c = STATUS_CONFIRM.archived!
    if (!(await panel.confirm({ title: c.title, message: `“${cohort.name}”`, consequences: c.consequences, confirmLabel: c.confirmLabel, danger: true }))) return
    await act('archive', () => panel.handleUpdateCohortStatus(cohort.id, 'archived'))
  }
  const remove = async () => {
    setMenuOpen(false)
    if (!(await panel.confirm({
      title: 'Delete this cohort permanently?',
      message: `“${cohort.name}” has no participants, registrations, certificates or reflections.`,
      consequences: [
        'The cohort, its schedule and its weekly reps are removed for good.',
        'This cannot be undone. To hide it but keep it, archive it instead.',
      ],
      confirmLabel: 'Delete permanently',
      danger: true,
      requireText: 'DELETE',
    }))) return
    await act('delete', () => panel.handleDeleteCohort(cohort.id))
  }

  const sectionId = (k: SectionKey) => `cohort-${cohort.id}-section-${k}`
  const sec = (k: SectionKey, title: string, summary: string | undefined, body: ReactNode) => (
    <Section id={sectionId(k)} title={title} summary={summary} open={isSectionOpen(k)} onToggle={() => toggleSection(k)}>{body}</Section>
  )

  return (
    <div style={{ ...cardStyle, padding: '1.25rem 1.25rem 0.5rem' }}>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flexWrap: 'wrap', paddingBottom: '0.75rem' }}>
        <button type="button" aria-expanded={open} onClick={onToggle}
          style={{ flex: '1 1 260px', minWidth: 0, display: 'flex', gap: '0.75rem', alignItems: 'flex-start', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
          <span aria-hidden="true" style={{ color: '#8a5a10', fontSize: '0.9rem', paddingTop: '0.25rem', width: '1rem' }}>{open ? '▾' : '▸'}</span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.35rem', color: 'var(--navy)', letterSpacing: '0.04em', lineHeight: 1.2, overflowWrap: 'anywhere' }}>{cohort.name}</span>
            <span style={{ ...metaStyle, display: 'block' }}>{program?.name ?? cohort.programs?.name ?? 'No pathway'}</span>
            <span style={{ ...metaStyle, display: 'block' }}>{dateRange(cohort)} · {seats}</span>
          </span>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: 'auto' }}>
          {statusBadge(availability.key, availability.label)}
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button type="button" aria-expanded={menuOpen} aria-label={`More actions for ${cohort.name}`} onClick={() => setMenuOpen(v => !v)} disabled={!!busy}
              style={{ ...secondaryButtonStyle, minHeight: '40px' }}>
              {busy === 'duplicate' ? 'Copying…' : busy === 'archive' ? 'Archiving…' : busy === 'delete' ? 'Deleting…' : 'More ▾'}
            </button>
            {menuOpen && (
              <div style={{ position: 'absolute', top: '110%', right: 0, background: 'white', border: '1px solid rgba(0,23,55,0.15)', borderRadius: '4px', boxShadow: '0 6px 20px rgba(0,0,0,0.14)', zIndex: 20, width: 'min(280px, 80vw)', overflow: 'hidden' }}>
                <button type="button" onClick={() => void duplicate()} style={menuItemStyle}>
                  Duplicate
                  <span style={{ ...metaStyle, display: 'block', fontSize: '0.8rem' }}>Copies the details and content as a new Draft, without dates or people.</span>
                </button>
                {cohort.status !== 'archived' && (
                  <button type="button" onClick={() => void archive()} style={{ ...menuItemStyle, borderTop: '1px solid var(--mist)' }}>
                    Archive
                    <span style={{ ...metaStyle, display: 'block', fontSize: '0.8rem' }}>Hides it from routine lists. Everything is kept.</span>
                  </button>
                )}
                <button type="button" onClick={() => void remove()} disabled={hasHistory}
                  style={{ ...menuItemStyle, borderTop: '1px solid var(--mist)', color: hasHistory ? 'var(--slate)' : '#b3261e', cursor: hasHistory ? 'not-allowed' : 'pointer' }}>
                  Delete permanently
                  <span style={{ ...metaStyle, display: 'block', fontSize: '0.8rem' }}>
                    {hasHistory
                      ? 'Not available: this cohort has participants, registrations, certificates or reflections. Archive it instead to keep its history.'
                      : 'Only for cohorts nobody has used. Cannot be undone.'}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <InlineError message={actionError} />

      {open && (
        <div>
          <p style={{ ...metaStyle, margin: '0 0 0.75rem', padding: '0.6rem 0.8rem', background: 'var(--paper)', borderRadius: '4px' }}>
            <strong style={{ color: 'var(--navy)' }}>{availability.label}:</strong> {availability.detail}
          </p>
          {sec('details', 'Details', undefined, <CohortDetails panel={panel} cohort={cohort} />)}
          {sec('participants', 'Participants', seats, <CohortParticipants panel={panel} cohort={cohort} />)}
          {sec('schedule', 'Schedule', plural(sessions, 'session'), <CohortSchedule panel={panel} cohort={cohort} />)}
          {sec('reps', 'Weekly reps', plural(reps, 'rep'), <CohortReps panel={panel} cohort={cohort} />)}
          {sec('prompts', 'Journal prompts', plural(prompts, 'prompt'), <CohortPrompts panel={panel} cohort={cohort} />)}
          {sec('content', 'Registration page content', undefined, <CohortContent panel={panel} cohort={cohort} />)}
          {sec('reading', 'Reading', cohort.book_title || 'No book', <CohortReading panel={panel} cohort={cohort} />)}
        </div>
      )}
    </div>
  )
}

export default function CohortsTab(panel: AdminPanel) {
  const [filter, setFilter] = useState<Filter>('current')
  const [showForm, setShowForm] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [sections, setSections] = useState<Record<string, Partial<Record<SectionKey, boolean>>>>({})
  const [justCreated, setJustCreated] = useState<string | null>(null)

  // The newest cohort with the name just created or copied opens automatically.
  const justCreatedId = useMemo(() => justCreated
    ? panel.cohorts.filter(c => c.name === justCreated).sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.id ?? null
    : null, [justCreated, panel.cohorts])

  const isOpen = (id: string) => expanded[id] ?? id === justCreatedId
  const toggle = (id: string) => setExpanded(prev => ({ ...prev, [id]: !isOpen(id) }))
  const isSectionOpen = (id: string, k: SectionKey) => sections[id]?.[k] ?? k === 'details'
  const toggleSection = (id: string, k: SectionKey) => setSections(prev => ({ ...prev, [id]: { ...prev[id], [k]: !isSectionOpen(id, k) } }))

  const counts = Object.fromEntries(FILTERS.map(f => [f.key, panel.cohorts.filter(c => f.statuses.includes(c.status)).length])) as Record<Filter, number>
  const card = (c: Cohort) => (
    <CohortCard key={c.id} panel={panel} cohort={c} open={isOpen(c.id)} onToggle={() => toggle(c.id)}
      isSectionOpen={k => isSectionOpen(c.id, k)} toggleSection={k => toggleSection(c.id, k)}
      onCopied={name => { setJustCreated(name); setFilter('current') }} />
  )

  const groupTitle = { fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.2rem', color: 'var(--navy)', letterSpacing: '0.05em', margin: '1.5rem 0 0.75rem' }
  const filtered = panel.cohorts.filter(c => FILTERS.find(f => f.key === filter)!.statuses.includes(c.status))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ flex: '1 1 320px' }}>
          <span style={eyebrowStyle}>Programs</span>
          <h1 style={pageTitleStyle}>Cohorts</h1>
          <p style={helpStyle}>
            A cohort is one run of a pathway, with its own dates, participants, schedule and weekly reps. Open a cohort to manage everything about it.
            New cohorts start as <strong>Draft</strong>: nothing is public until you set the status to Upcoming.
          </p>
          <p style={{ ...metaStyle, margin: '0 0 1rem' }}>
            Lists across all cohorts: <Link href="/admin/reps" style={{ color: '#8a5a10', fontWeight: 600 }}>All weekly reps</Link>
            {' · '}<Link href="/admin/prompts" style={{ color: '#8a5a10', fontWeight: 600 }}>All journal prompts</Link>
          </p>
        </div>
        {!showForm && (
          <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)} style={{ fontSize: '0.85rem', padding: '0.7rem 1.25rem' }}>+ New cohort</button>
        )}
      </div>

      {showForm && (
        <CreateCohortForm panel={panel} onCancel={() => setShowForm(false)}
          onCreated={(name, status) => { setShowForm(false); setJustCreated(name); setFilter(filterFor(status)) }} />
      )}

      <div role="group" aria-label="Show cohorts" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', margin: '0.5rem 0 1rem' }}>
        {FILTERS.map(f => {
          const active = filter === f.key
          return (
            <button key={f.key} type="button" aria-pressed={active} onClick={() => setFilter(f.key)}
              style={{ ...secondaryButtonStyle, minHeight: '40px', fontSize: '0.88rem', background: active ? 'var(--navy)' : 'white', color: active ? 'white' : 'var(--navy)', borderColor: active ? 'var(--navy)' : 'rgba(0,23,55,0.2)' }}>
              {f.label} ({counts[f.key]})
            </button>
          )
        })}
      </div>
      <p style={{ ...metaStyle, margin: '0 0 1rem' }}>
        {filter === 'current' ? 'Running now, upcoming and draft cohorts.' : filter === 'finished' ? 'Completed and cancelled cohorts. Their records are kept.' : 'Archived cohorts are hidden from routine lists. Everything is kept; change the status in Details to bring one back.'}
      </p>

      {panel.loading ? (
        <p style={metaStyle}>Loading cohorts…</p>
      ) : filtered.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <p style={{ ...metaStyle, margin: '0 0 1rem' }}>
            {filter === 'current' ? 'No current cohorts. Create one to get started.' : filter === 'finished' ? 'No finished cohorts yet.' : 'No archived cohorts.'}
          </p>
          {filter === 'current' && !showForm && (
            <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)} style={{ fontSize: '0.85rem' }}>+ New cohort</button>
          )}
        </div>
      ) : filter === 'current' ? (
        CURRENT_GROUPS.map(g => {
          const list = filtered.filter(c => c.status === g.status).sort(byStart)
          if (!list.length) return null
          return (
            <section key={g.status} aria-label={g.title}>
              <h2 style={groupTitle}>{g.title} ({list.length})</h2>
              {list.map(card)}
            </section>
          )
        })
      ) : (
        [...filtered].sort(byEndDesc).map(card)
      )}
    </div>
  )
}
