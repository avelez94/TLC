// Journal prompts for a pathway, plus the general prompts every pathway sees.
// Used inside each cohort and on the "All journal prompts" page.
import { useState } from 'react'
import type { AdminPanel } from '../../useAdminPanel'
import { InlineError } from '../feedback'
import { inputStyle, dangerLinkStyle } from '../shared'
import { FieldLabel, gridStyle, fullWidth, metaStyle, panelBoxStyle, rowStyle, smallButtonStyle, subheadStyle, type CohortSectionProps } from './ui'

const tagStyle = { fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.66rem', letterSpacing: '0.08em', textTransform: 'uppercase' as const, padding: '0.2rem 0.5rem', borderRadius: '2px' }

/** programId null = only the general prompts ("All pathways"). */
export function PromptsList({ panel, programId, idPrefix }: { panel: AdminPanel; programId: string | null; idPrefix: string }) {
  const [form, setForm] = useState({ prompt: '', week_number: '' })
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rowErrors, setRowErrors] = useState<Record<string, string | null>>({})

  const programName = programId ? panel.programs.find(p => p.id === programId)?.name ?? 'this pathway' : null
  const prompts = panel.journalPrompts
    .filter(p => p.program_id === null || (programId !== null && p.program_id === programId))
    .sort((a, b) => (a.week_number ?? 999) - (b.week_number ?? 999) || a.sort_order - b.sort_order)

  const add = async () => {
    setAdding(true)
    setAddError(null)
    const err = await panel.handleCreatePrompt({ prompt: form.prompt, program_id: programId ?? '', week_number: form.week_number })
    setAdding(false)
    if (err) setAddError(err)
    else setForm({ prompt: '', week_number: '' })
  }

  const remove = async (id: string, text: string, general: boolean) => {
    if (!(await panel.confirm({
      title: 'Delete this journal prompt?',
      message: `“${text.length > 160 ? `${text.slice(0, 160)}…` : text}”`,
      consequences: [
        general ? 'This is a general prompt: it is removed for every pathway.' : `It is removed for ${programName}.`,
        'Journal entries participants already wrote are not affected.',
        'This cannot be undone; you can add the prompt again later.',
      ],
      confirmLabel: 'Delete prompt',
      danger: true,
    }))) return
    setBusyId(id)
    const err = await panel.handleDeletePrompt(id)
    setRowErrors(prev => ({ ...prev, [id]: err }))
    setBusyId(null)
  }

  const fid = (f: string) => `${idPrefix}-${f}`
  return (
    <div>
      {prompts.length === 0 ? (
        <p style={{ ...metaStyle, margin: '0 0 0.75rem' }}>No journal prompts yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {prompts.map(p => {
            const general = p.program_id === null
            return (
              <li key={p.id} style={rowStyle}>
                <div style={{ minWidth: 0, flex: '1 1 260px' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                    <span style={{ ...tagStyle, background: general ? 'var(--mist)' : 'rgba(200,136,32,0.12)', color: general ? 'var(--slate)' : '#8a5a10' }}>
                      {general ? 'All pathways' : p.programs?.name ?? programName}
                    </span>
                    <span style={{ ...tagStyle, background: 'rgba(0,23,55,0.06)', color: 'var(--navy)' }}>{p.week_number != null ? `Week ${p.week_number}` : 'Any week'}</span>
                  </div>
                  <p style={{ color: 'var(--ink)', fontSize: '0.92rem', lineHeight: 1.6, margin: 0, overflowWrap: 'anywhere' }}>{p.prompt}</p>
                  <InlineError message={rowErrors[p.id]} />
                </div>
                <button type="button" onClick={() => void remove(p.id, p.prompt, general)} disabled={busyId === p.id} style={{ ...dangerLinkStyle, padding: '0.5rem 0' }}>
                  {busyId === p.id ? 'Deleting…' : 'Delete'}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div style={panelBoxStyle}>
        <h4 style={subheadStyle}>{programName ? `Add a prompt for ${programName}` : 'Add a prompt for all pathways'}</h4>
        <div style={gridStyle}>
          <div style={fullWidth}>
            <FieldLabel htmlFor={fid('prompt')}>Prompt</FieldLabel>
            <textarea id={fid('prompt')} value={form.prompt} rows={3} placeholder="What question should participants reflect on?"
              onChange={e => { setForm({ ...form, prompt: e.target.value }); setAddError(null) }} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <div>
            <FieldLabel htmlFor={fid('week')} hint="(optional)">Week number</FieldLabel>
            <input id={fid('week')} type="number" inputMode="numeric" min={1} value={form.week_number} placeholder="Any week"
              onChange={e => setForm({ ...form, week_number: e.target.value })} style={inputStyle} />
          </div>
        </div>
        <p style={{ ...metaStyle, margin: '0.5rem 0 0' }}>Leave the week empty to use the prompt in any week.</p>
        <button type="button" className="btn btn-primary" onClick={() => void add()} disabled={adding} style={{ ...smallButtonStyle, marginTop: '0.9rem' }}>
          {adding ? 'Adding…' : 'Add prompt'}
        </button>
        <InlineError message={addError} />
      </div>
    </div>
  )
}

export default function CohortPrompts({ panel, cohort }: CohortSectionProps) {
  return (
    <div>
      <p style={{ ...metaStyle, margin: '0 0 0.5rem' }}>Prompts belong to the pathway, so every cohort of this pathway shares them. “All pathways” prompts are shown to everyone.</p>
      <PromptsList panel={panel} programId={cohort.program_id} idPrefix={`prompts-${cohort.id}`} />
    </div>
  )
}
