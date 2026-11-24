import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PDFDocument } from 'pdf-lib'
import {
  renderCertificatePdf, formatCalendarDate, formatTimestampDate, cleanCertificateText,
  type CertificatePdfData,
} from '../../src/lib/certificate-pdf'

const base: CertificatePdfData = {
  certificateNumber: 'TLC-2027-0001',
  participantName: 'Avery Brooks',
  pathwayName: 'Emerging Leaders',
  cohortName: 'Emerging Leaders - Winter 2027',
  completionDate: '2027-03-12',
  issuedAt: '2027-03-15T14:30:00Z',
}

async function render(data: CertificatePdfData) {
  const bytes = await renderCertificatePdf(data)
  assert.ok(bytes instanceof Uint8Array)
  assert.equal(Buffer.from(bytes.subarray(0, 5)).toString('latin1'), '%PDF-', 'starts with %PDF')
  const doc = await PDFDocument.load(bytes, { updateMetadata: false })
  assert.equal(doc.getPageCount(), 1)
  const { width, height } = doc.getPage(0).getSize()
  assert.deepEqual([width, height], [792, 612], 'landscape US Letter')
  return { bytes, doc }
}

test('certificate: renders a one-page landscape PDF with metadata', async () => {
  const { doc } = await render({ ...base, signerName: 'Jordan Ellis', signerTitle: 'Lead Facilitator' })
  assert.equal(doc.getAuthor(), 'TLC Leadership Consulting & Coaching')
  assert.match(doc.getTitle() ?? '', /Certificate of Completion/)
  assert.match(doc.getTitle() ?? '', /Avery Brooks/)
  assert.match(doc.getSubject() ?? '', /TLC-2027-0001/)
})

test('certificate: without signer and without cohort', async () => {
  await render({ ...base, signerName: null, signerTitle: null, cohortName: null })
  await render({ ...base, signerName: '  ', cohortName: '' })
})

test('certificate: very long names, pathways and signer titles still render', async () => {
  const long = 'Maximiliana Alexandra Christobel Fitzgerald-Montgomery Wolfeschlegelsteinhausen '.repeat(3).trim()
  await render({ ...base, participantName: long })
  await render({ ...base, participantName: 'X'.repeat(300) }) // one unbreakable word
  await render({
    ...base,
    pathwayName: 'Advanced Strategic Leadership for Senior Executives and Emerging Change Agents '.repeat(2),
    signerName: 'Dr. Alexandra Montgomery-Whitfield',
    signerTitle: 'Founder and Principal Consultant, TLC Leadership Consulting & Coaching, Director of The Impact Lab',
  })
})

test('certificate: non-Latin and missing optional fields are handled gracefully', async () => {
  await render({ ...base, participantName: 'Zoë Ångström-Łukasz Nguyễn', pathwayName: 'Лидерство' })
  await render({ certificateNumber: 'TLC-2027-0003', participantName: 'Avery Brooks' })
  await render({ ...base, participantName: '', pathwayName: null, completionDate: 'not a date', issuedAt: 'nope' })
})

test('certificate: revoked variant renders and is larger than the plain one (extra mark)', async () => {
  const plain = await render(base)
  const revoked = await render({ ...base, revokedAt: '2027-04-01T16:00:00Z' })
  assert.ok(revoked.bytes.length > plain.bytes.length)
})

test('formatCalendarDate reads the date literally (no time-zone shift)', () => {
  assert.equal(formatCalendarDate('2027-01-01'), 'January 1, 2027')
  assert.equal(formatCalendarDate('2026-12-31'), 'December 31, 2026')
  assert.equal(formatCalendarDate('2026-03-08T00:00:00Z'), 'March 8, 2026')
  assert.equal(formatCalendarDate(null), null)
  assert.equal(formatCalendarDate('2026-13-01'), null)
  assert.equal(formatCalendarDate('soon'), null)
})

test('formatTimestampDate uses the New York calendar date', () => {
  assert.equal(formatTimestampDate('2027-01-01T03:00:00Z'), 'December 31, 2026')
  assert.equal(formatTimestampDate('2027-03-15T14:30:00Z'), 'March 15, 2027')
  assert.equal(formatTimestampDate(''), null)
  assert.equal(formatTimestampDate('nope'), null)
})

test('cleanCertificateText strips control and invisible characters', () => {
  const ch = (...codes: number[]) => String.fromCharCode(...codes)
  assert.equal(cleanCertificateText(`  Avery\n\tBrooks${ch(0)} `), 'Avery Brooks')
  assert.equal(cleanCertificateText(`A${ch(0x202e)}b${ch(0x200b)}c${ch(0xfeff)}`), 'A b c')
  assert.equal(cleanCertificateText(42), '')
  assert.equal(cleanCertificateText('abcdef', 3), 'abc')
})
