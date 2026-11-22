# Impact Lab Redesign, Inquiries and Admin Improvements: Test Summary

**Status:** **deployed 2026-11-22** (`main` = `a66b5da`, Vercel `dpl_CoB93KhQx89kpxBZ6ps3pucmFRg7`); migration 2c applied. See `docs/change-log.md` for the production record and `docs/admin-two-step-verification.md` for the admins' next step.

## Final design refinement (2026-11-22)

| Area | Change |
|---|---|
| Hero | Headline is three fixed lines (STEP UP. / SOLVE PROBLEMS. / CREATE IMPACT., the last in gold); each phrase is kept on one line and the size scales with the screen (50 px on phones to 88 px on large desktops). One intro paragraph, then **Explore the Pathways** and **Organizational Programs**. A right-hand summary lists the three pathways with who each is for and links to it. Hero height about 720–740 px on desktop, so both buttons are visible without scrolling at every tested size. |
| Approved intro copy | Not removed, moved: paragraph 2 now introduces "How the Lab Works"; paragraph 3 introduces the pathways section beside the "Independent pathways, not levels" note. |
| Pathway selector | Same names, taglines and numbers. Tabs show number, name and who it is for (desktop); on tablets and phones they are compact (number + name, 64–83 px tall) with the selected tab in navy with a pointer. Panel: opening statement, **Who it's for**, **How you'll grow**, **Focus areas**, **Development goal**, then **Inquire About {pathway}** and "Enrolling a team? Inquire for your organization". Keyboard (arrows, Home/End), focus outlines and tab/tabpanel roles unchanged. |
| Organizations | "Develop Leaders. Strengthen Teams. Improve Performance." Two options (scheduled cohorts, dedicated programs), who it is for, and **Inquire About Organizational Programs**, which scrolls to the form already set to "For my organization" and focuses the first field. Pathway buttons open it set to "For myself" with that pathway ticked. |
| Typography & contrast | Gold text on light backgrounds uses a darker gold (#8a5a10) that meets WCAG AA; form labels are plain sentence case at 0.85 rem; inputs 16 px (no zoom on iPhone); all buttons and choices at least 44 px tall. Footer text that was 20–35 % white (below AA) raised to 55–72 %; copyright year is now automatic. |
| Admin | Sidebar grouped (Overview, People, Programs, Participant experience, Insights & security); inactive items brighter. Resources: **Open** link uses the secure signed-link route (stored files no longer show a broken `storage:` link); removing a resource asks first, deletes the private file and is recorded in the activity log. Registrations: paid registrations show amount (or "Not recorded. Check the Stripe dashboard") and whether the participant confirmation and owner notification emails were sent; edit failures now show an error instead of failing silently. |

### Refinement tests

| Test | Result |
|---|---|
| Rendered `/impact` at 375, 430, 768, 1024, 1280, 1440, 1920 px | Headline phrases one line each at every width; no horizontal scroll; no element wider than the screen; hero buttons above the fold at every size (lowest: 598 px of 812 on a 375 px phone) |
| Tap targets (buttons, links, tabs, checkboxes) | all ≥ 44 px |
| Anchors under the fixed 115 px header | `#pathways`, `#organizations`, `#inquire`, `#emerging-leaders` etc. land below the header |
| Inquiry buttons (pathway, "Enrolling a team?", organizations, closing) | correct audience, pathway preselected, focus on first field |
| Form validation with empty fields | three clear messages, focus moves to the first error |
| Unit tests | 18/18 |
| Typecheck | clean |
| Lint (changed files) | no new findings (remaining findings are older `any` types) |
| Database access matrices | lockdown 79/79 · phase 2 31/31 · 2c 25/25 · compatibility 79/79 · rollback 124/124 |
| 2c rollback script (new) | removes inquiries, notes, activity and email logs and the unreferenced pathway rows; existing programs, cohorts, registrations, certificates and enrollments unchanged |
| Security smoke tests against a local build | unchanged: checkout closed (503), forged webhook 400, cron/admin APIs 401, portals redirect to sign-in |

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

## Production deployment checklist (needs owner approval)

Before
1. Owner reviews the screenshots and approves.
2. Fresh encrypted backup, then verify the restore (`supabase/scripts/backup.sh`, `backup-restore-verify.sh`).
3. Confirm `CHECKOUT_ENABLED` is still unset in Vercel Production (checkout stays closed).
   Record the current cohort status rule (`select pg_get_constraintdef(oid) from pg_constraint where conname = 'cohorts_status_check'`) in the change log; the 2c rollback needs it.

Deploy
4. Apply 2c (`20261122000000_pathways_inquiries_admin.sql`): additive; existing rows untouched; adds the three pathway records, inquiry tables, audit and email logs. Run the Supabase security advisor afterwards.
5. Fast-forward `main` to the reviewed commit of `feature/impact-lab-revamp`; Vercel builds Production.

Verify (non-destructive)
6. `/impact` on a phone and a laptop: hero, tabs, `#makers` old link, organization button opens the form.
7. Submit one clearly labelled test inquiry; confirm it appears in **Admin → Inquiries**, the owner email arrives and the **Security → Email log** shows it; then set it to Closed.
8. Admin: Pathways shows the approved copy with enrollment closed; Dashboard figures match the data; Resources **Open** works; historical programs and certificates unchanged.
9. Participant portal: journal and weekly reps load for a participant (no writes needed).
10. Both admins enroll two-step verification (Security tab) with Tramaine present.

Rollback
- Application: Vercel Instant Rollback to `dpl_FioQXWCeVy3kHJBVpwcEa7jtxq4V` (the current security release; 2c is compatible with it).
- Database: `supabase/rollback/20261122000000_pathways_inquiries_admin_rollback.sql` (removes only the 2c additions; take a backup first because it drops any inquiries received).
