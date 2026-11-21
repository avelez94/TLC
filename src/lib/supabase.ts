import { createBrowserClient } from '@supabase/ssr'
import { assertSafeEnvironment } from './env-guard'

// Next.js inlines these at build time, so the guard sees the same values in the browser.
assertSafeEnvironment({
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  ALLOW_PRODUCTION_SERVICES: process.env.NEXT_PUBLIC_ALLOW_PRODUCTION_SERVICES,
})

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
