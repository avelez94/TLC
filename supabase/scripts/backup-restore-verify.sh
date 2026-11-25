#!/usr/bin/env bash
# Prove an encrypted backup restores: verify its integrity tag, decrypt into a 0700 temp
# directory, load it into a throwaway LOCAL Postgres built from the production structure,
# and print per-table row counts and content checksums (no record contents). If a
# production fingerprint file is given (tbl|rows|md5 per line), compare and report PASS/FAIL.
# Usage: supabase/scripts/backup-restore-verify.sh <backup.tgz.enc> [prod-fingerprint.txt]
# Rehearsal: REHEARSE_MIGRATION=<migration name> [REHEARSE_ROLLBACK=<rollback file name>] also
# applies that migration to the restored copy and proves every existing row is unchanged (same
# count and checksum over the columns that existed before), then the same after the rollback.
# Counts and checksums only; the copy is deleted on exit.
set -euo pipefail
ENC="${1:?encrypted backup path}"; FP="${2:-}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}"
SERVICE="TLC production backup"
umask 077
PASS="$(security find-generic-password -s "$SERVICE" -a "$USER" -w)"; export PASS
WORK="$(mktemp -d)"; PORT="${VERIFY_PORT:-54332}"
export LC_ALL=C PGHOST=127.0.0.1 PGPORT="$PORT" PGUSER=postgres PGDATABASE=postgres
cleanup() { "$PGBIN/pg_ctl" -D "$WORK/data" stop -m fast >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

expected="$(cat "$ENC.hmac")"
actual="$(openssl dgst -sha256 -mac HMAC -macopt "key:$PASS" -r "$ENC" | cut -d' ' -f1)"
[ "$expected" = "$actual" ] || { echo "INTEGRITY CHECK FAILED"; exit 1; }
echo "Integrity tag: OK"

openssl enc -d -aes-256-cbc -pbkdf2 -md sha256 -iter 600000 -pass env:PASS -in "$ENC" -out "$WORK/bundle.tgz"
tar -C "$WORK" -xzf "$WORK/bundle.tgz"
DIR="$(find "$WORK" -maxdepth 1 -type d -name 'tlc-prod-*' | head -1)"

"$PGBIN/initdb" -D "$WORK/data" -U postgres --auth=trust >/dev/null
"$PGBIN/pg_ctl" -D "$WORK/data" -o "-k '' -p $PORT -c listen_addresses=127.0.0.1" -l "$WORK/pg.log" start >/dev/null
psql() { "$PGBIN/psql" -X -q -v ON_ERROR_STOP=1 "$@"; }
psql -f "$ROOT/supabase/tests/rls/00_supabase_stub.sql" >/dev/null
psql -f "$ROOT/supabase/tests/rls/01_live_replica.sql" >/dev/null
# Bring the local structure up to what production runs (migrations applied there, in order).
for m in ${APPLIED_MIGRATIONS:-20261121000000_emergency_rls_lockdown 20261121100000_privacy_phase2a_additive 20261121110000_privacy_phase2b_column_restrictions 20261122000000_pathways_inquiries_admin 20261123000000_admin_hardening 20261123000001_admin_hardening_search_path}; do
  psql -f "$ROOT/supabase/migrations/$m.sql" >/dev/null 2>&1
done

# auth.users ids/emails so profile foreign keys resolve
node -e '
const u=require(process.argv[1]); process.stdout.write(u.map(x=>[x.id, JSON.stringify(x.email ?? "")].join(",")).join("\n")+"\n")' "$DIR/auth_users.json" > "$WORK/auth_users.csv"
{
  echo "set session_replication_role = replica;"
  # Migrations applied above may seed rows (2c adds the pathways); the backup is the truth.
  echo "truncate public.programs cascade;"
  echo "\\copy auth.users (id, email) from '$WORK/auth_users.csv' csv"
  for f in "$DIR"/public/*.csv; do
    t="$(basename "$f" .csv)"
    [ -s "$f" ] || continue
    cols="$(head -1 "$f")"
    [ -n "$cols" ] && echo "\\copy public.$t ($cols) from '$f' csv header"
  done
} > "$WORK/load.sql"
psql -f "$WORK/load.sql" >/dev/null
echo "Restore: loaded into local Postgres"

psql -A -t -F '|' > "$WORK/restored.txt" <<'SQL'
set timezone to 'UTC';
do $$ declare t text; c bigint; m text; begin
  create temp table fp (tbl text, row_count bigint, content_md5 text);
  for t in select tablename from pg_tables where schemaname = 'public' order by 1 loop
    execute format('select count(*), md5(coalesce(string_agg(x::text, %L order by x::text), %L)) from public.%I x', '|', '', t) into c, m;
    insert into fp values (t, c, m);
  end loop;
end $$;
select tbl, row_count, content_md5 from fp order by tbl;
SQL

if [ -n "$FP" ]; then
  pass=0; fail=0
  while IFS='|' read -r t c m; do
    exp="$(grep "^$t|" "$FP" || true)"
    if [ "$exp" = "$t|$c|$m" ]; then pass=$((pass+1)); else fail=$((fail+1)); echo "MISMATCH $t: restored $c rows"; fi
  done < "$WORK/restored.txt"
  echo "Compared with production fingerprint: $pass match, $fail mismatch"
  [ "$fail" -eq 0 ] || exit 1
else
  awk -F'|' '{printf "%-24s %s\n", $1, $2}' "$WORK/restored.txt"
fi
echo "auth.users rows restored: $(psql -A -t -c 'select count(*) from auth.users')"

if [ -n "${REHEARSE_MIGRATION:-}" ]; then
  # Fingerprint each existing table over its CURRENT columns only, so added columns do not count.
  psql -c "create table public._cols as select table_name::text t, string_agg(quote_ident(column_name), ', ' order by ordinal_position) cols from information_schema.columns where table_schema = 'public' group by 1" >/dev/null
  fp_sql="set timezone to 'UTC'; select string_agg(t || '|' || n || '|' || m, E'\\n' order by t) from (select c.t, (xpath('/row/n/text()', query_to_xml(format('select count(*) n from public.%I', c.t), false, true, '')))[1]::text n, (xpath('/row/m/text()', query_to_xml(format('select md5(coalesce(string_agg(r::text, %L order by r::text), %L)) m from (select %s from public.%I) r', '|', '', c.cols, c.t), false, true, '')))[1]::text m from public._cols c where c.t <> '_cols') x"
  before="$(psql -A -t -c "$fp_sql")"
  psql -f "$ROOT/supabase/migrations/$REHEARSE_MIGRATION.sql" >/dev/null
  after="$(psql -A -t -c "$fp_sql")"
  [ "$before" = "$after" ] && echo "Rehearsal: $REHEARSE_MIGRATION applied; existing rows unchanged in all $(echo "$before" | wc -l | tr -d ' ') tables" || { echo "Rehearsal: CHANGED rows after $REHEARSE_MIGRATION:"; diff <(echo "$before") <(echo "$after") | grep '^[<>]' | cut -d'|' -f1-2; exit 1; }
  psql -A -t -c "select 'Rehearsal: advisor-style check: tables with two links to profiles = ' || coalesce(string_agg(t, ','), 'none') from (select conrelid::regclass::text t from pg_constraint where contype = 'f' and confrelid = 'public.profiles'::regclass group by 1 having count(*) > 1) x"
  psql -A -t -c "begin; select 'Rehearsal: automatic status job would change ' || count(*) || ' cohort(s)' from public.system_update_cohort_statuses(); rollback;" 2>/dev/null | grep Rehearsal || true
  if [ -n "${REHEARSE_ROLLBACK:-}" ]; then
    psql -f "$ROOT/supabase/rollback/$REHEARSE_ROLLBACK.sql" >/dev/null
    again="$(psql -A -t -c "$fp_sql")"
    [ "$before" = "$again" ] && echo "Rehearsal: rollback applied; existing rows still unchanged" || { echo "Rehearsal: CHANGED rows after rollback"; exit 1; }
  fi
fi
