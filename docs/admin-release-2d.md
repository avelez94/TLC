# Admin portal release (2d) — summary, tests and deployment plan

Branch `feature/impact-lab-revamp`. **Deployed 2026-11-23:** `main` = `91d7f23` (Vercel `dpl_AJhGEWZJvDr4ciB97SuQgq4djeE9`), migrations 2d + search-path follow-up applied, two-step mode `off`. Before: `main` = `a66b5da`
(Vercel `dpl_CoB93KhQx89kpxBZ6ps3pucmFRg7`), migrations lockdown, 2a, 2b, 2c.

## What changed
**Security and privacy**
- Two-step verification for admins is enforced by the database (`is_admin()` checks the session's
  verified assurance level), the admin pages and the server routes, controlled by one setting
  (`off` shipped → `required` after both admins enroll). Forced setup page; admin-to-admin
  recovery route. Runbook: `docs/admin-mfa-enforcement.md`.
- Hidden pathways disappear from the Impact Lab page, registration page, footer, contact form and
  search description; visitors cannot read hidden program records. Nothing is deleted.
- Learning resources: only participants with an active/completed enrollment in the matching
  cohort/pathway, coaching clients for coaching/shared resources, and admins — including through
  the direct `/api/resources/<id>/open` link and storage signed links.
- Admin routes audited: `/api/admin/users`, `/api/admin/user-logins`, `/api/invite`,
  `/api/create-payment-link`, `/api/admin/mfa-reset`, `/api/admin/revalidate-public` all require an
  admin (and two-step when enrolled/required); cron uses `CRON_SECRET`; every other admin write is
  checked by database policies.
- An admin cannot remove their own admin access or the last admin's (database rule + UI).

**Participant records**
- Weekly reps with reflections are archived, never deleted; the database refuses a delete that
  would remove reflections. Reflections remain author-only.
- Confirmations (with consequences) for withdrawal, role changes, deleting announcements/prompts/
  sessions/reps/posts/resources, replacing a schedule, archiving and deleting cohorts.

**Enrollment and registration (checkout stays off)**
- `/register` shows no cohorts, prices or payment buttons while checkout is off; it sends visitors
  to the inquiry form with their pathway pre-selected. Prices appear only when the pathway is open
  AND checkout is on.
- Capacity enforced in the database with a row lock (simultaneous enrollments tested); the invite
  route checks capacity before creating any account.
- "Confirm and give access" now enrolls first and marks confirmed only on success (the cause of the
  Leading Complicated People discrepancy). Returning participants are enrolled, not re-invited.
- Registration history stays accessible; confirmed-but-not-enrolled registrations are flagged for
  review, never fixed automatically.

**Accuracy** — documented definitions (`docs/admin-metrics.md`): Active participants = distinct
non-admin people in running cohorts; completed/withdrawn derived without rewriting records.

**Feedback** — persistent error notices (errors stay until dismissed), inline errors beside the
control, Saving…/Saved ✓ on auto-saved fields, no false success; partial invite failures are
reported as warnings.

**Activity log** — recorded by the database for every admin change: who, action, record name,
outcome, old/new values (meeting links, message text and reflections are never stored). Failed
attempts are recorded too. Shown as plain sentences.

**Other** — Excel-safe CSV (BOM, quoting, formula-injection guard); America/New_York convention
for dates; the signed-in admin's own name everywhere; reps and prompts can be prepared on Draft
cohorts; announcements require choosing an audience.

## Navigation
| Group | Before (14) | After (11) |
|---|---|---|
| Overview | Dashboard | Dashboard |
| People | Inquiries · Registrations · Participants & Users | Inquiries · Participants (incl. certificates) · Registration history |
| Programs | Pathways & Programs · Cohorts · Certificates | Pathways · Cohorts (incl. participants, schedule, weekly reps, journal prompts) |
| Participant experience | Resources · Announcements · Weekly Reps · Journal Prompts · Community | Announcements · Resources · Community |
| Insights & security | Reports · Security | Reports · Security & activity |
"All weekly reps", "All journal prompts" and "All certificates" pages remain (linked from Cohorts
and Participants).

## Tests (local, synthetic data only)
| Suite | Result |
|---|---|
| Database rules (`npm run test:rls`): 2d checks — MFA modes, hidden pathways, resource matrix, rep archival, capacity, admin guard, activity log | 66/66 |
| Earlier suites with 2d applied | phase 2: 31/31; 2c: 24/25 (expected change: visitors can no longer read the hidden historical program) |
| Simultaneous enrollments for 1 free seat | 1 succeeded, 2 refused, cohort within capacity |
| 2d rollback | policies identical to 2c, `is_admin` restored, records and log kept |
| Unit tests (`npm test`) | 29/29 |
| End-to-end (`npm run test:e2e`, local stack + production build) | 11/11 |
| Browser pass (local) | all 14 admin pages load at 1280 and 375 px without errors or sideways scroll; add/confirm/cancel flows checked |
| Public site | `/impact` visible text identical to live; public pages 200 |

## Deployment plan (needs owner approval)
1. Fresh encrypted backup + restore test (`supabase/scripts/backup.sh`, `backup-restore-verify.sh`).
2. Confirm production env: `CHECKOUT_ENABLED` unset.
3. Apply migration `20261123000000_admin_hardening.sql` (mode ships as `off`, so admin behaviour is
   unchanged). Verify: advisor; `admin_mfa_mode()` = off; anon cannot read non-public programs;
   participant/coach resource checks; one rep-archive dry run in a rolled-back transaction.
4. Fast-forward `main` to the reviewed commit; Vercel deploys.
5. Verify live: public pages; `/register` inquiry routing; admin pages (an admin signs in);
   dashboard numbers vs. definitions; activity log entry for one harmless edit.
6. Two-step activation later, per `docs/admin-mfa-enforcement.md` (both admins enrolled, recovery
   tested), by changing one setting.

## Rollback
- Application: Vercel Instant Rollback to `dpl_CoB93KhQx89kpxBZ6ps3pucmFRg7` (works with 2d in place).
- MFA problems: set `admin_mfa_mode` back to `off` (instant, no deploy).
- Database: `supabase/rollback/20261123000000_admin_hardening_rollback.sql` (tested; keeps records
  and the log; re-enables cascade deletes of reflections, so avoid unless necessary).
