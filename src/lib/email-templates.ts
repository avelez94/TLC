// Branded account emails (invitation, account set-up, password reset, enrollment notice).
// One layout so every participant email looks the same. All dynamic values are escaped here.
import { esc } from './email'

const SITE = 'https://tramainecrawford.com'

function button(href: string, label: string) {
  return `<div style="text-align: center; margin: 2rem 0;"><a href="${esc(href)}" style="display: inline-block; background: #C88820; color: #001737; padding: 0.9rem 2rem; text-decoration: none; font-weight: 700; font-size: 0.85rem; letter-spacing: 0.08em; text-transform: uppercase; border-radius: 2px;">${esc(label)}</a></div>`
}
function fallbackLink(href: string) {
  return `<p style="font-size: 0.85rem; color: #4A5260; line-height: 1.6; margin-bottom: 1.5rem;">If the button doesn't work, copy and paste this link into your browser:<br/><a href="${esc(href)}" style="color: #C88820; word-break: break-all;">${esc(href)}</a></p>`
}
function layout(eyebrow: string, inner: string) {
  return `
  <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #1C2430;">
    <div style="background: #001737; padding: 2rem; text-align: center; margin-bottom: 2rem;">
      <h1 style="color: #C88820; font-size: 1.5rem; letter-spacing: 0.08em; margin: 0;">TLC LEADERSHIP</h1>
      <p style="color: rgba(255,255,255,0.5); font-size: 0.75rem; letter-spacing: 0.2em; text-transform: uppercase; margin: 0.5rem 0 0;">${esc(eyebrow)}</p>
    </div>
    <div style="padding: 0 1rem; font-size: 1rem; line-height: 1.75;">
      ${inner}
      <p style="margin-bottom: 1.5rem;">Questions? Reach Tramaine at <a href="mailto:tramaine@tramainecrawford.com" style="color: #C88820;">tramaine@tramainecrawford.com</a> or <a href="tel:+12025991381" style="color: #C88820;">(202) 599-1381</a>.</p>
      <p style="margin-top: 2rem; color: #4A5260;">Tramaine L. Crawford<br/>TLC Leadership Consulting &amp; Coaching</p>
    </div>
    <div style="background: #001737; padding: 1.5rem; text-align: center; margin-top: 2rem;">
      <p style="color: rgba(255,255,255,0.3); font-size: 0.75rem; margin: 0;">2001 L St NW, Suite 500, Washington, DC 20036</p>
    </div>
  </div>`
}
const p = (t: string) => `<p style="margin-bottom: 1.5rem;">${t}</p>`
const cohortLine = (cohortName?: string | null) => cohortName ? ` You are enrolled in <strong>${esc(cohortName)}</strong>.` : ''
const portalFor = (role: string) => role === 'coaching_client' ? 'Coaching Portal' : role === 'admin' ? 'Admin Portal' : 'Impact Lab Portal'

export interface Rendered { subject: string; html: string }

/** A brand-new account: link to choose a password (expires; one use). */
export function invitationEmail(o: { name?: string | null; link: string; role: string; cohortName?: string | null }): Rendered {
  return {
    subject: "You're invited to TLC Leadership",
    html: layout(portalFor(o.role), [
      p(`Hi ${esc(o.name || 'there')},`),
      p(`You've been invited to create your account with TLC Leadership Consulting &amp; Coaching.${cohortLine(o.cohortName)} Choose your password to get started.`),
      button(o.link, 'Set up my account'),
      fallbackLink(o.link),
      `<p style="font-size: 0.85rem; color: #4A5260; margin-bottom: 1.5rem;">For your security this link works once and expires. If it has expired, reply to this email or ask Tramaine to send a new one.</p>`,
    ].join('')),
  }
}

/** An account that exists but has never been used: finish setting it up (password link). */
export function accountSetupEmail(o: { name?: string | null; link: string; role: string; cohortName?: string | null }): Rendered {
  return {
    subject: 'Finish setting up your TLC Leadership account',
    html: layout(portalFor(o.role), [
      p(`Hi ${esc(o.name || 'there')},`),
      p(`Your TLC Leadership account is ready, but you haven't chosen a password yet.${cohortLine(o.cohortName)} Use the button below to set it up.`),
      button(o.link, 'Set up my account'),
      fallbackLink(o.link),
      `<p style="font-size: 0.85rem; color: #4A5260; margin-bottom: 1.5rem;">This link replaces any earlier invitation. It works once and expires.</p>`,
    ].join('')),
  }
}

/** Someone who already uses their account was added to a cohort: no link needed. */
export function enrolledNoticeEmail(o: { name?: string | null; cohortName: string }): Rendered {
  return {
    subject: `You're enrolled: ${o.cohortName}`.slice(0, 200),
    html: layout('The Impact Lab', [
      p(`Hi ${esc(o.name || 'there')},`),
      p(`Welcome back. You are enrolled in <strong>${esc(o.cohortName)}</strong>. Sign in with your existing email and password to see your sessions and materials. Your earlier programs and certificates are still in your portal.`),
      button(`${SITE}/login`, 'Sign in'),
      `<p style="font-size: 0.85rem; color: #4A5260; margin-bottom: 1.5rem;">Forgot your password? Use "Forgot password" on the sign-in page.</p>`,
    ].join('')),
  }
}

export function passwordResetEmail(o: { link: string }): Rendered {
  return {
    subject: 'Reset your TLC Leadership password',
    html: layout('Password reset', [
      p('Hi,'),
      p('We received a request to reset your password. Click below to choose a new one.'),
      button(o.link, 'Reset password'),
      fallbackLink(o.link),
      `<p style="font-size: 0.85rem; color: #4A5260; margin-bottom: 1.5rem;">If you didn't request this, you can safely ignore this email. The link works once and expires.</p>`,
    ].join('')),
  }
}
