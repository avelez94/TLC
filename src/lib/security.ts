// Pure helpers for handling untrusted input. No framework imports, so they can be unit
// tested directly with `node --test`.

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/** Encode any value for safe interpolation into HTML text or a quoted attribute. */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).replace(/[&<>"']/g, ch => HTML_ESCAPES[ch])
}

/** Escape, and keep line breaks visible in an HTML email. */
export function escapeMultiline(value: unknown): string {
  return escapeHtml(value).replace(/\r?\n/g, '<br/>')
}

/** Trim, drop control characters (except newlines/tabs), and cap the length. */
export function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return ''
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, maxLength)
}

/** Single-line text: also collapses newlines, so it can't inject email headers or layout. */
export function cleanLine(value: unknown, maxLength: number): string {
  return cleanText(value, maxLength * 2).replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[A-Za-z]{2,}$/

export function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 254 && EMAIL_RE.test(value)
}

/** Returns the URL only if it is an absolute http(s) URL, otherwise null. */
export function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null
  const candidate = /^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`
  try {
    const url = new URL(candidate)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

export interface RateLimiter {
  /** Records a hit for `key`; returns true if the request is allowed. */
  hit(key: string, now?: number): boolean
}

/**
 * Fixed-window, in-memory limiter. On serverless hosts each warm instance keeps its own
 * counts, so this slows down abuse rather than guaranteeing a global cap.
 */
export function createRateLimiter(opts: { limit: number; windowMs: number; maxKeys?: number }): RateLimiter {
  const buckets = new Map<string, { count: number; resetAt: number }>()
  const maxKeys = opts.maxKeys ?? 5000
  return {
    hit(key, now = Date.now()) {
      const bucket = buckets.get(key)
      if (!bucket || bucket.resetAt <= now) {
        if (buckets.size >= maxKeys) {
          for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k)
          if (buckets.size >= maxKeys) buckets.delete(buckets.keys().next().value as string)
        }
        buckets.set(key, { count: 1, resetAt: now + opts.windowMs })
        return true
      }
      bucket.count += 1
      return bucket.count <= opts.limit
    },
  }
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return headers.get('x-real-ip') ?? 'unknown'
}
