// Small building blocks shared by the cohort sections (Cohorts screen, All weekly reps,
// All journal prompts).
import type { ReactNode } from 'react'
import type { Cohort, CohortStatus } from '@/types'
import type { AdminPanel } from '../../useAdminPanel'
import { SaveStatus, type SaveState } from '../feedback'
import { labelStyle } from '../shared'

export interface CohortSectionProps { panel: AdminPanel; cohort: Cohort }

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/** Responsive form grid: two or more columns on wide screens, one column on phones. */
export const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))', gap: '1rem' }
export const fullWidth = { gridColumn: '1 / -1' }
export const metaStyle = { color: 'var(--slate)', fontSize: '0.85rem', lineHeight: 1.5 }
export const subheadStyle = { fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.05rem', color: 'var(--navy)', letterSpacing: '0.05em', margin: '0 0 0.6rem' }
export const panelBoxStyle = { padding: '1rem', background: 'var(--paper)', borderRadius: '4px', border: '1px solid var(--mist)', marginTop: '1rem' }
export const rowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' as const, gap: '0.6rem 1rem', padding: '0.75rem 0', borderBottom: '1px solid var(--mist)' }
/** For .btn buttons in cohort screens; long labels wrap instead of overflowing on phones. */
export const smallButtonStyle = { fontSize: '0.85rem', padding: '0.6rem 1.1rem', whiteSpace: 'normal' as const, lineHeight: 1.3, textAlign: 'left' as const, maxWidth: '100%' }
export const eyebrowStyle = { fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.66rem', letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: '#8a5a10' }

/** A label with the field's save indicator beside it. */
export function FieldLabel({ htmlFor, children, state, hint }: { htmlFor: string; children: ReactNode; state?: SaveState; hint?: string }) {
  return (
    <label htmlFor={htmlFor} style={labelStyle}>
      {children}
      {hint && <span style={{ textTransform: 'none', letterSpacing: 0, fontFamily: 'var(--font-montserrat), sans-serif', color: 'var(--slate)', marginLeft: '0.35rem' }}>{hint}</span>}
      {state && <SaveStatus state={state} />}
    </label>
  )
}

/** A collapsible section inside a cohort card. */
export function Section({ id, title, summary, open, onToggle, children }: { id: string; title: string; summary?: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div id={`${id}-wrap`} style={{ borderTop: '1px solid var(--mist)', scrollMarginTop: '80px' }}>
      <h3 style={{ margin: 0 }}>
        <button type="button" id={`${id}-toggle`} aria-expanded={open} aria-controls={id} onClick={onToggle}
          style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', padding: '0.95rem 0', minHeight: '44px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
          <span style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: '1.15rem', color: 'var(--navy)', letterSpacing: '0.06em' }}>{title}</span>
          {summary && <span style={{ ...metaStyle, fontSize: '0.82rem' }}>{summary}</span>}
          <span aria-hidden="true" style={{ marginLeft: 'auto', color: '#8a5a10', fontSize: '1.1rem', fontWeight: 700 }}>{open ? '−' : '+'}</span>
        </button>
      </h3>
      {open && <div id={id} style={{ paddingBottom: '1.25rem' }}>{children}</div>}
    </div>
  )
}

/** Returns a plain-language problem with a web address, or null when it is fine (or empty). */
export function linkProblem(value: string, httpsOnly = false): string | null {
  const v = value.trim()
  if (!v) return null
  let url: URL
  try { url = new URL(v) } catch { return 'Enter the full web address, starting with https://' }
  if (httpsOnly && url.protocol !== 'https:') return 'This link must start with https:// (secure links only).'
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return 'Enter the full web address, starting with https://'
  return null
}

export const STATUS_OPTIONS: { value: CohortStatus; label: string; help: string }[] = [
  { value: 'draft', label: 'Draft — not public', help: 'Not shown publicly. Prepare everything first with the setup checklist: dates, schedule, meeting link, weekly reps and content. Nothing is published until you change the status.' },
  { value: 'upcoming', label: 'Upcoming — announced', help: 'Announced as coming up. While online registration is off for the site, it is not listed on the registration page: visitors use the inquiry form and you enroll people yourself. If it has a book, it appears on the public Reading page.' },
  { value: 'active', label: 'In progress — running now', help: 'Sessions are under way. Enrolled participants use their cohort in the portal.' },
  { value: 'completed', label: 'Completed — finished', help: 'Participants keep read-only access to their program history, materials and certificates. Completion for each participant is recorded by you in Completion & certificates.' },
  { value: 'cancelled', label: 'Cancelled — will not run', help: 'The cohort will not run. All records are kept.' },
  { value: 'archived', label: 'Archived — hidden', help: 'Hidden from routine lists. Everything is kept.' },
]

/** Lifecycle status names as shown on cohort headers. */
export const LIFECYCLE_LABEL: Record<CohortStatus, string> = {
  draft: 'Draft', upcoming: 'Upcoming', active: 'In progress', completed: 'Completed', archived: 'Archived', cancelled: 'Cancelled',
}
/** Badge colour keys for statusBadge (the text always carries the meaning). */
export const LIFECYCLE_BADGE: Record<CohortStatus, string> = {
  draft: 'draft', upcoming: 'upcoming', active: 'in_progress', completed: 'completed', archived: 'archived', cancelled: 'cancelled',
}

/** Help text for a status; Upcoming depends on whether online registration is switched on. */
export function statusHelp(status: CohortStatus, checkoutEnabled: boolean): string | undefined {
  if (status === 'upcoming' && checkoutEnabled) {
    return 'Announced as coming up. It is listed on the registration page, where people can sign up online while its pathway is open for enrollment and seats are free. If it has a book, it appears on the public Reading page.'
  }
  return STATUS_OPTIONS.find(o => o.value === status)?.help
}

/** Confirmation wording for status changes with consequences. */
export const STATUS_CONFIRM: Partial<Record<CohortStatus, { title: string; consequences: string[]; confirmLabel: string }>> = {
  archived: {
    title: 'Archive this cohort?',
    consequences: [
      'It is hidden from routine lists. You can find it under “Archived”.',
      'Participants, sessions, weekly reps, reflections and certificates are all kept.',
      'You can change the status back at any time.',
    ],
    confirmLabel: 'Archive cohort',
  },
  cancelled: {
    title: 'Cancel this cohort?',
    consequences: [
      'The cohort will not run and is no longer shown on the registration or Reading pages.',
      'Enrollments, registrations and all other records are kept.',
      'You can change the status back if plans change.',
    ],
    confirmLabel: 'Mark as cancelled',
  },
  completed: {
    title: 'Mark this cohort as completed?',
    consequences: [
      'Participants keep read-only access to their program history, materials and certificates.',
      'Completion is not recorded for anyone automatically. Next, review each participant in Completion & certificates and mark who completed.',
      'It moves to the “Finished” list. You can change the status back.',
    ],
    confirmLabel: 'Mark as completed',
  },
}

/** Sections of a cohort card, in display order. Also used in links: ?cohort=<id>&section=<key>. */
export const SECTION_KEYS = ['readiness', 'details', 'participants', 'schedule', 'reps', 'prompts', 'participation', 'attendance', 'completion', 'content', 'reading'] as const
export type SectionKey = typeof SECTION_KEYS[number]
/** Opens a section of the same cohort card, scrolls to it, and focuses an element in it when given. */
export type OpenSection = (key: SectionKey, focusId?: string) => void

export const cohortSectionHref = (cohortId: string, section: SectionKey) => `/admin/cohorts?cohort=${cohortId}&section=${section}`
export const inlineLinkStyle = { color: '#8a5a10', fontWeight: 600 }

/** The Tramaine signature printed on certificates only when he has approved it. */
export const TRAMAINE_SIGNER = { name: 'Tramaine L. Crawford', title: 'Founder, TLC Leadership Consulting & Coaching' }

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
