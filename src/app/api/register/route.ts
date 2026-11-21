import { NextResponse } from 'next/server'

// Retired endpoint. The register page uses /api/checkout. This route previously accepted
// unauthenticated submissions and emailed attacker-supplied HTML to any address, so it now
// refuses all requests. (Owner decision 2026-11-20: keep the existing pay-to-register flow.)
export async function POST() {
  return NextResponse.json(
    { error: 'This registration method is no longer available. Please register through tramainecrawford.com/register.' },
    { status: 410 }
  )
}
