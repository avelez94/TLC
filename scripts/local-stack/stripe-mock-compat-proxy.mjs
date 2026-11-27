// Local test helper only. stripe-mock 0.206 validates against a newer Stripe API than the app pins
// (2026-06-24.dahlia) and rejects `payment_method_types` on Checkout Sessions, which the pinned
// version accepts. This proxy removes that one field and forwards everything else unchanged to
// stripe-mock, so the real checkout route can be exercised end to end in tests.
//   node scripts/local-stack/stripe-mock-compat-proxy.mjs   (listens on 12113, forwards to 12111)
import http from 'node:http'
const TARGET = { host: '127.0.0.1', port: Number(process.env.STRIPE_MOCK_PORT ?? 12111) }
const PORT = Number(process.env.STRIPE_PROXY_PORT ?? 12113)
http.createServer((req, res) => {
  const chunks = []
  req.on('data', c => chunks.push(c))
  req.on('end', () => {
    let body = Buffer.concat(chunks).toString('utf8')
    if (req.method === 'POST' && req.url?.startsWith('/v1/checkout/sessions') && body) {
      body = body.split('&').filter(kv => !decodeURIComponent(kv.split('=')[0]).startsWith('payment_method_types')).join('&')
    }
    const headers = { ...req.headers, 'content-length': Buffer.byteLength(body) }
    // stripe-mock only accepts test-style keys. Local runs that simulate production use the fake
    // live key sk_live_placeholder… (never valid anywhere); swap it so those runs reach the mock.
    if (/sk_live_placeholder/.test(String(headers.authorization ?? ''))) headers.authorization = 'Bearer sk_test_123'
    const up = http.request({ ...TARGET, method: req.method, path: req.url, headers }, r => { res.writeHead(r.statusCode ?? 502, r.headers); r.pipe(res) })
    up.on('error', e => { res.writeHead(502); res.end(String(e)) })
    up.end(body)
  })
}).listen(PORT, '127.0.0.1', () => console.log(`stripe-mock compat proxy on ${PORT} -> ${TARGET.port}`))
