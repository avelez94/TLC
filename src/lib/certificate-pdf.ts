import { readFile } from 'node:fs/promises'
import path from 'node:path'
import * as fontkitModule from '@pdf-lib/fontkit'
import {
  PDFDocument, rgb, degrees, setCharacterSpacing,
  type PDFFont, type PDFPage, type RGB,
} from 'pdf-lib'

// Renders a certificate of completion as a one-page PDF (landscape US Letter).
// Plain data in, bytes out: no database or request access here, so it is unit-testable.
//
// Fonts are the OFL-licensed TTFs in src/assets/fonts (Bebas Neue for display headings,
// Montserrat for text). They are read from disk relative to process.cwd(), which is the
// project root both locally and in a Vercel function; next.config.ts lists them in
// `outputFileTracingIncludes` for the certificate route so they are always in the bundle.

export type CertificatePdfData = {
  certificateNumber: string
  participantName: string
  pathwayName?: string | null
  cohortName?: string | null
  /** Calendar date, 'YYYY-MM-DD' (Postgres `date`). Printed as-is, never shifted by time zone. */
  completionDate?: string | null
  /** Timestamp the certificate was issued (ISO string or Date). Printed as a New York calendar date. */
  issuedAt?: string | Date | null
  signerName?: string | null
  signerTitle?: string | null
  /** When set, the PDF carries a clear "REVOKED" mark. */
  revokedAt?: string | Date | null
}

export const ORGANISATION_NAME = 'TLC Leadership Consulting & Coaching'
const PROGRAM_NAME = 'The Impact Lab'
const DISPLAY_TZ = 'America/New_York'

// ------------------------------------------------------------------ palette (site colours)
const hex = (h: string): RGB => rgb(
  parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255,
)
const NAVY = hex('#001737')
const GOLD = hex('#C88820')
const PAPER = hex('#F7F5F0')
const INK = hex('#1C2430')
const SLATE = hex('#4A5260')
const REVOKED_RED = hex('#9B1C1C')

// ------------------------------------------------------------------ page geometry (points)
const PAGE_W = 792
const PAGE_H = 612
const CENTER_X = PAGE_W / 2
const CONTENT_W = 600 // widest any line of text may be

// ------------------------------------------------------------------ fonts
const FONT_DIR = path.join(process.cwd(), 'src', 'assets', 'fonts')
type FontBytes = { display: Uint8Array; text: Uint8Array; textBold: Uint8Array }
let fontBytes: Promise<FontBytes> | null = null

function loadFontBytes(): Promise<FontBytes> {
  if (!fontBytes) {
    fontBytes = Promise.all([
      readFile(path.join(FONT_DIR, 'BebasNeue-Regular.ttf')),
      readFile(path.join(FONT_DIR, 'Montserrat-Regular.ttf')),
      readFile(path.join(FONT_DIR, 'Montserrat-SemiBold.ttf')),
    ]).then(([display, text, textBold]) => ({ display, text, textBold }))
    fontBytes.catch(() => { fontBytes = null }) // retry on the next request after a failure
  }
  return fontBytes
}

// The package ships UMD; depending on the loader the API is the namespace or its default.
const fontkit = ('create' in fontkitModule
  ? fontkitModule
  : (fontkitModule as unknown as { default: typeof fontkitModule }).default)

type Fonts = { display: PDFFont; text: PDFFont; textBold: PDFFont; displayChars: Set<number> }

// ------------------------------------------------------------------ text helpers
// Control characters, zero-width and bidirectional-override characters, and the BOM.
const INVISIBLE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x00, 0x1f], [0x7f, 0x9f], [0x200b, 0x200f], [0x2028, 0x202e], [0x2060, 0x206f], [0xfeff, 0xfeff],
]
const isInvisible = (cp: number) => INVISIBLE_RANGES.some(([lo, hi]) => cp >= lo && cp <= hi)

/** Removes control characters, collapses whitespace and normalises to NFC. */
export function cleanCertificateText(value: unknown, max = 200): string {
  if (typeof value !== 'string') return ''
  const cleaned = value
    .normalize('NFC')
    .replace(/[^ -~]/g, (ch) => (isInvisible(ch.codePointAt(0)!) ? ' ' : ch))
    .replace(/\s+/g, ' ')
    .trim()
  return Array.from(cleaned).slice(0, max).join('').trimEnd() // whole characters only
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December']

/** 'YYYY-MM-DD' (optionally followed by a time) → 'Month D, YYYY', read literally (no time-zone shift). */
export function formatCalendarDate(value: string | null | undefined): string | null {
  const m = typeof value === 'string' ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim()) : null
  if (!m) return null
  const month = Number(m[2])
  const day = Number(m[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return `${MONTHS[month - 1]} ${day}, ${m[1]}`
}

/** A timestamp → 'Month D, YYYY' as a calendar date in New York (where the programme runs). */
export function formatTimestampDate(value: string | Date | null | undefined): string | null {
  if (value == null || value === '') return null
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat('en-US', { timeZone: DISPLAY_TZ, year: 'numeric', month: 'long', day: 'numeric' }).format(d)
}

type Style = { font: PDFFont; size: number; tracking?: number; color: RGB }

function widthOf(text: string, s: Style): number {
  const tracking = s.tracking ?? 0
  return s.font.widthOfTextAtSize(text, s.size) + tracking * Math.max(0, [...text].length - 1)
}

/** Draws one line of text centred on `cx` with its baseline at `y`. */
function drawCentered(page: PDFPage, text: string, y: number, s: Style, cx = CENTER_X) {
  if (!text) return
  const tracking = s.tracking ?? 0
  const x = cx - widthOf(text, s) / 2
  if (tracking) page.pushOperators(setCharacterSpacing(tracking))
  page.drawText(text, { x, y, size: s.size, font: s.font, color: s.color })
  if (tracking) page.pushOperators(setCharacterSpacing(0))
}

/** Splits `text` into two lines at the word boundary that best balances their widths. */
function splitBalanced(text: string, s: Style): [string, string] | null {
  const words = text.split(' ')
  if (words.length < 2) return null
  let best: [string, string] | null = null
  let bestWidth = Infinity
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ')
    const b = words.slice(i).join(' ')
    const w = Math.max(widthOf(a, s), widthOf(b, s))
    if (w < bestWidth) { bestWidth = w; best = [a, b] }
  }
  return best
}

/** Cuts `text` so it fits in `maxWidth`, ending with an ellipsis. */
function truncateToWidth(text: string, s: Style, maxWidth: number): string {
  if (widthOf(text, s) <= maxWidth) return text
  const chars = [...text]
  while (chars.length > 1 && widthOf(chars.join('').trimEnd() + '…', s) > maxWidth) chars.pop()
  return chars.join('').trimEnd() + '…'
}

/**
 * Fits text into `maxWidth`: shrink from `size` down to `minSize` on one line; if still too
 * wide, use two balanced lines (when allowed), shrinking again; as a last resort, truncate.
 */
export function fitText(
  text: string, s: Style, maxWidth: number, minSize: number, maxLines: 1 | 2 = 1,
): { lines: string[]; size: number } {
  const at = (size: number): Style => ({ ...s, size, tracking: s.tracking ? (s.tracking * size) / s.size : 0 })
  const fitsOne = (size: number) => widthOf(text, at(size)) <= maxWidth
  for (let size = s.size; size >= minSize; size -= 0.5) {
    if (fitsOne(size)) return { lines: [text], size }
  }
  if (maxLines === 2) {
    const two = splitBalanced(text, at(minSize))
    if (two) {
      const twoMax = Math.max(minSize, s.size * 0.75) // two lines start a little smaller
      for (let size = twoMax; size >= minSize * 0.7; size -= 0.5) {
        if (two.every((line) => widthOf(line, at(size)) <= maxWidth)) return { lines: two, size }
      }
      const size = minSize * 0.7
      return { lines: two.map((line) => truncateToWidth(line, at(size), maxWidth)), size }
    }
  }
  return { lines: [truncateToWidth(text, at(minSize), maxWidth)], size: minSize }
}

// ------------------------------------------------------------------ ornaments
function drawFrame(page: PDFPage) {
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: PAPER })
  // Double gold rule, with small square accents where the inner rule turns the corner.
  const outer = 22
  const inner = 29
  page.drawRectangle({
    x: outer, y: outer, width: PAGE_W - outer * 2, height: PAGE_H - outer * 2,
    borderColor: GOLD, borderWidth: 1.4,
  })
  page.drawRectangle({
    x: inner, y: inner, width: PAGE_W - inner * 2, height: PAGE_H - inner * 2,
    borderColor: GOLD, borderWidth: 0.5,
  })
  const a = 5
  for (const [cx, cy] of [[inner, inner], [PAGE_W - inner, inner], [inner, PAGE_H - inner], [PAGE_W - inner, PAGE_H - inner]]) {
    page.drawRectangle({ x: cx - a / 2, y: cy - a / 2, width: a, height: a, color: GOLD })
  }
}

/** A short gold rule broken by a small diamond, centred on `y`. */
function drawDivider(page: PDFPage, y: number, halfWidth = 70) {
  const gap = 9
  page.drawLine({ start: { x: CENTER_X - halfWidth, y }, end: { x: CENTER_X - gap, y }, thickness: 0.6, color: GOLD })
  page.drawLine({ start: { x: CENTER_X + gap, y }, end: { x: CENTER_X + halfWidth, y }, thickness: 0.6, color: GOLD })
  const r = 3.2
  page.drawSvgPath(`M 0 ${-r} L ${r} 0 L 0 ${r} L ${-r} 0 Z`, { x: CENTER_X, y, color: GOLD })
}

function drawRevokedMark(page: PDFPage, fonts: Fonts, revokedOn: string | null) {
  const s: Style = { font: fonts.display, size: 150, tracking: 12, color: REVOKED_RED }
  const text = 'REVOKED'
  const w = widthOf(text, s)
  const angle = 28
  const rad = (angle * Math.PI) / 180
  // Centre of the rotated text box lands on the centre of the page.
  const capH = s.size * 0.7
  const x = CENTER_X - (w / 2) * Math.cos(rad) + (capH / 2) * Math.sin(rad)
  const y = PAGE_H / 2 - (w / 2) * Math.sin(rad) - (capH / 2) * Math.cos(rad)
  page.pushOperators(setCharacterSpacing(s.tracking ?? 0))
  page.drawText(text, { x, y, size: s.size, font: s.font, color: REVOKED_RED, opacity: 0.2, rotate: degrees(angle) })
  page.pushOperators(setCharacterSpacing(0))
  // A plain-language notice above the footer, so the status is unmistakable in print too.
  const notice = revokedOn
    ? `This certificate was revoked on ${revokedOn} and is no longer valid.`
    : 'This certificate has been revoked and is no longer valid.'
  drawCentered(page, notice.toUpperCase(), 66, { font: fonts.textBold, size: 8, tracking: 1, color: REVOKED_RED })
}

// ------------------------------------------------------------------ main
export async function renderCertificatePdf(data: CertificatePdfData): Promise<Uint8Array> {
  const certificateNumber = cleanCertificateText(data.certificateNumber, 40)
  const participant = cleanCertificateText(data.participantName, 160)
  const pathway = cleanCertificateText(data.pathwayName, 160)
  const cohort = cleanCertificateText(data.cohortName, 160)
  const signerName = cleanCertificateText(data.signerName, 120)
  const signerTitle = cleanCertificateText(data.signerTitle, 160)
  const completedOn = formatCalendarDate(data.completionDate)
  const issuedOn = formatTimestampDate(data.issuedAt)
  const revoked = data.revokedAt != null && data.revokedAt !== ''

  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const bytes = await loadFontBytes()
  const display = await doc.embedFont(bytes.display, { subset: true })
  const fonts: Fonts = {
    display,
    text: await doc.embedFont(bytes.text, { subset: true }),
    textBold: await doc.embedFont(bytes.textBold, { subset: true }),
    displayChars: new Set(display.getCharacterSet()),
  }
  /** Bebas Neue covers Latin only; fall back to Montserrat for anything it cannot draw. */
  const displayFontFor = (text: string) =>
    [...text].every((ch) => ch === ' ' || fonts.displayChars.has(ch.codePointAt(0)!)) ? fonts.display : fonts.textBold

  const title = `${PROGRAM_NAME} Certificate of Completion${participant ? ` - ${participant}` : ''}`
  doc.setTitle(title, { showInWindowTitleBar: true })
  doc.setAuthor(ORGANISATION_NAME)
  doc.setCreator(PROGRAM_NAME)
  doc.setProducer(ORGANISATION_NAME)
  doc.setSubject(certificateNumber ? `Certificate No. ${certificateNumber}` : 'Certificate of Completion')
  doc.setKeywords(['certificate', 'completion', PROGRAM_NAME])
  doc.setLanguage('en-US')

  const page = doc.addPage([PAGE_W, PAGE_H])
  drawFrame(page)

  // ---- header (fixed)
  drawCentered(page, ORGANISATION_NAME.toUpperCase(), 535, { font: fonts.textBold, size: 9, tracking: 2.6, color: NAVY })
  drawDivider(page, 521, 54)
  drawCentered(page, PROGRAM_NAME.toUpperCase(), 498, { font: fonts.display, size: 17, tracking: 3.4, color: GOLD })

  // ---- body: a stack of items centred vertically between the header and the signature
  type Item = { height: number; gapAfter: number; draw: (top: number) => void }
  const items: Item[] = []
  const CAP = 0.7 // cap height of both families, as a fraction of the size

  const addText = (lines: string[], s: Style, gapAfter: number, lineGap = 0.32) => {
    const lead = s.size * (CAP + lineGap)
    items.push({
      height: s.size * CAP + lead * (lines.length - 1),
      gapAfter,
      draw: (top) => lines.forEach((line, i) => drawCentered(page, line, top - s.size * CAP - lead * i, s)),
    })
  }

  addText(['CERTIFICATE OF COMPLETION'], { font: fonts.display, size: 50, tracking: 3, color: NAVY }, 26)
  addText(['This certifies that'], { font: fonts.text, size: 12, color: SLATE }, 24)

  // Participant name: large, shrinks to fit, two lines for very long names; gold rule beneath.
  {
    const s: Style = { font: fonts.textBold, size: 34, color: INK }
    const fit = participant ? fitText(participant, s, CONTENT_W, 22, 2) : { lines: [''], size: s.size }
    const fitted: Style = { ...s, size: fit.size }
    const lead = fit.size * (CAP + 0.42)
    const textH = fit.size * CAP + lead * (fit.lines.length - 1)
    const ruleGap = 17 // clears descenders and marks below the baseline
    const ruleW = Math.min(CONTENT_W, Math.max(300, ...fit.lines.map((l) => widthOf(l, fitted))) + 60)
    items.push({
      height: textH + ruleGap,
      gapAfter: 22,
      draw: (top) => {
        fit.lines.forEach((line, i) => drawCentered(page, line, top - fit.size * CAP - lead * i, fitted))
        const y = top - textH - ruleGap
        page.drawLine({ start: { x: CENTER_X - ruleW / 2, y }, end: { x: CENTER_X + ruleW / 2, y }, thickness: 0.7, color: GOLD })
      },
    })
  }

  addText(['has completed'], { font: fonts.text, size: 12, color: SLATE }, 18)

  // Pathway (the programme completed); falls back to the cohort name, then the programme.
  const headline = pathway || cohort || PROGRAM_NAME
  const subline = pathway ? cohort : ''
  {
    const text = headline.toUpperCase()
    const s: Style = { font: displayFontFor(text), size: 32, tracking: 1.6, color: NAVY }
    if (s.font !== fonts.display) s.size = 22
    const fit = fitText(text, s, CONTENT_W, 20, 2)
    addText(fit.lines, { ...s, size: fit.size, tracking: (s.tracking! * fit.size) / s.size }, subline ? 14 : 20, 0.25)
  }
  if (subline) {
    const s: Style = { font: fonts.text, size: 12, color: SLATE }
    const fit = fitText(subline, s, CONTENT_W, 9)
    addText(fit.lines, { ...s, size: fit.size }, 20)
  }
  if (completedOn) {
    addText([`Completed ${completedOn}`], { font: fonts.textBold, size: 11, tracking: 0.4, color: INK }, 0)
  }

  const bodyTop = 462
  const bodyBottom = 166
  const total = items.reduce((sum, it, i) => sum + it.height + (i < items.length - 1 ? it.gapAfter : 0), 0)
  // Centre the block; if it is taller than the space (very long names), start at the top.
  let top = Math.min(bodyTop, bodyBottom + total + Math.max(0, (bodyTop - bodyBottom - total) / 2))
  for (const it of items) { it.draw(top); top -= it.height + it.gapAfter }

  // ---- signature (fixed): a signature line only when a signer is recorded
  if (signerName) {
    const lineY = 128
    const nameStyle: Style = { font: fonts.textBold, size: 11, color: INK }
    const titleStyle: Style = { font: fonts.text, size: 9, color: SLATE }
    const name = fitText(signerName, nameStyle, 320, 8)
    const signerTitleFit = signerTitle ? fitText(signerTitle, titleStyle, 460, 8, 2) : null
    page.drawLine({ start: { x: CENTER_X - 120, y: lineY }, end: { x: CENTER_X + 120, y: lineY }, thickness: 0.6, color: INK })
    drawCentered(page, name.lines[0], lineY - 17, { ...nameStyle, size: name.size })
    signerTitleFit?.lines.forEach((line, i) =>
      drawCentered(page, line, lineY - 31 - i * 11, { ...titleStyle, size: signerTitleFit.size }))
  } else {
    drawDivider(page, 132, 36)
    drawCentered(page, ORGANISATION_NAME, 112, { font: fonts.textBold, size: 11, tracking: 0.3, color: NAVY })
  }

  // ---- footer (fixed)
  const footer = [
    certificateNumber ? `Certificate No. ${certificateNumber}` : '',
    issuedOn ? `Issued ${issuedOn}` : '',
  ].filter(Boolean).join('  ·  ')
  drawCentered(page, footer, 46, { font: fonts.text, size: 8, tracking: 0.5, color: SLATE })

  if (revoked) drawRevokedMark(page, fonts, formatTimestampDate(data.revokedAt))

  return doc.save()
}
