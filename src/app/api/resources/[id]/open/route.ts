import { NextResponse } from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase-server'
import { safeHttpUrl } from '@/lib/security'
import { STORAGE_PREFIX } from '@/lib/resource-links'

const SIGNED_URL_SECONDS = 300
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Opens a resource for the signed-in user. Authorization is the database's own rule: the
// resource is looked up with the user's session, so RLS decides whether they may see it.
// Files in private storage get a short-lived signed URL; external links are redirected
// only if they are http(s).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const { data: resource } = await supabase.from('resources').select('id, url').eq('id', id).maybeSingle()
  if (!resource?.url) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (resource.url.startsWith(STORAGE_PREFIX)) {
    const path = resource.url.slice(STORAGE_PREFIX.length)
    const { data, error } = await supabaseAdmin.storage.from('resources').createSignedUrl(path, SIGNED_URL_SECONDS)
    if (error || !data?.signedUrl) return NextResponse.json({ error: 'File unavailable' }, { status: 404 })
    return NextResponse.redirect(data.signedUrl)
  }

  const external = safeHttpUrl(resource.url)
  if (!external) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.redirect(external)
}
