# Independent Backup and Restore Test

## Is the in-database backup enough?

The `security_backup` schema (taken 2026-11-21 before the emergency fix) holds copies of all 32
public tables, the old policies, grants and functions. It is **not sufficient** as the only
backup for further migrations:

- It lives **in the same database**: project deletion, account compromise, corruption or an
  accidental `drop schema` loses it together with the data.
- It does **not** include `auth` (logins), `storage`, or the full schema/roles needed to rebuild.
- The free plan has **no platform backups** or point-in-time recovery.

Phases 2a and 2b change no data and run in a transaction, so the in-database copy covers their
direct risk. Your policy still requires an independent backup before **any** further production
migration. Do the steps below once, then before each production change.

After the independent backup is verified, the copies in `security_backup.data_20261121__*`
(personal data) should be dropped on approval; the policy/grant snapshots can stay.

## 1. Take the backup (owner runs these in Terminal; the password is typed at a prompt, never saved)

Get the connection string: Supabase dashboard → production project → **Connect** → **Session
pooler** → copy the URI **without** the password part.

```bash
brew install age
```
```bash
mkdir -p ~/TLC-Backups && chmod 700 ~/TLC-Backups
```
```bash
/opt/homebrew/opt/postgresql@17/bin/pg_dump --format=custom --no-owner --no-privileges --schema=public --schema=auth --schema=storage --file ~/TLC-Backups/tlc-prod-$(date +%Y%m%d).dump "postgresql://postgres.jpgvclclgnyfguatuihx@<pooler-host>:5432/postgres"
```
(`pg_dump` asks for the database password.)

Encrypt it, then remove the unencrypted file:

```bash
age --passphrase --output ~/TLC-Backups/tlc-prod-$(date +%Y%m%d).dump.age ~/TLC-Backups/tlc-prod-$(date +%Y%m%d).dump && rm ~/TLC-Backups/tlc-prod-$(date +%Y%m%d).dump
```

Store the passphrase in your password manager. Keep a second copy of the `.age` file somewhere
access-restricted (for example an encrypted external drive or a 1Password document). Never in
GitHub, email or a shared folder.

## 2. Test that it restores (owner starts it; it runs locally, nothing leaves the machine)

```bash
supabase/scripts/verify-backup.sh ~/TLC-Backups/tlc-prod-YYYYMMDD.dump.age
```

The script asks for the passphrase, restores into a throwaway local Postgres, prints a row count
and checksum per table, and deletes everything when done. I then compare the output against the
same fingerprint taken from production (counts and checksums only, no records).
