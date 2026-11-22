# Impact Lab Redesign, Inquiries and Admin Improvements: Test Summary

**Status:** on branch `feature/impact-lab-revamp`, **not deployed**. Production still runs the
security release (`5752e5e`). Database change `20261122000000_pathways_inquiries_admin.sql`
(2c) is **not applied**.

## What is in this release

| Area | Change |
|---|---|
| `/impact` | Rebuilt as a server-rendered page: hero with approved copy, three pathways (01/02/03 with an explicit "independent pathways, not levels" notice), accessible tab selector, "How the Lab Works", organizations section and inquiry form, closing call to action. Metadata, canonical URL, Open Graph, JSON-LD. Prices appear only when a pathway is open for enrollment and has a label. Old links `/impact#finders`, `#makers`, `#leaders` open the matching new pathway. |
| Inquiries | `/api/inquiries`: validation, spam trap, durable rate limits, stored admin-only, owner notification, fixed-text acknowledgement. Admin **Inquiries** tab: filters, search, status (New → Closed), follow-up dates with "due" flags, notes, CSV export. |
| Pathways & Programs | Admin edits wording, price, price label, visibility and enrollment for each pathway; length limits match the database so edits can't break the layout; price/label mismatch is blocked; historical programs listed read-only. |
| Dashboard & Reports | Real figures only (cohorts in progress/upcoming, active participants, registrations to review, open inquiries and follow-ups due, sessions in the next 14 days, fill vs. real capacity). Hard-coded "25" and always-"active" badges removed. Reports state that they measure participation, not leadership effectiveness; CSV export. |
| Cohorts | Statuses Draft / Upcoming / Active / Completed / Cancelled / Archived; capacity; **Archive** action; deleting a cohort with participants, registrations or certificates is blocked (deletion cascades). |
| Participants | Search; enroll returning participants in another cohort; mark withdrawn (record kept). "Confirm & Invite" for an existing account enrolls them and sends a sign-in notice instead of failing. |
| Security | Admin two-step verification (TOTP authenticator app, free plan): enroll/remove in **Security**, code prompt at sign-in, admin pages and admin APIs require it once enrolled. Activity log of sensitive admin actions; email delivery log. |
| Wording | Homepage card, footer, contact form, reading page and register page use the three pathways; the broken `/coaching/parents` link now points to `/parent-coaching`. |

## Tests run

| Test | Result |
|---|---|
| Database access matrix, 2c (pathways, inquiries, audit log, email log, capacity, archive) | 25/25 |
| Database phase-2 matrix with 2c applied | 31/31 |
| Current production code paths with 2a only | 79/79 |
| Lockdown matrix / rollback | 79/79 · 124/124 restored |
| Unit tests (incl. pathway merge, price hiding, legacy anchors) | 18/18 |
| Typecheck | clean |
| Production build (local) | passes |
| `/impact` in a real browser, 1440 px and 375 px | layout correct; no horizontal scroll; one `<h1>`; images have alt text |
| Tabs: click, arrow keys, old `#makers` link | pass |
| "Inquire about…" preselects pathway; client validation messages | pass |
| `/api/inquiries`: missing fields, bad email, unknown pathway, spam trap, malformed JSON, database failure | correct responses for each |
| Mobile tap targets | fixed (toggle raised to 44 px) |

## Not tested yet (needs the production database after 2c, or a signed-in admin)

- Admin tabs against real data (Inquiries, Pathways, Security, enrollment). Verified here by
  typecheck and the database matrix; to be checked by an admin right after deployment.
- MFA enrollment end-to-end (needs a real admin sign-in; planned as the first post-deploy step
  with Tramaine present).
- Inquiry email delivery (production Resend).

## Deployment plan (needs owner approval)

1. Take a fresh encrypted backup and verify the restore (`supabase/scripts/backup.sh`, then `backup-restore-verify.sh`).
2. Apply 2c (additive; existing rows untouched; adds the three pathway records, inquiry tables and logs).
3. Fast-forward `main` to the branch; verify `/impact`, `/register`, `/contact`, home, admin tabs.
4. With an admin signed in: open Pathways (review copy, keep enrollment closed), submit a test inquiry, check it in Inquiries and the email log, then turn on two-step verification.
Rollback: Vercel Instant Rollback to `dpl_FioQXWCeVy3kHJBVpwcEa7jtxq4V` (2c is compatible with that release).
