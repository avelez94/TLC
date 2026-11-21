# The Impact Lab — Technical & Functional Audit

**Prepared:** 2026-11-20 · **Branch:** `feature/impact-lab-revamp` (based on production commit `1c6aedc`)
**Scope:** public site, Impact Lab flows, participant portal, admin panel, API routes, data model, auth, email, payments, SEO, deployment.
**Status:** Audit only. No production data, schema, or deployment has been changed.

---

## 0. How this audit was done, and its limits

| Checked | How |
|---|---|
| All source under `src/` (pages, admin tabs, portal, API routes, middleware) | Read directly |
| Supabase RLS / grants | `supabase/migrations/*.sql` in the repo |
| Live site behaviour | Loaded tramainecrawford.com (`/`, `/impact`, `/register`) in a browser, inspected network calls, headings, meta tags |
| Vercel | Project `tlc`, env var **names** (values not read), production deployments |

**Not verified — must be done before any migration:**
- **The live database.** The Supabase account connected to this workspace does not include this site's project, so live tables, columns, policies and data were not inspected. The repo migrations are known to be incomplete (see H2), so every database finding below is "per the repo" until a live schema dump confirms it.
- Supabase Auth settings (redirect allow-list, email confirmation), storage bucket policies, Resend domain/DMARC setup, Stripe dashboard settings (webhook endpoints, enabled events).
- The coaching portal was reviewed only for shared concerns; it is out of scope for changes.

**Repo hygiene found during audit:** the local `main` was 1 commit ahead and 5 behind `origin/main`. The local-only commit duplicates a change already in production. Production (`dpl_7AL9X3wQbvAZo1phFQvgWC6ToN4o`) runs `1c6aedc`, which includes cohort delete/duplicate features not in the old local checkout. All work now branches from `1c6aedc`.

---

## 1. Current state assessment

### Stack
Next.js 16.2.9 (App Router) · React 19.2 · Supabase (Postgres, Auth, Storage) via `@supabase/ssr` · Stripe Checkout + Payment Links · Resend for email · Vercel hosting with one daily cron · Tailwind 4 installed but styling is almost entirely inline styles.

### What exists and works

| Area | State | Notes |
|---|---|---|
| Public Impact Lab page `/impact` | **Working, outdated content** | Three hard-coded "levels" (Finders/Makers/Leaders) merged with DB fields from `programs` matched **by name string** |
| Registration `/register` | **Working (paid path)** | Program → cohort → form → Stripe Checkout. Only shows `upcoming` cohorts. Live: all three programs currently show "No cohorts currently open" |
| Stripe webhook | **Working** | Marks registration paid, emails participant + Tramaine |
| Contact form | **Working** | Honeypot field; emails Tramaine + auto-reply |
| Login / password reset | **Working** | Branded Resend emails instead of Supabase defaults |
| Participant portal `/impact-portal` | **Working** | Dashboard, cohort + session schedule, weekly reps with reflections, private journal, cohort posts/comments/likes, members list, polling group chat, announcements, resource library, progress, certificates, profile |
| Admin panel `/admin/*` | **Working, broad** | 12 tabs: Dashboard, Registrations, Users (invite, role, hourly rate, payment links, reset email), Programs, Cohorts (create, edit inline, duplicate, delete, session generator, rich description, book), Weekly Reps, Journal Prompts, Community moderation, Announcements, Resources (file upload), Certificates, Reports |
| Cron | **Working** | Daily: `upcoming → active → completed` by dates; protected by `CRON_SECRET` (present in Vercel) |
| RLS | **Enabled** (per repo migration of 2026-07-24) | A good first pass, but several policies are broader than the data warrants (see §3) |

### Partially implemented
- **"Request a Quote" programs** — the form copy adapts, but submission always calls `/api/checkout`, which rejects a null price. The button resets with no error shown. Organisational interest currently has no working path except the general contact form.
- **Reports** — enrollment bars use a hard-coded capacity of 25; Programs table shows every program as "active" regardless of state.
- **Cohort statuses** — only `upcoming / active / completed`. No draft, full, archived, cancelled. Delete is a hard delete.
- **Certificates** — issued manually; no completion criteria (`requirements_met: {}` always).
- **`/api/register`** — the no-payment registration endpoint is no longer used by the UI but is still publicly callable.

### Missing
- Organisational inquiry form, inquiry storage, inquiry pipeline/statuses, admin notes, exports.
- Cohort capacity, facilitator assignment, archive.
- Stable program identifiers (slugs) — renaming a program in admin can silently break `/impact` and `/register?program=…`.
- Email send log, idempotency, delivery status, editable templates.
- Audit log of admin actions.
- Per-page SEO metadata, `<h1>` on `/impact`, canonical URLs, Open Graph, structured data, `sitemap.xml`, `robots.txt` (both 404 live).
- Separate non-production environment (see M1 — this one matters).

### Outdated "levels" language — every occurrence

| Location | What |
|---|---|
| `src/app/(public)/impact/page.tsx` | Finders/Makers/Leaders cards, "Individual · Level 01–03", sticky sub-nav, "Three levels. One journey.", "Start where you are and move forward from there." |
| `src/app/(public)/page.tsx:127` | Homepage card: "Three programs, one path. Find your direction, build your impact, raise it in others." |
| `src/components/Footer.tsx:27-29` | Links to `/impact#finders`, `#makers`, `#leaders` |
| `src/app/(public)/contact/page.tsx:130-132` + `src/app/api/contact/route.ts:23-25` | Interest dropdown options + email labels |
| `src/app/(public)/reading/page.tsx:23-30` | Slug map `finders/makers/leaders` |
| `src/app/(public)/register/page.tsx` | "Choose the program that is right for where you are. Each one is designed to meet you at your current stage of growth." (stage framing) |
| `src/app/(portal)/admin/components/CohortsTab.tsx:147` | Placeholder "Impact Makers — Fall 2025" |
| **Database** `programs` rows | Names and descriptions ("Impact Finders is designed for individuals seeking greater clarity…") — live, visible on `/register` |
| **Database** `cohorts.name` values | Likely contain old program names — verify in schema dump |

---

## 2. Findings by severity

### Critical — fix before or with launch

**C1. Checkout trusts the price sent by the browser.** `api/checkout/route.ts:14,53` uses `price` from the request body for `unit_amount`. Anyone can POST `price: 1` and pay $1; the webhook then marks the registration "paid". Fix: look up price server-side from `program_id`, verify the cohort belongs to that program and is open, never accept `program_name`/`price` from the client.

**C2. Unescaped user input in every email.** `contact`, `register`, `webhook`, `invite` interpolate name, message, organization, "why" and program/cohort names straight into HTML. An attacker can put links/markup inside a trusted "New Registration" email to Tramaine. The contact auto-reply and `/api/register` also send attacker-controlled text **to any address supplied**, which lets the site's sending domain be used for spam and damages its sender reputation. Fix: HTML-escape every interpolated value, stop echoing free text in auto-replies, rate-limit public endpoints, remove or protect `/api/register`.

**C3. Every logged-in user can read every profile.** RLS on `profiles` is `using (true)` for `authenticated`. Any participant can query all users' email, phone, organisation, role and `hourly_rate` — including coaching clients'. Fix: self + admin only on the table; expose a minimal `id, full_name` view (or a security-definer function scoped to shared cohorts) for community display.

**C4. Cohort content is not scoped to cohort members.** `community_posts`, `community_comments`, `community_likes`, `weekly_reps`, `announcements`, `resources` are readable by any authenticated user, including coaching clients and participants from other cohorts. The portal filters by cohort in the UI only. Fix: an `is_cohort_member(cohort_id)` helper and membership-based policies.

**C5. `cohort_messages` has no RLS in the repo.** The group-chat table is not mentioned in any migration. If RLS is off in the live DB, the public anon key (shipped to every browser) can read and write every cohort's chat. **Verify immediately**; fix with membership policies.

### High

**H1. No server-side admin gate.** Middleware only checks "is logged in". Any participant can load `/admin`; protection depends entirely on RLS (which, per C3, exposes all profiles). Login routing reads `user_metadata.role`, which users can edit about themselves and which goes stale when an admin changes the role in `profiles`. Fix: check `profiles.role` in middleware/a server layout for `/admin`; route by `profiles.role`.

**H2. Repo migrations do not describe the live database.** Evidence: the live `/register` reads cohort columns (`includes`, `book_*`, `description`) that the repo's column grant does not give to `anon`, yet the request succeeds; `cohort_messages`, the base `community_comments` table, `registrations` columns, and `programs` columns (`price`, `motto`, `keywords`, `leadership_goal`, `focus_areas`) have no migration; production code deletes cohorts but the repo has no delete policy. Fix: `supabase db dump --schema-only` (plus policies and grants) from production, commit it as a baseline migration, then write all changes as additive migrations against it.

**H3. Stripe webhook is not idempotent.** Stripe retries deliveries; each retry re-sends both emails. Abandoned checkouts leave "pending / unpaid" registrations that clutter admin. Fix: store processed `event.id`s, ignore repeats; handle `checkout.session.expired`.

**H4. Duplicate and orphaned enrollment records.** No duplicate check on registrations; enrollment insert errors in `/api/invite` are logged and ignored; "Confirm & Invite" calls `generateLink({type:'invite'})`, which fails for an email that already has an account, so a **returning participant cannot be enrolled in a new cohort** through the normal flow. `invite` also uses `.eq('role','admin').single()`, which breaks once there are two admins. Fix: unique `(cohort_id, user_id)`, a dedicated "enroll existing user" path, surface errors.

**H5. Participant files are public.** Uploads go to the `resources` bucket and are linked with `getPublicUrl` — anyone with the link can download program materials, no expiry. No server-side type/size validation. Fix: private bucket, short-lived signed URLs issued to cohort members, type/size checks.

**H6. Unsanitised stored HTML.** Cohort descriptions are saved from a `contentEditable` editor and rendered on the public register page with `dangerouslySetInnerHTML`. A compromised admin session or pasted content can inject script into a public page. Fix: sanitise (allow-list tags) on save and render.

### Medium

**M1. Preview deployments use production.** Every Vercel env var targets both `preview` and `production`, so any branch preview talks to the **live database, live Stripe keys and live email**. Testing this project on a preview URL would touch real records and could email real participants. Fix before any preview deploy: a separate Supabase project (or Supabase branch), Stripe test keys, and a Resend sandbox/test recipient for the `preview` target.

**M2. Silent failures in admin.** Most admin writes ignore the returned error (inline `onBlur` saves, status changes, deletes). The repo has no `UPDATE` policy on `weekly_reps`, so "Edit rep" may silently do nothing (verify live). Fix: a shared mutation helper that shows success only on success.

**M3. Non-atomic schedule generation.** "Generate schedule" deletes all sessions, then inserts; a failure in between leaves the cohort with no schedule.

**M4. Misleading numbers.** Reports capacity "25" is invented; Programs "active" badge is hard-coded; dashboard "Coaching Clients — Active clients" counts a role, not activity; participant Progress shows journal entries "x/8" with an invented denominator. These conflict with "never show fabricated analytics".

**M5. Portal cohort selection.** `.in('cohorts.status', …)` on an embedded table without `!inner` does not filter the parent rows, and `.limit(1).single()` means a participant enrolled in two cohorts sees only the newest one.

**M6. Date/time display.** Several places parse `YYYY-MM-DD` with `new Date(d)` (UTC midnight), showing the previous day for US users (portal cohort dates, rep due dates). Live `/register` shows "MONDAYS AT 18:03" — raw 24-hour time.

**M7. Fragile coupling between admin data and public layout.** `/impact` finds programs by exact name; `/register?program=` matches by substring. A rename breaks the page. Fix: stable `slug`.

**M8. No rate limiting** on contact, register, checkout, password reset.

**M9. No audit trail** for role changes, deletions, payment links, enrollments.

### SEO, accessibility, performance

- All public pages are client components, so none can export metadata. Every page shares one title and description. Live `/impact`: no `<h1>`, no canonical, no Open Graph, no JSON-LD.
- `sitemap.xml` and `robots.txt` return 404.
- **Broken link (verified live):** homepage "Coaching for Parents" card → `/coaching/parents` (404). The real route is `/parent-coaching`.
- `(portal)/layout.tsx` renders a second `<html><body>` inside the root layout's `<body>` — invalid markup, hydration warnings.
- `next.config.ts` allows the image optimiser to fetch from **any** host (`hostname: '**'`); anyone can use the site's optimiser (and its bill) as a proxy. Restrict to the hosts actually used.
- Source images are 1.3–2.4 MB; `next/image` mitigates, but the originals should be resized/compressed.
- Impact page sub-nav is hard-coded to `top: 115px`; sticky offsets break if the nav height changes.
- Portal navigation uses emoji as icons; the sidebar items are buttons without `aria-current`; the mobile menu button has no accessible name.

---

## 3. Public website redesign plan

**Keep:** URL `/impact`, brand tokens (navy `#001737`, gold `#C88820`, paper `#F7F5F0`), Bebas Neue / Montserrat / JetBrains Mono, the Impact Lab logo, existing nav and footer.

**Page structure**
1. **Hero** — eyebrow "The Impact Lab", headline *Step Up. Solve Problems. Create Impact.*, the approved description, two CTAs: *Explore the Pathways* (scrolls) and *Inquire About a Cohort*.
2. **Three Pathways. One Purpose.** — a short line stating that pathways are chosen by current role, not completed in order. A role selector ("Preparing to lead / New to supervising / Already leading people") with three tabs; the selected pathway shows its opening statement, description, focus areas, development goal and a CTA. On mobile the tabs become a stacked accordion. All three remain in the DOM for SEO and no-JS readers.
3. **How the Lab works** — the four learning modes already named in the approved copy (guided learning, discussion, deliberate practice, real-world application). No invented outcomes.
4. **For Organizations** — headline *Develop Leaders. Strengthen Teams. Improve Performance.*, approved copy, primary button opens the inquiry form inline (anchor `#organizations`).
5. **Individual inquiry** — short form or link to `/register` when a cohort is open (decided by data, not by editing code).
6. Closing CTA.

**Data-driven, layout-safe:** pathway text lives in `programs` (existing columns cover almost everything: `description`, `motto` → tagline, `keywords` → focus areas, `leadership_goal`). The page renders from a fixed three-slot layout keyed by slug, with length limits enforced in admin, so content edits cannot break the layout. If the DB is unreachable the page falls back to the approved copy in code.

**Technical:** `/impact/page.tsx` becomes a server component (metadata, `<h1>`, JSON-LD `Course`/`EducationalOccupationalProgram` entries without prices or dates unless approved); interactive parts are small client islands. Old anchors `#finders/#makers/#leaders` keep working by mapping to the new sections.

A visual preview accompanies this document.

---

## 4. Admin portal assessment & recommendations

| Area | Today | Recommendation |
|---|---|---|
| A. Overview | 4 counters + quick actions | Real metrics from DB: open/in-progress/upcoming cohorts, enrolled participants, pending registrations, new inquiries (individual vs organisational), cohort fill vs capacity, next 7 days of sessions. Engagement only where recorded (rep submissions, posts) and labelled as activity, not development. |
| B. Pathways | Programs tab edits name, description, price, label, fields | Rename to "Pathways". Lock the three identities (slug not editable), field-level character limits, `is_public` and `enrollment_open` toggles, live preview of the public card. |
| C. Cohorts | Strong already | Add `capacity`, `facilitator_id` (if approved), statuses Draft / Open / Full / In Progress / Completed / Archived / Cancelled; replace hard delete with Archive (delete only when no enrollments). Auto-"Full" at capacity. Make schedule generation atomic (RPC). |
| D. Participants | Users tab (all roles) | A participant view: search, pathway/cohort/status filters, enroll/remove, resend invite, CSV export of contact + enrollment fields only. Reflections and journal never included. |
| E. Curriculum | Reps, prompts, resources, sessions, announcements exist | Reuse; add `is_published` + `release_at` to reps/resources, link resources to a session, cohort-level vs pathway-level scoping. No separate LMS. |
| F. Inquiries | Registrations tab only | New **Inquiries** tab (individual + organisational): statuses New / Contacted / Qualified / Follow-Up Needed / Converted / Closed, notes, follow-up date, linked pathway(s)/cohort, search, filter, CSV export. |
| G. Communications | Hard-coded HTML in 5 routes | One email module: shared layout, escaped variables, templates (enrollment confirmation, cohort invitation, session reminder, announcement, resource release, completion), `email_log` with unique key per (template, recipient, entity) to prevent duplicate sends. Session reminders via the existing cron. Bulk sends: preview, recipient count, confirm step, BCC never used — one message per recipient. |
| H. Reporting | Basic | Enrollment by pathway / cohort, fill rate vs real capacity, inquiry conversion, rep completion where recorded. Header note: "Operational metrics — participation, not leadership effectiveness." CSV export. |
| I. Roles | admin / coaching_client / impact_participant | Keep. Add `facilitator` only if the owner confirms facilitators exist (cohort-scoped, no access to private journals). Do not add Program Administrator until there is a second staff member. Enforce role server-side (H1). |

**Endpoint authorisation audit**

| Route | Auth | Issue |
|---|---|---|
| `GET /api/admin/user-logins` | `requireAdmin` ✓ | — |
| `POST /api/invite` | `requireAdmin` ✓ | H4 |
| `POST /api/create-payment-link` | `requireAdmin` ✓ | Amount computed client-side (admin-only, lower risk) |
| `POST /api/checkout` | Public | C1 |
| `POST /api/register` | Public | C2, unused |
| `POST /api/contact` | Public, honeypot | C2, no rate limit |
| `POST /api/request-password-reset` | Public | Non-enumerating ✓; no rate limit |
| `POST /api/webhook` | Stripe signature ✓ | H3 |
| `GET /api/cron/update-cohort-statuses` | Bearer `CRON_SECRET` ✓ | — |
| Direct table writes from admin UI | RLS `is_admin()` | Fine once C3/H1 are fixed; add audit log |

---

## 5. Recommended architecture

Reuse the current app and database. All schema changes are **additive** (new nullable columns, new tables, new policies); nothing is dropped or renamed in place.

```
programs            + slug (unique), is_public, enrollment_open, opening_statement, sort_order (exists)
cohorts             + capacity, facilitator_id, archived_at; status values extended (mapped from old)
cohort_enrollments  + unique (cohort_id, user_id)
registrations       (individual enrollments — kept as is) + inquiry_id
inquiries           NEW: kind (individual|organization), contact fields, org fields, pathway_slugs[],
                    participants_estimate, timeline, message, status, follow_up_on, source, created_at
inquiry_notes       NEW: inquiry_id, author_id, body, created_at        (admin-only RLS)
email_log           NEW: template, recipient, entity_type, entity_id, status, provider_id, unique key
stripe_events       NEW: event_id primary key (idempotency)
audit_log           NEW: actor_id, action, entity_type, entity_id, diff jsonb, created_at (insert-only)
public_profiles     VIEW: id, full_name  (replaces broad profiles read)
is_cohort_member()  FUNCTION (security definer) used by cohort content policies
```

Server-side: move admin mutations that touch money, roles, enrollment or bulk email into route handlers / server actions with `requireAdmin` + audit logging; simple content edits can stay client-side under RLS. Public forms post to route handlers that validate (schema), rate-limit, check a honeypot, and use the service role only for the insert.

Status mapping for existing cohorts: `upcoming` → `open` (or `draft` if no start date), `active` → `in_progress`, `completed` → `completed`. Cron and portal queries updated in the same release; old values accepted during transition.

---

## 6. Implementation priorities

**Essential for launch**
1. Live schema dump committed as baseline; isolated preview environment (M1).
2. Security: C1, C2, C3, C4, C5, H1, H6; remove or protect `/api/register`; rate limits on public forms.
3. Pathway data: slugs + three pathway records (per owner decision Q1), `is_public`/`enrollment_open`.
4. New `/impact` page (server-rendered, accessible, responsive) + organisational inquiry form → `inquiries` table → Resend notification.
5. Admin Inquiries tab (list, detail, status, notes, filter, CSV).
6. Content consistency: homepage card, footer, contact options, reading page, register intro, admin placeholder, DB program text; redirects for old anchors/slugs.
7. SEO basics: metadata for public pages, `<h1>`, canonical, OG, `sitemap.ts`, `robots.ts`; fix `/coaching/parents` link; fix nested `<html>`.
8. Webhook idempotency (H3); escaped email templates.

**Recommended (next)**
- Cohort capacity, extended statuses, archive instead of delete, facilitator field.
- Participant management view with search and export; enroll-existing-user flow (H4).
- Private resource storage with signed URLs (H5).
- Admin overview with real metrics; reports by pathway; remove invented numbers (M4).
- Audit log; mutation error handling (M2); atomic schedule generation (M3).
- Email log + templated session reminders and release notifications.

**Optional / future**
- Release-dated module sequencing, worksheets with submissions, attendance tracking.
- Bulk announcements by email with consent tracking.
- Organisation-level portal for HR sponsors.
- Bot protection service (e.g. Cloudflare Turnstile) if honeypot + rate limiting is not enough.

---

## 7. Migration & testing plan

**Before any change to the database**
1. Confirm Supabase plan backups / point-in-time recovery; take a manual `pg_dump` (data + schema) and store it off-platform.
2. `supabase db dump --schema-only` + policies + grants → commit as baseline. Diff it against what the code expects.
3. Stand up a non-production Supabase project/branch from that schema with seeded fake data; point Vercel **preview** env vars at it with Stripe **test** keys.

**Preserving records**
- Existing participants, enrollments, registrations, certificates, posts, journals: untouched. New columns are nullable; new tables are separate.
- Existing programs: per owner decision — either rename rows in place (IDs keep all history attached) or add three new pathway rows and mark old ones `is_public = false` (history keeps original names). Recommended: the second, so past certificates still read "Impact Finders".
- Logins/sessions: no auth changes besides routing by `profiles.role`; users stay signed in.
- RLS tightening is the riskiest step: ship each policy with a test matrix (anon, participant A, participant B in another cohort, coaching client, admin) run against the preview DB.

**Testing**
- Forms: valid, invalid, honeypot, rate-limited, duplicate submit; email received once; record visible in admin.
- Checkout: tampered price rejected; webhook replay sends no second email (Stripe CLI `trigger`).
- Admin actions: each tab create/edit/delete on preview DB; errors shown on failure.
- Portal: participant sees only own cohort; cannot read other profiles' email; journal private.
- Responsive: 360, 768, 1024, 1440 px; keyboard-only pass; axe scan; Lighthouse on `/impact`.
- Regression: home, about, coaching, consulting, parent coaching, contact, resources, coaching portal, login/reset.

**Release & rollback**
- Ship as a PR from `feature/impact-lab-revamp`; review on a preview URL backed by the non-production DB.
- Migrations applied to production only after approval, in a low-traffic window, each with a written down-migration.
- Code rollback: Vercel Instant Rollback to `dpl_7AL9X3wQbvAZo1phFQvgWC6ToN4o` (current production) or `git revert`; git tag `rollback/pre-impact-revamp-2026-11-20` marks the pre-change commit.
- Data rollback: additive migrations are reverted by their down scripts; worst case, restore from the pre-migration dump/PITR.

---

## 8. Questions requiring owner approval

1. **Old programs → new pathways.** Is Impact Finders → Emerging Leaders, Makers → New Leaders, Leaders → Practicing Leaders a correct mapping, or are these entirely new programs? Should past participants' records and certificates keep the old names?
2. **Numbering.** The brief labels pathways 01/02/03. Numbers read as a sequence, which the brief says to avoid. Keep the numerals, or identify pathways by role only (the preview uses role labels)?
3. **Pricing.** Should individual prices ($97 is live today) appear publicly? Same price per pathway? Organisational pricing stays private — confirm.
4. **Enrollment approval.** Today: pay → Tramaine confirms → invite. Keep manual confirmation, auto-enroll on payment, or require an application/inquiry before payment?
5. **Individual CTA.** When no cohort is open, should "Inquire About a Cohort" collect an interest list per pathway?
6. **Facilitators.** Will anyone other than Tramaine facilitate? If so, may facilitators see weekly-rep reflections? (Recommended default: no access to private journals; reflections only if participants are told.)
7. **Reflection privacy.** Today even admins cannot read journal entries or rep reflections. Keep it that way?
8. **Capacity and waitlist.** Default cohort size? Waitlist automatically when full, or close enrollment?
9. **Inquiry routing.** Who receives organisational inquiry emails? Is the "we will follow up within 24 hours" promise on the site accurate?
10. **Cohort community after completion.** Do alumni keep access to posts/chat/resources? Can members of different cohorts in the same pathway see each other?
11. **Refunds/cancellations.** Is there a policy to show at checkout?
12. **Reading list.** Does "What We Are Reading" continue per pathway?
13. **Spam protection.** Is a third-party challenge (e.g. Cloudflare Turnstile) acceptable if needed, or honeypot + rate limiting only?
14. **Testimonials/outcomes.** None will be shown until supplied and approved — confirm.
15. **Data retention.** How long should closed inquiries be kept?
