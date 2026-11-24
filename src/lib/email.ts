import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Resend } from 'resend'
import { emailRecipient, emailSinkDir } from './env-guard'
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
  /** The person / record this email is about, so the admin portal can show and resend it. */
  related?: { userId?: string | null; type?: string; id?: string | null }
  /**
   * One key per intended send (e.g. one per button click). A second request with the same key
   * is reported as a duplicate and nothing is sent again. Also passed to the provider.
   */
  idempotencyKey?: string
  /** The failed email this one replaces (resend). */
  resendOf?: number
}

/**
 * accepted  the provider took the message for delivery (later events may say delivered/bounced)
 * failed    the provider refused it, or it could not be handed over
 * skipped   not sent on purpose (non-production without a test recipient)
 * duplicate this exact request was already handled; nothing was sent again
 */
export type EmailOutcome = 'accepted' | 'failed' | 'skipped' | 'duplicate'
export interface SendResult { sent: boolean; status: EmailOutcome; id?: string; logId?: number; error?: string }

/** Plain-language result for admin messages. Never claims a send that did not happen. */
export function describeEmailResult(r: SendResult, what = 'The email'): string {
  switch (r.status) {
    case 'accepted': return `${what} was handed to the email service for delivery.`
    case 'duplicate': return `${what} was already sent for this request; it was not sent again.`
    case 'skipped': return `${what} was not sent (test environment: emails are not delivered here).`
    default: return `${what} could not be sent${r.error ? ` (${r.error})` : ''}.`
  }
}

type LogStatus = 'queued' | 'accepted' | 'failed' | 'skipped'

async function insertLog(row: Record<string, unknown>): Promise<{ id?: number; duplicateOf?: { id: number; status: string } }> {
  try {
    const { data, error } = await supabaseAdmin.from('email_log').insert(row).select('id').single()
    if (error) {
      if (error.code === '23505' && row.idempotency_key) {
        const { data: prev } = await supabaseAdmin.from('email_log').select('id, status').eq('idempotency_key', row.idempotency_key as string).maybeSingle()
        if (prev) return { duplicateOf: prev as { id: number; status: string } }
      }
      // Older schema (before 2e) or another problem: retry with the original columns only.
      const { template, recipient, subject, status, provider_id, error: err } = row
      const retry = await supabaseAdmin.from('email_log').insert({ template, recipient, subject, status: status === 'accepted' || status === 'queued' ? 'sent' : status, provider_id, error: err }).select('id').single()
      return { id: retry.data?.id as number | undefined }
    }
    return { id: data.id as number }
  } catch {
    return {}
  }
}

async function updateLog(id: number | undefined, patch: Record<string, unknown>) {
  if (!id) return
  try { await supabaseAdmin.from('email_log').update(patch).eq('id', id) } catch { /* best effort */ }
}

let sinkCounter = 0
/**
 * Local test transport: writes the message to a folder. Failures can be simulated for tests:
 * any "+fail@" address, or an address listed in <dir>/fail-addresses.txt (one per line).
 */
async function sinkSend(dir: string, msg: OutgoingEmail, subject: string): Promise<{ id?: string; error?: string }> {
  await mkdir(dir, { recursive: true })
  const failing = await readFile(path.join(dir, 'fail-addresses.txt'), 'utf8').catch(() => '')
  if (/\+fail@/i.test(msg.to) || failing.split(/\s+/).some(a => a && a.toLowerCase() === msg.to.toLowerCase())) {
    return { error: 'Simulated delivery failure (local test)' }
  }
  const id = `sink_${Date.now()}_${++sinkCounter}`
  await writeFile(path.join(dir, `${id}.json`), JSON.stringify({ id, to: msg.to, subject, template: msg.template, html: msg.html, at: new Date().toISOString() }, null, 2))
  return { id }
}

/**
 * Sends one email and records the real outcome in email_log. Never throws.
 * Outside production the message goes to EMAIL_TEST_RECIPIENT, to the local sink folder
 * (EMAIL_SINK_DIR), or is skipped — preview and local testing never email real people.
 * Links and message bodies are never written to the log.
 */
export async function deliverEmail(msg: OutgoingEmail): Promise<SendResult> {
  const template = (msg.template ?? 'unnamed').slice(0, 60)
  const subject = msg.subject.replace(/[\r\n]+/g, ' ').slice(0, 200)
  const sink = emailSinkDir(process.env)
  const to = sink ? msg.to : emailRecipient(process.env, msg.to)
  const base = {
    template, recipient: (to ?? msg.to).slice(0, 254), subject,
    related_user_id: msg.related?.userId ?? null, related_type: msg.related?.type ?? null, related_id: msg.related?.id ?? null,
    resend_of: msg.resendOf ?? null, idempotency_key: msg.idempotencyKey ?? null,
  }

  if (!to) {
    const log = await insertLog({ ...base, status: 'skipped' satisfies LogStatus })
    if (log.duplicateOf) return { sent: false, status: 'duplicate', logId: log.duplicateOf.id }
    console.info(`[email] skipped outside production: "${subject}"`)
    return { sent: false, status: 'skipped', logId: log.id }
  }

  const log = await insertLog({ ...base, status: 'queued' satisfies LogStatus })
  if (log.duplicateOf) {
    const ok = ['accepted', 'sent', 'delivered'].includes(log.duplicateOf.status)
    return { sent: ok, status: 'duplicate', logId: log.duplicateOf.id }
  }

  let id: string | undefined
  let error: string | undefined
  try {
    if (sink) {
      ({ id, error } = await sinkSend(sink, { ...msg, to }, subject))
    } else {
      const { template: _t, related: _r, idempotencyKey, resendOf: _o, ...payload } = msg
      void _t; void _r; void _o
      const { data, error: err } = await resend().emails.send({ ...payload, to, subject }, idempotencyKey ? { idempotencyKey } : undefined)
      if (err) error = err.message
      id = data?.id
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }

  if (error) {
    await updateLog(log.id, { status: 'failed', error: error.slice(0, 500), last_event_at: new Date().toISOString() })
    return { sent: false, status: 'failed', logId: log.id, error }
  }
  await updateLog(log.id, { status: 'accepted', provider_id: id ?? null, last_event: 'accepted', last_event_at: new Date().toISOString() })
  return { sent: true, status: 'accepted', id, logId: log.id }
}

/**
 * Compatibility wrapper for existing callers: same as deliverEmail, but throws when the
 * provider refuses the message (so the caller's error handling runs).
 */
export async function sendEmail(msg: OutgoingEmail): Promise<SendResult> {
  const r = await deliverEmail(msg)
  if (r.status === 'failed') throw new Error(`Email error: ${r.error ?? 'unknown'}`)
  return r
}
