// "Setup checklist" at the top of Draft, Upcoming and In progress cohorts. Each item opens the
// section that fixes it. The checklist is information only: it never changes the status,
// publishes anything, or blocks a status change.
import type { Cohort } from '@/types'
import { cohortReadiness, type CohortReadiness, type ReadinessItem } from '@/lib/cohort-readiness'
import type { AdminPanel } from '../../useAdminPanel'
import { metaStyle, subheadStyle, type OpenSection } from './ui'

export function readinessFor(panel: AdminPanel, cohort: Cohort): CohortReadiness {
  return cohortReadiness({
    cohort, programs: panel.programs, sessions: panel.cohortSessions, reps: panel.reps, prompts: panel.journalPrompts,
    resources: panel.resources, announcements: panel.announcements, enrollments: panel.enrollments, people: panel.users,
    emailProblems: panel.emailProblems,
  })
}

/** The element to focus for an item (ids used by the section components). */
export function focusTarget(cohort: Cohort, item: ReadinessItem, enrolledCount: number): string {
  const id = cohort.id
  switch (item.key) {
    case 'pathway': return `cohort-${id}-program_id`
    case 'name': return `cohort-${id}-name`
    case 'dates': return cohort.start_date ? `cohort-${id}-end_date` : `cohort-${id}-start_date`
    case 'capacity': return `cohort-${id}-capacity`
    case 'meeting_link': return `cohort-${id}-zoom_link`
    case 'schedule': return `session-${id}-generate`
    case 'reps': return `rep-new-${id}-title`
    case 'prompts': return `prompts-${id}-prompt`
    case 'reading': return `cohort-${id}-book_title`
    case 'resources': return `cohort-${id}-link-resource`
    case 'welcome': return `cohort-${id}-link-announcement`
    case 'access': return enrolledCount === 0 ? `cohort-${id}-link-invite` : `cohort-${id}-section-participants-toggle`
    default: return `cohort-${id}-section-${item.section}-toggle`
  }
}

const itemButton = {
  display: 'flex', gap: '0.75rem', alignItems: 'flex-start', width: '100%', textAlign: 'left' as const, padding: '0.7rem 0.75rem',
  background: 'white', border: '1px solid var(--mist)', borderRadius: '4px', cursor: 'pointer', fontFamily: 'var(--font-montserrat), sans-serif', minHeight: '44px',
}

function Item({ item, onOpen }: { item: ReadinessItem; onOpen: () => void }) {
  return (
    <li style={{ marginBottom: '0.5rem' }}>
      <button type="button" onClick={onOpen} style={{ ...itemButton, background: item.done ? 'white' : 'rgba(200,136,32,0.06)', borderColor: item.done ? 'var(--mist)' : 'rgba(200,136,32,0.35)' }}>
        <span aria-hidden="true" style={{ width: '1.3rem', flexShrink: 0, fontWeight: 700, color: item.done ? '#14532d' : '#8a5a10' }}>{item.done ? '✓' : '○'}</span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: 'block', fontWeight: 600, color: 'var(--navy)', fontSize: '0.9rem' }}>
            {item.label}
            <span style={{ fontWeight: 600, fontSize: '0.75rem', marginLeft: '0.5rem', color: item.done ? '#14532d' : '#8a5a10' }}>{item.done ? 'Done' : 'To do'}</span>
          </span>
          <span style={{ ...metaStyle, display: 'block', fontSize: '0.82rem', overflowWrap: 'anywhere' }}>{item.hint}</span>
        </span>
        <span aria-hidden="true" style={{ color: '#8a5a10', fontWeight: 700, flexShrink: 0 }}>›</span>
      </button>
    </li>
  )
}

export default function CohortReadinessChecklist({ cohort, readiness, enrolledCount, onOpen }: {
  cohort: Cohort; readiness: CohortReadiness; enrolledCount: number; onOpen: OpenSection
}) {
  const open = (item: ReadinessItem) => onOpen(item.section, focusTarget(cohort, item, enrolledCount))
  const listStyle = { listStyle: 'none', margin: '0 0 1rem', padding: 0 }
  return (
    <div>
      <p style={{ color: 'var(--ink)', fontSize: '0.92rem', lineHeight: 1.6, margin: '0 0 0.4rem', fontWeight: 600 }}>{readiness.summary}</p>
      <p style={{ ...metaStyle, margin: '0 0 1rem' }}>
        Select an item to go to the place where you set it. This checklist is a guide: it never changes the cohort’s status or publishes anything.
      </p>
      <h4 style={subheadStyle}>Essential ({readiness.essentials.filter(i => i.done).length} of {readiness.essentials.length} done)</h4>
      <ul style={listStyle}>{readiness.essentials.map(i => <Item key={i.key} item={i} onOpen={() => open(i)} />)}</ul>
      <h4 style={subheadStyle}>Recommended ({readiness.recommended.filter(i => i.done).length} of {readiness.recommended.length} done)</h4>
      <p style={{ ...metaStyle, margin: '0 0 0.5rem' }}>Helpful for participants, never required.</p>
      <ul style={listStyle}>{readiness.recommended.map(i => <Item key={i.key} item={i} onOpen={() => open(i)} />)}</ul>
    </div>
  )
}
