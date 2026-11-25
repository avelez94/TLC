import { formatDateET } from '@/lib/business-time'
import { cardStyle, EmptyState, h2Style, mutedText, PageHeader, StatusBadge } from './ui'
import type { JournalEntryRow, Rep, Submission } from './types'

interface HistoryItem { key: string; at: string; kind: 'Journal entry' | 'Weekly rep'; heading: string; context: string | null; prompt: string | null; body: string }

/** The participant's own journal entries and rep reflections, newest first. Read-only. */
export function LearningHistory({ entries, submissions, repsById, programLabel, cohortLabel, onOpenJournal }: {
  entries: JournalEntryRow[]
  submissions: Submission[]
  repsById: Map<string, Rep>
  programLabel: (programId: string | null) => string | null
  cohortLabel: (cohortId: string) => string | null
  onOpenJournal: () => void
}) {
  const items: HistoryItem[] = [
    ...entries.map(e => ({
      key: `j-${e.id}`, at: e.created_at, kind: 'Journal entry' as const,
      heading: e.title || 'Journal entry', context: programLabel(e.program_id), prompt: e.prompt_used, body: e.body || '',
    })),
    ...submissions.map(s => {
      const rep = repsById.get(s.rep_id)
      return {
        key: `r-${s.id}`, at: s.completed_at || '', kind: 'Weekly rep' as const,
        heading: rep ? `${rep.week_number != null ? `Week ${rep.week_number}: ` : ''}${rep.title}` : 'Weekly rep',
        context: rep ? cohortLabel(rep.cohort_id) : null, prompt: null, body: s.reflection || '',
      }
    }),
  ].sort((a, b) => b.at.localeCompare(a.at))

  return (
    <div>
      <PageHeader
        eyebrow="History"
        title="My Learning History"
        intro={<>Your journal entries and weekly rep reflections across all your programs, newest first. Only you can see them. This page is read-only; to edit a current-program entry, use the <button type="button" onClick={onOpenJournal} style={{ background: 'none', border: 'none', padding: 0, color: '#8a5a10', fontWeight: 600, cursor: 'pointer', fontSize: 'inherit', fontFamily: 'inherit' }}>Reflection Journal</button>.</>}
      />
      {items.length === 0 && <EmptyState>Nothing here yet. Your journal entries and weekly rep reflections will be listed here as you write them.</EmptyState>}
      <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {items.map(item => (
          <li key={item.key} style={{ ...cardStyle, borderLeft: `3px solid ${item.kind === 'Weekly rep' ? 'var(--navy)' : 'var(--gold)'}` }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              <StatusBadge kind="info">{item.kind}</StatusBadge>
              {item.at && <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: '0.6rem', letterSpacing: '0.1em', color: '#8a5a10', textTransform: 'uppercase' }}>{formatDateET(item.at, 'long')}</span>}
              {item.context && <span style={{ fontSize: '0.72rem', color: 'var(--slate)' }}>{item.context}</span>}
            </div>
            <h2 style={{ ...h2Style, marginBottom: '0.35rem' }}>{item.heading}</h2>
            {item.prompt && <p style={{ color: 'var(--slate)', fontSize: '0.8rem', fontStyle: 'italic', marginBottom: '0.5rem' }}>{item.prompt}</p>}
            <p style={{ ...mutedText, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>{item.body}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}
