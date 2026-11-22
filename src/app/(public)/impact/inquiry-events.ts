// Shared by the Impact Lab page's buttons and the inquiry form: open the form already set
// to the right audience (organization or individual) and, optionally, a pathway.
export const OPEN_INQUIRY_EVENT = 'impact:open-inquiry'

export interface OpenInquiryDetail {
  kind: 'organization' | 'individual'
  pathway?: string
}

export function openInquiry(detail: OpenInquiryDetail) {
  window.dispatchEvent(new CustomEvent<OpenInquiryDetail>(OPEN_INQUIRY_EVENT, { detail }))
  const card = document.getElementById('inquire')
  if (!card) return
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  card.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  // Move focus for keyboard and screen-reader users once the form has updated.
  window.setTimeout(() => card.querySelector<HTMLInputElement>('input[name="contact_name"]')?.focus({ preventScroll: true }), reduce ? 0 : 450)
}
