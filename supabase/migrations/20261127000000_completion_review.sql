-- 2f: close a cohort's completion review without changing anyone's completion.
-- Owner decision 2026-11-27: Fall 2026 participants will not receive certificates. An administrator
-- records that decision on the cohort; the dashboard then stops asking for completion and
-- certificates for it. Enrollments, completion status and certificates are untouched, and the
-- review can be reopened (clear the fields). Additive; the deployed app ignores the new columns.
-- Rollback: supabase/rollback/20261127000000_completion_review_rollback.sql
begin;
alter table public.cohorts
  add column if not exists completion_review_closed_at timestamptz,
  add column if not exists completion_review_closed_by uuid references auth.users(id) on delete set null,
  add column if not exists completion_review_note text check (length(completion_review_note) <= 300);
-- Signed-in users read cohorts column by column (phase 2b); administrators write through the
-- existing admin_write policy.
grant select (completion_review_closed_at, completion_review_closed_by, completion_review_note) on public.cohorts to authenticated;
commit;
