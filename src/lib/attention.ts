// "Needs your attention": built only from real records, each item linking to the exact
// record or workflow that resolves it. Pure function so it can be unit-tested; payments add
// their own items (src/lib/payment-attention.ts). Nothing here changes any record.
import type { AttentionItem } from './attention-types'
import { SEVERITY_ORDER } from './attention-types'
import { cohortReadiness, type ReadinessInput } from './cohort-readiness'

export interface AttentionInput {
  today: string // YYYY-MM-DD, New York
  inquiries: { id: string; status: string; follow_up_on: string | null; kind: string; contact_name: string; organization: string | null; created_at: string }[]
  emailProblems: { id: number; template: string; recipient: string; status: string; related_user_id?: string | null; resolved_at?: string | null; created_at: string }[]
  registrations: { id: string; full_name: string; email: string; status: string | null; cohort_id: string | null; created_at: string }[]
  cohorts: (ReadinessInput['cohort'] & { status: string; completion_review_closed_at?: string | null })[]
  enrollments: { id?: string; cohort_id: string; user_id: string; status: string | null; enrolled_at?: string }[]
  people: { id: string; role: string | null; email: string | null; full_name: string | null; last_sign_in_at?: string | null }[]
  certificates: { user_id: string; cohort_id: string | null; revoked_at?: string | null }[]
  readiness: Omit<ReadinessInput, 'cohort'>
}

const TEMPLATE_NOUN: Record<string, string> = {
  invite: 'invitation', account_setup: 'account set-up link', enrollment_returning: '"you\'re enrolled" email', password_reset: 'password reset email',
  inquiry_ack: 'inquiry confirmation', contact_autoreply: 'contact form reply', registration_confirmation: 'registration confirmation',
  inquiry_owner: 'new-inquiry notification to you', contact_owner: 'contact-form notification to you', registration_owner: 'new-registration notification to you',
  payment_request: 'payment request',
}

const dayDiff = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000)
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const OPEN_INQUIRY = (s: string) => s !== 'converted' && s !== 'closed'

export function attentionItems(i: AttentionInput): AttentionItem[] {
  const items: AttentionItem[] = []
  const admins = new Set(i.people.filter(p => p.role === 'admin').map(p => p.id))
  const person = (id: string | null | undefined) => i.people.find(p => p.id === id)
  const nameOf = (id: string | null | undefined) => person(id)?.full_name || person(id)?.email || 'someone'
  const cohortById = new Map(i.cohorts.map(c => [c.id, c]))

  // ---------------------------------------------------------------- inquiries
  for (const q of i.inquiries) {
    const who = q.kind === 'organization' && q.organization ? q.organization : q.contact_name
    const due = OPEN_INQUIRY(q.status) && q.follow_up_on && q.follow_up_on <= i.today
    if (due) {
      const late = dayDiff(q.follow_up_on!, i.today)
      items.push({
        id: `inquiry-due:${q.id}`, severity: late > 0 ? 'urgent' : 'action', group: 'inquiries',
        title: late > 0 ? `Follow-up overdue: ${who}` : `Follow up today: ${who}`,
        detail: late > 0 ? `Planned for ${plural(late, 'day')} ago.` : undefined,
        href: `/admin/inquiries?id=${q.id}`, actionLabel: 'Open inquiry', since: q.follow_up_on,
      })
    } else if (q.status === 'new') {
      items.push({
        id: `inquiry-new:${q.id}`, severity: 'action', group: 'inquiries',
        title: `New ${q.kind === 'organization' ? 'organization' : 'individual'} inquiry: ${who}`,
        detail: 'Reply, then set the status and a follow-up date.', href: `/admin/inquiries?id=${q.id}`, actionLabel: 'Open inquiry', since: q.created_at,
      })
    }
  }

  // ---------------------------------------------------------------- emails
  for (const e of i.emailProblems.filter(e => !e.resolved_at)) {
    const noun = TEMPLATE_NOUN[e.template] ?? 'email'
    const account = ['invite', 'account_setup', 'enrollment_returning', 'password_reset'].includes(e.template) && e.related_user_id
    items.push({
      id: `email:${e.id}`, severity: 'urgent', group: 'emails',
      title: `${noun.charAt(0).toUpperCase()}${noun.slice(1)} ${e.status === 'bounced' ? 'bounced' : 'was not delivered'}: ${account ? nameOf(e.related_user_id) : e.recipient}`,
      detail: account ? 'Resend it with a fresh link, or mark it handled after reaching them another way.' : 'Check the address; mark it handled once dealt with.',
      href: account ? `/admin/users?person=${e.related_user_id}` : `/admin/security?email=${e.id}`, actionLabel: account ? 'Open person' : 'Review email', since: e.created_at,
    })
  }

  // ---------------------------------------------------------------- registrations
  for (const r of i.registrations.filter(r => r.status === 'pending')) {
    items.push({
      id: `registration:${r.id}`, severity: 'action', group: 'registrations', title: `Registration to review: ${r.full_name}`,
      detail: 'Confirm and give access, place on the waitlist, or decline.', href: `/admin/registrations?id=${r.id}`, actionLabel: 'Review', since: r.created_at,
    })
  }
  const emailToId = new Map(i.people.filter(p => p.email).map(p => [p.email!.toLowerCase(), p.id]))
  const notEnrolled = i.registrations.filter(r => {
    if (r.status !== 'confirmed' || !r.cohort_id) return false
    const uid = emailToId.get(r.email.toLowerCase())
    return !uid || !i.enrollments.some(e => e.user_id === uid && e.cohort_id === r.cohort_id)
  })
  if (notEnrolled.length) {
    items.push({
      id: 'registrations-not-enrolled', severity: 'info', group: 'registrations',
      title: `${plural(notEnrolled.length, 'confirmed registration')} without an enrollment`,
      detail: 'Records to review; nothing is changed automatically.', href: notEnrolled.length === 1 ? `/admin/registrations?id=${notEnrolled[0].id}` : '/admin/registrations?filter=review',
      actionLabel: 'Review', since: null,
    })
  }

  // ---------------------------------------------------------------- cohorts
  for (const c of i.cohorts) {
    if (!['draft', 'upcoming', 'active'].includes(c.status)) continue
    const days = c.start_date ? dayDiff(i.today, c.start_date) : null
    const relevant = c.status === 'active' || (days !== null && days <= 30)
    if (!relevant) continue
    const r = cohortReadiness({ ...i.readiness, cohort: c })
    if (r.missingEssential > 0) {
      const missing = r.essentials.filter(x => !x.done)
      items.push({
        id: `cohort-setup:${c.id}`, severity: c.status === 'active' || (days !== null && days <= 7) ? 'urgent' : 'action', group: 'cohorts',
        title: c.status === 'active' ? `${c.name} is running but setup is incomplete` : days !== null && days >= 0 ? `${c.name} starts in ${plural(days, 'day')} and needs setup` : `${c.name} needs setup`,
        detail: `Still to do: ${missing.map(x => x.action).join(', ')}.`, href: `/admin/cohorts?cohort=${c.id}&section=readiness`, actionLabel: 'Open checklist', since: c.start_date,
      })
    } else if (c.status === 'draft' && days !== null && days >= 0 && days <= 30) {
      items.push({
        id: `cohort-draft:${c.id}`, severity: 'action', group: 'cohorts', title: `${c.name} is ready but still a Draft`,
        detail: `It starts in ${plural(days, 'day')}. Set it to Upcoming when you want to announce it.`, href: `/admin/cohorts?cohort=${c.id}&section=details`, actionLabel: 'Open cohort', since: c.start_date,
      })
    } else if (c.status === 'upcoming' && days !== null && days >= 0 && days <= 14) {
      items.push({
        id: `cohort-soon:${c.id}`, severity: 'info', group: 'cohorts', title: `${c.name} starts in ${plural(days, 'day')}`,
        detail: 'Essential setup is done.', href: `/admin/cohorts?cohort=${c.id}&section=readiness`, actionLabel: 'Open cohort', since: c.start_date,
      })
    }

    // Participants who still cannot get in (never signed in, enrolled more than 3 days ago).
    const stuck = i.enrollments.filter(e => e.cohort_id === c.id && e.status === 'active' && !admins.has(e.user_id)
      && !person(e.user_id)?.last_sign_in_at && (!e.enrolled_at || dayDiff(e.enrolled_at.slice(0, 10), i.today) >= 3))
    if (stuck.length) {
      items.push({
        id: `cohort-signin:${c.id}`, severity: 'action', group: 'participants',
        title: `${plural(stuck.length, 'participant')} in ${c.name} ${stuck.length === 1 ? 'has' : 'have'} not signed in yet`,
        detail: stuck.slice(0, 3).map(e => nameOf(e.user_id)).join(', ') + (stuck.length > 3 ? ` and ${stuck.length - 3} more` : '') + '. Send a sign-in email from the Participants section.',
        href: `/admin/cohorts?cohort=${c.id}&section=participants`, actionLabel: 'Open participants', since: null,
      })
    }
  }

  // ---------------------------------------------------------------- completion and certificates
  // A cohort whose completion review an administrator closed (e.g. no certificates for that
  // cohort) raises no completion or certificate reminders; its records are not changed.
  const reviewClosed = new Set(i.cohorts.filter(c => c.completion_review_closed_at).map(c => c.id))
  for (const c of i.cohorts.filter(c => (c.status === 'completed' || c.status === 'archived') && !reviewClosed.has(c.id))) {
    const waiting = i.enrollments.filter(e => e.cohort_id === c.id && e.status === 'active' && !admins.has(e.user_id))
    if (waiting.length) {
      items.push({
        id: `completion:${c.id}`, severity: c.status === 'archived' ? 'info' : 'action', group: 'completion',
        title: `${c.name} has finished: record completion for ${plural(waiting.length, 'participant')}`,
        detail: 'Completion is your decision; certificates can be issued once it is recorded.', href: `/admin/cohorts?cohort=${c.id}&section=completion`, actionLabel: 'Review completion', since: c.end_date,
      })
    }
  }
  const noCert = i.enrollments.filter(e => e.status === 'completed' && !i.certificates.some(x => x.user_id === e.user_id && x.cohort_id === e.cohort_id && !x.revoked_at))
  const byCohort = new Map<string, number>()
  for (const e of noCert) byCohort.set(e.cohort_id, (byCohort.get(e.cohort_id) ?? 0) + 1)
  for (const [cohortId, n] of byCohort) {
    if (reviewClosed.has(cohortId)) continue
    items.push({
      id: `certificates:${cohortId}`, severity: 'info', group: 'completion',
      title: `${plural(n, 'completed participant')} in ${cohortById.get(cohortId)?.name ?? 'a cohort'} without a certificate`,
      detail: 'Issue certificates when you are ready.', href: `/admin/cohorts?cohort=${cohortId}&section=completion`, actionLabel: 'Issue certificates', since: null,
    })
  }

  return sortAttention(items)
}

export function sortAttention(items: AttentionItem[]): AttentionItem[] {
  return [...items].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || (a.since ?? '9999').localeCompare(b.since ?? '9999'))
}
