// "All journal prompts": the same prompts section as inside each cohort, for any pathway,
// or the general prompts every pathway sees.
import { useState } from 'react'
import Link from 'next/link'
import type { AdminPanel } from '../useAdminPanel'
import { cardStyle, helpStyle, inputStyle, labelStyle, pageTitleStyle, programChoices, sectionTitleStyle } from './shared'
import { PromptsList } from './cohort/CohortPrompts'
import { eyebrowStyle, metaStyle } from './cohort/ui'

const GENERAL = '__all__'

export default function JournalPromptsTab(panel: AdminPanel) {
  const [chosen, setChosen] = useState(GENERAL)
  const [showHistorical, setShowHistorical] = useState(false)
  const choices = programChoices(panel.programs, showHistorical)
  // A historical program stays selected only while historical programs are shown.
  const programId = chosen !== GENERAL && choices.some(p => p.id === chosen) ? chosen : null
  const programName = programId ? choices.find(p => p.id === programId)?.name : null

  return (
    <div>
      <span style={eyebrowStyle}>Cohorts</span>
      <h1 style={pageTitleStyle}>All journal prompts</h1>
      <p style={helpStyle}>
        Journal prompts are also managed inside each cohort (Cohorts → open a cohort → Journal prompts). Prompts belong to a pathway, so all of its cohorts share them;
        “All pathways” prompts are shown to every participant.{' '}
        <Link href="/admin/cohorts" style={{ color: '#8a5a10', fontWeight: 600 }}>Back to Cohorts</Link>
      </p>

      {panel.loading ? <p style={metaStyle}>Loading…</p> : (
        <>
          <div style={{ maxWidth: '520px', marginBottom: '1.25rem' }}>
            <label htmlFor="prompts-pathway" style={labelStyle}>Pathway</label>
            <select id="prompts-pathway" value={programId ?? GENERAL} onChange={e => setChosen(e.target.value)} style={inputStyle}>
              <option value={GENERAL}>All pathways (general prompts)</option>
              {choices.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <label style={{ ...metaStyle, display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.5rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={showHistorical} onChange={e => setShowHistorical(e.target.checked)} /> Show historical programs
            </label>
          </div>
          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}>{programName ?? 'All pathways'}</h2>
            <p style={{ ...metaStyle, margin: '0 0 0.5rem' }}>
              {programName ? `Prompts for ${programName}, plus the general prompts every pathway sees.` : 'General prompts, shown to participants in every pathway.'}
            </p>
            <PromptsList key={programId ?? GENERAL} panel={panel} programId={programId} idPrefix={`all-prompts-${programId ?? 'general'}`} />
          </div>
        </>
      )}
    </div>
  )
}
