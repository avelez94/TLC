# Security Remediation Report

**Updated:** 2026-11-21 · **Branch:** `feature/impact-lab-revamp` (from production commit `1c6aedc`)
**Rollback points:** Vercel deployment `dpl_7AL9X3wQbvAZo1phFQvgWC6ToN4o` (current production app) · git tag `rollback/pre-impact-revamp-2026-11-20`
**Confidential incident assessment:** kept outside the repository (not in GitHub).

Status key: **Resolved** = live in production and verified · **Partial** · **Outstanding**

## Production database (project `jpgvclclgnyfguatuihx`)

Emergency migration `20261121000000_emergency_rls_lockdown.sql` **applied 2026-11-21 07:51:56 UTC** with owner approval.

Before applying: target project reconfirmed; full in-database backup of all 32 public tables taken with row counts and checksums (the free plan has no platform backups); pre-change policies, grants, column ACLs and function definitions saved; migration reviewed for privilege escalation (two issues found and fixed before applying: a guard trigger that could never fire, and helper functions that were callable over the API).

After applying, verified live:
- Data unchanged: 32/32 tables identical by checksum.
- 124 policies replaced by 57; no policy reaches anonymous users except public catalogue reads.
- Anonymous privileges limited to `programs`, `program_includes`, `cohort_sessions`, `availability_blocks` and public columns of `cohorts` (not Zoom links).
- No function executable by anonymous users; trigger functions not executable by signed-in users; helper functions in an unexposed schema.
- Over the public API as an anonymous visitor: 19 sensitive tables refused for reading; updates and deletes refused; hidden schemas refused; public catalogue still served.
- As real participant / coaching client / admin accounts inside rolled-back transactions: participants see only themselves, the admins and their own cohort; cannot see others' rates, journals, reflections or messages; cannot promote themselves or anyone; cannot post or chat in another cohort; can post in their own. Admin workflows (registrations, cohorts, profiles) work; journals stay private from admins.
- Security advisor: 8 findings → 2 (one informational, one plan-dependent; see below).

## Issues

| # | Issue | Fix | Status |
|---|---|---|---|
| 1 | Anonymous read/write on 31 tables ("Admin full access" policies + default grants) | Emergency lockdown | **Resolved** |
| 2 | Self-promotion to admin (profile self-update, sign-up metadata role) | Admin-only profile updates; guard trigger; sign-ups start as participant | **Resolved** |
| 3 | Signed-in users could read every profile | Row rule: self, admins, admin profile, own-cohort members | **Resolved** (rows) |
| 3b | Cohort members could read each other's email/phone columns | Directory columns only (`2b`); `my_profile()` for own record; admin data via `/api/admin/users` | **Resolved** |
| 4 | Cohort content readable across cohorts | Membership-based rules | **Resolved** |
| 5 | Cohort chat | Members of that cohort and admins only; admin-only delete | **Resolved** |
| 6 | Journals and reflections readable by others | Author only, including from admins | **Resolved** |
| 7 | Bookings view bypassed RLS, writable by anyone | Runs as caller; admin only | **Resolved** |
| 8 | Zoom links readable by any signed-in user | `cohort_meeting_links()` returns own cohort only (admins all); column revoked (`2b`) | **Resolved** |
| 9 | Public storage bucket | Private bucket, 50 MB / document-media types, admin-only writes; files served via 5-minute signed URLs after an authorization check (`/api/resources/[id]/open`) | **Resolved** (bucket held no files, so nothing was exposed) |
| 10 | Browser-controlled checkout price | Price read on the server; cohort must belong to program and be open | **Resolved** |
| 10b | Configured price differs from displayed price for two programs | Checkout refuses when they disagree; prices unchanged pending owner decision | **Resolved** (owner decision outstanding) |
| 11 | Missing server-side admin gate; role from user-editable metadata | Middleware + server admin layout use `profiles.role` | **Resolved** |
| 12 | Unescaped input in emails; spam relay via auto-reply and `/api/register` | Escaping, single-line cleaning, http(s)-only links, fixed auto-reply text, `/api/register` retired | **Resolved** |
| 13 | Unsafe rich-text rendering | Allow-list sanitizer on save and render (12 attack payloads tested in a browser engine) | **Resolved** |
| 14 | Webhook not idempotent; notifications could be lost | Payment recorded once (conditional update on registration + Stripe session) before email; per-email sent timestamps; failed email → 500 → Stripe retry sends only the missing email | **Resolved** |
| 15 | Duplicate registrations / enrollments / rep submissions | Abandoned unpaid registration reused; paid duplicate refused; unique indexes (`2a`) | **Resolved** |
| 16 | Rate limits per instance only | Postgres-backed limiter shared by all instances (`2a`); in-memory fallback | **Resolved** |
| 17 | Preview/local using production DB, live Stripe, real inboxes | Environment guard fails closed; email redirected outside production; live key removed from local config | **Partial** (guard live; no second Supabase project, so Preview builds stop at the guard by design; testing is local) |
| 18 | Journal and rep saving broken (wrong column names) | Correct columns; journal editing; rep submissions limited to own cohort; errors shown | **Resolved** |
| 19 | Coaching clients could not message (two admins broke a `.single()` lookup) | Coach chosen deterministically | **Resolved** |
| 20 | Leaked-password protection off | Requires Supabase Pro ($25/month) | **Outstanding** (owner decision) |
| 21 | `is_admin()` callable by signed-in users (reveals only own status) | Move to private schema in a later migration | **Outstanding** (informational) |
| 22 | Payment reconciliation for past registrations | Needs the TLC Stripe account (connected Stripe tool belongs to another business) | **Outstanding** |
| 23 | Admin MFA, test accounts in production | Recommendations made; pending approval | **Outstanding** |

## Deployment (completed 2026-11-21 — see docs/change-log.md)

1. Independent encrypted backup taken and restore-verified (32/32 tables match).
2. `20261121100000_privacy_phase2a_additive.sql` applied and verified.
3. Application release `5752e5e` deployed to production and verified.
4. `20261121110000_privacy_phase2b_column_restrictions.sql` applied and verified.
Rollbacks for each are in `supabase/rollback/` and never run automatically.

## Vercel preview build (2026-11-21)

Bisected on Vercel: the unchanged production tree builds; production + this branch's
`tsconfig.json` alone fails. Cause: `allowImportingTsExtensions` breaks `next/font/google`
resolution under Turbopack on Vercel. Fixed by restoring production's `tsconfig.json` exactly;
unit tests resolve imports through a Node hook instead. The branch now compiles and type-checks
on Vercel, then stops at the environment guard ("preview is configured with the PRODUCTION
Supabase project … LIVE Stripe secret key"), as designed, until Preview variables are separated.

## Tests

- Database access matrix on a structural replica of production: before 41/79 failing (exposure reproduced) · after lockdown 79/79 · phase 2 31/31 · current production code paths after 2a 79/79 · rollback exact (124/124, 0 differences).
- Unit tests 17/17 (escaping, cleaning, URLs, rate limiter, pricing incl. displayed-price guard, route access, environment guard, sanitizer fallback).
- Typecheck clean; no new lint errors; production build passes; endpoint smoke test on a local production build.
- Pending (needs development environment and Stripe test keys): end-to-end runs for each persona, Stripe test checkout, replayed webhooks, email failure handling, private resources and meeting links through the UI.
