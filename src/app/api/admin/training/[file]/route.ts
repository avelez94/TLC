import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin, supabaseAdmin } from '@/lib/supabase-server'
import { TRAINING_BUCKET, TRAINING_FILES, isTrainingKey } from '@/lib/training-files'

// Training videos and guide for administrators. Checks for a signed-in administrator (with
// two-step verification when it is set up), then redirects to a short-lived signed link to the
// private file. `?download=1` asks the browser to save the file instead of playing it.
export const runtime = 'nodejs'
const NO_STORE = { 'Cache-Control': 'private, no-store' }
const LINK_SECONDS = 3 * 60 * 60 // long enough to watch the whole video and seek within it

export async function GET(request: NextRequest, { params }: { params: Promise<{ file: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Not authorized' }, { status: 401, headers: NO_STORE })
  const { file } = await params
  if (!isTrainingKey(file)) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE })
  const f = TRAINING_FILES[file]
  const download = request.nextUrl.searchParams.get('download') === '1'
  const { data, error } = await supabaseAdmin.storage.from(TRAINING_BUCKET)
    .createSignedUrl(f.path, LINK_SECONDS, download ? { download: f.filename } : undefined)
  if (error || !data?.signedUrl) return NextResponse.json({ error: 'File unavailable' }, { status: 404, headers: NO_STORE })
  return NextResponse.redirect(data.signedUrl, { status: 302, headers: NO_STORE })
}
