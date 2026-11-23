// Keeps non-production runs (local `next dev`, Vercel preview deployments) away from the
// production database, live Stripe keys and real recipients' inboxes.
//
// Production is identified ONLY by Vercel's VERCEL_ENV === 'production'. Anything else is
// treated as non-production. To deliberately run against production services from a
// non-production environment, set ALLOW_PRODUCTION_SERVICES=true (not recommended).

export const PRODUCTION_SUPABASE_REF = 'jpgvclclgnyfguatuihx'

type Env = Record<string, string | undefined>

export function isProductionDeployment(env: Env): boolean {
  return env.VERCEL_ENV === 'production'
}

/** Environments where the guard is enforced. Unknown/other environments are left alone. */
function guardedEnvironment(env: Env): string | null {
  if (env.VERCEL_ENV === 'preview' || env.NEXT_PUBLIC_VERCEL_ENV === 'preview') return 'preview'
  if (env.VERCEL_ENV === 'development' || env.NODE_ENV === 'development') return 'development'
  return null
}

export function environmentProblems(env: Env): string[] {
  const where = guardedEnvironment(env)
  if (!where || env.ALLOW_PRODUCTION_SERVICES === 'true') return []
  const problems: string[] = []
  if ((env.NEXT_PUBLIC_SUPABASE_URL ?? '').includes(PRODUCTION_SUPABASE_REF)) {
    problems.push(`${where} is configured with the PRODUCTION Supabase project`)
  }
  if ((env.STRIPE_SECRET_KEY ?? '').startsWith('sk_live_')) {
    problems.push(`${where} is configured with a LIVE Stripe secret key`)
  }
  return problems
}

export function assertSafeEnvironment(env: Env): void {
  const problems = environmentProblems(env)
  if (problems.length > 0) {
    throw new Error(
      `Unsafe environment configuration: ${problems.join('; ')}. ` +
        'Point this environment at the development Supabase project and Stripe test keys ' +
        '(see docs/environments.md), or set ALLOW_PRODUCTION_SERVICES=true to override.'
    )
  }
}

/**
 * Where an outgoing email should go. In a known non-production environment (Vercel
 * preview or local dev): EMAIL_TEST_RECIPIENT if set, otherwise null (do not send).
 * Everywhere else (production, or anything unrecognised): the real recipient, so a
 * missing system variable can never silently stop production email.
 */
/**
 * Local/preview test transport: when EMAIL_SINK_DIR is set in a known non-production
 * environment, emails are written to that folder instead of being sent. Never in production.
 */
export function emailSinkDir(env: Env): string | null {
  if (isProductionDeployment(env) || guardedEnvironment(env) === null) return null
  return env.EMAIL_SINK_DIR || null
}

export function emailRecipient(env: Env, intended: string): string | null {
  if (guardedEnvironment(env) === null) return intended
  return env.EMAIL_TEST_RECIPIENT || null
}
