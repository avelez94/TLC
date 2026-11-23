import { NextResponse } from 'next/server'
import { visiblePathwayLinks } from '@/lib/public-pathways'

// Visible pathway names for client-side forms (the contact form). Public information only.
export async function GET() {
  return NextResponse.json({ pathways: await visiblePathwayLinks() })
}
