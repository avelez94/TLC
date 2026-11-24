// Shared shape for the dashboard's "Needs your attention" list. Every item comes from real
// records and links to the exact record or workflow that resolves it.
//
// Record links (each screen opens the record from its query string):
//   /admin/inquiries?id=<inquiry id>
//   /admin/cohorts?cohort=<cohort id>&section=<readiness|details|participants|schedule|reps|prompts|participation|attendance|completion|content|reading>
//   /admin/users?person=<profile id>            (/admin/users?invite=1&cohort=<id> opens the invite form)
//   /admin/registrations?id=<registration id>
//   /admin/security?email=<email_log id>        (email delivery list, that row highlighted)
//   /admin/resources?cohort=<cohort id>         (add-resource form for that cohort)
//   /admin/announcements?cohort=<cohort id>     (new announcement for that cohort)

export type AttentionSeverity = 'urgent' | 'action' | 'info'

export interface AttentionItem {
  /** Stable key, e.g. "email:123" or "inquiry-new:<id>". */
  id: string
  severity: AttentionSeverity
  /** Grouping on the dashboard. */
  group: 'inquiries' | 'emails' | 'registrations' | 'payments' | 'cohorts' | 'participants' | 'completion'
  title: string
  detail?: string
  href: string
  actionLabel: string
  /** For sorting: an ISO date/time the item became relevant (oldest first within a severity). */
  since?: string | null
}

export const SEVERITY_ORDER: Record<AttentionSeverity, number> = { urgent: 0, action: 1, info: 2 }
