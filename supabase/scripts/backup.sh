#!/usr/bin/env bash
# Create an encrypted, access-restricted backup of production in ~/TLC-Backups.
#   - Export: supabase/scripts/backup-export.mjs (exact CSV per table, auth summary, storage list)
#   - Encryption: AES-256-CBC, PBKDF2-SHA256 (600k iterations), plus HMAC-SHA256 over the
#     ciphertext (encrypt-then-MAC) so tampering or corruption is detected before restore.
#   - Passphrase: random, stored only in the macOS login Keychain
#     (service "TLC production backup"); never printed or written to disk.
# Plaintext exists only in a 0700 temp directory and is deleted on exit.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DEST="${TLC_BACKUP_DIR:-$HOME/TLC-Backups}"
SERVICE="TLC production backup"
mkdir -p "$DEST" && chmod 700 "$DEST"
umask 077

if ! PASS="$(security find-generic-password -s "$SERVICE" -a "$USER" -w 2>/dev/null)"; then
  PASS="$(openssl rand -base64 48)"
  security add-generic-password -s "$SERVICE" -a "$USER" -w "$PASS" -j "Encrypts TLC production backups in ~/TLC-Backups" >/dev/null
  echo "Created a new backup passphrase in the login Keychain (\"$SERVICE\")."
fi
export PASS

WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
(cd "$ROOT" && node supabase/scripts/backup-export.mjs "$WORK/tlc-prod-$STAMP")
tar -C "$WORK" -czf "$WORK/bundle.tgz" "tlc-prod-$STAMP"

OUT="$DEST/tlc-prod-$STAMP.tgz.enc"
openssl enc -aes-256-cbc -pbkdf2 -md sha256 -iter 600000 -salt -pass env:PASS -in "$WORK/bundle.tgz" -out "$OUT"
openssl dgst -sha256 -mac HMAC -macopt "key:$PASS" -r "$OUT" | cut -d' ' -f1 > "$OUT.hmac"
chmod 600 "$OUT" "$OUT.hmac"
echo
echo "Encrypted backup: $OUT ($(du -h "$OUT" | cut -f1))"
echo "Integrity tag:    $OUT.hmac"
