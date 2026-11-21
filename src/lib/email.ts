import { Resend } from 'resend'
import { emailRecipient } from './env-guard'

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
}

/**
 * Sends through Resend. Outside production the message goes to EMAIL_TEST_RECIPIENT (or is
 * skipped), so preview and local testing never email real participants.
 * Subjects are collapsed to one line. All dynamic values in `html` must already be escaped.
 */
export async function sendEmail(msg: OutgoingEmail): Promise<{ sent: boolean; id?: string }> {
  const to = emailRecipient(process.env, msg.to)
  if (!to) {
    console.info(`[email] skipped outside production: "${msg.subject}"`)
    return { sent: false }
  }
  const subject = msg.subject.replace(/[\r\n]+/g, ' ').slice(0, 200)
  const { data, error } = await resend().emails.send({ ...msg, to, subject })
  if (error) throw new Error(`Resend error: ${error.message}`)
  return { sent: true, id: data?.id }
}
