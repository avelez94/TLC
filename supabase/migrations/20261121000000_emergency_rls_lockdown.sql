-- =====================================================================================
-- EMERGENCY RLS LOCKDOWN — TLC Leadership (project jpgvclclgnyfguatuihx)
-- Status: APPLIED to production 2026-11-21 07:51:56 UTC (version 20261121075156) with owner approval.
--
-- Problem (verified from the live catalog, 2026-11-20):
--   * Nearly every public table has a policy "Admin full access" FOR ALL TO public
--     USING (true). Combined with Supabase's default grants, the public anon key (which
--     ships in every page of the site) can read, insert, update and delete those tables:
--     profiles, registrations, journal entries, private messages, coaching data, bookings.
--   * profiles also has "Allow all reads temporarily" and a self-update policy with no
--     WITH CHECK, so any signed-in user can set their own role to 'admin'.
--   * handle_new_user() copies the role from sign-up metadata, so a self sign-up can
--     request role 'admin'.
--   * booking_availability is an auto-updatable view owned by postgres, and anon holds
--     INSERT/UPDATE/DELETE on it, which writes to bookings without RLS.
--
-- What this migration does (no table data is read, changed or deleted):
--   1. Saves every current public policy and table grant into security_backup.* so the
--      exact previous state can be restored (see supabase/rollback/20261121000000_emergency_rls_lockdown_rollback.sql).
--   2. Drops ALL policies on public tables and recreates a minimal set matching how the
--      current production code uses each table.
--   3. Removes anon privileges except read access to public catalogue tables.
--   4. Stops trusting role from sign-up metadata; blocks role / hourly_rate changes by
--      anyone except an admin or the service role.
--
-- Compatible with the code currently in production (commit 1c6aedc): it can be applied
-- before any application deploy. Participant reflections and journals become private to
-- their author (owner decision, 2026-11-20).
-- =====================================================================================

begin;

-- ---------------------------------------------------------------- 1. backup
create schema if not exists security_backup;
revoke all on schema security_backup from public, anon, authenticated;

drop table if exists security_backup.policies_20261121;
create table security_backup.policies_20261121 as
  select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
  from pg_policies where schemaname = 'public';

drop table if exists security_backup.table_grants_20261121;
create table security_backup.table_grants_20261121 as
  select grantee, table_name, privilege_type
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee in ('anon', 'authenticated');

drop table if exists security_backup.catalog_acl_20261121;
create table security_backup.catalog_acl_20261121 as
  select c.relname, c.relkind::text, c.relacl::text as relacl, c.reloptions::text as reloptions,
         (select json_agg(json_build_object('col', a.attname, 'acl', a.attacl::text))
            from pg_attribute a where a.attrelid = c.oid and a.attacl is not null) as column_acls
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'v');

drop table if exists security_backup.functions_20261121;
create table security_backup.functions_20261121 as
  select p.proname, pg_get_functiondef(p.oid) as definition, p.proacl::text as proacl
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('handle_new_user', 'is_admin', 'rls_auto_enable');

-- ---------------------------------------------------------------- 2. helper functions
-- All security definer with a fixed search_path, so policies can call them without
-- recursing into RLS on the tables they read.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin')
$$;

-- Membership helpers live in app_private, which PostgREST does not expose, so they can be
-- used by policies but not called as /rest/v1/rpc endpoints.
create schema if not exists app_private;
revoke all on schema app_private from public, anon;
grant usage on schema app_private to authenticated, service_role;

create or replace function app_private.is_cohort_member(p_cohort uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.cohort_enrollments
    where cohort_id = p_cohort and user_id = auth.uid() and status = 'active'
  )
$$;

-- True when the caller has an active enrollment in a cohort the other user belongs to.
create or replace function app_private.shares_cohort_with(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.cohort_enrollments mine
    join public.cohort_enrollments theirs on theirs.cohort_id = mine.cohort_id
    where mine.user_id = auth.uid() and mine.status = 'active'
      and theirs.user_id = p_user and theirs.status <> 'withdrawn'
  )
$$;

create or replace function app_private.is_admin_user(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = p_user and role = 'admin')
$$;

create or replace function app_private.post_cohort(p_post uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select cohort_id from public.community_posts where id = p_post
$$;

revoke all on all functions in schema app_private from public, anon;
grant execute on all functions in schema app_private to authenticated, service_role;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

-- ---------------------------------------------------------------- 3. drop every policy
do $$
declare r record;
begin
  for r in select tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
end $$;

-- ---------------------------------------------------------------- 4. privileges
revoke all on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- Public catalogue used by /impact and /register
grant select on public.programs, public.program_includes, public.cohort_sessions,
  public.availability_blocks to anon;
grant select (id, program_id, name, start_date, end_date, status, created_at, session_day,
  session_time, includes, expectations, book_title, book_image_url, book_purchase_url,
  description) on public.cohorts to anon;

-- booking_availability ran with its owner's rights (bypassing RLS) and was writable by
-- anon. No current page reads it. Make it obey the caller's RLS and admin-only access.
alter view public.booking_availability set (security_invoker = true);
revoke all on public.booking_availability from anon, authenticated;
grant select on public.booking_availability to authenticated;

-- Trigger / maintenance functions must not be callable through the public API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_admin() from public, anon;
do $$ begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;

-- New tables created later must not be exposed to anon by default.
alter default privileges in schema public revoke all on tables from anon;

-- ---------------------------------------------------------------- 5. policies
-- Public catalogue: readable by everyone, writable by admins.
create policy "catalog_read" on public.programs for select to anon, authenticated using (true);
create policy "admin_write" on public.programs for all to authenticated using (is_admin()) with check (is_admin());
create policy "catalog_read" on public.program_includes for select to anon, authenticated using (true);
create policy "admin_write" on public.program_includes for all to authenticated using (is_admin()) with check (is_admin());
create policy "catalog_read" on public.cohorts for select to anon, authenticated using (true);
create policy "admin_write" on public.cohorts for all to authenticated using (is_admin()) with check (is_admin());
create policy "catalog_read" on public.cohort_sessions for select to anon, authenticated using (true);
create policy "admin_write" on public.cohort_sessions for all to authenticated using (is_admin()) with check (is_admin());
create policy "catalog_read" on public.availability_blocks for select to anon, authenticated using (true);
create policy "admin_write" on public.availability_blocks for all to authenticated using (is_admin()) with check (is_admin());

-- Profiles: yourself, admins, the admin's own profile (shown as "Tramaine" in portals),
-- and people you share an active cohort with. Only admins can update.
create policy "profiles_read" on public.profiles for select to authenticated
  using (id = auth.uid() or is_admin() or role = 'admin' or app_private.shares_cohort_with(id));
create policy "profiles_admin_update" on public.profiles for update to authenticated
  using (is_admin()) with check (is_admin());

-- Enrollment: own rows, co-members of your active cohorts (members list), admins.
create policy "enrollments_read" on public.cohort_enrollments for select to authenticated
  using (user_id = auth.uid() or is_admin() or app_private.is_cohort_member(cohort_id));
create policy "admin_write" on public.cohort_enrollments for all to authenticated using (is_admin()) with check (is_admin());

-- Admin-only business records (public forms insert through server routes with the service role).
create policy "admin_all" on public.registrations for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin_all" on public.bookings for all to authenticated using (is_admin()) with check (is_admin());

-- Cohort content: members of that cohort and admins.
create policy "reps_read" on public.weekly_reps for select to authenticated
  using (is_admin() or app_private.is_cohort_member(cohort_id));
create policy "admin_write" on public.weekly_reps for all to authenticated using (is_admin()) with check (is_admin());

create policy "posts_read" on public.community_posts for select to authenticated
  using (is_admin() or app_private.is_cohort_member(cohort_id));
create policy "posts_insert" on public.community_posts for insert to authenticated
  with check (user_id = auth.uid() and (is_admin() or app_private.is_cohort_member(cohort_id)));
create policy "posts_update_own" on public.community_posts for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and (is_admin() or app_private.is_cohort_member(cohort_id)));
create policy "posts_delete" on public.community_posts for delete to authenticated
  using (user_id = auth.uid() or is_admin());

create policy "comments_read" on public.community_comments for select to authenticated
  using (is_admin() or app_private.is_cohort_member(app_private.post_cohort(post_id)));
create policy "comments_insert" on public.community_comments for insert to authenticated
  with check (user_id = auth.uid() and (is_admin() or app_private.is_cohort_member(app_private.post_cohort(post_id))));
create policy "comments_delete" on public.community_comments for delete to authenticated
  using (user_id = auth.uid() or is_admin());

create policy "likes_read" on public.community_likes for select to authenticated
  using (is_admin() or app_private.is_cohort_member(app_private.post_cohort(post_id)));
create policy "likes_insert" on public.community_likes for insert to authenticated
  with check (user_id = auth.uid() and (is_admin() or app_private.is_cohort_member(app_private.post_cohort(post_id))));
create policy "likes_delete_own" on public.community_likes for delete to authenticated
  using (user_id = auth.uid());

create policy "chat_read" on public.cohort_messages for select to authenticated
  using (is_admin() or app_private.is_cohort_member(cohort_id));
create policy "chat_insert" on public.cohort_messages for insert to authenticated
  with check (user_id = auth.uid() and (is_admin() or app_private.is_cohort_member(cohort_id)));
create policy "chat_admin_delete" on public.cohort_messages for delete to authenticated
  using (is_admin());

-- Announcements and resources keep their current intent (global items visible to all
-- signed-in users; cohort items to members), minus anonymous access.
create policy "announcements_read" on public.announcements for select to authenticated
  using (is_admin() or target_user_id = auth.uid()
         or (target_user_id is null and (cohort_id is null or app_private.is_cohort_member(cohort_id))));
create policy "admin_write" on public.announcements for all to authenticated using (is_admin()) with check (is_admin());

create policy "resources_read" on public.resources for select to authenticated
  using (is_admin() or portal_type = 'both' or cohort_id is null or app_private.is_cohort_member(cohort_id));
create policy "admin_write" on public.resources for all to authenticated using (is_admin()) with check (is_admin());

create policy "prompts_read" on public.journal_prompts for select to authenticated using (true);
create policy "admin_write" on public.journal_prompts for all to authenticated using (is_admin()) with check (is_admin());

create policy "certificates_read" on public.certificates for select to authenticated
  using (user_id = auth.uid() or is_admin());
create policy "admin_write" on public.certificates for all to authenticated using (is_admin()) with check (is_admin());

-- Private to the author only (owner decision: reflections and journals stay private,
-- no admin or facilitator access).
create policy "own_only" on public.journal_entries for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own_only" on public.weekly_rep_submissions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own_only" on public.impact_entries for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Self-owned records the coach (admin) works with.
create policy "own_or_admin" on public.assessments for all to authenticated
  using (user_id = auth.uid() or is_admin()) with check (user_id = auth.uid() or is_admin());
create policy "own_or_admin" on public.evaluations for all to authenticated
  using (user_id = auth.uid() or is_admin()) with check (user_id = auth.uid() or is_admin());
create policy "own_or_admin" on public.coaching_goals for all to authenticated
  using (client_id = auth.uid() or is_admin()) with check (client_id = auth.uid() or is_admin());
create policy "own_or_admin" on public.development_plans for all to authenticated
  using (client_id = auth.uid() or is_admin()) with check (client_id = auth.uid() or is_admin());
create policy "own_or_admin" on public.growth_milestones for all to authenticated
  using (client_id = auth.uid() or is_admin()) with check (client_id = auth.uid() or is_admin());
create policy "own_or_admin" on public.insights for all to authenticated
  using (client_id = auth.uid() or is_admin()) with check (client_id = auth.uid() or is_admin());
create policy "own_or_admin" on public.life_domains for all to authenticated
  using (client_id = auth.uid() or is_admin()) with check (client_id = auth.uid() or is_admin());
create policy "own_or_admin" on public.weekly_checkins for all to authenticated
  using (client_id = auth.uid() or is_admin()) with check (client_id = auth.uid() or is_admin());

create policy "sessions_read" on public.coaching_sessions for select to authenticated
  using (client_id = auth.uid() or coach_id = auth.uid() or is_admin());
create policy "admin_write" on public.coaching_sessions for all to authenticated using (is_admin()) with check (is_admin());

create policy "attendance_read" on public.session_attendance for select to authenticated
  using (user_id = auth.uid() or is_admin());
create policy "admin_write" on public.session_attendance for all to authenticated using (is_admin()) with check (is_admin());

-- 1:1 messages: only the two parties; clients may only message an admin.
create policy "messages_read" on public.messages for select to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());
create policy "messages_send" on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and (is_admin() or app_private.is_admin_user(recipient_id)));
create policy "messages_admin_delete" on public.messages for delete to authenticated
  using (is_admin());

-- ---------------------------------------------------------------- 6. role integrity
-- New accounts always start as impact_participant. /api/invite sets the intended role
-- afterwards with the service role, so the invite flow is unchanged.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.email, 'impact_participant');
  return new;
end;
$$;

-- Defence in depth: even if a future policy allowed self-updates, role and hourly_rate
-- can only change through an admin session or the service role.
-- SECURITY INVOKER on purpose: inside a definer function current_user would always be the
-- owner, and the check below would never fire.
create or replace function public.guard_profile_privileged_columns() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.hourly_rate is distinct from old.hourly_rate)
     and current_user::text not in ('service_role', 'postgres', 'supabase_admin')
     and not is_admin() then
    raise exception 'Only an administrator can change role or hourly_rate' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_profile_privileged_columns on public.profiles;
create trigger guard_profile_privileged_columns before update on public.profiles
  for each row execute function public.guard_profile_privileged_columns();
revoke all on function public.guard_profile_privileged_columns() from public, anon, authenticated;

commit;
