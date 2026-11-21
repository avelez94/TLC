# Production Change Log

All times UTC. Project: Supabase `jpgvclclgnyfguatuihx`, Vercel project `tlc`.
Rollback points: git tag `rollback/pre-impact-revamp-2026-11-20` (commit `1c6aedc`),
Vercel deployment `dpl_7AL9X3wQbvAZo1phFQvgWC6ToN4o` (previous production).

| When (2026-11-21) | Change | Approved | Verification | Recovery |
|---|---|---|---|---|
| 07:4x | In-database backup of all 32 public tables + policy/grant/function snapshots (`security_backup`) | Owner, emergency approval | Checksums identical to live tables | — |
| 07:51:56 | Migration `emergency_rls_lockdown_20261121` | Owner, emergency approval | Data unchanged 32/32; 57 policies; anon refused on 19 sensitive tables; participant/client/admin checks; advisor 8 → 2 | `supabase/rollback/20261121000000_…` (not to be used; reopens exposure) |
| 16:43 | Independent encrypted backup `~/TLC-Backups/tlc-prod-20261121T164339Z.tgz.enc` (AES-256/PBKDF2 + HMAC, key in macOS Keychain) | Owner, rollout approval | Restored into throwaway local Postgres: integrity OK, 32/32 tables match production counts and checksums, 10 accounts | Restore with `supabase/scripts/backup-restore-verify.sh` |
| ~17:10 | Migration `privacy_phase2a_additive_20261121` (functions, private bucket, rate-limit table, notification columns, unique indexes, rep-submission rule) | Owner, rollout approval | All tables unchanged (registrations original columns identical); objects present; 60 policies | `supabase/rollback/20261121100000_privacy_phase2a_rollback.sql` |
| ~17:20 | Application release: `main` fast-forwarded `1c6aedc` → `5752e5e`, Vercel deployment `dpl_FioQXWCeVy3kHJBVpwcEa7jtxq4V` | Owner, rollout approval | 11 public pages 200; `/api/register` 410; `/api/checkout` 503 (closed); webhook unsigned 400; cron/admin routes 401; protected pages → /login; register page loads data in a real browser | Vercel Instant Rollback to `dpl_7AL9X3wQbvAZo1phFQvgWC6ToN4o` (compatible with 2a; **not** with 2b — roll back 2b first) |
| 17:28 | Migration `privacy_phase2b_column_restrictions_20261121` + API schema reload | Owner, rollout approval | Participant: own row/`my_profile` OK, others' email/phone/rate refused, Zoom column refused, own cohort link only; client: profile + coach found; admin: links, role/Zoom/cohort updates, registrations; anon unchanged; public pages and reading/register queries 200; advisor: no errors | `supabase/rollback/20261121110000_privacy_phase2b_rollback.sql`, then app rollback if needed |

Not changed: prices, payment records, refunds, accounts (including the two 2026-06-26 test
accounts), paid services. Online checkout is closed (`CHECKOUT_ENABLED` unset).
