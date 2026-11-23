// Local stand-in for the parts of Supabase the site uses, for end-to-end testing with
// synthetic data only. NEVER point this at production; it has no real security.
//
//   /auth/v1/*     sign-in (password), sessions, two-step (TOTP, real codes), admin user API
//   /storage/v1/*  private file storage (files kept in a temp folder)
//   /rest/v1/*     forwarded to PostgREST, which applies the database's own RLS policies
//
// Tokens are HS256 JWTs signed with the same secret PostgREST uses, carrying the same claims
// Supabase issues (sub, role, aal, amr), so auth.uid() and the aal checks behave as in prod.
import http from 'node:http'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'

const PORT = Number(process.env.GATEWAY_PORT ?? 54321)
const POSTGREST = process.env.POSTGREST_URL ?? 'http://127.0.0.1:54322'
const SECRET = process.env.JWT_SECRET
const PGURL = process.env.PG_URL
const STORAGE_DIR = process.env.STORAGE_DIR ?? fs.mkdtempSync('/tmp/tlc-local-storage-')
if (!SECRET || !PGURL) throw new Error('JWT_SECRET and PG_URL are required')

// ---------------------------------------------------------------- helpers
const b64u = buf => Buffer.from(buf).toString('base64url')
export function sign(claims) {
  const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = b64u(JSON.stringify(claims))
  return `${head}.${body}.${b64u(crypto.createHmac('sha256', SECRET).update(`${head}.${body}`).digest())}`
}
function verify(token) {
  const [h, b, s] = (token ?? '').split('.')
  if (!s) return null
  const expect = b64u(crypto.createHmac('sha256', SECRET).update(`${h}.${b}`).digest())
  if (expect !== s) return null
  const claims = JSON.parse(Buffer.from(b, 'base64url').toString())
  if (claims.exp && claims.exp < Date.now() / 1000) return null
  return claims
}
const lit = v => v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`
function sql(query) {
  return new Promise((resolve, reject) => {
    execFile('psql', ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', PGURL, '-c', query], (err, out, errOut) => {
      if (err) reject(new Error(errOut || err.message)); else resolve(out.trim())
    })
  })
}
const json = async q => {
  const write = /^\s*(insert|update|delete)\b/i.test(q)
  const out = await sql(write ? `with t as (${q}) select coalesce(json_agg(t), '[]') from t` : `select coalesce(json_agg(t), '[]') from (${q}) t`)
  return JSON.parse(out || '[]')
}
const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', ...headers })
  res.end(body === undefined ? '' : JSON.stringify(body))
}
const readBody = req => new Promise(r => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => r(Buffer.concat(c))) })
const hash = pw => crypto.createHash('sha256').update(`tlc-local:${pw}`).digest('hex')

import { totp, b32encode } from './sign.mjs'
const totpOk = (secret, code) => [-30000, 0, 30000].some(d => totp(secret, Date.now() + d) === String(code).trim())

// ---------------------------------------------------------------- users and sessions
const refreshTokens = new Map() // token -> { userId, aal }
async function userObject(id) {
  const [u] = await json(`select u.id, u.email, u.raw_user_meta_data as user_metadata, u.created_at, u.last_sign_in_at,
    coalesce((select json_agg(json_build_object('id', f.id, 'friendly_name', f.friendly_name, 'factor_type', 'totp', 'status', f.status, 'created_at', f.created_at, 'updated_at', f.created_at) order by f.created_at)
              from auth.mfa_factors f where f.user_id = u.id), '[]') as factors
    from auth.users u where u.id = ${lit(id)}`)
  if (!u) return null
  return { ...u, aud: 'authenticated', role: 'authenticated', email_confirmed_at: u.created_at, confirmed_at: u.created_at, app_metadata: { provider: 'email', providers: ['email'] }, identities: [], updated_at: u.created_at }
}
async function session(userId, aal, methods) {
  const user = await userObject(userId)
  const now = Math.floor(Date.now() / 1000)
  const access_token = sign({ aud: 'authenticated', exp: now + 3600, iat: now, sub: userId, email: user.email, role: 'authenticated', aal, amr: methods.map(m => ({ method: m, timestamp: now })), session_id: crypto.randomUUID(), is_anonymous: false })
  const refresh_token = crypto.randomBytes(24).toString('hex')
  refreshTokens.set(refresh_token, { userId, aal, methods })
  return { access_token, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token, user }
}
const bearer = req => verify((req.headers.authorization ?? '').replace(/^Bearer /i, ''))
const isService = req => bearer(req)?.role === 'service_role'

async function createUser(email, metadata = {}, password = null) {
  const [row] = await json(`insert into auth.users (email, raw_user_meta_data, encrypted_password) values (${lit(email.toLowerCase())}, ${lit(JSON.stringify(metadata))}::jsonb, ${lit(password ? hash(password) : null)}) returning id`)
  return row.id
}

// ---------------------------------------------------------------- auth routes
async function auth(req, res, url, body) {
  const p = url.pathname.replace('/auth/v1', '')
  const data = body.length ? JSON.parse(body.toString() || '{}') : {}

  if (p === '/token' && url.searchParams.get('grant_type') === 'password') {
    const [u] = await json(`select id from auth.users where lower(email) = lower(${lit(data.email)}) and encrypted_password = ${lit(hash(data.password ?? ''))}`)
    if (!u) return send(res, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' })
    await sql(`update auth.users set last_sign_in_at = now() where id = ${lit(u.id)}`)
    return send(res, 200, await session(u.id, 'aal1', ['password']))
  }
  if (p === '/token' && url.searchParams.get('grant_type') === 'refresh_token') {
    const s = refreshTokens.get(data.refresh_token)
    if (!s) return send(res, 400, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' })
    refreshTokens.delete(data.refresh_token)
    return send(res, 200, await session(s.userId, s.aal, s.methods))
  }
  if (p === '/logout') return send(res, 204)
  if (p === '/recover') return send(res, 200, {})

  const claims = bearer(req)
  if (p === '/user' && req.method === 'GET') {
    if (!claims?.sub) return send(res, 401, { code: 401, error_code: 'no_authorization', msg: 'Not signed in' })
    const u = await userObject(claims.sub)
    return u ? send(res, 200, u) : send(res, 404, { msg: 'User not found' })
  }
  if (p === '/user' && req.method === 'PUT') {
    if (!claims?.sub) return send(res, 401, { msg: 'Not signed in' })
    if (data.password) await sql(`update auth.users set encrypted_password = ${lit(hash(data.password))} where id = ${lit(claims.sub)}`)
    return send(res, 200, await userObject(claims.sub))
  }

  // Two-step verification (TOTP)
  if (p === '/factors' && req.method === 'POST') {
    if (!claims?.sub) return send(res, 401, { msg: 'Not signed in' })
    const secret = b32encode(crypto.randomBytes(20))
    const [f] = await json(`insert into auth.mfa_factors (user_id, status, friendly_name, secret) values (${lit(claims.sub)}, 'unverified', ${lit(data.friendly_name ?? 'Authenticator')}, ${lit(secret)}) returning id`)
    const uri = `otpauth://totp/TLC:${encodeURIComponent(claims.email)}?secret=${secret}&issuer=TLC`
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><rect width="180" height="180" fill="#eee"/><text x="90" y="95" font-size="12" text-anchor="middle">LOCAL TEST QR</text></svg>`
    return send(res, 200, { id: f.id, type: 'totp', friendly_name: data.friendly_name, totp: { qr_code: svg, secret, uri } })
  }
  let m = p.match(/^\/factors\/([0-9a-f-]+)\/challenge$/)
  if (m) return send(res, 200, { id: crypto.randomUUID(), type: 'totp', expires_at: Math.floor(Date.now() / 1000) + 300 })
  m = p.match(/^\/factors\/([0-9a-f-]+)\/verify$/)
  if (m) {
    if (!claims?.sub) return send(res, 401, { msg: 'Not signed in' })
    const [f] = await json(`select id, secret from auth.mfa_factors where id = ${lit(m[1])} and user_id = ${lit(claims.sub)}`)
    if (!f || !totpOk(f.secret, data.code)) return send(res, 422, { code: 422, error_code: 'mfa_verification_failed', msg: 'Invalid TOTP code entered' })
    await sql(`update auth.mfa_factors set status = 'verified' where id = ${lit(f.id)}`)
    return send(res, 200, await session(claims.sub, 'aal2', ['password', 'totp']))
  }
  m = p.match(/^\/factors\/([0-9a-f-]+)$/)
  if (m && req.method === 'DELETE') {
    if (!claims?.sub) return send(res, 401, { msg: 'Not signed in' })
    await sql(`delete from auth.mfa_factors where id = ${lit(m[1])} and user_id = ${lit(claims.sub)}`)
    return send(res, 200, { id: m[1] })
  }

  // Admin API (service role only)
  if (p.startsWith('/admin/')) {
    if (!isService(req)) return send(res, 403, { msg: 'service role required' })
    if (p === '/admin/users' && req.method === 'GET') {
      const ids = await json('select id from auth.users order by created_at')
      return send(res, 200, { users: await Promise.all(ids.map(r => userObject(r.id))), aud: 'authenticated' })
    }
    if (p === '/admin/generate_link') {
      let [u] = await json(`select id from auth.users where lower(email) = lower(${lit(data.email)})`)
      if (data.type === 'invite') {
        if (u) return send(res, 422, { code: 422, error_code: 'email_exists', msg: 'A user with this email address has already been registered' })
        u = { id: await createUser(data.email, data.data ?? {}) }
      }
      if (!u) return send(res, 404, { msg: 'User not found' })
      const user = await userObject(u.id)
      return send(res, 200, { ...user, action_link: `http://127.0.0.1:${PORT}/local-link/${data.type}/${u.id}`, email_otp: '000000', hashed_token: 'local', redirect_to: data.redirect_to ?? null, verification_type: data.type })
    }
    m = p.match(/^\/admin\/users\/([0-9a-f-]+)\/factors$/)
    if (m) return send(res, 200, await json(`select id, friendly_name, 'totp' as factor_type, status, created_at from auth.mfa_factors where user_id = ${lit(m[1])}`))
    m = p.match(/^\/admin\/users\/([0-9a-f-]+)\/factors\/([0-9a-f-]+)$/)
    if (m && req.method === 'DELETE') { await sql(`delete from auth.mfa_factors where id = ${lit(m[2])} and user_id = ${lit(m[1])}`); return send(res, 200, { id: m[2] }) }
  }
  return send(res, 404, { msg: `local auth: ${req.method} ${p} not implemented` })
}

// ---------------------------------------------------------------- storage (private bucket)
async function storage(req, res, url, body) {
  const p = decodeURIComponent(url.pathname.replace('/storage/v1', ''))
  const file = rel => path.join(STORAGE_DIR, rel.replace(/\.\.+/g, ''))
  let m = p.match(/^\/object\/sign\/([^/]+)\/(.+)$/)
  if (m) {
    if (!isService(req)) return send(res, 403, { message: 'not allowed' })
    const exp = Math.floor(Date.now() / 1000) + (JSON.parse(body.toString() || '{}').expiresIn ?? 60)
    const token = sign({ url: `${m[1]}/${m[2]}`, exp })
    return send(res, 200, { signedURL: `/object/sign/${m[1]}/${m[2]}?token=${token}` })
  }
  m = p.match(/^\/object\/sign\/([^/]+)\/(.+)$/)
  if (req.method === 'GET' && (m = p.match(/^\/object\/sign\/([^/]+)\/(.+)$/))) {
    const c = verify(url.searchParams.get('token'))
    if (!c || c.url !== `${m[1]}/${m[2]}`) return send(res, 400, { message: 'invalid signature' })
    res.writeHead(200, { 'content-type': 'application/octet-stream' }); return res.end(fs.readFileSync(file(`${m[1]}/${m[2]}`)))
  }
  // Only admins (or the service role) may write to the private bucket, as in production.
  const claims = bearer(req)
  const admin = claims?.role === 'service_role' || (claims?.sub && (await sql(`select role from public.profiles where id = ${lit(claims.sub)}`)) === 'admin')
  m = p.match(/^\/object\/([^/]+)\/(.+)$/)
  if (m && (req.method === 'POST' || req.method === 'PUT')) {
    if (!admin) return send(res, 403, { statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' })
    fs.mkdirSync(path.dirname(file(`${m[1]}/${m[2]}`)), { recursive: true })
    fs.writeFileSync(file(`${m[1]}/${m[2]}`), body)
    return send(res, 200, { Key: `${m[1]}/${m[2]}`, Id: crypto.randomUUID() })
  }
  m = p.match(/^\/object\/([^/]+)$/)
  if (m && req.method === 'DELETE') {
    if (!admin) return send(res, 403, { message: 'not allowed' })
    const { prefixes = [] } = JSON.parse(body.toString() || '{}')
    for (const k of prefixes) fs.rmSync(file(`${m[1]}/${k}`), { force: true })
    return send(res, 200, prefixes.map(name => ({ name })))
  }
  return send(res, 404, { message: `local storage: ${req.method} ${p} not implemented` })
}

// ---------------------------------------------------------------- server
http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`)
  if (req.method === 'OPTIONS') return send(res, 204)
  const body = await readBody(req)
  try {
    if (url.pathname.startsWith('/auth/v1')) return await auth(req, res, url, body)
    if (url.pathname.startsWith('/storage/v1')) return await storage(req, res, url, body)
    if (url.pathname.startsWith('/rest/v1')) {
      const headers = { ...req.headers }
      delete headers.host; delete headers['content-length']; delete headers.apikey
      if (!headers.authorization && req.headers.apikey) headers.authorization = `Bearer ${req.headers.apikey}`
      const r = await fetch(POSTGREST + url.pathname.replace('/rest/v1', '') + url.search, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body })
      const out = Buffer.from(await r.arrayBuffer())
      const h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-expose-headers': '*' }
      for (const k of ['content-type', 'content-range', 'preference-applied']) if (r.headers.get(k)) h[k] = r.headers.get(k)
      res.writeHead(r.status, h); return res.end(out)
    }
    if (url.pathname.startsWith('/local-link/')) { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('Local test invite/recovery link (no email is sent locally).') }
    send(res, 404, { message: 'not found' })
  } catch (e) {
    console.error(e)
    send(res, 500, { message: String(e.message ?? e) })
  }
}).listen(PORT, '127.0.0.1', () => console.log(`local gateway on http://127.0.0.1:${PORT} (storage ${STORAGE_DIR})`))
