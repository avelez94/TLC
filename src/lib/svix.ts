// Svix webhook signature check (used by Resend delivery events).
import { createHmac, timingSafeEqual } from 'node:crypto'

export function verifySvix(secret: string, id: string, timestamp: string, body: string, header: string, nowMs = Date.now()): boolean {
  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || Math.abs(nowMs / 1000 - ts) > 300) return false
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest()
  return header.split(' ').some(part => {
    const [version, sig] = part.split(',')
    if (version !== 'v1' || !sig) return false
    const given = Buffer.from(sig, 'base64')
    return given.length === expected.length && timingSafeEqual(given, expected)
  })
}
