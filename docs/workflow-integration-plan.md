# Workflow integration (release 2e) — working plan

Branch `feature/workflow-integration` (from `feature/impact-lab-revamp` = production `91d7f23` + docs).
Production before this work: `main` = `91d7f23` (Vercel `dpl_AJhGEWZJvDr4ciB97SuQgq4djeE9`),
migrations lockdown, 2a, 2b, 2c, 2d (+ search-path follow-up). Nothing here is deployed until the
owner approves. Synthetic data only (local stack, `scripts/local-stack/`).

## Owner decisions this plan follows (2026-11-23)
- Past participants keep read-only access to their program history, own work, materials and certificates.
- One portal for current and completed programs.
- Completion is approved by Tramaine. Nothing completes automatically (not end dates, not counts).
- Certificates downloadable once officially issued. No retroactive issuing for Fall 2026 without approval.
- Invitation, password-setup and enrollment emails report real status and support safe retries.
- Readiness checklist guides; it does not block.
- Organizations can enroll several participants under one inquiry.
- Attendance interface allowed; no attendance-based rules.
- No new automated reminder emails. Checkout stays off; prices unchanged.
- Paid registrations keep the existing pay → admin confirm flow (setting `enroll_on_payment` = `review`);
  `automatic` exists for later but is not switched on.

## Database (migration `20261124000000_workflow_integration.sql`, additive)
1. Participation rules: `is_cohort_participant` (active or completed enrollment) for reading;
   `can_participate` (active enrollment AND cohort Upcoming/Active, or reopened by
   `cohorts.activity_open_until`) for submitting reps, posting, commenting, liking, chatting.
2. Completion: `cohort_enrollments.completed_at / completed_by / completion_note`, filled by trigger
   from the signed-in admin. Withdrawn → completed refused.
3. Certificates: snapshot fields, number `TLC-YYYY-NNNN`, one per person per cohort, requires a
   completed enrollment, cannot be deleted (revoke instead).
4. `admin_cohort_participation(cohort)`: who submitted which rep (never reflection text).
5. `inquiry_participants`: people invited/enrolled from an inquiry, with per-person result.
6. `email_log`: provider statuses, related person/record, resend chain, resolved flag, idempotency key.
7. Payments: registration payment fields, `payment_requests`, `stripe_events` (idempotency).
8. System activity: `admin_audit_log.actor_type`; `system_update_cohort_statuses()` changes
   statuses and logs each change once, atomically (ET date).

## API contracts
- `POST /api/invite` `{ email, full_name, role, cohort_id?, program_id?, reenroll?, inquiry_id?, idempotency_key? }`
  → `{ outcome, user_id, email: { status, log_id }, warnings[] }` where outcome ∈
  `invited | setup_link_sent | enrolled_returning | already_enrolled | reenrolled` and errors
  carry `code` ∈ `cohort_full | withdrawn_needs_confirm | account_exists_other_role | invalid`.
- `POST /api/admin/access-email` `{ user_id, idempotency_key }` → sends the right email (set-up
  link if never signed in, otherwise password reset) and returns the real result.
- `POST /api/admin/email-resend` `{ log_id, idempotency_key }` → resends a failed invite or
  password email with a fresh link; marks the original resolved on success.
- `GET /api/certificates/<id>/pdf` → PDF for the owner or an admin.

## Phases → where
| Phase | Main files |
|---|---|
| 1 Participant access | `impact-portal/page.tsx` (+ components), migration §1 |
| 2 Invitations/email | `lib/email.ts`, `api/invite`, `api/admin/access-email`, `api/admin/email-resend`, `api/email-events` |
| 3 Dashboard | `DashboardTab.tsx`, `lib/attention.ts` |
| 4 Readiness | `lib/cohort-readiness.ts`, cohort card |
| 5 Inquiry → enrollment | `InquiriesTab.tsx`, `components/inquiry/*` |
| 6 Completion/certificates | `components/cohort/CohortCompletion.tsx`, `api/certificates`, `lib/certificate-pdf.ts` |
| 7 Participation | `components/cohort/CohortParticipation.tsx` |
| 8 Automation log | `api/cron/update-cohort-statuses`, migration §8 |
| 9/11 Help, wording, UX | across admin/portal |
| 12 Payments | `api/checkout`, `api/webhook`, `api/admin/payment-requests`, Registrations, Reports |
