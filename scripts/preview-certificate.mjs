// Writes sample certificate PDFs with SYNTHETIC data, for design review.
//
//   node --import ./tests/register.mjs scripts/preview-certificate.mjs [output-dir]
//
// On macOS it also renders a PNG of page 1 next to each PDF (Quick Look, `qlmanage`).
import { mkdir, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { renderCertificatePdf } from '../src/lib/certificate-pdf.ts'

const outDir = path.resolve(process.argv[2] ?? 'tmp/certificates')
await mkdir(outDir, { recursive: true })

const base = {
  certificateNumber: 'TLC-2027-0001',
  participantName: 'Avery Brooks',
  pathwayName: 'Emerging Leaders',
  cohortName: 'Emerging Leaders - Winter 2027',
  completionDate: '2027-03-12',
  issuedAt: '2027-03-15T14:30:00Z',
}

const samples = {
  'sample-with-signer': { ...base, signerName: 'Jordan Ellis', signerTitle: 'Lead Facilitator, The Impact Lab' },
  'sample-without-signer': base,
  'sample-long-name-revoked': {
    ...base,
    certificateNumber: 'TLC-2027-0002',
    participantName: 'Maximiliana Alexandra Christobel Fitzgerald-Montgomery Wolfeschlegelsteinhausen',
    cohortName: null,
    revokedAt: '2027-04-01T16:00:00Z',
  },
}

for (const [name, data] of Object.entries(samples)) {
  const file = path.join(outDir, `${name}.pdf`)
  await writeFile(file, await renderCertificatePdf(data))
  console.log(file)
  if (process.platform === 'darwin') {
    try {
      execFileSync('qlmanage', ['-t', '-s', '1600', '-o', outDir, file], { stdio: 'ignore' })
      console.log(`${file}.png`)
    } catch {
      // Quick Look is optional; the PDF is the deliverable.
    }
  }
}
