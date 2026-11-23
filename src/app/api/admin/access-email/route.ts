// Admin: help one person get into their account. Sends a fresh account set-up link if they
// have never signed in, otherwise a password reset link, and reports the real result.
// A second click within two minutes is refused unless `force` is set, so a slow email is
// not sent twice by accident; the same idempotency key is never sent twice.
import { NextResponse } from 'next/server'
import { requireAdmin, supabaseAdmin } from '@/lib/supabase-server'
import { audit } from '@/lib/audit'
import { ACCESS_TEMPLATES, accessKindFor, describeAccess, sendAccessEmail } from '@/lib/account-access'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const KEY_RE = /^[A-Za-z0-9:_-]{8,90}$/

export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 }) }
  const userId = typeof body.user_id === 'string' && UUID_RE.test(body.user_id) ? body.user_id : null
  const key = typeof body.idempotency_key === 'string' && KEY_RE.test(body.idempotency_key) ? body.idempotency_key : undefined
  if (!userId) return NextResponse.json({ ok: false, error: 'Choose a person.' }, { status: 400 })

  const { data: person } = await supabaseAdmin.from('profiles').select('id, full_name, email, role').eq('id', userId).maybeSingle()
  if (!person?.email) return NextResponse.json({ ok: false, error: 'This person has no email address on file.' }, { status: 400 })
  const name = person.full_name || person.email
  const kind = await accessKindFor(userId)

  if (body.force !== true) {
    const since = new Date(Date.now() - 2 * 60_000).toISOString()
    const { data: recent } = await supabaseAdmin.from('email_log').select('id, created_at')
      .eq('related_user_id', userId).eq('template', ACCESS_TEMPLATES[kind]).in('status', ['accepted', 'delivered', 'sent', 'queued'])
      .gte('created_at', since).limit(1)
    if (recent?.length) {
      return NextResponse.json({ ok: false, code: 'recently_sent', kind, error: `A ${kind === 'account_setup' ? 'set-up link' : 'password reset email'} was sent to ${name} less than two minutes ago. Give it a few minutes to arrive (ask them to check spam) before sending another.` }, { status: 409 })
    }
  }

  const resendOf = typeof body.resend_of === 'number' ? body.resend_of : undefined
  const r = await sendAccessEmail({ kind, userId, email: person.email, name, role: person.role ?? undefined, idempotencyKey: key, resendOf })
  await audit(admin.id, kind === 'account_setup' ? 'person.send_setup_link' : 'person.send_password_reset', 'person', userId,
    { email_status: r.status }, { label: name, outcome: r.status === 'failed' ? 'failed' : 'success' })
  return NextResponse.json({ ok: r.status !== 'failed', kind, status: r.status, log_id: r.logId ?? null, message: describeAccess(r, name) }, { status: r.status === 'failed' ? 502 : 200 })
}
