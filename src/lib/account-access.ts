// Server-only: which email a person needs to get into their account, and sending it with a
// fresh link. Used by the invite route, the admin "send access email" action and resends.
import { supabaseAdmin } from './supabase-server'
import { deliverEmail, FROM_TLC, type SendResult } from './email'
import { accountSetupEmail, enrolledNoticeEmail, invitationEmail, passwordResetEmail } from './email-templates'

export type AccessKind = 'invitation' | 'account_setup' | 'enrolled_notice' | 'password_reset'
/** Template names in email_log for each kind (also what can be resent). */
export const ACCESS_TEMPLATES: Record<AccessKind, string> = {
  invitation: 'invite', account_setup: 'account_setup', enrolled_notice: 'enrollment_returning', password_reset: 'password_reset',
}
export const RESENDABLE_TEMPLATES = new Set(['invite', 'account_setup', 'enrollment_returning', 'password_reset'])

const site = () => process.env.NEXT_PUBLIC_SITE_URL ?? 'https://tramainecrawford.com'

export interface AuthState { exists: boolean; email: string | null; lastSignInAt: string | null; neverSignedIn: boolean }

export async function authState(userId: string): Promise<AuthState> {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId)
  if (error || !data?.user) return { exists: false, email: null, lastSignInAt: null, neverSignedIn: true }
  const last = data.user.last_sign_in_at ?? null
  return { exists: true, email: data.user.email ?? null, lastSignInAt: last, neverSignedIn: !last }
}

/** A one-time password link for an existing account (Supabase "recovery"). */
async function recoveryLink(email: string, kind: 'setup' | 'reset'): Promise<{ link?: string; error?: string }> {
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'recovery', email,
    options: { redirectTo: `${site()}/reset?type=recovery${kind === 'setup' ? '&welcome=1' : ''}` },
  })
  if (error || !data?.properties?.action_link) return { error: error?.message ?? 'no link was produced' }
  return { link: data.properties.action_link }
}

export interface AccessEmailInput {
  kind: AccessKind
  userId: string
  email: string
  name?: string | null
  role?: string
  cohortName?: string | null
  /** For kind 'invitation' the caller already generated the invite link. */
  inviteLink?: string
  idempotencyKey?: string
  resendOf?: number
  relatedType?: string
  relatedId?: string | null
}

export interface AccessEmailResult extends SendResult { kind: AccessKind }

/** Builds and sends one access email. Never throws; link problems are reported as failures. */
export async function sendAccessEmail(i: AccessEmailInput): Promise<AccessEmailResult> {
  const role = i.role ?? 'impact_participant'
  let rendered
  if (i.kind === 'invitation') {
    if (!i.inviteLink) return { kind: i.kind, sent: false, status: 'failed', error: 'no invitation link was produced' }
    rendered = invitationEmail({ name: i.name, link: i.inviteLink, role, cohortName: i.cohortName })
  } else if (i.kind === 'enrolled_notice') {
    rendered = enrolledNoticeEmail({ name: i.name, cohortName: i.cohortName ?? 'your new cohort' })
  } else {
    const { link, error } = await recoveryLink(i.email, i.kind === 'account_setup' ? 'setup' : 'reset')
    if (!link) return { kind: i.kind, sent: false, status: 'failed', error: `the sign-in link could not be created (${error})` }
    rendered = i.kind === 'account_setup'
      ? accountSetupEmail({ name: i.name, link, role, cohortName: i.cohortName })
      : passwordResetEmail({ link })
  }
  const r = await deliverEmail({
    template: ACCESS_TEMPLATES[i.kind], from: FROM_TLC, to: i.email, subject: rendered.subject, html: rendered.html,
    related: { userId: i.userId, type: i.relatedType ?? 'person', id: i.relatedId ?? i.userId },
    idempotencyKey: i.idempotencyKey, resendOf: i.resendOf,
  })
  if (r.status === 'accepted' && i.resendOf) {
    await supabaseAdmin.from('email_log').update({ resolved_at: new Date().toISOString() }).eq('id', i.resendOf).is('resolved_at', null)
  }
  return { ...r, kind: i.kind }
}

/** The right email for someone who needs to get in: set-up link if never signed in, else reset. */
export async function accessKindFor(userId: string): Promise<'account_setup' | 'password_reset'> {
  return (await authState(userId)).neverSignedIn ? 'account_setup' : 'password_reset'
}

/** Plain words for an admin message. */
export function describeAccess(r: AccessEmailResult, name: string): string {
  const what = {
    invitation: `The invitation to ${name}`, account_setup: `The account set-up link for ${name}`,
    enrolled_notice: `The "you're enrolled" email to ${name}`, password_reset: `The password reset email to ${name}`,
  }[r.kind]
  switch (r.status) {
    case 'accepted': return `${what} was accepted by the email service for delivery.`
    case 'duplicate': return `${what} was already sent for this request; it was not sent again.`
    case 'skipped': return `${what} was not sent: this is a test environment, so emails are not delivered.`
    default: return `${what} could not be sent${r.error ? `: ${r.error}` : ''}. Use Resend after checking the address.`
  }
}
