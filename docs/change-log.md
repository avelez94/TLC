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


| When (2026-11-22) | Change | Approved | Verification | Recovery |
|---|---|---|---|---|
| 15:43 | Independent encrypted backup `~/TLC-Backups/tlc-prod-20261122T154353Z.tgz.enc` | Owner, deployment approval | Restored into throwaway local Postgres: integrity OK, 32/32 tables match production content checksums, 10 accounts | `supabase/scripts/backup-restore-verify.sh` |
| ~16:00 | Recorded pre-2c rule: `cohorts_status_check` = `CHECK (status = ANY (ARRAY['active','upcoming','completed']))`; all 4 cohorts `completed` | — | — | Used by the 2c rollback |
| ~16:05 | Migration `pathways_inquiries_admin_20261122` (2c) | Owner, deployment approval | Existing tables' checksums unchanged; 3 pathway rows (public, enrollment closed); historical programs kept, not public; 4 new tables with RLS; anon has no access; audit log append-only; email log server-written; 66 policies; advisor: no new findings | `supabase/rollback/20261122000000_pathways_inquiries_admin_rollback.sql` (backup first; removes inquiries) |
| 16:12 | Application release: `main` fast-forwarded `5752e5e` → `a66b5da` (reviewed code `fcc7c19` + change-log), Vercel deployment `dpl_CoB93KhQx89kpxBZ6ps3pucmFRg7` | Owner, deployment approval | 11 public pages 200; checkout 503 (closed); forged webhook 400; cron/admin/invite APIs 401; admin and portal pages → /login; anon key refused on inquiries, logs, profiles, registrations, journals; `/impact` live at 375 and 1440 px (headline one line per phrase, no sideways scroll, old `#makers` link, tabs, inquiry buttons); no runtime errors | Vercel Instant Rollback to `dpl_FioQXWCeVy3kHJBVpwcEa7jtxq4V` (compatible with 2c) |
| 16:14 | One labelled test inquiry ("TEST - Deployment check", test inbox `delivered@resend.dev`) | Owner, deployment approval | Stored as New; owner notification and acknowledgement both `sent` in the email log; admin permissions (view, status, follow-up, notes, pathway edit, capacity, archive, audit append) pass in rolled-back transactions; participant sees none of it and cannot self-promote | Owner closes the test inquiry in Admin → Inquiries |

Not changed: prices, payment records, refunds, accounts, backups (in-database `security_backup` copies and `~/TLC-Backups` kept) (including the two 2026-06-26 test
accounts), paid services. Online checkout is closed (`CHECKOUT_ENABLED` unset).
