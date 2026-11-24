// Admin actions on one registration's payment record (never its enrollment):
//   complimentary         mark the place as free on purpose, with a reason (who approved is recorded)
//   remove_complimentary  undo that (back to "Not paid")
//   resolve_issue         mark a flagged payment issue as reviewed, with an optional note
//   sync                  re-read the checkout from Stripe (for a missed webhook) and record it
// Enrolling is still done with "Confirm and give access" (POST /api/invite).
import { NextResponse } from 'next/server'
import { requireAdmin, supabaseAdmin } from '@/lib/supabase-server'
import { cleanText } from '@/lib/security'
import { audit } from '@/lib/audit'
import { syncRegistrationFromStripe } from '@/lib/payments'
import { fail, paymentDeps, stripeFailure, UUID_RE } from '../../payment-requests/deps'

const COMPLIMENTARY_FROM = ['unpaid', 'expired', 'failed']

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) return fail(401, 'Unauthorized')
  const { id } = await params
  if (!UUID_RE.test(id)) return fail(400, 'Invalid request')
  let body: Record<string, unknown>
  try { body = await request.json() } catch { return fail(400, 'Invalid request') }

  const { data: reg } = await supabaseAdmin.from('registrations').select('id, full_name, payment_status, enrollment_issue, complimentary_reason').eq('id', id).maybeSingle()
  if (!reg) return fail(404, 'That registration no longer exists.')
  const current = reg.payment_status ?? 'unpaid'

  switch (body.action) {
    case 'complimentary': {
      const reason = cleanText(body.reason, 300)
      if (!reason) return fail(400, 'Give the reason for the complimentary place (for example “Scholarship” or “Partner organization”).')
      if (!COMPLIMENTARY_FROM.includes(current)) {
        return fail(409, current === 'complimentary' ? 'This place is already complimentary.'
          : current === 'pending' ? 'A payment is being processed for this registration. Wait for it to finish first.'
          : 'This registration has a payment on record. Refund it in Stripe first if the place should be free.')
      }
      const { data, error } = await supabaseAdmin.from('registrations')
        .update({ payment_status: 'complimentary', complimentary_reason: reason, complimentary_approved_by: admin.id, payment_error: null })
        .eq('id', id).in('payment_status', COMPLIMENTARY_FROM).select('id')
      if (error || !data?.length) return fail(409, 'The registration changed while you were editing it. Refresh the page and try again.')
      await audit(admin.id, 'registration.complimentary', 'registration', id, { from: current }, { label: reg.full_name })
      return NextResponse.json({ ok: true, message: `${reg.full_name}'s place is marked complimentary. They are not enrolled yet: use “Confirm and give access” when ready.` })
    }
    case 'remove_complimentary': {
      if (current !== 'complimentary') return fail(409, 'This place is not complimentary.')
      const { error } = await supabaseAdmin.from('registrations')
        .update({ payment_status: 'unpaid', complimentary_reason: null, complimentary_approved_by: null }).eq('id', id).eq('payment_status', 'complimentary')
      if (error) return fail(500, 'The change could not be saved.')
      await audit(admin.id, 'registration.complimentary_removed', 'registration', id, { reason: reg.complimentary_reason }, { label: reg.full_name })
      return NextResponse.json({ ok: true, message: 'No longer complimentary. Their enrollment (if any) was not changed.' })
    }
    case 'resolve_issue': {
      if (!reg.enrollment_issue) return fail(409, 'There is no open issue on this registration.')
      const note = cleanText(body.note, 300)
      const { error } = await supabaseAdmin.from('registrations').update({ enrollment_issue: null, enrollment_issue_at: null }).eq('id', id).eq('enrollment_issue', reg.enrollment_issue)
      if (error) return fail(500, 'The change could not be saved.')
      await audit(admin.id, 'registration.issue_resolved', 'registration', id, { issue: reg.enrollment_issue, note: note || null }, { label: reg.full_name })
      return NextResponse.json({ ok: true, message: 'Marked as reviewed.' })
    }
    case 'sync': {
      try {
        const message = await syncRegistrationFromStripe(paymentDeps(), id)
        await audit(admin.id, 'registration.stripe_sync', 'registration', id, {}, { label: reg.full_name })
        return NextResponse.json({ ok: true, message })
      } catch (e) {
        return stripeFailure(e)
      }
    }
    default:
      return fail(400, 'Unknown action.')
  }
}
