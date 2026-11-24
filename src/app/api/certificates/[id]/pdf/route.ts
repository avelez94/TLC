import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient, requireAdmin } from '@/lib/supabase-server'
import { renderCertificatePdf } from '@/lib/certificate-pdf'

// The PDF is drawn with fonts read from disk (src/assets/fonts), so this must run on Node.
export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NO_STORE = { 'Cache-Control': 'private, no-store' }

const fail = (status: number, error: string) => NextResponse.json({ error }, { status, headers: NO_STORE })

// Downloads a certificate of completion as a PDF.
// Authorization is the database's own rule: the certificate is read with the signed-in user's
// session, so RLS returns only their own certificates (or any, for an administrator).
// - not signed in → 401; unknown, malformed or not visible → 404
// - revoked → 410 for participants; administrators can still open it, marked "REVOKED"
// - someone else's certificate additionally needs a fully verified admin session
//   (same check as the admin area, including two-step verification).
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!UUID_RE.test(id)) return fail(404, 'Not found')

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return fail(401, 'Please sign in to download your certificate.')

  const { data: cert, error } = await supabase
    .from('certificates')
    .select('id, user_id, certificate_number, participant_name, pathway_name, cohort_name, completion_date, issued_at, signer_name, signer_title, revoked_at')
    .eq('id', id)
    .maybeSingle()
  if (error) return fail(500, 'Could not load the certificate.')
  if (!cert) return fail(404, 'Not found')

  const isOwner = cert.user_id === user.id
  const needsAdmin = !isOwner || cert.revoked_at != null
  const isAdmin = needsAdmin ? (await requireAdmin()) != null : false
  if (!isOwner && !isAdmin) return fail(404, 'Not found')
  if (cert.revoked_at != null && !isAdmin) return fail(410, 'This certificate has been revoked.')
  if (!cert.certificate_number) return fail(404, 'Not found')

  let pdf: Uint8Array
  try {
    pdf = await renderCertificatePdf({
      certificateNumber: cert.certificate_number,
      participantName: cert.participant_name ?? '',
      pathwayName: cert.pathway_name,
      cohortName: cert.cohort_name,
      completionDate: cert.completion_date,
      issuedAt: cert.issued_at,
      signerName: cert.signer_name,
      signerTitle: cert.signer_title,
      revokedAt: cert.revoked_at,
    })
  } catch (err) {
    console.error('certificate pdf render failed', id, err instanceof Error ? err.message : err)
    return fail(500, 'Could not create the certificate PDF.')
  }

  const safeNumber = String(cert.certificate_number).replace(/[^A-Za-z0-9-]/g, '') || 'certificate'
  const filename = `TLC-Certificate-${safeNumber}.pdf`
  const disposition = request.nextUrl.searchParams.get('inline') === '1' ? 'inline' : 'attachment'

  return new Response(new Blob([pdf as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }), {
    status: 200,
    headers: {
      ...NO_STORE,
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${disposition}; filename="${filename}"`,
      'Content-Length': String(pdf.byteLength),
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
