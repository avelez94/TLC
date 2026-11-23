import { NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { requireAdmin } from '@/lib/supabase-server'
import { PUBLIC_PATHWAYS_TAG } from '@/lib/public-pathways'

// Called by the admin portal after a pathway is saved, so the footer, contact form and
// pre-rendered public pages show (or stop showing) the pathway right away.
export async function POST() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  revalidateTag(PUBLIC_PATHWAYS_TAG, { expire: 0 })
  revalidatePath('/', 'layout')
  return NextResponse.json({ success: true })
}
