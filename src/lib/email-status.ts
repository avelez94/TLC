// Plain-language email delivery states for the admin portal (client-safe; no server imports).
import type { EmailLogRow } from '@/types'

export const TEMPLATE_LABEL: Record<string, string> = {
  invite: 'Invitation', account_setup: 'Account set-up link', enrollment_returning: '"You\'re enrolled" notice',
  password_reset: 'Password reset', inquiry_owner: 'New inquiry (to Tramaine)', inquiry_ack: 'Inquiry received (to visitor)',
  contact_owner: 'Contact form (to Tramaine)', contact_autoreply: 'Contact form reply', registration_confirmation: 'Registration confirmation',
  registration_owner: 'New registration (to Tramaine)', payment_request: 'Payment request',
}
export const RESENDABLE = new Set(['invite', 'account_setup', 'enrollment_returning', 'password_reset'])
export const PROBLEM_STATUSES = new Set(['failed', 'bounced', 'complained'])

export function templateLabel(t: string): string { return TEMPLATE_LABEL[t] ?? 'Email' }

/**
 * badge: the shared statusBadge key; label: short state; explain: what it means.
 * "Accepted" is not "delivered": the email service took the message; delivery is confirmed
 * only when delivery events are switched on (see docs/email-delivery.md).
 */
export function emailState(row: Pick<EmailLogRow, 'status' | 'resolved_at'>): { badge: string; label: string; explain: string } {
  switch (row.status) {
    case 'queued': return { badge: 'pending', label: 'Sending', explain: 'Being handed to the email service.' }
    case 'sent':
    case 'accepted': return { badge: 'open', label: 'Accepted', explain: 'The email service accepted it for delivery.' }
    case 'delivered': return { badge: 'open', label: 'Delivered', explain: "Delivered to the recipient's mail server." }
    case 'delayed': return { badge: 'pending', label: 'Delayed', explain: 'Delivery is delayed; the email service keeps trying.' }
    case 'bounced': return { badge: 'full', label: row.resolved_at ? 'Bounced · handled' : 'Bounced', explain: 'The address rejected it. Check the address.' }
    case 'complained': return { badge: 'full', label: 'Marked as spam', explain: 'The recipient marked it as spam.' }
    case 'failed': return { badge: row.resolved_at ? 'completed' : 'full', label: row.resolved_at ? 'Failed · handled' : 'Failed', explain: 'It was not sent.' }
    default: return { badge: 'completed', label: 'Not sent (test)', explain: 'Not sent on purpose: test environment.' }
  }
}
