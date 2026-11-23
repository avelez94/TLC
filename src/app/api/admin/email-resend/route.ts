// Admin: resend a failed account email (invitation, set-up link, password reset, enrollment
// notice) with a FRESH link. The original row is marked resolved only when the new one is
// accepted. Other emails (owner notifications, receipts) are not resent from here.
import { NextResponse } from 'next/server'
import { requireAdmin, supabaseAdmin } from '@/lib/supabase-server'
import { audit } from '@/lib/audit'
import { RESENDABLE_TEMPLATES, accessKindFor, describeAccess, sendAccessEmail } from '@/lib/account-access'

const KEY_RE = /^[A-Za-z0-9:_-]{8,90}$/

export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 }) }
  const logId = typeof body.log_id === 'number' ? body.log_id : null
  const key = typeof body.idempotency_key === 'string' && KEY_RE.test(body.idempotency_key) ? body.idempotency_key : undefined
  if (!logId) return NextResponse.json({ ok: false, error: 'Choose an email to resend.' }, { status: 400 })

  const { data: row } = await supabaseAdmin.from('email_log').select('id, template, status, related_user_id, related_type, related_id, resolved_at').eq('id', logId).maybeSingle()
  if (!row) return NextResponse.json({ ok: false, error: 'That email record was not found.' }, { status: 404 })
  if (row.resolved_at) return NextResponse.json({ ok: false, code: 'already_resolved', error: 'This email was already resent or marked as handled.' }, { status: 409 })
  if (!['failed', 'bounced', 'complained'].includes(row.status)) return NextResponse.json({ ok: false, error: 'Only failed or bounced emails can be resent here.' }, { status: 409 })
  if (!RESENDABLE_TEMPLATES.has(row.template) || !row.related_user_id) {
    return NextResponse.json({ ok: false, code: 'not_resendable', error: 'This kind of email cannot be resent from here. Contact the person directly, then mark it as handled.' }, { status: 409 })
  }
  const { data: person } = await supabaseAdmin.from('profiles').select('id, full_name, email, role').eq('id', row.related_user_id).maybeSingle()
  if (!person?.email) return NextResponse.json({ ok: false, error: 'The person for this email no longer has an account.' }, { status: 409 })
  const name = person.full_name || person.email

  // An enrollment notice is resent as-is; anything about getting in gets the right fresh link.
  let cohortName: string | null = null
  if (row.related_type === 'enrollment' && row.related_id) {
    const { data: enr } = await supabaseAdmin.from('cohort_enrollments').select('cohorts(name)').eq('id', row.related_id).maybeSingle()
    cohortName = (enr?.cohorts as unknown as { name: string } | null)?.name ?? null
  }
  const kind = row.template === 'enrollment_returning' ? 'enrolled_notice' : await accessKindFor(person.id)
  const r = await sendAccessEmail({ kind, userId: person.id, email: person.email, name, role: person.role ?? undefined, cohortName,
    idempotencyKey: key, resendOf: row.id, relatedType: row.related_type ?? undefined, relatedId: row.related_id })
  await audit(admin.id, 'email.resend', 'email', String(row.id), { template: row.template, new_status: r.status }, { label: name, outcome: r.status === 'failed' ? 'failed' : 'success' })
  return NextResponse.json({ ok: r.status === 'accepted' || r.status === 'skipped', kind, status: r.status, log_id: r.logId ?? null, message: describeAccess(r, name) }, { status: r.status === 'failed' ? 502 : 200 })
}
