#!/usr/bin/env bash
# Prove an encrypted backup restores: verify its integrity tag, decrypt into a 0700 temp
# directory, load it into a throwaway LOCAL Postgres built from the production structure,
# and print per-table row counts and content checksums (no record contents). If a
# production fingerprint file is given (tbl|rows|md5 per line), compare and report PASS/FAIL.
# Usage: supabase/scripts/backup-restore-verify.sh <backup.tgz.enc> [prod-fingerprint.txt]
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
for m in ${APPLIED_MIGRATIONS:-20261121000000_emergency_rls_lockdown 20261121100000_privacy_phase2a_additive 20261121110000_privacy_phase2b_column_restrictions}; do
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
