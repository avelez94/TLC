// Browser-only helpers for the policy editor: converts the editable area's DOM to structured
// blocks (and back). Only paragraphs, bulleted and numbered lists, bold, italic, underline and
// links survive; everything else (styles, fonts, pasted Word/Docs markup) is reduced to text.
import { safePolicyHref, type Block, type Inline } from './policies'

type Fmt = { b?: boolean; i?: boolean; u?: boolean; href?: string }
const BLOCK_TAGS = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'TABLE', 'TR', 'PRE'])

function pushRun(runs: Inline[], t: string, f: Fmt) {
  if (!t) return
  const last = runs[runs.length - 1]
  if (last && !!last.b === !!f.b && !!last.i === !!f.i && !!last.u === !!f.u && last.href === f.href) { last.t += t; return }
  const r: Inline = { t }
  if (f.b) r.b = true
  if (f.i) r.i = true
  if (f.u) r.u = true
  if (f.href) r.href = f.href
  runs.push(r)
}

function inline(node: Node, f: Fmt, runs: Inline[]) {
  if (node.nodeType === Node.TEXT_NODE) { pushRun(runs, (node.textContent ?? '').replace(/ /g, ' '), f); return }
  if (node.nodeType !== Node.ELEMENT_NODE) return
  const el = node as HTMLElement
  const tag = el.tagName
  if (tag === 'BR') { pushRun(runs, '\n', f); return }
  if (['SCRIPT', 'STYLE', 'TEMPLATE', 'IFRAME', 'OBJECT', 'SVG'].includes(tag)) return
  const weight = el.style?.fontWeight
  const next: Fmt = {
    b: f.b || tag === 'B' || tag === 'STRONG' || weight === 'bold' || Number(weight) >= 600,
    i: f.i || tag === 'I' || tag === 'EM' || el.style?.fontStyle === 'italic',
    u: f.u || tag === 'U' || (el.style?.textDecoration ?? '').includes('underline'),
    href: f.href ?? (tag === 'A' ? safePolicyHref(el.getAttribute('href')) : undefined),
  }
  el.childNodes.forEach(c => inline(c, next, runs))
}

const trimRuns = (runs: Inline[]): Inline[] => {
  const out = runs.map(r => ({ ...r }))
  while (out.length && !out[0].t.replace(/^[\s\n]+/, '')) out.shift()
  while (out.length && !out[out.length - 1].t.replace(/[\s\n]+$/, '')) out.pop()
  if (out.length) { out[0].t = out[0].t.replace(/^[\s\n]+/, ''); out[out.length - 1].t = out[out.length - 1].t.replace(/[\s\n]+$/, '') }
  return out.filter(r => r.t)
}

function listItems(list: HTMLElement): Inline[][] {
  const items: Inline[][] = []
  list.childNodes.forEach(n => {
    if (n.nodeType !== Node.ELEMENT_NODE) return
    const el = n as HTMLElement
    if (el.tagName === 'LI') {
      // The item's own text first, then any nested list (flattened into the same list).
      const runs: Inline[] = []
      const nested: Inline[][] = []
      el.childNodes.forEach(c => {
        if (c.nodeType === Node.ELEMENT_NODE && ['UL', 'OL'].includes((c as HTMLElement).tagName)) nested.push(...listItems(c as HTMLElement))
        else inline(c, {}, runs)
      })
      const t = trimRuns(runs)
      if (t.length) items.push(t)
      items.push(...nested)
    } else if (['UL', 'OL'].includes(el.tagName)) items.push(...listItems(el))
  })
  return items
}

/** The editable area → blocks. */
export function domToBlocks(root: HTMLElement): Block[] {
  const blocks: Block[] = []
  let pending: Inline[] = []
  const flush = () => {
    const t = trimRuns(pending)
    if (t.length) blocks.push({ type: 'p', c: t })
    pending = []
  }
  const walk = (parent: Node) => {
    parent.childNodes.forEach(n => {
      if (n.nodeType === Node.ELEMENT_NODE) {
        const el = n as HTMLElement
        if (el.tagName === 'UL' || el.tagName === 'OL') {
          flush()
          const items = listItems(el)
          if (items.length) blocks.push({ type: el.tagName === 'UL' ? 'ul' : 'ol', items })
          return
        }
        if (BLOCK_TAGS.has(el.tagName)) {
          flush()
          // A block containing lists or other blocks is walked; otherwise it is one paragraph.
          if (Array.from(el.children).some(c => BLOCK_TAGS.has(c.tagName) || c.tagName === 'UL' || c.tagName === 'OL')) walk(el)
          else { inline(el, {}, pending); flush() }
          return
        }
        if (el.tagName === 'BR' && parent === root) { flush(); return }
      }
      inline(n, {}, pending)
    })
  }
  walk(root)
  flush()
  return blocks
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function runsHtml(runs: Inline[]): string {
  return runs.map(r => {
    let h = esc(r.t).replace(/\n/g, '<br>')
    if (r.u) h = `<u>${h}</u>`
    if (r.i) h = `<em>${h}</em>`
    if (r.b) h = `<strong>${h}</strong>`
    const href = safePolicyHref(r.href)
    if (href) h = `<a href="${esc(href)}">${h}</a>`
    return h
  }).join('')
}

/** Blocks → HTML for the editable area (escaped; links re-checked). */
export function blocksToHtml(blocks: Block[]): string {
  return blocks.map(b => b.type === 'p'
    ? `<p>${runsHtml(b.c)}</p>`
    : `<${b.type}>${b.items.map(i => `<li>${runsHtml(i)}</li>`).join('')}</${b.type}>`).join('')
}

/** Pasted HTML or text → clean editor HTML. */
export function cleanPaste(html: string | null, text: string): string {
  if (html) {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    return blocksToHtml(domToBlocks(doc.body))
  }
  return blocksToHtml(text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean).map(p => ({ type: 'p' as const, c: [{ t: p }] })))
}
