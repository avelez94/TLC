#!/usr/bin/env bash
# Restore-test an encrypted production backup on a throwaway LOCAL Postgres, print per-table
# row counts and checksums (no record contents), then delete everything.
# Usage: supabase/scripts/verify-backup.sh path/to/tlc-prod-YYYYMMDD.dump.age
set -euo pipefail
ENC="${1:?path to .dump.age file}"
PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}"
WORK="$(mktemp -d)"; PORT="${VERIFY_PORT:-54331}"
export LC_ALL=C PGHOST=127.0.0.1 PGPORT="$PORT" PGUSER=postgres
cleanup() { "$PGBIN/pg_ctl" -D "$WORK/data" stop -m fast >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT
chmod 700 "$WORK"

echo "Decrypting (you will be asked for the backup passphrase)…"
age --decrypt --output "$WORK/backup.dump" "$ENC"

"$PGBIN/initdb" -D "$WORK/data" -U postgres --auth=trust >/dev/null
"$PGBIN/pg_ctl" -D "$WORK/data" -o "-k '' -p $PORT -c listen_addresses=127.0.0.1" -l "$WORK/pg.log" start >/dev/null
"$PGBIN/psql" -X -q -c "create role anon nologin; create role authenticated nologin; create role service_role nologin; create role supabase_auth_admin nologin; create role supabase_storage_admin nologin; create role authenticator nologin;" >/dev/null
"$PGBIN/psql" -X -q -c "create extension if not exists pgcrypto;" >/dev/null

echo "Restoring…"
"$PGBIN/pg_restore" --no-owner --no-privileges --dbname=postgres "$WORK/backup.dump" 2> "$WORK/restore.log" || true
echo "Restore warnings (extension/role objects that exist only on Supabase are expected): $(grep -c 'error' "$WORK/restore.log" || true)"

echo
echo "table | rows | md5"
"$PGBIN/psql" -X -A -t -F ' | ' -c "
do \$\$ declare t text; c bigint; m text; begin
  create temp table fp (tbl text, row_count bigint, content_md5 text);
  for t in select tablename from pg_tables where schemaname = 'public' order by 1 loop
    execute format('select count(*), md5(coalesce(string_agg(x::text, %L order by x::text), %L)) from public.%I x', '|', '', t) into c, m;
    insert into fp values (t, c, m);
  end loop;
end \$\$;
select * from fp order by tbl;"
echo
echo "auth.users rows: $("$PGBIN/psql" -X -A -t -c 'select count(*) from auth.users' 2>/dev/null || echo 'not restored')"
echo "Done. Temporary files are being deleted."
