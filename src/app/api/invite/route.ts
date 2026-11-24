// Invite or enroll one person (admin only). Handles every account situation:
//   new person                         → account + invitation link (+ enrollment)
//   account exists, never signed in    → enrollment + fresh account set-up link (never "sign in")
//   account exists and in use          → enrollment + "you're enrolled" notice
//   already enrolled in this cohort    → nothing changes; reported as already enrolled
//   withdrew from this cohort          → re-enrolled only when the admin confirms (reenroll: true)
// The enrollment is verified before success is reported, and the email result is reported
// separately and truthfully (accepted / failed / skipped). Optional inquiry_id records the
// person against the inquiry (inquiry_participants).
import { NextResponse } from 'next/server'
import { requireAdmin, supabaseAdmin } from '@/lib/supabase-server'
import { cleanLine, isValidEmail } from '@/lib/security'
import { audit } from '@/lib/audit'
import { likeExact } from '@/lib/payments'
import { authState, describeAccess, sendAccessEmail, type AccessEmailResult } from '@/lib/account-access'

const ALLOWED_ROLES = ['impact_participant', 'coaching_client', 'admin'] as const
type InviteRole = (typeof ALLOWED_ROLES)[number]
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const KEY_RE = /^[A-Za-z0-9:_-]{8,90}$/
const ENROLLABLE = new Set(['draft', 'upcoming', 'active'])

type Outcome = 'invited' | 'enrolled' | 'reenrolled' | 'already_enrolled' | 'account_created'
type InquiryResult = 'invited' | 'setup_link_sent' | 'enrolled' | 'already_enrolled' | 'failed'

const fail = (status: number, code: string, error: string, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ ok: false, code, error, ...extra }, { status })

export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return fail(401, 'unauthorized', 'Unauthorized')

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return fail(400, 'invalid', 'Invalid request') }

  const email = cleanLine(body.email, 254).toLowerCase()
  const full_name = cleanLine(body.full_name, 120)
  const role = body.role as InviteRole
  const program_id = typeof body.program_id === 'string' && UUID_RE.test(body.program_id) ? body.program_id : null
  const cohort_id = typeof body.cohort_id === 'string' && UUID_RE.test(body.cohort_id) ? body.cohort_id : null
  const inquiry_id = typeof body.inquiry_id === 'string' && UUID_RE.test(body.inquiry_id) ? body.inquiry_id : null
  const reenroll = body.reenroll === true
  const key = typeof body.idempotency_key === 'string' && KEY_RE.test(body.idempotency_key) ? body.idempotency_key : undefined

  if (!isValidEmail(email) || !ALLOWED_ROLES.includes(role)) return fail(400, 'invalid', 'Enter a valid email address and choose a role.')
  if (role === 'impact_participant' && !full_name) return fail(400, 'invalid', 'Enter their name.')

  const warnings: string[] = []
  const recordForInquiry = async (result: InquiryResult, userId: string | null, detail: string) => {
    if (!inquiry_id) return
    const { error } = await supabaseAdmin.from('inquiry_participants').upsert(
      { inquiry_id, email, full_name: full_name || email, user_id: userId, cohort_id, result, detail: detail.slice(0, 500), created_by: admin.id, updated_at: new Date().toISOString() },
      { onConflict: 'inquiry_id,email' })
    if (error) warnings.push('The result could not be saved on the inquiry. Add a note there so it is not lost.')
  }

  try {
    let cohort: { id: string; name: string; capacity: number | null; status: string } | null = null
    if (cohort_id) {
      const { data } = await supabaseAdmin.from('cohorts').select('id, name, capacity, status').eq('id', cohort_id).maybeSingle()
      if (!data) return fail(400, 'cohort_missing', 'That cohort no longer exists.')
      if (!ENROLLABLE.has(data.status)) return fail(409, 'cohort_unavailable', `${data.name} is ${data.status}, so nobody can be enrolled in it. Choose a draft, upcoming or running cohort.`)
      cohort = data
    }
    const seatCheck = async () => {
      if (!cohort || cohort.capacity == null) return null
      const { count } = await supabaseAdmin.from('cohort_enrollments').select('id', { count: 'exact', head: true }).eq('cohort_id', cohort.id).eq('status', 'active')
      return (count ?? 0) >= cohort.capacity ? `${cohort.name} is full (${count} of ${cohort.capacity} seats taken). Raise the capacity in Cohorts first.` : null
    }

    // ------------------------------------------------------------ existing account
    const { data: existing } = await supabaseAdmin.from('profiles').select('id, full_name, role').ilike('email', likeExact(email)).maybeSingle()
    if (existing) {
      const name = existing.full_name || full_name || email
      if (role !== 'impact_participant' || !cohort) {
        return fail(409, 'account_exists', `${name} already has an account. To add them to a cohort, choose Impact Lab participant and a cohort. To help them sign in, open their record in Participants and use "Send sign-in email".`, { user_id: existing.id })
      }
      if (existing.role !== 'impact_participant') {
        return fail(409, 'account_exists_other_role', `${name} has a ${existing.role === 'admin' ? 'administrator' : 'coaching'} account. Enroll them from their record in Participants if that is intended.`, { user_id: existing.id })
      }

      const { data: current } = await supabaseAdmin.from('cohort_enrollments').select('id, status').eq('cohort_id', cohort.id).eq('user_id', existing.id).maybeSingle()
      const access = await authState(existing.id)
      let outcome: Outcome
      if (current?.status === 'active' || current?.status === 'completed') {
        outcome = 'already_enrolled'
        const detail = current.status === 'completed' ? 'Already completed this cohort.' : 'Already enrolled in this cohort.'
        await recordForInquiry('already_enrolled', existing.id, detail)
        return NextResponse.json({
          ok: true, outcome, user_id: existing.id, enrollment_status: current.status, never_signed_in: access.neverSignedIn, email: null, warnings,
          message: `${name} is ${current.status === 'completed' ? 'listed as having completed' : 'already enrolled in'} ${cohort.name}. Nothing was changed and no email was sent.${access.neverSignedIn ? ' They have not signed in yet: use "Send sign-in email" on their record if they need a new link.' : ''}`,
        })
      }
      if (current?.status === 'withdrawn' && !reenroll) {
        return fail(409, 'withdrawn_needs_confirm', `${name} withdrew from ${cohort.name} earlier. Confirm that you want to re-enroll them.`, { user_id: existing.id })
      }
      const full = await seatCheck()
      if (full) { await recordForInquiry('failed', existing.id, full); return fail(409, 'cohort_full', full) }

      const write = current
        ? await supabaseAdmin.from('cohort_enrollments').update({ status: 'active' }).eq('id', current.id).select('id, status').single()
        : await supabaseAdmin.from('cohort_enrollments').insert({ user_id: existing.id, cohort_id: cohort.id, status: 'active' }).select('id, status').single()
      if (write.error || write.data?.status !== 'active') {
        const msg = write.error?.details === 'cohort_full' ? write.error.message : `${name} could not be enrolled in ${cohort.name}.`
        await recordForInquiry('failed', existing.id, msg)
        await audit(admin.id, 'enrollment.create', 'enrollment', existing.id, { cohort_id: cohort.id }, { label: `${name} — ${cohort.name}`, outcome: 'failed' })
        return fail(write.error?.details === 'cohort_full' ? 409 : 500, write.error?.details === 'cohort_full' ? 'cohort_full' : 'enrollment_failed', msg)
      }
      outcome = current ? 'reenrolled' : 'enrolled'
      await audit(admin.id, current ? 'enrollment.reenroll' : 'enrollment.returning', 'enrollment', existing.id, { cohort_id: cohort.id }, { label: `${name} — ${cohort.name}` })

      // Someone who never set a password gets a fresh set-up link, not "sign in".
      const mail: AccessEmailResult = await sendAccessEmail({
        kind: access.neverSignedIn ? 'account_setup' : 'enrolled_notice', userId: existing.id, email, name, cohortName: cohort.name,
        idempotencyKey: key ? `${key}:email` : undefined, relatedType: 'enrollment', relatedId: write.data.id,
      })
      await recordForInquiry(mail.status === 'failed' ? 'enrolled' : access.neverSignedIn ? 'setup_link_sent' : 'enrolled', existing.id,
        `${outcome === 'reenrolled' ? 'Re-enrolled' : 'Enrolled'} in ${cohort.name}. ${describeAccess(mail, name)}`)
      return NextResponse.json({
        ok: true, outcome, user_id: existing.id, enrollment_status: 'active', never_signed_in: access.neverSignedIn,
        email: { kind: mail.kind, status: mail.status, log_id: mail.logId ?? null }, warnings,
        message: `${name} is ${outcome === 'reenrolled' ? 're-enrolled' : 'enrolled'} in ${cohort.name}. ${describeAccess(mail, name)}`,
      })
    }

    // ------------------------------------------------------------ new account
    const full = await seatCheck()
    if (full) { await recordForInquiry('failed', null, full); return fail(409, 'cohort_full', full) }

    const { data: link, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite', email,
      options: { data: { full_name, role }, redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset?type=invite` },
    })
    if (linkError || !link?.user) {
      await recordForInquiry('failed', null, `The account could not be created: ${linkError?.message ?? 'unknown error'}`)
      return fail(400, 'account_failed', `The account could not be created: ${linkError?.message ?? 'unknown error'}.`)
    }
    const userId = link.user.id
    const name = full_name || email

    const { error: profileError } = await supabaseAdmin.from('profiles').update({ full_name: full_name || null, role, email }).eq('id', userId)
    if (profileError) warnings.push(`The account was created, but its role could not be set to ${role}. Check it in Participants.`)

    let outcome: Outcome = 'account_created'
    let enrollmentId: string | null = null
    if (role === 'impact_participant' && cohort) {
      const { data: enr, error: enrollError } = await supabaseAdmin.from('cohort_enrollments').insert({ user_id: userId, cohort_id: cohort.id, status: 'active' }).select('id').single()
      if (enrollError || !enr) {
        warnings.push(`The account was created, but enrolling them in ${cohort.name} failed${enrollError?.details === 'cohort_full' ? ' (the cohort filled up)' : ''}. Enroll them from the cohort's Participants section.`)
      } else { enrollmentId = enr.id; outcome = 'invited' }
    } else if (role !== 'impact_participant' || !cohort) {
      outcome = 'invited'
    }
    if (role === 'coaching_client' && program_id) {
      await supabaseAdmin.from('coaching_sessions').insert({ client_id: userId, coach_id: admin.id, title: 'Foundation Session', status: 'upcoming' })
    }

    const mail = await sendAccessEmail({
      kind: 'invitation', userId, email, name, role, cohortName: enrollmentId ? cohort?.name : null,
      inviteLink: link.properties?.action_link, idempotencyKey: key ? `${key}:email` : undefined,
      relatedType: enrollmentId ? 'enrollment' : 'person', relatedId: enrollmentId ?? userId,
    })
    await audit(admin.id, 'user.invite', 'person', userId, { role, cohort_id, email_status: mail.status }, { label: name, outcome: 'success' })
    await recordForInquiry(enrollmentId ? 'invited' : mail.status === 'failed' ? 'failed' : 'invited', userId,
      `${enrollmentId ? `Account created and enrolled in ${cohort?.name}.` : 'Account created (not enrolled).'} ${describeAccess(mail, name)}`)

    return NextResponse.json({
      ok: true, outcome, user_id: userId, enrollment_status: enrollmentId ? 'active' : null, never_signed_in: true,
      email: { kind: mail.kind, status: mail.status, log_id: mail.logId ?? null }, warnings,
      message: `${enrollmentId ? `${name} is enrolled in ${cohort?.name}` : `An account was created for ${name}`}. ${describeAccess(mail, name)}`,
    })
  } catch (err) {
    console.error('Invite error:', err instanceof Error ? err.message : err)
    return fail(500, 'server_error', 'Something went wrong on the server. Check Participants before trying again, so nobody is invited twice.')
  }
}
