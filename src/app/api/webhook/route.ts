import type Stripe from 'stripe'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getStripe } from '@/lib/stripe'
import { esc, sendEmail, FROM_TLC, FROM_PLATFORM, OWNER_INBOX } from '@/lib/email'
import { safeHttpUrl } from '@/lib/security'

const formatDate = (dateStr: string | null) =>
  dateStr ? new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null

const formatTime = (timeStr: string | null) => {
  if (!timeStr) return null
  const [hours, minutes] = timeStr.split(':').map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'} ET`
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('Webhook: STRIPE_WEBHOOK_SECRET is not configured')
    return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  }

  const body = await request.text()
  const signature = request.headers.get('stripe-signature')
  if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true })
  }

  const session = event.data.object as Stripe.Checkout.Session
  const registrationId = session.metadata?.registration_id
  if (!registrationId || session.payment_status !== 'paid') {
    return NextResponse.json({ received: true })
  }

  const REG_COLUMNS = 'id, full_name, email, cohort_id, payment_status, confirmation_email_sent_at, owner_notified_at, programs(name), cohorts(name, start_date, end_date, session_day, session_time, book_title, book_image_url, book_purchase_url)'

  // 1. Record the payment exactly once: flip to paid only if not already paid, and only for
  //    the registration created with this Checkout session. Replays match zero rows.
  //    The payment is stored BEFORE any email is attempted, so a mail outage can't lose it.
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from('registrations')
    .update({
      payment_status: 'paid',
      paid_at: new Date().toISOString(),
      amount_paid: session.amount_total != null ? Math.round(session.amount_total / 100) : null,
    })
    .eq('id', registrationId)
    .eq('stripe_session_id', session.id)
    .or('payment_status.is.null,payment_status.neq.paid')
    .select(REG_COLUMNS)

  if (claimError) {
    console.error('Webhook: could not record payment', claimError.code)
    return NextResponse.json({ error: 'Database error' }, { status: 500 }) // Stripe will retry
  }

  // 2. Replays: nothing new to record, but finish any notification that failed earlier.
  let row = claimed?.[0]
  if (!row) {
    const { data: existing } = await supabaseAdmin
      .from('registrations').select(REG_COLUMNS)
      .eq('id', registrationId).eq('stripe_session_id', session.id).maybeSingle()
    if (!existing || existing.payment_status !== 'paid' || (existing.confirmation_email_sent_at && existing.owner_notified_at)) {
      return NextResponse.json({ received: true, duplicate: true })
    }
    row = existing
  }

  const reg = row as unknown as {
    id: string
    confirmation_email_sent_at: string | null
    owner_notified_at: string | null
    full_name: string
    email: string
    programs: { name: string } | null
    cohorts: {
      name: string; start_date: string | null; end_date: string | null; session_day: string | null
      session_time: string | null; book_title: string | null; book_image_url: string | null; book_purchase_url: string | null
    } | null
  }
  const programName = reg.programs?.name ?? 'The Impact Lab'
  const cohort = reg.cohorts
  const amount = session.amount_total != null ? (session.amount_total / 100).toFixed(2) : '0.00'

  let scheduleHtml = ''
  let bookHtml = ''
  if (cohort) {
    const start = formatDate(cohort.start_date)
    const end = formatDate(cohort.end_date)
    const time = formatTime(cohort.session_time)
    if (start && end) scheduleHtml += `<p style="font-size: 0.85rem; color: #4A5260; margin: 0.5rem 0 0;">${esc(start)} to ${esc(end)}</p>`
    if (cohort.session_day && time) scheduleHtml += `<p style="font-size: 0.85rem; color: #4A5260; margin: 0.25rem 0 0;">${esc(cohort.session_day)}s at ${esc(time)}</p>`
    if (cohort.book_title) {
      const purchaseUrl = safeHttpUrl(cohort.book_purchase_url)
      const imageUrl = safeHttpUrl(cohort.book_image_url)
      bookHtml = `
        <div style="background: #F7F5F0; border-left: 3px solid #C88820; padding: 1.5rem; margin-bottom: 1.5rem;">
          <p style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.15em; color: #C88820; margin-bottom: 0.75rem;">What We Are Reading</p>
          <table style="width: 100%;"><tr>
            ${imageUrl ? `<td style="width: 90px; vertical-align: top; padding-right: 1rem;"><img src="${esc(imageUrl)}" alt="${esc(cohort.book_title)}" style="width: 90px; height: auto; border-radius: 3px; display: block;" /></td>` : ''}
            <td style="vertical-align: top;">
              <p style="font-size: 1rem; font-weight: 700; color: #001737; margin: 0 0 0.5rem;">${esc(cohort.book_title)}</p>
              ${purchaseUrl ? `<a href="${esc(purchaseUrl)}" style="display: inline-block; background: #C88820; color: #001737; padding: 0.5rem 1rem; text-decoration: none; font-weight: 700; font-size: 0.75rem; letter-spacing: 0.05em; text-transform: uppercase; border-radius: 2px;">Buy the Book</a>` : ''}
            </td>
          </tr></table>
        </div>`
    }
  }

  let notificationFailed = false
  const markSent = (column: 'confirmation_email_sent_at' | 'owner_notified_at') =>
    supabaseAdmin.from('registrations').update({ [column]: new Date().toISOString() }).eq('id', reg.id).is(column, null)

  if (!reg.confirmation_email_sent_at) try {
    await sendEmail({
      from: FROM_TLC,
      to: reg.email,
      subject: 'Your Impact Lab registration is confirmed',
      html: `
        <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #1C2430;">
          <div style="background: #001737; padding: 2rem; text-align: center; margin-bottom: 2rem;">
            <h1 style="color: #C88820; font-size: 1.5rem; letter-spacing: 0.08em; margin: 0;">TLC LEADERSHIP</h1>
            <p style="color: rgba(255,255,255,0.5); font-size: 0.75rem; letter-spacing: 0.2em; text-transform: uppercase; margin: 0.5rem 0 0;">The Impact Lab</p>
          </div>
          <div style="padding: 0 1rem;">
            <p style="font-size: 1rem; line-height: 1.75; margin-bottom: 1.5rem;">Hi ${esc(reg.full_name)},</p>
            <p style="font-size: 1rem; line-height: 1.75; margin-bottom: 1.5rem;">Thank you for registering for The Impact Lab. Your registration has been received successfully.</p>
            <div style="background: #F7F5F0; border-left: 3px solid #C88820; padding: 1.5rem; margin-bottom: 1.5rem;">
              <p style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.15em; color: #C88820; margin-bottom: 0.75rem;">Your Registration</p>
              <p style="font-size: 1rem; font-weight: 700; color: #001737; margin-bottom: 0.25rem;">${esc(programName)}</p>
              <p style="font-size: 0.9rem; color: #4A5260; margin-bottom: 0;">${esc(cohort?.name)}</p>
              ${scheduleHtml}
            </div>
            ${bookHtml}
            <p style="font-size: 1rem; line-height: 1.75; margin-bottom: 1.5rem;">You will receive your Learning Hub invitation and program details shortly.</p>
            <p style="font-size: 1rem; line-height: 1.75; margin-bottom: 1.5rem;">In the meantime, if you have any questions reach out to Tramaine directly at <a href="mailto:tramaine@tramainecrawford.com" style="color: #C88820;">tramaine@tramainecrawford.com</a> or <a href="tel:+12025991381" style="color: #C88820;">(202) 599-1381</a>.</p>
            <p style="font-size: 1rem; line-height: 1.75;">We look forward to making a greater impact with you.</p>
            <p style="font-size: 1rem; line-height: 1.75; margin-top: 2rem; color: #4A5260;">Tramaine L. Crawford<br/>TLC Leadership Consulting &amp; Coaching</p>
          </div>
          <div style="background: #001737; padding: 1.5rem; text-align: center; margin-top: 2rem;">
            <p style="color: rgba(255,255,255,0.3); font-size: 0.75rem; margin: 0;">2001 L St NW, Suite 500, Washington, DC 20036</p>
          </div>
        </div>`,
    })
    await markSent('confirmation_email_sent_at')
  } catch (emailErr) {
    notificationFailed = true
    console.error('Webhook: participant email failed', emailErr instanceof Error ? emailErr.message : emailErr)
  }

  if (!reg.owner_notified_at) try {
    await sendEmail({
      from: FROM_PLATFORM,
      to: OWNER_INBOX,
      subject: `New Impact Lab registration — ${reg.full_name}`,
      html: `
        <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #1C2430;">
          <div style="background: #001737; padding: 2rem; margin-bottom: 2rem;">
            <h1 style="color: #C88820; font-size: 1.25rem; letter-spacing: 0.08em; margin: 0;">New Registration</h1>
            <p style="color: rgba(255,255,255,0.5); font-size: 0.75rem; margin: 0.5rem 0 0;">Payment received</p>
          </div>
          <div style="padding: 0 1rem;">
            <p style="font-size: 1rem; line-height: 1.75;">A new participant has registered and payment has been received. Review their registration in the admin panel, assign them to their cohort, and click Confirm &amp; Send Invitation to give them access to their Learning Hub.</p>
            <div style="background: #F7F5F0; border-left: 3px solid #C88820; padding: 1.25rem 1.5rem; margin: 1.5rem 0;">
              <table style="width: 100%; font-size: 0.9rem; line-height: 1.9;">
                <tr><td style="color: #4A5260; width: 120px;">Name</td><td style="font-weight: 600;">${esc(reg.full_name)}</td></tr>
                <tr><td style="color: #4A5260;">Email</td><td>${esc(reg.email)}</td></tr>
                <tr><td style="color: #4A5260;">Program</td><td><strong>${esc(programName)}</strong></td></tr>
                <tr><td style="color: #4A5260;">Cohort</td><td>${esc(cohort?.name)}</td></tr>
                <tr><td style="color: #4A5260;">Amount Paid</td><td><strong>$${esc(amount)}</strong></td></tr>
              </table>
            </div>
            <a href="https://tramainecrawford.com/admin/registrations" style="display: inline-block; background: #C88820; color: #001737; padding: 0.75rem 1.5rem; text-decoration: none; font-weight: 700; font-size: 0.85rem; letter-spacing: 0.08em; text-transform: uppercase; margin-top: 1rem; border-radius: 2px;">Review in Admin Panel</a>
          </div>
        </div>`,
    })
    await markSent('owner_notified_at')
  } catch (emailErr) {
    notificationFailed = true
    console.error('Webhook: owner email failed', emailErr instanceof Error ? emailErr.message : emailErr)
  }

  // A failed notification returns 500 so Stripe redelivers the event; the payment is already
  // recorded, and step 2 above resends only the email that is still missing.
  if (notificationFailed) return NextResponse.json({ received: true, notification: 'retry' }, { status: 500 })
  return NextResponse.json({ received: true })
}
