// HS256 JWT signing for the local stack (same algorithm and claims shape as Supabase keys).
import crypto from 'node:crypto'
const b64u = b => Buffer.from(b).toString('base64url')
export function sign(claims, secret = process.env.JWT_SECRET) {
  const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = b64u(JSON.stringify(claims))
  return `${head}.${body}.${b64u(crypto.createHmac('sha256', secret).update(`${head}.${body}`).digest())}`
}

// RFC 6238 TOTP (SHA-1, 30 s, 6 digits): the same codes authenticator apps produce.
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
export const b32encode = buf => { let bits = '', out = ''; for (const b of buf) bits += b.toString(2).padStart(8, '0'); for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)]; return out }
const b32decode = s => { let bits = ''; for (const ch of s.replace(/=+$/, '')) bits += B32.indexOf(ch).toString(2).padStart(5, '0'); const out = []; for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2)); return Buffer.from(out) }
export function totp(secret, t = Date.now()) {
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(t / 30000)))
  const h = crypto.createHmac('sha1', b32decode(secret)).update(counter).digest()
  const o = h[h.length - 1] & 15
  return String(((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000)).padStart(6, '0')
}
