// Allow-list sanitizer for the small amount of admin-authored rich text (cohort
// descriptions). Runs in the browser (uses DOMParser). Without a DOM it returns plain,
// escaped text, so it never emits unsanitized markup.
import { escapeHtml, safeHttpUrl } from './security'

const ALLOWED_TAGS = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'UL', 'OL', 'LI', 'A', 'H3', 'H4', 'BLOCKQUOTE', 'SPAN', 'DIV'])
const DROP_WITH_CONTENT = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'MATH', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'LINK', 'META'])

export function sanitizeRichText(html: string | null | undefined): string {
  if (!html) return ''
  if (typeof DOMParser === 'undefined') return escapeHtml(html.replace(/<[^>]*>/g, ' '))

  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  const root = doc.body.firstElementChild
  if (!root) return ''

  const clean = (node: Element) => {
    for (const child of Array.from(node.children)) {
      // SVG/MathML elements report lowercase tag names; compare case-insensitively.
      const tag = child.tagName.toUpperCase()
      if (DROP_WITH_CONTENT.has(tag)) {
        child.remove()
        continue
      }
      clean(child)
      if (!ALLOWED_TAGS.has(tag)) {
        child.replaceWith(...Array.from(child.childNodes)) // keep the text, drop the tag
        continue
      }
      for (const attr of Array.from(child.attributes)) {
        if (!(tag === 'A' && attr.name === 'href')) child.removeAttribute(attr.name)
      }
      if (tag === 'A') {
        const href = safeHttpUrl(child.getAttribute('href'))
        if (href) {
          child.setAttribute('href', href)
          child.setAttribute('target', '_blank')
          child.setAttribute('rel', 'noopener noreferrer nofollow')
        } else {
          child.removeAttribute('href')
        }
      }
    }
  }
  clean(root)
  return root.innerHTML
}

/** For href attributes built from stored URLs: only http(s), otherwise undefined. */
export function safeHref(url: string | null | undefined): string | undefined {
  return safeHttpUrl(url) ?? undefined
}
