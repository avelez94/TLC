# Environments

| Environment | Where | Supabase | Stripe | Email |
|---|---|---|---|---|
| **Production** | tramainecrawford.com (Vercel *Production*) | `jpgvclclgnyfguatuihx` (TLC Leadership) | Live keys | Real recipients |
| **Preview** | Vercel preview URLs for branches/PRs | Separate development project | Test keys | `EMAIL_TEST_RECIPIENT` only |
| **Local** | `npm run dev` | Development project (or local Supabase) | Test keys | `EMAIL_TEST_RECIPIENT` only |

## The guard

`src/lib/env-guard.ts` stops the app from starting in **preview** or **local development**
when it is configured with the production Supabase project or a live Stripe secret key.
It also routes all outgoing email to `EMAIL_TEST_RECIPIENT` (or skips it) outside production.
Production is never blocked or redirected.

`ALLOW_PRODUCTION_SERVICES=true` overrides the guard. Don't set it unless you mean to touch
real data.

> Today every Vercel variable is shared by **Preview and Production**, and the local
> `.env.local` points at production with a live Stripe key (it defines `STRIPE_SECRET_KEY`
> twice; the second, live, value wins). With the guard in place, preview deploys and
> `npm run dev` will refuse to start until the steps below are done. That is intended.

## One-time setup (needs owner approval: creates a Supabase project and changes Vercel settings)

1. **Create a development Supabase project** (e.g. "TLC Leadership – Dev").
   Apply the schema from `supabase/tests/rls/01_live_replica.sql` (structure only, no data),
   then `supabase/migrations/20261121000000_emergency_rls_lockdown.sql`.
   Seed with fake data (`supabase/tests/rls/02_fixtures.sql` is a starting point; create
   users through Supabase Auth so they can sign in).
2. **Vercel → Settings → Environment Variables**: for each variable, untick *Preview* on the
   production value and add a Preview-only value:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` → dev project
   - `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` → Stripe test mode
   - `STRIPE_WEBHOOK_SECRET` → a test-mode webhook endpoint pointing at the preview URL
   - `EMAIL_TEST_RECIPIENT` → a team inbox
   - `NEXT_PUBLIC_SITE_URL` → leave unset for previews or set per branch
3. **Local**: copy `.env.example` to `.env.development.local` and fill in dev/test values.
   Remove or rename the current `.env.local` (it holds production secrets, including the
   live Stripe key) so `npm run dev` cannot pick it up.

## Testing database permissions

`supabase/tests/rls/run.sh` builds a throwaway local Postgres, loads a structural replica of
the production schema and policies, and runs an access matrix (anonymous visitor, two
participants in different cohorts, an outsider, a coaching client, an admin) before and
after the lockdown migration, then verifies the rollback. Requires Postgres 17 binaries on
`PATH`; touches no remote database.

```bash
PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH" supabase/tests/rls/run.sh
```

## Unit tests

```bash
npm test
```
