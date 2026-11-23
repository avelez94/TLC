-- Rollback for 20261124000000_workflow_integration.sql (2e).
-- Restores the 2d access rules and removes the 2e rules that the 2d app does not expect
-- (certificate requirements, completion tracking, the system status function).
-- KEEPS every new table and column and their data (inquiry_participants, payment_requests,
-- stripe_events, completion and certificate fields, email delivery fields): they are unused by
-- the 2d app and removing them would lose records. Run with the 2d app deployed (Vercel
-- Instant Rollback to dpl_AJhGEWZJvDr4ciB97SuQgq4djeE9) or before rolling the app back.
-- Note: after this, past participants can again post or submit in finished cohorts at the
-- database level (as in 2d); the 2d portal does not offer it.
begin;

drop policy if exists "reps_read" on public.weekly_reps;
create policy "reps_read" on public.weekly_reps for select to authenticated using (
  is_admin() or (app_private.is_cohort_member(cohort_id)
    and (archived_at is null or exists (
      select 1 from public.weekly_rep_submissions s where s.rep_id = weekly_reps.id and s.user_id = auth.uid()))));

drop policy if exists "own_submit_in_cohort" on public.weekly_rep_submissions;
create policy "own_submit_in_cohort" on public.weekly_rep_submissions for insert to authenticated
  with check (user_id = auth.uid() and app_private.is_cohort_member(app_private.rep_cohort(rep_id)));
drop policy if exists "own_edit" on public.weekly_rep_submissions;
create policy "own_edit" on public.weekly_rep_submissions for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and app_private.is_cohort_member(app_private.rep_cohort(rep_id)));
drop policy if exists "own_delete" on public.weekly_rep_submissions;
create policy "own_delete" on public.weekly_rep_submissions for delete to authenticated using (user_id = auth.uid());

drop policy if exists "enrollments_read" on public.cohort_enrollments;
create policy "enrollments_read" on public.cohort_enrollments for select to authenticated
  using (user_id = auth.uid() or is_admin() or app_private.is_cohort_member(cohort_id));

drop policy if exists "announcements_read" on public.announcements;
create policy "announcements_read" on public.announcements for select to authenticated using (
  is_admin() or target_user_id = auth.uid()
  or (target_user_id is null and (cohort_id is null or app_private.is_cohort_member(cohort_id))));

drop policy if exists "posts_read" on public.community_posts;
create policy "posts_read" on public.community_posts for select to authenticated
  using (is_admin() or app_private.is_cohort_member(cohort_id));
drop policy if exists "posts_insert" on public.community_posts;
create policy "posts_insert" on public.community_posts for insert to authenticated
  with check (user_id = auth.uid() and (is_admin() or app_private.is_cohort_member(cohort_id)));
drop policy if exists "posts_update_own" on public.community_posts;
create policy "posts_update_own" on public.community_posts for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and (is_admin() or app_private.is_cohort_member(cohort_id)));
drop policy if exists "posts_delete" on public.community_posts;
create policy "posts_delete" on public.community_posts for delete to authenticated
  using (user_id = auth.uid() or is_admin());

drop policy if exists "comments_read" on public.community_comments;
create policy "comments_read" on public.community_comments for select to authenticated
  using (is_admin() or app_private.is_cohort_member(app_private.post_cohort(post_id)));
drop policy if exists "comments_insert" on public.community_comments;
create policy "comments_insert" on public.community_comments for insert to authenticated
  with check (user_id = auth.uid() and (is_admin() or app_private.is_cohort_member(app_private.post_cohort(post_id))));
drop policy if exists "comments_delete" on public.community_comments;
create policy "comments_delete" on public.community_comments for delete to authenticated
  using (user_id = auth.uid() or is_admin());

drop policy if exists "likes_read" on public.community_likes;
create policy "likes_read" on public.community_likes for select to authenticated
  using (is_admin() or app_private.is_cohort_member(app_private.post_cohort(post_id)));
drop policy if exists "likes_insert" on public.community_likes;
create policy "likes_insert" on public.community_likes for insert to authenticated
  with check (user_id = auth.uid() and (is_admin() or app_private.is_cohort_member(app_private.post_cohort(post_id))));
drop policy if exists "likes_delete_own" on public.community_likes;
create policy "likes_delete_own" on public.community_likes for delete to authenticated using (user_id = auth.uid());

drop policy if exists "chat_read" on public.cohort_messages;
create policy "chat_read" on public.cohort_messages for select to authenticated
  using (is_admin() or app_private.is_cohort_member(cohort_id));
drop policy if exists "chat_insert" on public.cohort_messages;
create policy "chat_insert" on public.cohort_messages for insert to authenticated
  with check (user_id = auth.uid() and (is_admin() or app_private.is_cohort_member(cohort_id)));

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

drop trigger if exists prepare_certificate on public.certificates;
drop trigger if exists keep_certificates on public.certificates;
drop trigger if exists track_completion on public.cohort_enrollments;
drop function if exists public.system_update_cohort_statuses();
drop function if exists public.admin_cohort_participation(uuid);
drop function if exists public.admin_resolve_email(bigint);
drop function if exists public.enroll_on_payment_mode();
drop function if exists app_private.can_participate(uuid);
drop function if exists app_private.cohort_accepts_activity(uuid);
drop function if exists app_private.is_cohort_participant(uuid);
drop function if exists app_private.prepare_certificate();
drop function if exists app_private.keep_certificates();
drop function if exists app_private.track_completion();

commit;
