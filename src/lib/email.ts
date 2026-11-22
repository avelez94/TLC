import { Resend } from 'resend'
import { emailRecipient } from './env-guard'
import { supabaseAdmin } from './supabase-server'

export { escapeHtml as esc, escapeMultiline as escMultiline } from './security'

export const FROM_TLC = 'TLC Leadership <noreply@contact.tramainecrawford.com>'
export const FROM_PLATFORM = 'TLC Platform <noreply@contact.tramainecrawford.com>'
export const FROM_WEBSITE = 'TLC Website <noreply@contact.tramainecrawford.com>'
export const OWNER_INBOX = 'tramaine@tramainecrawford.com'

let client: Resend | null = null
function resend(): Resend {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured')
  client ??= new Resend(process.env.RESEND_API_KEY)
  return client
}

export interface OutgoingEmail {
  from: string
  to: string
  subject: string
  html: string
  replyTo?: string
  /** Short name for the email log, e.g. "inquiry_owner". */
  template?: string
}

/** Best effort: delivery history for the admin portal. Never blocks or fails a send. */
async function logEmail(template: string, recipient: string, subject: string, status: 'sent' | 'failed' | 'skipped', providerId?: string, error?: string) {
  try {
    await supabaseAdmin.from('email_log').insert({
      template: template.slice(0, 60), recipient: recipient.slice(0, 254), subject: subject.slice(0, 200),
      status, provider_id: providerId ?? null, error: error ? error.slice(0, 500) : null,
    })
  } catch {
    // table not present yet, or database unavailable: the email outcome is still returned
  }
}

/**
 * Sends through Resend. Outside production the message goes to EMAIL_TEST_RECIPIENT (or is
 * skipped), so preview and local testing never email real participants.
 * Subjects are collapsed to one line. All dynamic values in `html` must already be escaped.
 */
export async function sendEmail(msg: OutgoingEmail): Promise<{ sent: boolean; id?: string }> {
  const template = msg.template ?? 'unnamed'
  const subject = msg.subject.replace(/[\r\n]+/g, ' ').slice(0, 200)
  const to = emailRecipient(process.env, msg.to)
  if (!to) {
    console.info(`[email] skipped outside production: "${subject}"`)
    await logEmail(template, msg.to, subject, 'skipped')
    return { sent: false }
  }
  const { template: _t, ...payload } = msg
  void _t
  const { data, error } = await resend().emails.send({ ...payload, to, subject })
  if (error) {
    await logEmail(template, to, subject, 'failed', undefined, error.message)
    throw new Error(`Resend error: ${error.message}`)
  }
  await logEmail(template, to, subject, 'sent', data?.id)
  return { sent: true, id: data?.id }
}
