// Cohort setup readiness: a checklist of what a cohort needs before it runs. It is an
// indicator only. It never changes a cohort's status, never publishes anything and never
// blocks a status change; the lifecycle status (Draft, Upcoming, In progress, …) stays the
// official state and is always set by an administrator.
//
// Essential (counted in "Needs setup · N items"):
//   pathway       the cohort belongs to a pathway that exists
//   name          the cohort has a name
//   dates         start date and end date are both set
//   capacity      a seat limit is set
//   schedule      at least one session has a date
//   meeting_link  the meeting link (zoom_link) is set
// Recommended (shown, never required):
//   reps          at least one weekly rep that is not archived
//   prompts       journal prompts exist for the pathway (pathway-specific or general prompts)
//   resources     at least one learning resource for this cohort or its pathway
//   reading       a book title is set
//   welcome       an announcement addressed to this cohort exists
//   access        everyone enrolled can sign in: every non-withdrawn, non-admin participant has
//                 signed in, or has no unresolved failed/bounced email. With nobody enrolled
//                 yet it is not done ("Invite participants").
//
// Pure: no database access, no dates from the clock. Shared by the Cohorts screen and tests.

export type ReadinessSection = 'details' | 'participants' | 'schedule' | 'reps' | 'prompts' | 'content' | 'reading'

export interface ReadinessItem {
  key: string
  label: string
  done: boolean
  /** Plain words: what is set, or what to do. */
  hint: string
  /** The cohort card section that fixes it. */
  section: ReadinessSection
  /** Lower-case instruction used in the summary, e.g. "add a meeting link". */
  action: string
}

export interface CohortReadiness {
  essentials: ReadinessItem[]
  recommended: ReadinessItem[]
  ready: boolean
  missingEssential: number
  summary: string
}

export interface ReadinessInput {
  cohort: {
    id: string; program_id: string | null; name: string | null; start_date: string | null; end_date: string | null
    capacity?: number | null; zoom_link?: string | null; book_title?: string | null
  }
  programs: { id: string }[]
  sessions: { cohort_id: string; session_date: string | null }[]
  reps: { cohort_id: string; archived_at?: string | null }[]
  prompts: { program_id: string | null }[]
  resources: { cohort_id: string | null; program_id: string | null }[]
  announcements: { cohort_id: string | null }[]
  enrollments: { cohort_id: string; user_id: string; status: string | null }[]
  people: { id: string; role: string | null; last_sign_in_at?: string | null }[]
  emailProblems: { related_user_id?: string | null; status: string; resolved_at?: string | null }[]
}

const n = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`

/** "a, b and c" */
function joinWords(parts: string[]): string {
  if (parts.length <= 1) return parts.join('')
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function cohortReadiness(input: ReadinessInput): CohortReadiness {
  const { cohort } = input
  const hasProgram = !!cohort.program_id && input.programs.some(p => p.id === cohort.program_id)
  const dated = input.sessions.filter(s => s.cohort_id === cohort.id && !!s.session_date).length
  const missingDate = !cohort.start_date && !cohort.end_date ? 'start and end dates' : !cohort.start_date ? 'start date' : 'end date'

  const essentials: ReadinessItem[] = [
    {
      key: 'pathway', label: 'Pathway selected', section: 'details', done: hasProgram, action: 'choose a pathway',
      hint: hasProgram ? 'The cohort belongs to a pathway.' : 'Choose the pathway this cohort runs.',
    },
    {
      key: 'name', label: 'Cohort name', section: 'details', done: !!cohort.name?.trim(), action: 'give it a name',
      hint: cohort.name?.trim() ? 'Named.' : 'Give the cohort a name participants will recognise.',
    },
    {
      key: 'dates', label: 'Start and end dates', section: 'details', done: !!cohort.start_date && !!cohort.end_date,
      action: `set the ${missingDate}`,
      hint: cohort.start_date && cohort.end_date ? 'Both dates are set.' : `Set the ${missingDate}.`,
    },
    {
      key: 'capacity', label: 'Seat limit', section: 'details', done: cohort.capacity != null, action: 'set a seat limit',
      hint: cohort.capacity != null ? `${n(cohort.capacity, 'seat')}.` : 'Set how many people can join (capacity).',
    },
    {
      key: 'schedule', label: 'Session schedule', section: 'schedule', done: dated > 0, action: 'generate the session schedule',
      hint: dated > 0 ? `${n(dated, 'session')} with a date.` : 'Generate the weekly schedule, or add sessions with dates.',
    },
    {
      key: 'meeting_link', label: 'Meeting link', section: 'details', done: !!cohort.zoom_link?.trim(), action: 'add a meeting link',
      hint: cohort.zoom_link?.trim() ? 'Set. Only enrolled participants see it.' : 'Add the Zoom (or other) link participants use to join sessions.',
    },
  ]

  const reps = input.reps.filter(r => r.cohort_id === cohort.id && !r.archived_at).length
  const prompts = input.prompts.filter(p => p.program_id === null || (!!cohort.program_id && p.program_id === cohort.program_id)).length
  const resources = input.resources.filter(r => r.cohort_id === cohort.id || (!!cohort.program_id && r.program_id === cohort.program_id)).length
  const welcome = input.announcements.some(a => a.cohort_id === cohort.id)

  const admins = new Set(input.people.filter(p => p.role === 'admin').map(p => p.id))
  const enrolled = [...new Set(input.enrollments
    .filter(e => e.cohort_id === cohort.id && e.status !== 'withdrawn' && !admins.has(e.user_id))
    .map(e => e.user_id))]
  const signedIn = new Set(input.people.filter(p => !!p.last_sign_in_at).map(p => p.id))
  const undelivered = new Set(input.emailProblems
    .filter(m => (m.status === 'failed' || m.status === 'bounced') && !m.resolved_at && m.related_user_id)
    .map(m => m.related_user_id as string))
  const blocked = enrolled.filter(id => !signedIn.has(id) && undelivered.has(id)).length
  const accessDone = enrolled.length > 0 && blocked === 0

  const recommended: ReadinessItem[] = [
    {
      key: 'reps', label: 'Weekly reps', section: 'reps', done: reps > 0, action: 'add weekly reps',
      hint: reps > 0 ? `${n(reps, 'weekly rep')}.` : 'Add the weekly practice participants complete between sessions.',
    },
    {
      key: 'prompts', label: 'Journal prompts', section: 'prompts', done: prompts > 0, action: 'add journal prompts',
      hint: prompts > 0 ? `${n(prompts, 'prompt')} available for this pathway.` : 'Add prompts for this pathway (or general prompts for all pathways).',
    },
    {
      key: 'resources', label: 'Learning resources', section: 'participants', done: resources > 0, action: 'add learning resources',
      hint: resources > 0 ? `${n(resources, 'resource')} for this cohort or its pathway.` : 'Add materials for this cohort or its pathway.',
    },
    {
      key: 'reading', label: 'Reading', section: 'reading', done: !!cohort.book_title?.trim(), action: 'add the book',
      hint: cohort.book_title?.trim() ? `“${cohort.book_title.trim()}”.` : 'Add the book this cohort reads, if there is one.',
    },
    {
      key: 'welcome', label: 'Welcome announcement', section: 'participants', done: welcome, action: 'post a welcome announcement',
      hint: welcome ? 'An announcement for this cohort is posted.' : 'Post a welcome message for this cohort’s participants.',
    },
    {
      key: 'access', label: 'Everyone enrolled can sign in', section: 'participants', done: accessDone,
      action: enrolled.length === 0 ? 'invite participants' : 'resend sign-in emails that did not arrive',
      hint: enrolled.length === 0
        ? 'Invite participants.'
        : blocked > 0
          ? `${n(blocked, 'person has', 'people have')} not signed in and their email did not arrive. Resend it from Needs your attention or their record.`
          : `${n(enrolled.length, 'participant')} enrolled; no undelivered sign-in emails.`,
    },
  ]

  const missing = essentials.filter(i => !i.done)
  const ready = missing.length === 0
  const optional = recommended.filter(i => !i.done)
  let summary: string
  if (ready) {
    summary = 'Ready: all essential setup is done.'
    if (optional.length) summary += ` Optional: ${joinWords(optional.slice(0, 2).map(i => i.action))}${optional.length > 2 ? ` (${optional.length - 2} more)` : ''}.`
  } else {
    const steps = `${capitalize(joinWords(missing.map(i => i.action)))}.`
    summary = missing.length <= 2 ? `Your cohort is almost ready. ${steps}` : `Your cohort needs setup (${n(missing.length, 'essential item')}). ${steps}`
  }
  return { essentials, recommended, ready, missingEssential: missing.length, summary }
}

/** Short indicator for the cohort header: "Ready" or "Needs setup · 2 items". */
export function readinessLabel(r: Pick<CohortReadiness, 'ready' | 'missingEssential'>): string {
  return r.ready ? 'Ready' : `Needs setup · ${n(r.missingEssential, 'item')}`
}

/** Readiness is shown only while a cohort is being prepared or running. */
export const showsReadiness = (status: string | null) => status === 'draft' || status === 'upcoming' || status === 'active'
