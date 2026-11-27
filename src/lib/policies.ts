// Policies & Legal: the three policies Tramaine writes and publishes himself. Content is stored
// as structured blocks (paragraphs and lists of plain-text runs with bold/italic/underline and
// links), never as HTML, so the public pages render it with React and nothing typed into the
// editor can become markup on the site. Shared by the admin editor, the server and the pages.

export const POLICY_SLUGS = ['privacy', 'terms', 'refund'] as const
export type PolicySlug = (typeof POLICY_SLUGS)[number]
export const isPolicySlug = (s: unknown): s is PolicySlug => typeof s === 'string' && (POLICY_SLUGS as readonly string[]).includes(s)

export const POLICY_META: Record<PolicySlug, { name: string; path: string; short: string }> = {
  privacy: { name: 'Privacy Policy', path: '/privacy', short: 'Privacy' },
  terms: { name: 'Terms & Conditions', path: '/terms', short: 'Terms' },
  refund: { name: 'Refund & Cancellation Policy', path: '/refund-policy', short: 'Refunds & cancellations' },
}

export interface Inline { t: string; b?: boolean; i?: boolean; u?: boolean; href?: string }
export type Block = { type: 'p'; c: Inline[] } | { type: 'ul' | 'ol'; items: Inline[][] }
export interface PolicySection { id: string; heading: string; body: Block[] }
export interface PolicyContent { title: string; intro: Block[]; sections: PolicySection[] }

export const EMPTY_POLICY: PolicyContent = { title: '', intro: [], sections: [] }

export const LIMITS = { title: 120, heading: 160, sections: 60, blocksPerSection: 120, itemsPerList: 80, runsPerLine: 80, textPerRun: 4000, totalText: 120_000 }

/** Links allowed in policies: web pages, email and phone. */
export function safePolicyHref(href: unknown): string | undefined {
  if (typeof href !== 'string') return undefined
  const v = href.trim()
  if (v.length > 500) return undefined
  if (/^mailto:[^\s<>"]+@[^\s<>"]+$/i.test(v)) return v
  if (/^tel:\+?[\d\s().-]{4,25}$/i.test(v)) return v
  try {
    const u = new URL(v)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : undefined
  } catch {
    return undefined
  }
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\u0000/g, '').slice(0, max) : '')

function cleanRuns(v: unknown): Inline[] {
  if (!Array.isArray(v)) return []
  const out: Inline[] = []
  for (const r of v.slice(0, LIMITS.runsPerLine)) {
    if (!r || typeof r !== 'object') continue
    const run = r as Record<string, unknown>
    const t = str(run.t, LIMITS.textPerRun)
    if (!t) continue
    const x: Inline = { t }
    if (run.b === true) x.b = true
    if (run.i === true) x.i = true
    if (run.u === true) x.u = true
    const href = safePolicyHref(run.href)
    if (href) x.href = href
    out.push(x)
  }
  return out
}

export function cleanBlocks(v: unknown): Block[] {
  if (!Array.isArray(v)) return []
  const out: Block[] = []
  for (const b of v.slice(0, LIMITS.blocksPerSection)) {
    if (!b || typeof b !== 'object') continue
    const blk = b as Record<string, unknown>
    if (blk.type === 'p') {
      const c = cleanRuns(blk.c)
      if (c.length) out.push({ type: 'p', c })
    } else if (blk.type === 'ul' || blk.type === 'ol') {
      const items = Array.isArray(blk.items) ? blk.items.slice(0, LIMITS.itemsPerList).map(cleanRuns).filter(i => i.length) : []
      if (items.length) out.push({ type: blk.type, items })
    }
  }
  return out
}

/** Strict copy of whatever the browser sent: unknown fields dropped, sizes capped, links checked. */
export function cleanPolicyContent(v: unknown): { ok: true; content: PolicyContent } | { ok: false; error: string } {
  if (!v || typeof v !== 'object') return { ok: false, error: 'The policy content is missing.' }
  const raw = v as Record<string, unknown>
  const sectionsRaw = Array.isArray(raw.sections) ? raw.sections : []
  if (sectionsRaw.length > LIMITS.sections) return { ok: false, error: `A policy can have at most ${LIMITS.sections} sections.` }
  const seen = new Set<string>()
  const sections: PolicySection[] = sectionsRaw.map((s, i) => {
    const sec = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>
    let id = typeof sec.id === 'string' && /^[a-z0-9-]{1,40}$/i.test(sec.id) ? sec.id : `s${i + 1}`
    while (seen.has(id)) id = `${id}-${i + 1}`
    seen.add(id)
    return { id, heading: str(sec.heading, LIMITS.heading).trim(), body: cleanBlocks(sec.body) }
  })
  const content: PolicyContent = { title: str(raw.title, LIMITS.title).trim(), intro: cleanBlocks(raw.intro), sections }
  if (policyTextLength(content) > LIMITS.totalText) return { ok: false, error: 'This policy is too long to save. Split it into fewer, shorter sections.' }
  return { ok: true, content }
}

export function blocksText(blocks: Block[]): string {
  return blocks.map(b => (b.type === 'p' ? b.c.map(r => r.t).join('') : b.items.map(i => i.map(r => r.t).join('')).join('\n'))).join('\n').trim()
}

export function policyTextLength(c: PolicyContent): number {
  return c.title.length + blocksText(c.intro).length + c.sections.reduce((n, s) => n + s.heading.length + blocksText(s.body).length, 0)
}

/** Placeholder wording that must never be published as an official policy. */
const PLACEHOLDER_WORDS = /\b(lorem ipsum|placeholder|TBD|to be determined|insert (your|the|company)\b[^.\n]{0,30}|x{3,})\b/i
const PLACEHOLDER_BRACKETS = /\[[^\]\n]{1,40}\]|\{\{[^}\n]{1,40}\}\}/
const PLACEHOLDER = { exec: (s: string) => s.match(PLACEHOLDER_WORDS) ?? s.match(PLACEHOLDER_BRACKETS) }

/**
 * What still prevents publishing. A policy is publishable only when it has a title and at least
 * one complete section (heading and wording), no section is half-empty, and nothing reads like
 * placeholder text. Blank or skeleton pages can never become official terms.
 */
export function publishProblems(c: PolicyContent): string[] {
  const problems: string[] = []
  if (!c.title) problems.push('Add a page title.')
  const complete = c.sections.filter(s => s.heading && blocksText(s.body).length > 0)
  if (!complete.length) problems.push('Add at least one section with a heading and wording.')
  c.sections.forEach((s, i) => {
    if (!s.heading && blocksText(s.body)) problems.push(`Section ${i + 1} needs a heading.`)
    if (s.heading && !blocksText(s.body)) problems.push(`Section ${i + 1} (“${s.heading}”) has no wording.`)
  })
  if (policyTextLength(c) < 200) problems.push('The policy is very short. Add the full wording before publishing.')
  const all = [c.title, blocksText(c.intro), ...c.sections.flatMap(s => [s.heading, blocksText(s.body)])].join('\n')
  const ph = PLACEHOLDER.exec(all)
  if (ph) problems.push(`Replace the placeholder text “${ph[0]}” with the final wording.`)
  return problems
}

/** Stable JSON (sorted keys) for hashing and change detection. */
export function stableJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableJson).join(',')}]`
  if (v && typeof v === 'object') return `{${Object.keys(v as object).sort().map(k => `${JSON.stringify(k)}:${stableJson((v as Record<string, unknown>)[k])}`).join(',')}}`
  return JSON.stringify(v)
}

/** "November 27, 2026" in Eastern time. */
export function policyDate(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(iso))
}

/** What a registration stores about the policies the participant accepted. */
export interface AcceptedPolicy { slug: PolicySlug; version_id: string; version_number: number; published_at: string | null }
