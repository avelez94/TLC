// Turns activity-log rows into plain sentences for the owner ("Changed cohort "Fall 2027"
// status from Draft to Upcoming"). Covers the database-recorded entries (2d) and the older
// hand-written ones, so nothing is ever shown as raw code.

export interface ActivityRow {
  action: string
  entity_type: string | null
  entity_label?: string | null
  outcome?: string | null
  changes?: Record<string, { from?: unknown; to?: unknown; changed?: boolean }> | null
  details?: Record<string, unknown> | null
}

export interface ActivityLookups {
  program?: (id: string) => string | undefined
  cohort?: (id: string) => string | undefined
  person?: (id: string) => string | undefined
}

const ENTITY: Record<string, string> = {
  program: 'pathway or program', cohort: 'cohort', enrollment: 'enrollment', session: 'session', weekly_rep: 'weekly rep',
  journal_prompt: 'journal prompt', announcement: 'announcement', resource: 'resource', certificate: 'certificate',
  registration: 'registration', inquiry: 'inquiry', inquiry_note: 'note on inquiry', person: 'person',
  community_post: 'community post', community_comment: 'community comment', chat_message: 'chat message',
}

const FIELD: Record<string, string> = {
  name: 'name', tagline: 'tagline', price: 'price', price_label: 'price shown', is_public: 'shown on the Impact Lab page',
  enrollment_open: 'open for enrollment', session_day: 'session day', session_time: 'session time', program_id: 'pathway',
  status: 'status', start_date: 'start date', end_date: 'end date', capacity: 'capacity', cohort_id: 'cohort',
  title: 'title', session_date: 'date', session_number: 'session number', week_number: 'week', due_date: 'due date',
  archived_at: 'archived', prompt: 'prompt', type: 'type', portal_type: 'portal', follow_up_on: 'follow-up date',
  role: 'role', hourly_rate: 'hourly rate', zoom_link: 'meeting link', description: 'description', includes: 'what is included',
  expectations: 'expectations', book_title: 'book', book_image_url: 'book image', book_purchase_url: 'book link',
  opening_statement: 'opening statement', audience: 'who it is for', leadership_goal: 'development goal', keywords: 'focus areas',
  instructions: 'instructions', why_it_matters: 'why it matters', body: 'message', url: 'link or file', payment_status: 'checkout status',
  amount_paid: 'amount recorded', user_id: 'person',
}

const VALUE: Record<string, string> = {
  draft: 'Draft', upcoming: 'Upcoming', active: 'Active', completed: 'Completed', archived: 'Archived', cancelled: 'Cancelled',
  withdrawn: 'Withdrawn', admin: 'Administrator', impact_participant: 'Impact Lab participant', coaching_client: 'Coaching client',
  new: 'New', contacted: 'Contacted', qualified: 'Qualified', follow_up: 'Follow-up needed', converted: 'Converted', closed: 'Closed',
  pending: 'Pending', confirmed: 'Confirmed', declined: 'Declined', waitlist: 'Waitlist', impact: 'Impact Lab', coaching: 'Coaching', both: 'Both portals',
}

// Entries written before the activity log was recorded by the database.
const LEGACY: Record<string, string> = {
  'user.invite': 'Invited a user', 'user.role_change': 'Changed a role', 'enrollment.reactivate': 'Reactivated an enrollment',
  'enrollment.withdraw': 'Withdrew an enrollment', 'enrollment.returning': 'Enrolled a returning participant',
  'cohort.status': 'Changed a cohort status', 'payment_link.create': 'Sent a payment link', 'mfa.enroll': 'Turned on two-step verification',
  'mfa.remove': 'Removed an authenticator', 'mfa.reset': 'Reset another administrator’s two-step verification',
}

function show(field: string, v: unknown, look: ActivityLookups): string {
  if (v === null || v === undefined || v === '') return 'empty'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  const s = String(v)
  if (field === 'program_id') return look.program?.(s) ?? 'another pathway'
  if (field === 'cohort_id') return look.cohort?.(s) ?? 'another cohort'
  if (field === 'user_id') return look.person?.(s) ?? 'a person'
  if (field === 'archived_at') return 'Yes'
  if (field === 'price') return `$${s}`
  return VALUE[s] ?? s
}

export function describeChanges(row: ActivityRow, look: ActivityLookups = {}): string[] {
  const out: string[] = []
  for (const [field, c] of Object.entries(row.changes ?? {})) {
    const label = FIELD[field] ?? field.replace(/_/g, ' ')
    if (c.changed) out.push(`${label} changed`)
    else out.push(`${label}: ${show(field, c.from, look)} → ${show(field, c.to, look)}`)
  }
  return out
}

export function describeActivity(row: ActivityRow, look: ActivityLookups = {}): string {
  const label = row.entity_label ? `“${row.entity_label}”` : ''
  const failed = row.outcome === 'failed' ? 'Failed: ' : row.outcome === 'blocked' ? 'Blocked: ' : ''
  const [entityKey, verb] = row.action.split('.')
  const noun = ENTITY[entityKey]
  const changes = row.changes ?? {}

  if (!noun || (LEGACY[row.action] && !row.changes)) {
    const legacy = LEGACY[row.action]
    return failed + (legacy ? (label ? `${legacy} ${label}` : legacy) : row.action.replace(/[._]/g, ' '))
  }
  if (entityKey === 'person' && changes.role) {
    return `${failed}Changed ${row.entity_label || 'a person'}’s role from ${show('role', changes.role.from, look)} to ${show('role', changes.role.to, look)}`
  }
  if (entityKey === 'enrollment' && changes.status) {
    const to = changes.status.to
    const what = to === 'withdrawn' ? 'Withdrew' : to === 'active' ? 'Re-enrolled' : `Set to ${show('status', to, look)}:`
    return `${failed}${what} ${label}`.trim()
  }
  if (entityKey === 'enrollment' && verb === 'create') return `${failed}Enrolled ${label}`.trim()
  if (changes.status && Object.keys(changes).length === 1) {
    return `${failed}Changed ${noun} ${label} status from ${show('status', changes.status.from, look)} to ${show('status', changes.status.to, look)}`
  }
  const verbs: Record<string, string> = { create: 'Created', update: 'Updated', delete: 'Deleted', archive: 'Archived' }
  if (entityKey === 'inquiry_note' && verb === 'create') return `${failed}Added a note to inquiry ${label}`.trim()
  if (entityKey === 'certificate' && verb === 'create') return `${failed}Issued a certificate: ${label}`.trim()
  return `${failed}${verbs[verb] ?? verb} ${noun} ${label}`.trim()
}
