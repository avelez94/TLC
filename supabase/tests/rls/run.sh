#!/usr/bin/env bash
# Runs the RLS access matrix on a throwaway local Postgres: once against the replica of
# the live policies (shows the exposure), once after the lockdown migration, then checks
# that the rollback script restores the original policy set. Touches no remote database.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
WORK="${RLS_TEST_DIR:-$(mktemp -d)}"
PORT="${RLS_TEST_PORT:-54329}"
export LC_ALL=C PGHOST=127.0.0.1 PGPORT="$PORT" PGUSER=postgres PGDATABASE=postgres

initdb -D "$WORK/data" -U postgres --auth=trust >/dev/null
pg_ctl -D "$WORK/data" -o "-k '' -p $PORT -c listen_addresses=127.0.0.1" -l "$WORK/pg.log" start >/dev/null
trap 'pg_ctl -D "$WORK/data" stop -m fast >/dev/null; rm -rf "$WORK"' EXIT

run() { psql -X -q -v ON_ERROR_STOP=1 "$@"; }
setup() {
  run -c 'drop database if exists rls_test' -c 'create database rls_test' >/dev/null
  for f in 00_supabase_stub 01_live_replica 02_fixtures; do run -d rls_test -f "$HERE/$f.sql" >/dev/null; done
}

echo "=== BEFORE: replica of live policies ==="
setup
run -d rls_test -f "$HERE/03_checks.sql"

echo "=== AFTER: emergency lockdown migration applied ==="
setup
run -d rls_test -f "$ROOT/supabase/migrations/20261121000000_emergency_rls_lockdown.sql" >/dev/null
run -d rls_test -f "$HERE/03_checks.sql"

echo "=== PHASE 2: lockdown + 2a + 2b applied ==="
setup
for m in 20261121000000_emergency_rls_lockdown 20261121100000_privacy_phase2a_additive 20261121110000_privacy_phase2b_column_restrictions; do
  run -d rls_test -f "$ROOT/supabase/migrations/$m.sql" >/dev/null
done
run -d rls_test -f "$HERE/04_checks_phase2.sql"
echo "=== 2c: pathways, inquiries, audit/email logs ==="
setup
for m in 20261121000000_emergency_rls_lockdown 20261121100000_privacy_phase2a_additive 20261121110000_privacy_phase2b_column_restrictions 20261122000000_pathways_inquiries_admin; do
  run -d rls_test -f "$ROOT/supabase/migrations/$m.sql" >/dev/null
done
run -d rls_test -f "$HERE/05_checks_2c.sql"
run -d rls_test -f "$HERE/04_checks_phase2.sql" | tail -3
echo "=== COMPATIBILITY: current production code paths still work after 2a only ==="
setup
run -d rls_test -f "$ROOT/supabase/migrations/20261121000000_emergency_rls_lockdown.sql" >/dev/null
run -d rls_test -f "$ROOT/supabase/migrations/20261121100000_privacy_phase2a_additive.sql" >/dev/null
run -d rls_test -f "$HERE/03_checks.sql" | tail -3

echo "=== ROLLBACK: restores the original policies exactly ==="
setup
run -d rls_test -f "$ROOT/supabase/migrations/20261121000000_emergency_rls_lockdown.sql" >/dev/null
run -d rls_test -c "create temp table before_rb as select tablename, policyname, cmd, roles::text, qual, with_check from security_backup.policies_20261121" \
  -f "$ROOT/supabase/rollback/20261121000000_emergency_rls_lockdown_rollback.sql" \
  -c "select (select count(*) from before_rb) as backed_up,
             (select count(*) from pg_policies where schemaname='public') as restored,
             (select count(*) from (select tablename, policyname, cmd, roles::text, qual, with_check from pg_policies where schemaname='public'
                                    except select * from before_rb) d) as differences,
             has_table_privilege('anon','public.profiles','SELECT') as anon_select_restored"
