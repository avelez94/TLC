# Release 2e — workflow integration: summary, tests, migration, rollback and deployment checklist

Branch `feature/workflow-integration` (from production `0272dc6` = `91d7f23` + docs). **Not deployed.**
Production before 2e (checked read-only 2026-11-24): `main` = `91d7f23` (Vercel
`dpl_AJhGEWZJvDr4ciB97SuQgq4djeE9`), migrations lockdown, 2a, 2b, 2c, 2d + search-path follow-up.
Plan: `docs/workflow-integration-plan.md`. Email statuses: `docs/email-delivery.md`.

## What changes for people
| Who | Change |
|---|---|
| Past participants (e.g. the six Fall 2026 participants) | The portal shows **My Completed Programs**, **My Certificates** and **My Learning History** (they saw "Not enrolled" before). Finished programs are read-only unless an admin reopens activity until a date. |
| Participants | Honest progress (submitted / open / overdue; no invented target of 8). Download a branded PDF certificate once one is issued. |
| Invitees | Invitation and set-up links land on "set your password" (before: "request a reset"). An expired link says so and offers a new one. |
| Admins | **Needs your attention** first on the dashboard (exact links), cohort **setup checklist**, inquiry → enrollment for individuals and organizations (per-person results), manual completion and certificates, participation (who submitted, never what), attendance (record only), truthful email statuses with safe resend, payments views (test mode), "How do I…?" help. |
| Visitors | No change to the public site design. Wording only on the register success/cancel pages (unreachable while checkout is off). |

## Database migration `20261124000000_workflow_integration.sql`
Additive. No existing row is changed or deleted.
| § | Change | Effect on today's data |
|---|---|---|
| 1 | Read rules use `is_cohort_participant` (active **or completed** enrollment); write rules use `can_participate` (active enrollment in an Upcoming/Active cohort, or a cohort reopened with `cohorts.activity_open_until`). | Fall 2026 participants can read their program; they can no longer post or submit into the finished cohort. |
| 2 | `cohort_enrollments.completed_at / completed_by / completion_note`; trigger records the admin and date; withdrawn → completed refused. | None (no enrollment is completed today). |
| 3 | Certificate snapshot fields, number `TLC-YYYY-NNNN`, one valid certificate per person per cohort (a revoked one can be re-issued), requires recorded completion, cannot be deleted (revoke instead). | None (production has 0 certificates). |
| 4 | `admin_cohort_participation(cohort)`: who submitted which rep, never reflection text. | — |
| 5 | `inquiry_participants` (admin-only; emails stored lower-case, one row per inquiry and email). | New, empty. |
| 6 | `email_log`: statuses accepted/queued/delivered/delayed/bounced/complained, related person/record, resend chain, idempotency key, resolved flag; `admin_resolve_email`. | Existing rows (`sent`) unchanged and valid. |
| 7 | Payments: registration payment fields (cents, refunds, receipt, issues, complimentary), `payment_requests`, `stripe_events`; setting `enroll_on_payment = review`; `enroll_on_payment_mode()` (admins) and `system_enroll_on_payment_mode()` (webhook). | 14 historical registrations unchanged; `paid` with $0 = free checkout. |
| 8 | `admin_audit_log.actor_type`; `system_update_cohort_statuses()` changes and logs each automatic status change once (New York date). | — |
| 9 | Activity log covers attendance, inquiry people, payment requests, completion and certificate revocation. | — |
| 10 | Certificate signature: `certificates.signature_text / signature_font` snapshotted at issue; setting `certificate_signature` (ships **not approved**); `admin_certificate_signature()` / `admin_set_certificate_signature()` (admins, logged). A certificate's signer details cannot change after issue. | None (0 certificates). New certificates get the stylized signature only after an admin records Tramaine's approval. |

"Who did it" columns (`completed_by`, `issued_by`, `resolved_by`, `created_by`,
`complimentary_approved_by`) reference `auth.users`, **not** `profiles`: a second link from
`cohort_enrollments` or `certificates` to `profiles` makes the API's joins ambiguous and would break
the deployed 2d app the moment the migration is applied (found in testing; regression test added).

Compatibility with the deployed 2d app while the new app deploys: the old app keeps working, except
(a) issuing a certificate requires recorded completion (no certificates exist in production), and
(b) its cron route still works (direct updates; just not logged).

## Stripe safety while payments are off
`stripeWritesAllowed()`: with a live key, nothing in the portal may create or change anything in
Stripe unless `CHECKOUT_ENABLED=true` (test keys: always, for development). Enforced in the payment
logic (send/void), in the create route (invoice and payment-link requests refused with 403 before
a draft is saved) and in the screen (only offline requests offered). Reading from Stripe is not
blocked. Checkout keeps its own 503 guard. Every Stripe create/update call in the code is behind one
of these two guards (the webhook's only write switches a paid payment link off). Production has a
Stripe secret key and no `CHECKOUT_ENABLED`, so after deployment no invoice or link can be created.

## Compatibility with the deployed app (main 91d7f23)
- Production's own admin suite, run against a 2e database: 11 / 11.
- Every admin, participant, past-participant and coaching page of the deployed code loaded against
  a 2e database with no failed database request.
- `tests/e2e/compat-2e.mjs`: 49 reads and writes made by the deployed code (participants, past
  participants, coaching clients, admins, the cron job), run on 2d and on 2e. Three differences,
  all intended: a past participant can no longer post or chat in a finished cohort (the deployed
  portal never offered it), and a certificate needs recorded completion first.

## Backup and rehearsal on production data (2026-11-25)
Fresh encrypted backup `~/TLC-Backups/tlc-prod-20261125T004412Z.tgz.enc`: integrity tag OK, restored
into a throwaway local Postgres, 36 / 36 tables match production's counts and checksums, 10
accounts. Rehearsal on that restored copy (`REHEARSE_MIGRATION=… REHEARSE_ROLLBACK=…
supabase/scripts/backup-restore-verify.sh`): 2e applied cleanly, every existing row unchanged in all
37 tables and views (checksums over the original columns), no new ambiguous links, the automatic
status job would change 0 cohorts; after the rollback every row still unchanged. The copy is deleted
on exit; only counts and checksums are printed.

Records preserved (production today): 10 accounts, 6 enrollments, 4 cohorts and 25 sessions,
14 registrations, 0 certificates, 0 journal entries and 0 rep submissions, 7 community posts,
2 bookings, 0 coaching sessions/messages, 16 activity-log rows, 2 email-log rows.

## Test results (local stack, synthetic data, 2026-11-24)
| Suite | Result |
|---|---|
| Type check (`tsc`) | clean |
| Lint | clean for all 2e code; 11 errors remain in `coaching-portal/page.tsx` (unchanged since before 2e) |
| Unit (`npm test`) | 73 / 73 |
| Journeys A, B, C, E, F + security + screen joins (`tests/e2e/journeys.test.mjs`) | 7 / 7 |
| Admin (`npm run test:e2e`) | 11 / 11 |
| Payments, test mode + stripe-mock + site routes (`tests/e2e/payments.test.mjs`) | 31 / 31 |
| RLS: 2d checks with 2e | 66 / 66; 2c checks 24 / 25 (the one difference is 2d's intended change: visitors no longer read the hidden historical program); phase 2 checks 31 / 31 |
| Rollback 2e | policies identical to 2d (0 differences, 0 missing), functions identical, completion records and new tables kept |
| Ambiguous links to `profiles` | 2d `messages` = 2e `messages` (no new ones) |
| Link crawl (admin + portal pages) | 35 internal links, 0 broken |

Bugs found and fixed during testing: invitation links opened "request a reset" instead of "set your
password"; completed-cohort participants saw "Not enrolled"; inquiry-participant records were never
saved (upsert target did not match the index); the `_` character in an email matched other accounts
in the invite lookup; the ambiguous `profiles` link above; the dashboard listed a paid registration
twice; the "enrolled" message ignored a failed email and the inquiry notes did not refresh.

## Rollback
1. Application: Vercel Instant Rollback to `dpl_AJhGEWZJvDr4ciB97SuQgq4djeE9`.
2. Database: `supabase/rollback/20261124000000_workflow_integration_rollback.sql` restores the 2d
   access rules and removes the 2e triggers and functions (tested: identical to 2d). It **keeps** all
   new tables, columns and their data, and the expanded activity-log function with its triggers on the
   kept tables (so changes to those records are still recorded).
3. Backups: fresh encrypted backup before applying (`supabase/scripts/backup.sh`). The exporter
   already lists the 2e tables (recorded as absent before 2e).

## Production deployment checklist (needs owner approval)
Order matters: the database migration goes first, then the code (the 2d app keeps working on 2e;
the 2e app needs 2e). Checkout stays off throughout.
1. Confirm production is still `main` = `91d7f23` with 6 migrations; `cohort_enrollments` and
   `certificates` each have one link to `profiles`; `CHECKOUT_ENABLED` unset; `admin_mfa_mode` = `off`.
2. Fresh encrypted backup (`supabase/scripts/backup.sh`) and restore test against a production
   fingerprint (`backup-restore-verify.sh <file> <fingerprint>`; expect all tables match), with the
   rehearsal (`REHEARSE_MIGRATION=20261124000000_workflow_integration
   REHEARSE_ROLLBACK=20261124000000_workflow_integration_rollback`; expect rows unchanged).
3. Apply `20261124000000_workflow_integration` (one transaction). Verify: security advisor; no new
   ambiguous links to `profiles`; service role can write `stripe_events`, `payment_requests`,
   `inquiry_participants`; `certificate_signature` setting present and **not approved**; in a
   rolled-back transaction: a Fall 2026 participant reads their cohort and cannot post,
   `system_update_cohort_statuses()`.
4. Fast-forward `main` to the reviewed commit; Vercel deploys. No new environment variables are
   required. Optional later: `RESEND_WEBHOOK_SECRET` (delivery tracking).
5. Verify live (read-only checks plus authorized accounts): public pages unchanged; checkout 503;
   cron route 401 without its secret; admin dashboard loads without an error banner; Certificates →
   Signature shows "Not approved yet"; a payment request offers only "offline" (Stripe writes off);
   Tramaine and you review the dashboard and the participant view with authorized accounts.
6. Do not approve the certificate signature, record Fall 2026 completion or issue certificates
   until Tramaine decides.

Rollback (any step): Vercel Instant Rollback to `dpl_AJhGEWZJvDr4ciB97SuQgq4djeE9`; if the database
must go back, `supabase/rollback/20261124000000_workflow_integration_rollback.sql` (tested on a
restored production copy: rules back to 2d exactly, every row kept). Data entered after deployment
is kept by the rollback.

## Owner decisions still open
See the final report: completion criteria, certificate signer, attendance use, past-participant
access duration, pricing and payment policies, complimentary approvals, enrollment after payment,
delivery tracking, Fall 2026 completion, MFA activation.
