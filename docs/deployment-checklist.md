# Deployment Checklist — Security Release

Every line marked **APPROVAL** waits for an explicit "approved" from the owner. Nothing in
production changes without it. "Gate" lines must pass before moving on; if one fails, stop and
use the recovery step for that stage.

## Stage 0 — Immediate temporary safeguards (optional, recommended)

The production app (commit `1c6aedc`) still has two endpoints that are exploitable today even
though the database is locked down:

| Endpoint | Risk today | Safeguard |
|---|---|---|
| `POST /api/checkout` | Pays any amount the caller chooses (Stripe minimum $0.50) for any cohort; the registration is marked paid. No cohort is open, so no customer uses this now. | Vercel Firewall rule: deny `POST /api/checkout` |
| `POST /api/register` | Unused by the site; emails attacker-written HTML from the TLC domain to any address (spam/phishing relay) and inserts junk registrations. | Vercel Firewall rule: deny `POST /api/register` |
| `POST /api/contact` | Attacker HTML in Tramaine's inbox; limited auto-reply relay. Needed for leads, so keep open. | Treat links in contact emails with caution until Stage 3 |
| `POST /api/request-password-reset` | No rate limit (inbox flooding). | Firewall rate-limit rule if the plan offers one |

- [ ] **APPROVAL:** add the two deny rules (Vercel → Project `tlc` → Firewall → Configure → New
      rule: *Request Path equals `/api/checkout`* AND *Method equals `POST`* → **Deny**; same for
      `/api/register`). Reversible instantly by deleting the rules. Remove them at Stage 3.
- [ ] Until Stage 3: before confirming any registration, check the amount in Stripe matches the price.

## Stage 1 — Development environment and integration tests (no production impact)

- [ ] Owner creates the dev Supabase project and Stripe test-mode access (`docs/dev-environment-setup.md`).
- [ ] Load structure, lockdown, 2a, 2b and synthetic data into dev; run the database matrix and advisors.
- [ ] Separate Vercel Preview variables; confirm no Preview variable points at production.
- [ ] Fix the preview build failure (see findings) and get a green preview deployment.
- [ ] End-to-end tests on dev, each recorded pass/fail:
      anonymous visitor · prospective participant (register + Stripe test checkout) · new participant
      (invite, first login, portal) · returning participant (second cohort) · participant in another
      cohort (isolation) · coaching client (messaging, check-in) · admin (every tab) · unauthorized
      admin attempts · replayed webhooks (`stripe events resend`) · email delivery failure (bad
      Resend key → 500, retry sends once) · journals (create/edit) · reps (submit/view/duplicate) ·
      Zoom links (member vs non-member) · private resources (signed URL, expiry, non-member denied).
- [ ] Gate: all pass; results added to `docs/security-remediation.md`.

## Stage 2 — Before touching production

- [ ] Owner takes the independent encrypted backup and runs the restore test (`docs/backup-and-restore.md`).
- [ ] Gate: restored row counts and checksums match a fresh production fingerprint.
- [ ] Owner chooses a low-traffic window; no cohort registrations in progress.
- [ ] Confirm Vercel Instant Rollback target: `dpl_7AL9X3wQbvAZo1phFQvgWC6ToN4o`.

## Stage 3 — Production release (2a → app → 2b)

| Step | Action | Compatibility check | Gate | Recovery |
|---|---|---|---|---|
| 3.1 | **APPROVAL:** apply `20261121100000_privacy_phase2a_additive.sql` | Additive only; current production code verified working with it (79/79) | Advisors clean; public pages and login work; admin panel loads | `supabase/rollback/20261121100000_privacy_phase2a_rollback.sql` (bucket settings only) |
| 3.2 | **APPROVAL:** merge the branch to `main` / promote the tested preview to production | Code works with or without 2b (fallbacks tested) | Smoke test: home, /impact, /register, /login, admin tabs, both portals, contact form, a Stripe test-mode check not possible in live — verify checkout returns the expected "closed"/price-mismatch responses | Vercel Instant Rollback to `dpl_7AL9X3wQbvAZo1phFQvgWC6ToN4o` (30 seconds; 2a is safe with old code) |
| 3.3 | **APPROVAL:** apply `20261121110000_privacy_phase2b_column_restrictions.sql` | Requires 3.2 live; old code would break | Admin users tab shows emails; portals show own details; members list shows names only; Zoom link visible to members | `supabase/rollback/20261121110000_privacy_phase2b_rollback.sql` (re-grants table reads; row rules stay). Never roll back the emergency lockdown. |
| 3.4 | Remove Stage 0 firewall rules | — | Checkout refuses tampered prices and mismatched labels | Re-add rules |
| 3.5 | Rerun the security advisor and the anonymous/participant/admin live checks | — | Same results as 2026-11-21 plus 2b restrictions | — |

## Stage 4 — Follow-ups needing decisions

- [ ] **APPROVAL:** admin MFA enforcement migration (database requires a second factor for admin
      actions) after both admins enroll.
- [ ] **APPROVAL:** Supabase Auth settings in production: disable public sign-ups, password policy,
      redirect allow-list, secure email change.
- [ ] **APPROVAL:** price/label correction for Impact Makers and Impact Leaders (owner decides values).
- [ ] **APPROVAL:** any refunds or customer communication after Stripe reconciliation.
- [ ] **APPROVAL:** drop `security_backup.data_20261121__*` once the independent backup is verified.
- [ ] Delete the temporary `tmp/vercel-*` branches.
