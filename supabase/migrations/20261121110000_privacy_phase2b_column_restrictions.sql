-- =====================================================================================
-- PRIVACY HARDENING 2b (COLUMN RESTRICTIONS) — TLC Leadership (project jpgvclclgnyfguatuihx)
-- Status: APPLIED to production 2026-11-21 17:2x UTC, after release 5752e5e went live. Requires that release:
-- the older code reads profiles.* and cohorts.* directly and would break.
--
--  * Signed-in users can read only directory columns of profiles (id, full_name, role,
--    avatar_url, timezone, created_at). Contact details, hourly rates and preferences are
--    served to admins by /api/admin/users and to each user by my_profile().
--  * cohorts.zoom_link is no longer readable directly (use cohort_meeting_links()).
-- Rollback: supabase/rollback/20261121110000_privacy_phase2b_rollback.sql
-- =====================================================================================

begin;

-- profiles: directory columns only
revoke select on public.profiles from authenticated;
grant select (id, full_name, role, avatar_url, timezone, created_at) on public.profiles to authenticated;

-- cohorts: everything except zoom_link
revoke select on public.cohorts from authenticated;
grant select (id, program_id, name, start_date, end_date, status, created_at, session_day,
  session_time, includes, expectations, book_title, book_image_url, book_purchase_url,
  description) on public.cohorts to authenticated;

commit;
