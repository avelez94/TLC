import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/supabase-server'
import { DEFAULT_SIGNATURE_FONT, isSignatureFont, renderCertificatePdf } from '@/lib/certificate-pdf'
import { todayET } from '@/lib/business-time'

// Sample certificate with the signature typed in Certificates → Signature, for review before it
// is approved. Administrators only; a sample participant, nothing is stored or issued.
export const runtime = 'nodejs'
const NO_STORE = { 'Cache-Control': 'private, no-store' }

export async function GET(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Not authorized' }, { status: 401, headers: NO_STORE })
  const q = request.nextUrl.searchParams
  const font = q.get('font')
  const pdf = await renderCertificatePdf({
    certificateNumber: 'SAMPLE', participantName: 'Sample Participant', pathwayName: 'Emerging Leaders',
    cohortName: 'Sample cohort (preview)', completionDate: todayET(), issuedAt: new Date(),
    signatureText: (q.get('text') ?? '').slice(0, 80), signerName: (q.get('name') ?? '').slice(0, 120),
    signerTitle: (q.get('title') ?? '').slice(0, 160), signatureFont: isSignatureFont(font) ? font : DEFAULT_SIGNATURE_FONT,
  })
  return new Response(new Blob([pdf as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }), {
    status: 200,
    headers: { ...NO_STORE, 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="certificate-preview.pdf"', 'X-Content-Type-Options': 'nosniff' },
  })
}
