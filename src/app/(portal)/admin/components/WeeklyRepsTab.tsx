// "All weekly reps": the same weekly-reps section as inside each cohort, for any cohort
// (Draft cohorts included), chosen from one list.
import { useState } from 'react'
import Link from 'next/link'
import type { CohortStatus } from '@/types'
import type { AdminPanel } from '../useAdminPanel'
import { cardStyle, helpStyle, inputStyle, labelStyle, pageTitleStyle, sectionTitleStyle, statusBadge } from './shared'
import CohortReps from './cohort/CohortReps'
import { eyebrowStyle, metaStyle } from './cohort/ui'

const GROUPS: { status: CohortStatus; label: string }[] = [
  { status: 'active', label: 'Running now' }, { status: 'upcoming', label: 'Upcoming' }, { status: 'draft', label: 'Draft (not public)' },
  { status: 'completed', label: 'Completed' }, { status: 'cancelled', label: 'Cancelled' }, { status: 'archived', label: 'Archived' },
]

export default function WeeklyRepsTab(panel: AdminPanel) {
  const [chosen, setChosen] = useState('')
  const sorted = [...panel.cohorts].sort((a, b) => (a.start_date ?? '9999').localeCompare(b.start_date ?? '9999') || a.name.localeCompare(b.name))
  const fallback = GROUPS.map(g => sorted.find(c => c.status === g.status)).find(Boolean)
  const cohort = panel.cohorts.find(c => c.id === chosen) ?? fallback ?? null

  return (
    <div>
      <span style={eyebrowStyle}>Cohorts</span>
      <h1 style={pageTitleStyle}>All weekly reps</h1>
      <p style={helpStyle}>
        Weekly reps are also managed inside each cohort (Cohorts → open a cohort → Weekly reps). Use this page to jump between cohorts quickly.{' '}
        <Link href="/admin/cohorts" style={{ color: '#8a5a10', fontWeight: 600 }}>Back to Cohorts</Link>
      </p>

      {panel.loading ? <p style={metaStyle}>Loading…</p> : panel.cohorts.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <p style={{ ...metaStyle, margin: 0 }}>There are no cohorts yet. <Link href="/admin/cohorts" style={{ color: '#8a5a10', fontWeight: 600 }}>Create a cohort</Link> first.</p>
        </div>
      ) : (
        <>
          <div style={{ maxWidth: '520px', marginBottom: '1.25rem' }}>
            <label htmlFor="reps-cohort" style={labelStyle}>Cohort</label>
            <select id="reps-cohort" value={cohort?.id ?? ''} onChange={e => setChosen(e.target.value)} style={inputStyle}>
              {GROUPS.map(g => {
                const list = sorted.filter(c => c.status === g.status)
                return list.length ? (
                  <optgroup key={g.status} label={g.label}>
                    {list.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </optgroup>
                ) : null
              })}
            </select>
          </div>
          {cohort && (
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                <h2 style={{ ...sectionTitleStyle, margin: 0 }}>{cohort.name}</h2>
                {statusBadge(cohort.status)}
              </div>
              <CohortReps key={cohort.id} panel={panel} cohort={cohort} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
