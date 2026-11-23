#!/usr/bin/env bash
# Runs the RLS access matrix on a throwaway local Postgres: once against the replica of
# the live policies (shows the exposure), once after the lockdown migration, then checks
# that the rollback script restores the original policy set. Touches no remote database.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
WORK="${RLS_TEST_DIR:-$(mktemp -d)}"
PORT="${RLS_TEST_PORT:-54329}"
export PGOPTIONS="-c client_min_messages=warning" LC_ALL=C PGHOST=127.0.0.1 PGPORT="$PORT" PGUSER=postgres PGDATABASE=postgres

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
MIGRATIONS_2D="20261121000000_emergency_rls_lockdown 20261121100000_privacy_phase2a_additive 20261121110000_privacy_phase2b_column_restrictions 20261122000000_pathways_inquiries_admin 20261123000000_admin_hardening 20261123000001_admin_hardening_search_path"
echo "=== 2d: admin hardening (MFA in the database, resources, reps, capacity, activity log) ==="
setup
for m in $MIGRATIONS_2D; do run -d rls_test -f "$ROOT/supabase/migrations/$m.sql" >/dev/null; done
run -d rls_test -f "$HERE/06_checks_2d.sql"
echo "--- earlier checks with 2d applied (expected difference: anon can no longer read the hidden historical program) ---"
setup
for m in $MIGRATIONS_2D; do run -d rls_test -f "$ROOT/supabase/migrations/$m.sql" >/dev/null; done
run -d rls_test -f "$HERE/05_checks_2c.sql" | tail -3
run -d rls_test -f "$HERE/04_checks_phase2.sql" | tail -3

echo "=== 2d: simultaneous enrollments cannot overfill a cohort ==="
setup
for m in $MIGRATIONS_2D; do run -d rls_test -f "$ROOT/supabase/migrations/$m.sql" >/dev/null; done
run -d rls_test -c "update cohorts set capacity = 2 where id = '00000000-0000-0000-0000-0000000c0002'" >/dev/null  # 1 of 2 taken (P2)
race() {  # $1 = user id; each session holds its insert open for a second before committing
  run -d rls_test -c "begin" -c "set local role service_role" \
    -c "insert into cohort_enrollments (cohort_id, user_id, status) values ('00000000-0000-0000-0000-0000000c0002', '$1', 'active')" \
    -c "select pg_sleep(1)" -c "commit" >/dev/null 2>&1 && echo ok || echo blocked
}
race 00000000-0000-0000-0000-0000000000b1 > "$WORK/r1" & race 00000000-0000-0000-0000-0000000000b3 > "$WORK/r2" & race 00000000-0000-0000-0000-0000000000d1 > "$WORK/r3" &
wait
echo "3 simultaneous enrollments for 1 free seat: $(cat "$WORK/r1" "$WORK/r2" "$WORK/r3" | sort | uniq -c | tr '\n' ' ')"
run -d rls_test -c "select count(*) as active_in_cohort_two, (count(*) = 2) as within_capacity from cohort_enrollments where cohort_id = '00000000-0000-0000-0000-0000000c0002' and status = 'active'"

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

echo "=== ROLLBACK 2c: removes only the 2c additions; existing records untouched ==="
setup
for m in 20261121000000_emergency_rls_lockdown 20261121100000_privacy_phase2a_additive 20261121110000_privacy_phase2b_column_restrictions; do
  run -d rls_test -f "$ROOT/supabase/migrations/$m.sql" >/dev/null
done
run -d rls_test -c "create table public._before_2c as select (select count(*) from programs) p, (select count(*) from cohorts) c, (select count(*) from registrations) r, (select count(*) from certificates) ce, (select count(*) from cohort_enrollments) e" >/dev/null
run -d rls_test -f "$ROOT/supabase/migrations/20261122000000_pathways_inquiries_admin.sql" >/dev/null
run -d rls_test -c "insert into inquiries (kind, contact_name, email, pathways) values ('organization', 'Test Person', 'test@example.org', '{new-leaders}')" >/dev/null
run -d rls_test -f "$ROOT/supabase/rollback/20261122000000_pathways_inquiries_admin_rollback.sql" >/dev/null
run -d rls_test -c "select to_regclass('public.inquiries') is null and to_regclass('public.admin_audit_log') is null and to_regclass('public.email_log') is null as tables_removed,
                           (select count(*) from programs where slug like '%-leaders') as pathway_rows_left,
                           (select row(p, c, r, ce, e) from _before_2c) = row((select count(*) from programs), (select count(*) from cohorts), (select count(*) from registrations), (select count(*) from certificates), (select count(*) from cohort_enrollments)) as existing_records_unchanged"

echo "=== ROLLBACK 2d: restores the 2c rules; records and activity log kept ==="
setup
for m in 20261121000000_emergency_rls_lockdown 20261121100000_privacy_phase2a_additive 20261121110000_privacy_phase2b_column_restrictions 20261122000000_pathways_inquiries_admin; do
  run -d rls_test -f "$ROOT/supabase/migrations/$m.sql" >/dev/null
done
run -d rls_test -c "create table public._policies_2c as select tablename, policyname, cmd, roles::text, qual, with_check from pg_policies where schemaname='public' and tablename <> '_policies_2c'" \
  -c "create table public._isadmin_2c as select pg_get_functiondef('public.is_admin'::regproc) d" >/dev/null
run -d rls_test -f "$ROOT/supabase/migrations/20261123000000_admin_hardening.sql" >/dev/null
run -d rls_test -c "insert into admin_audit_log (actor_id, action, outcome) values ('00000000-0000-0000-0000-0000000000a1', 'test.entry', 'success')" \
  -c "update weekly_reps set archived_at = now() where id = '00000000-0000-0000-0000-00000000cc01'" >/dev/null
run -d rls_test -f "$ROOT/supabase/rollback/20261123000000_admin_hardening_rollback.sql" >/dev/null
run -d rls_test -c "select
  (select count(*) from (select tablename, policyname, cmd, roles::text, qual, with_check from pg_policies where schemaname='public' and tablename not like '\_%'
                          except select * from _policies_2c) d) as policy_differences,
  (select count(*) from (select * from _policies_2c except select tablename, policyname, cmd, roles::text, qual, with_check from pg_policies where schemaname='public') d) as policies_missing,
  (select d from _isadmin_2c) = pg_get_functiondef('public.is_admin'::regproc) as is_admin_restored,
  (select count(*) from admin_audit_log where action = 'test.entry') as activity_log_kept,
  (select count(*) from weekly_rep_submissions) as reflections_kept,
  (select count(*) from pg_trigger where tgname in ('audit_admin_change','enforce_cohort_capacity','guard_admin_role')) as triggers_left"
