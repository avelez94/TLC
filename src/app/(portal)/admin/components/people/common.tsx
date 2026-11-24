'use client'

// Shared pieces for the People screens (Participants, All certificates, Registration history).
import type { AdminPanel } from '../../useAdminPanel'
import type { Cohort, Profile } from '@/types'
import { seatsTaken } from '@/lib/admin-metrics'
import { formatDateET } from '@/lib/business-time'
import { labelStyle } from '../shared'

export const ROLE_LABEL: Record<string, string> = {
  impact_participant: 'Impact Lab participant',
  coaching_client: 'Coaching client',
  admin: 'Administrator',
}

const COHORT_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', upcoming: 'Upcoming', active: 'In progress', completed: 'Completed', archived: 'Archived', cancelled: 'Cancelled',
}

/** Cohorts people can be enrolled in now: Draft, Upcoming or In progress. */
export const ENROLLABLE_STATUSES = ['draft', 'upcoming', 'active']

export interface CohortChoice { cohort: Cohort; label: string; full: boolean }

/** Enrollable cohorts with seat information. Full cohorts are marked so the option can be disabled. */
export function enrollableCohortChoices(panel: AdminPanel): CohortChoice[] {
  return panel.cohorts
    .filter(c => ENROLLABLE_STATUSES.includes(c.status))
    .map(c => {
      const taken = seatsTaken(c.id, panel.enrollments)
      const full = c.capacity != null && taken >= c.capacity
      const seats = c.capacity != null ? (full ? `Full (${taken} of ${c.capacity} seats)` : `${c.capacity - taken} of ${c.capacity} seats left`) : `${taken} enrolled, no seat limit`
      const program = c.programs?.name ? ` (${c.programs.name})` : ''
      const start = c.start_date ? `, starts ${formatDateET(c.start_date)}` : ''
      return { cohort: c, full, label: `${c.name}${program} · ${COHORT_STATUS_LABEL[c.status] ?? c.status}${start} · ${seats}` }
    })
}

export const personLabel = (u: Pick<Profile, 'full_name' | 'email'>) => u.full_name || u.email || 'Unnamed person'

export const primaryButton = { fontSize: '0.85rem', padding: '0.65rem 1.1rem' }

/** A row of filter buttons (one selected). */
export function FilterBar({ label, options, value, onChange }: { label: string; options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div role="group" aria-label={label} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
      {options.map(o => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} aria-pressed={value === o.value}
          style={{ padding: '0.55rem 0.9rem', minHeight: '40px', borderRadius: '2px', border: '1.5px solid rgba(0,23,55,0.15)', background: value === o.value ? 'var(--navy)' : 'white', color: value === o.value ? 'white' : 'var(--navy)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-montserrat), sans-serif' }}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <span style={labelStyle}>{label}</span>
      <div style={{ color: 'var(--ink)', fontSize: '0.92rem', lineHeight: 1.5, overflowWrap: 'anywhere' }}>{children}</div>
    </div>
  )
}

export const detailGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem 1.25rem', marginBottom: '1.25rem' }
