import { NextResponse } from 'next/server'
import { getSessionUserWithRole, supabaseAdmin } from '@/lib/supabase-server'
import { audit } from '@/lib/audit'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Recovery: an administrator who lost their authenticator asks the other administrator to
// reset it. Only an admin signed in WITH their own two-step code (aal2) may do this, only for
// another admin, and it is recorded in the activity log. The person then signs in with their
// password and sets up a new authenticator.
export async function POST(request: Request) {
  const session = await getSessionUserWithRole()
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!session.mfaVerified) {
    return NextResponse.json({ error: 'Turn on two-step verification for your own account and sign in with your code before resetting someone else’s.' }, { status: 403 })
  }
  const body = await request.json().catch(() => ({}))
  const userId = typeof body.user_id === 'string' && UUID_RE.test(body.user_id) ? body.user_id : null
  if (!userId) return NextResponse.json({ error: 'Choose an administrator.' }, { status: 400 })
  if (userId === session.user.id) return NextResponse.json({ error: 'You cannot reset your own two-step verification here. Use Security → your authenticators.' }, { status: 400 })

  const { data: target } = await supabaseAdmin.from('profiles').select('role, full_name, email').eq('id', userId).maybeSingle()
  if (!target || target.role !== 'admin') return NextResponse.json({ error: 'Only another administrator’s two-step verification can be reset here.' }, { status: 400 })

  const { data, error } = await supabaseAdmin.auth.admin.mfa.listFactors({ userId })
  if (error) return NextResponse.json({ error: 'Could not read their authenticators. Nothing was changed.' }, { status: 500 })
  let removed = 0
  for (const f of data?.factors ?? []) {
    const { error: delError } = await supabaseAdmin.auth.admin.mfa.deleteFactor({ id: f.id, userId })
    if (delError) {
      await audit(session.user.id, 'mfa.reset', 'person', userId, { removed }, { label: target.full_name || target.email, outcome: 'failed' })
      return NextResponse.json({ error: `Only ${removed} authenticator(s) were removed; try again.` }, { status: 500 })
    }
    removed++
  }
  await audit(session.user.id, 'mfa.reset', 'person', userId, { removed }, { label: target.full_name || target.email })
  return NextResponse.json({ success: true, removed })
}
