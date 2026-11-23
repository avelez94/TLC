// Delivery events from Resend (delivered, delayed, bounced, complained). Optional: active only
// when RESEND_WEBHOOK_SECRET is set and the webhook is added in the Resend dashboard. Verified
// with the Svix signature scheme Resend uses. Only the status of an existing log row changes.
import { NextResponse } from 'next/server'
import { verifySvix } from '@/lib/svix'
import { supabaseAdmin } from '@/lib/supabase-server'

const EVENT_STATUS: Record<string, string> = {
  'email.delivered': 'delivered', 'email.delivery_delayed': 'delayed', 'email.bounced': 'bounced',
  'email.complained': 'complained', 'email.failed': 'failed',
}
// A later event never moves a message backwards (e.g. delayed after delivered).
const RANK: Record<string, number> = { queued: 0, sent: 1, accepted: 1, delayed: 2, delivered: 3, failed: 4, bounced: 5, complained: 5 }

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'Not configured' }, { status: 404 })
  const body = await request.text()
  const id = request.headers.get('svix-id') ?? ''
  const timestamp = request.headers.get('svix-timestamp') ?? ''
  const signature = request.headers.get('svix-signature') ?? ''
  if (!id || !verifySvix(secret, id, timestamp, body, signature)) return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })

  let event: { type?: string; created_at?: string; data?: { email_id?: string } }
  try { event = JSON.parse(body) } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  const status = EVENT_STATUS[event.type ?? '']
  const providerId = event.data?.email_id
  if (!status || !providerId) return NextResponse.json({ received: true })

  const { data: row } = await supabaseAdmin.from('email_log').select('id, status').eq('provider_id', providerId).maybeSingle()
  if (!row) return NextResponse.json({ received: true, unknown: true })
  if ((RANK[status] ?? 0) < (RANK[row.status] ?? 0)) return NextResponse.json({ received: true, ignored: true })
  await supabaseAdmin.from('email_log').update({
    status, last_event: (event.type ?? '').replace('email.', '').slice(0, 40), last_event_at: event.created_at ?? new Date().toISOString(),
  }).eq('id', row.id)
  return NextResponse.json({ received: true })
}
