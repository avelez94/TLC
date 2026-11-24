#!/usr/bin/env bash
# Local end-to-end stack with SYNTHETIC data only: throwaway Postgres (same schema, policies
# and migrations as production), PostgREST, and a local stand-in for Supabase auth/storage.
# Touches no remote service. Then build/run the site against it:
#   scripts/local-stack/start.sh && set -a && . /tmp/tlc-local-stack/env.local && set +a && npx next build && npx next start -p 3999
# Stop: scripts/local-stack/start.sh stop
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
WORK="${LOCAL_STACK_DIR:-/tmp/tlc-local-stack}"
PGPORT_LOCAL=54330
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH" LC_ALL=C PGOPTIONS="-c client_min_messages=warning"

stop() {
  for p in gateway postgrest; do [ -f "$WORK/$p.pid" ] && kill "$(cat "$WORK/$p.pid")" 2>/dev/null || true; done
  [ -d "$WORK/data" ] && pg_ctl -D "$WORK/data" stop -m fast >/dev/null 2>&1 || true
}
if [ "${1:-}" = "stop" ]; then stop; rm -rf "$WORK"; echo "stopped"; exit 0; fi
# Keep the previous local signing secret so a restart does not invalidate a running local build
# (NEXT_PUBLIC_* keys are baked in at build time). Local only; never used outside this machine.
PREV_SECRET="$(sed -n 's/^JWT_SECRET=//p' "$WORK/secret.env" 2>/dev/null || true)"
stop; rm -rf "$WORK"; mkdir -p "$WORK/storage"

initdb -D "$WORK/data" -U postgres --auth=trust >/dev/null
pg_ctl -D "$WORK/data" -o "-k '' -p $PGPORT_LOCAL -c listen_addresses=127.0.0.1" -l "$WORK/pg.log" start >/dev/null
PG="postgres://postgres@127.0.0.1:$PGPORT_LOCAL/tlc_local"
psql -X -q -h 127.0.0.1 -p $PGPORT_LOCAL -U postgres -c "create database tlc_local" >/dev/null
run() { psql -X -q -v ON_ERROR_STOP=1 "$PG" "$@" >/dev/null; }

run -f "$ROOT/supabase/tests/rls/00_supabase_stub.sql"
run -c "alter table auth.users add column if not exists encrypted_password text, add column if not exists created_at timestamptz default now(), add column if not exists last_sign_in_at timestamptz;
        alter table auth.mfa_factors add column if not exists friendly_name text, add column if not exists secret text;"
run -f "$ROOT/supabase/tests/rls/01_live_replica.sql"
run -f "$HERE/prod-foreign-keys.sql"
for m in 20261121000000_emergency_rls_lockdown 20261121100000_privacy_phase2a_additive 20261121110000_privacy_phase2b_column_restrictions 20261122000000_pathways_inquiries_admin ${LOCAL_EXTRA_MIGRATIONS-20261123000000_admin_hardening 20261123000001_admin_hardening_search_path 20261124000000_workflow_integration}; do
  run -f "$ROOT/supabase/migrations/$m.sql"
done
# The 2c pathway rows exist in production; the 2c migration only inserts them when missing.
run -f "$HERE/seed.sql"
run -c "create role authenticator login password 'local' noinherit; grant anon, authenticated, service_role to authenticator;
        grant usage on schema public to anon, authenticated, service_role;
        grant all on all tables in schema public to service_role; grant all on all sequences in schema public to service_role, authenticated;
        grant execute on all functions in schema public to service_role;
        notify pgrst, 'reload schema';"

SECRET="${PREV_SECRET:-$(openssl rand -hex 32)}"
sign() { JWT_SECRET="$SECRET" node -e "import('$HERE/sign.mjs').then(m => process.stdout.write(m.sign({ role: '$1', iss: 'local', iat: 1700000000, exp: 4100000000 })))"; }
ANON="$(sign anon)"; SERVICE="$(sign service_role)"

cat > "$WORK/postgrest.conf" <<EOF
db-uri = "postgres://authenticator:local@127.0.0.1:$PGPORT_LOCAL/tlc_local"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$SECRET"
server-host = "127.0.0.1"
server-port = 54322
EOF
nohup postgrest "$WORK/postgrest.conf" > "$WORK/postgrest.log" 2>&1 & echo $! > "$WORK/postgrest.pid"
JWT_SECRET="$SECRET" PG_URL="$PG" STORAGE_DIR="$WORK/storage" nohup node "$HERE/gateway.mjs" > "$WORK/gateway.log" 2>&1 & echo $! > "$WORK/gateway.pid"

cat > "$WORK/env.local" <<EOF
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON
SUPABASE_SERVICE_ROLE_KEY=$SERVICE
NEXT_PUBLIC_SITE_URL=http://localhost:3999
STRIPE_SECRET_KEY=sk_test_local_dummy
STRIPE_WEBHOOK_SECRET=whsec_local_dummy
RESEND_API_KEY=
VERCEL_ENV=preview
CRON_SECRET=local
NEXT_TELEMETRY_DISABLED=1
EOF
echo "JWT_SECRET=$SECRET" > "$WORK/secret.env"
echo "PG_URL=$PG" >> "$WORK/secret.env"
sleep 1
curl -fsS "http://127.0.0.1:54321/rest/v1/programs?select=name&is_public=eq.true" -H "apikey: $ANON" >/dev/null && echo "local stack ready: env in $WORK/env.local" || { echo "stack failed; see $WORK/*.log"; exit 1; }
