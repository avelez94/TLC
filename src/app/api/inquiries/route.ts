import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { esc, escMultiline, sendEmail, FROM_TLC, FROM_WEBSITE, OWNER_INBOX } from '@/lib/email'
import { cleanLine, cleanText, clientIp, isValidEmail } from '@/lib/security'
import { rateLimit } from '@/lib/rate-limit'
import { PATHWAY_SLUGS, DEFAULT_PATHWAYS } from '@/lib/pathways'

const ORG_TYPES = ['Corporate / private sector', 'Government agency', 'Educational institution', 'Nonprofit', 'Other']
const PARTICIPANTS = ['1–5', '6–15', '16–30', '31+', 'Not sure yet']
const TIMELINES = ['Within 3 months', '3–6 months', '6–12 months', 'Exploring options']
const PATHWAY_CHOICES = [...PATHWAY_SLUGS, 'unsure'] as const

// Public endpoint for the Impact Lab inquiry form (organizations and individuals).
// Stores the inquiry with the service role (the table is admin-only under RLS), notifies
// the owner, and sends the submitter a fixed-text acknowledgement.
export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // Honeypot: filled only by bots. Pretend success so they don't adapt.
  if (body.website) return NextResponse.json({ success: true })

  const kind = body.kind === 'individual' ? 'individual' : 'organization'
  const contact_name = cleanLine(body.contact_name, 120)
  const organization = cleanLine(body.organization, 160)
  const email = cleanLine(body.email, 254).toLowerCase()
  const phone = cleanLine(body.phone, 40)
  const organization_type = ORG_TYPES.includes(String(body.organization_type)) ? String(body.organization_type) : null
  const participants_estimate = PARTICIPANTS.includes(String(body.participants_estimate)) ? String(body.participants_estimate) : null
  const timeline = TIMELINES.includes(String(body.timeline)) ? String(body.timeline) : null
  const message = cleanText(body.message, 4000)
  const pathways = Array.isArray(body.pathways)
    ? [...new Set(body.pathways.filter((p): p is string => typeof p === 'string' && (PATHWAY_CHOICES as readonly string[]).includes(p)))]
    : []

  const errors: Record<string, string> = {}
  if (!contact_name) errors.contact_name = 'Enter the name of the person we should contact.'
  if (kind === 'organization' && !organization) errors.organization = 'Enter your organization’s name.'
  if (!isValidEmail(email)) errors.email = 'Enter a valid email address, like name@organization.org.'
  if (pathways.length === 0) errors.pathways = 'Choose at least one pathway, or “Not sure yet”.'
  if (Object.keys(errors).length) {
    return NextResponse.json({ error: 'Please correct the highlighted fields.', fields: errors }, { status: 400 })
  }

  if (!(await rateLimit('inquiry-ip', clientIp(request.headers), 5, 3600)) || !(await rateLimit('inquiry-email', email, 3, 86400))) {
    return NextResponse.json({ error: 'We already received several inquiries from you. Tramaine will be in touch, or email tramaine@tramainecrawford.com directly.' }, { status: 429 })
  }

  const { data: saved, error: dbError } = await supabaseAdmin
    .from('inquiries')
    .insert({
      kind, contact_name, organization: organization || null, email, phone: phone || null,
      organization_type, pathways, participants_estimate, timeline, message: message || null,
      source: 'impact-lab-page',
    })
    .select('id')
    .single()
  if (dbError || !saved) {
    console.error('Inquiry: save failed', dbError?.code)
    return NextResponse.json({ error: 'We could not save your inquiry. Please try again, or email tramaine@tramainecrawford.com.' }, { status: 500 })
  }

  const pathwayNames = pathways.map(p => DEFAULT_PATHWAYS.find(d => d.slug === p)?.name ?? 'Not sure yet').join(', ')
  const row = (label: string, value: string | null) =>
    value ? `<tr><td style="color:#4A5260;width:160px;padding:2px 0;">${esc(label)}</td><td style="padding:2px 0;">${esc(value)}</td></tr>` : ''

  // The inquiry is saved; email problems are logged but don't fail the submission.
  try {
    await sendEmail({
      template: 'inquiry_owner',
      from: FROM_WEBSITE,
      to: OWNER_INBOX,
      replyTo: email,
      subject: kind === 'organization' ? `New organizational inquiry — ${organization}` : `New Impact Lab inquiry — ${contact_name}`,
      html: `
        <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #1C2430;">
          <div style="background:#001737;padding:2rem;margin-bottom:1.5rem;"><h1 style="color:#C88820;font-size:1.25rem;letter-spacing:0.08em;margin:0;">New ${kind === 'organization' ? 'Organizational' : 'Individual'} Inquiry</h1></div>
          <div style="padding:0 1rem;">
            <table style="width:100%;font-size:0.9rem;line-height:1.6;">
              ${row('Contact', contact_name)}${row('Organization', organization || null)}${row('Email', email)}${row('Phone', phone || null)}
              ${row('Organization type', organization_type)}${row('Pathways', pathwayNames)}${row('Participants', participants_estimate)}${row('Timeline', timeline)}
            </table>
            ${message ? `<p style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.15em;color:#C88820;margin:1.5rem 0 0.5rem;">Additional information</p><p style="font-size:0.9rem;line-height:1.7;margin:0;">${escMultiline(message)}</p>` : ''}
            <a href="https://tramainecrawford.com/admin/inquiries" style="display:inline-block;background:#C88820;color:#001737;padding:0.75rem 1.5rem;text-decoration:none;font-weight:700;font-size:0.85rem;letter-spacing:0.08em;text-transform:uppercase;margin-top:1.5rem;border-radius:2px;">Open in Admin Panel</a>
          </div>
        </div>`,
    })
    await sendEmail({
      template: 'inquiry_ack',
      from: FROM_TLC,
      to: email,
      subject: 'We received your Impact Lab inquiry',
      html: `
        <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #1C2430;">
          <div style="background:#001737;padding:2rem;text-align:center;margin-bottom:2rem;"><h1 style="color:#C88820;font-size:1.5rem;letter-spacing:0.08em;margin:0;">THE IMPACT LAB</h1></div>
          <div style="padding:0 1rem;font-size:1rem;line-height:1.75;">
            <p>Hi ${esc(contact_name.split(' ')[0])},</p>
            <p>Thank you for your interest in The Impact Lab. We received your inquiry and Tramaine will follow up with you personally.</p>
            <p>If you have questions in the meantime, reach Tramaine at <a href="mailto:tramaine@tramainecrawford.com" style="color:#C88820;">tramaine@tramainecrawford.com</a>.</p>
            <p style="margin-top:2rem;color:#4A5260;">Tramaine L. Crawford<br/>TLC Leadership Consulting &amp; Coaching</p>
          </div>
        </div>`,
    })
  } catch (err) {
    console.error('Inquiry: notification failed', err instanceof Error ? err.message : err)
  }

  return NextResponse.json({ success: true })
}
