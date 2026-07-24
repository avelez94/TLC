-- Security fix: RLS was not enabled (or not correctly scoped) on most tables,
-- allowing fully unauthenticated read/write access to PII (profiles, registrations,
-- bookings, private messages, journal entries, etc.) via the public anon key.
-- This migration enables RLS everywhere and adds policies matching how the app
-- actually reads/writes each table (see admin/impact-portal/coaching-portal pages
-- and the API routes under src/app/api).
--
-- Every `create policy` is preceded by a `drop policy if exists` so this file
-- is safe to re-run from scratch, regardless of whether an earlier attempt
-- partially applied before failing.
--
-- After applying, smoke-test: public register/schedule pages, impact portal,
-- coaching portal, and the admin panel (login as each role if possible).

-- Helper: identifies whether the current authenticated user is an admin.
-- security definer + fixed search_path so it can be safely referenced from
-- policies on other tables without being affected by (or recursing into) RLS.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  )
$$;

-- ============ profiles ============
-- Broad authenticated read: the app joins other users' full_name/role
-- pervasively (community posts/comments, enrollments, messaging, admin panel).
-- Only admins can change role / hourly_rate (matches admin panel behavior).
alter table profiles enable row level security;

drop policy if exists "Authenticated users can view all profiles" on profiles;
create policy "Authenticated users can view all profiles"
  on profiles for select
  to authenticated
  using (true);

drop policy if exists "Admins can update any profile" on profiles;
create policy "Admins can update any profile"
  on profiles for update
  to authenticated
  using (is_admin())
  with check (is_admin());

-- ============ registrations ============
-- Admin-only. Public inserts go through /api/register and /api/checkout using
-- the service-role key, which bypasses RLS entirely, so no INSERT policy here.
alter table registrations enable row level security;

drop policy if exists "Admins can view all registrations" on registrations;
create policy "Admins can view all registrations"
  on registrations for select
  to authenticated
  using (is_admin());

drop policy if exists "Admins can update registrations" on registrations;
create policy "Admins can update registrations"
  on registrations for update
  to authenticated
  using (is_admin())
  with check (is_admin());

-- ============ bookings ============
-- Contains PII (name, email, phone, reason). Admin-only on the base table;
-- inserts happen server-side via /api/schedule (service role). The public
-- scheduling page only needs to know which slots are taken, so it reads from
-- the `booking_availability` view below instead of this table.
alter table bookings enable row level security;

drop policy if exists "Admins can view all bookings" on bookings;
create policy "Admins can view all bookings"
  on bookings for select
  to authenticated
  using (is_admin());

drop policy if exists "Admins can delete bookings" on bookings;
create policy "Admins can delete bookings"
  on bookings for delete
  to authenticated
  using (is_admin());

drop view if exists booking_availability;
create view booking_availability as
  select booking_date, booking_time from bookings;

grant select on booking_availability to anon, authenticated;

-- ============ availability_blocks ============
-- No PII (just blocked date/time slots) — safe to keep publicly readable.
alter table availability_blocks enable row level security;

drop policy if exists "Anyone can view availability blocks" on availability_blocks;
create policy "Anyone can view availability blocks"
  on availability_blocks for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins can manage availability blocks" on availability_blocks;
create policy "Admins can manage availability blocks"
  on availability_blocks for insert
  to authenticated
  with check (is_admin());

drop policy if exists "Admins can delete availability blocks" on availability_blocks;
create policy "Admins can delete availability blocks"
  on availability_blocks for delete
  to authenticated
  using (is_admin());

-- ============ programs ============
-- Public marketing content — needed by the public register/coaching/impact pages.
alter table programs enable row level security;

drop policy if exists "Anyone can view programs" on programs;
create policy "Anyone can view programs"
  on programs for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins can update programs" on programs;
create policy "Admins can update programs"
  on programs for update
  to authenticated
  using (is_admin())
  with check (is_admin());

-- ============ program_includes ============
-- Public marketing content, read-only from the app.
alter table program_includes enable row level security;

drop policy if exists "Anyone can view program includes" on program_includes;
create policy "Anyone can view program includes"
  on program_includes for select
  to anon, authenticated
  using (true);

-- ============ cohorts ============
-- Public needs cohort name/dates/status to register, but zoom_link is a
-- private meeting link for enrolled/authenticated users only — restrict it
-- via column grants (RLS is row-level only and can't split columns by role).
alter table cohorts enable row level security;

drop policy if exists "Anyone can view cohorts" on cohorts;
create policy "Anyone can view cohorts"
  on cohorts for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins can insert cohorts" on cohorts;
create policy "Admins can insert cohorts"
  on cohorts for insert
  to authenticated
  with check (is_admin());

drop policy if exists "Admins can update cohorts" on cohorts;
create policy "Admins can update cohorts"
  on cohorts for update
  to authenticated
  using (is_admin())
  with check (is_admin());

revoke select on cohorts from anon;
grant select (id, program_id, name, start_date, end_date, status, created_at, session_day, session_time)
  on cohorts to anon;
grant select on cohorts to authenticated;

-- ============ cohort_sessions ============
-- Session schedule — no PII, needed by both the public register page and portals.
alter table cohort_sessions enable row level security;

drop policy if exists "Anyone can view cohort sessions" on cohort_sessions;
create policy "Anyone can view cohort sessions"
  on cohort_sessions for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins can manage cohort sessions" on cohort_sessions;
create policy "Admins can manage cohort sessions"
  on cohort_sessions for insert
  to authenticated
  with check (is_admin());

drop policy if exists "Admins can update cohort sessions" on cohort_sessions;
create policy "Admins can update cohort sessions"
  on cohort_sessions for update
  to authenticated
  using (is_admin())
  with check (is_admin());

drop policy if exists "Admins can delete cohort sessions" on cohort_sessions;
create policy "Admins can delete cohort sessions"
  on cohort_sessions for delete
  to authenticated
  using (is_admin());

-- ============ cohort_enrollments ============
alter table cohort_enrollments enable row level security;

drop policy if exists "Users can view own enrollments, admins view all" on cohort_enrollments;
create policy "Users can view own enrollments, admins view all"
  on cohort_enrollments for select
  to authenticated
  using (auth.uid() = user_id or is_admin());

-- ============ weekly_reps ============
-- Rep content isn't sensitive; scoping strictly by cohort membership isn't
-- worth the added policy complexity here.
alter table weekly_reps enable row level security;

drop policy if exists "Authenticated users can view weekly reps" on weekly_reps;
create policy "Authenticated users can view weekly reps"
  on weekly_reps for select
  to authenticated
  using (true);

drop policy if exists "Admins can create weekly reps" on weekly_reps;
create policy "Admins can create weekly reps"
  on weekly_reps for insert
  to authenticated
  with check (is_admin());

drop policy if exists "Admins can delete weekly reps" on weekly_reps;
create policy "Admins can delete weekly reps"
  on weekly_reps for delete
  to authenticated
  using (is_admin());

-- ============ weekly_rep_submissions ============
-- Personal reflections — self only. Admin does not read this table today.
alter table weekly_rep_submissions enable row level security;

drop policy if exists "Users can view own rep submissions" on weekly_rep_submissions;
create policy "Users can view own rep submissions"
  on weekly_rep_submissions for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can submit own rep reflections" on weekly_rep_submissions;
create policy "Users can submit own rep reflections"
  on weekly_rep_submissions for insert
  to authenticated
  with check (auth.uid() = user_id);

-- ============ journal_prompts ============
alter table journal_prompts enable row level security;

drop policy if exists "Authenticated users can view journal prompts" on journal_prompts;
create policy "Authenticated users can view journal prompts"
  on journal_prompts for select
  to authenticated
  using (true);

drop policy if exists "Admins can create journal prompts" on journal_prompts;
create policy "Admins can create journal prompts"
  on journal_prompts for insert
  to authenticated
  with check (is_admin());

drop policy if exists "Admins can delete journal prompts" on journal_prompts;
create policy "Admins can delete journal prompts"
  on journal_prompts for delete
  to authenticated
  using (is_admin());

-- ============ journal_entries ============
-- Private reflections — self only. Admin does not read this table today.
alter table journal_entries enable row level security;

drop policy if exists "Users can view own journal entries" on journal_entries;
create policy "Users can view own journal entries"
  on journal_entries for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create own journal entries" on journal_entries;
create policy "Users can create own journal entries"
  on journal_entries for insert
  to authenticated
  with check (auth.uid() = user_id);

-- ============ announcements ============
alter table announcements enable row level security;

drop policy if exists "Authenticated users can view announcements" on announcements;
create policy "Authenticated users can view announcements"
  on announcements for select
  to authenticated
  using (true);

drop policy if exists "Admins can create announcements" on announcements;
create policy "Admins can create announcements"
  on announcements for insert
  to authenticated
  with check (is_admin());

drop policy if exists "Admins can delete announcements" on announcements;
create policy "Admins can delete announcements"
  on announcements for delete
  to authenticated
  using (is_admin());

-- ============ resources ============
alter table resources enable row level security;

drop policy if exists "Authenticated users can view resources" on resources;
create policy "Authenticated users can view resources"
  on resources for select
  to authenticated
  using (true);

drop policy if exists "Admins can create resources" on resources;
create policy "Admins can create resources"
  on resources for insert
  to authenticated
  with check (is_admin());

drop policy if exists "Admins can delete resources" on resources;
create policy "Admins can delete resources"
  on resources for delete
  to authenticated
  using (is_admin());

-- ============ certificates ============
alter table certificates enable row level security;

drop policy if exists "Users can view own certificates, admins view all" on certificates;
create policy "Users can view own certificates, admins view all"
  on certificates for select
  to authenticated
  using (auth.uid() = user_id or is_admin());

drop policy if exists "Admins can issue certificates" on certificates;
create policy "Admins can issue certificates"
  on certificates for insert
  to authenticated
  with check (is_admin());

-- ============ community_posts ============
alter table community_posts enable row level security;

drop policy if exists "Authenticated users can view community posts" on community_posts;
create policy "Authenticated users can view community posts"
  on community_posts for select
  to authenticated
  using (true);

drop policy if exists "Users can create own community posts" on community_posts;
create policy "Users can create own community posts"
  on community_posts for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can edit own community posts" on community_posts;
create policy "Users can edit own community posts"
  on community_posts for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own posts, admins delete any" on community_posts;
create policy "Users can delete own posts, admins delete any"
  on community_posts for delete
  to authenticated
  using (auth.uid() = user_id or is_admin());

-- ============ community_likes ============
alter table community_likes enable row level security;

drop policy if exists "Authenticated users can view community likes" on community_likes;
create policy "Authenticated users can view community likes"
  on community_likes for select
  to authenticated
  using (true);

drop policy if exists "Users can like posts as themselves" on community_likes;
create policy "Users can like posts as themselves"
  on community_likes for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can remove own likes" on community_likes;
create policy "Users can remove own likes"
  on community_likes for delete
  to authenticated
  using (auth.uid() = user_id);

-- ============ community_comments ============
-- Table + select/insert policies already exist from a prior migration.
-- Adding the missing delete policy (needed for admin comment moderation
-- and participants deleting their own comments).
drop policy if exists "Users can delete own comments, admins delete any" on community_comments;
create policy "Users can delete own comments, admins delete any"
  on community_comments for delete
  to authenticated
  using (auth.uid() = user_id or is_admin());

-- ============ messages ============
-- Private 1:1 messages — strictly self-scoped (sender or recipient).
alter table messages enable row level security;

drop policy if exists "Users can view their own conversations" on messages;
create policy "Users can view their own conversations"
  on messages for select
  to authenticated
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

drop policy if exists "Users can send messages as themselves" on messages;
create policy "Users can send messages as themselves"
  on messages for insert
  to authenticated
  with check (auth.uid() = sender_id);

-- ============ weekly_checkins ============
-- Personal check-ins reviewed by the coach before sessions.
-- Note: this table's ownership column is `client_id`, not `user_id`.
alter table weekly_checkins enable row level security;

drop policy if exists "Users can view own checkins, admins view all" on weekly_checkins;
create policy "Users can view own checkins, admins view all"
  on weekly_checkins for select
  to authenticated
  using (auth.uid() = client_id or is_admin());

drop policy if exists "Users can submit own checkins" on weekly_checkins;
create policy "Users can submit own checkins"
  on weekly_checkins for insert
  to authenticated
  with check (auth.uid() = client_id);

-- ============ coaching_sessions ============
-- Not read/written from the client anywhere today — only via /api/invite
-- using the service role, which bypasses RLS. Enable RLS with no policies
-- so it's fully locked down against direct client access.
alter table coaching_sessions enable row level security;
