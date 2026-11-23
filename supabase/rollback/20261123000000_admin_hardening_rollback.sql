-- ROLLBACK for 20261123000000_admin_hardening.sql (2d). Run by hand only.
--
-- Usually NOT needed: the previous application release works with 2d in place (an
-- application rollback through Vercel does not require this script).
--
-- Restores the 2c behaviour: is_admin() without the two-step check, the previous program,
-- resource and weekly-rep read rules, no capacity or admin-access guard, no automatic
-- activity log. Keeps every record: activity-log entries and their new columns stay,
-- archived reps keep their archived_at value (older code ignores it, so they reappear).
-- WARNING: after this, deleting a weekly rep deletes its reflections again.
begin;

do $$
declare t text;
begin
  foreach t in array array['programs','cohorts','cohort_enrollments','cohort_sessions','weekly_reps','journal_prompts',
                           'announcements','resources','certificates','registrations','inquiries','inquiry_notes',
                           'profiles','community_posts','community_comments','cohort_messages'] loop
    execute format('drop trigger if exists audit_admin_change on public.%I', t);
  end loop;
end $$;
drop trigger if exists enforce_cohort_capacity on public.cohort_enrollments;
drop trigger if exists guard_admin_role on public.profiles;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin')
$$;

drop policy if exists "catalog_read_public" on public.programs;
drop policy if exists "catalog_read" on public.programs;
create policy "catalog_read" on public.programs for select to anon, authenticated using (true);

drop policy if exists "resources_read" on public.resources;
create policy "resources_read" on public.resources for select to authenticated
  using (is_admin() or portal_type = 'both' or cohort_id is null or app_private.is_cohort_member(cohort_id));

drop policy if exists "reps_read" on public.weekly_reps;
create policy "reps_read" on public.weekly_reps for select to authenticated
  using (is_admin() or app_private.is_cohort_member(cohort_id));
alter table public.weekly_rep_submissions drop constraint if exists weekly_rep_submissions_rep_id_fkey;
alter table public.weekly_rep_submissions add constraint weekly_rep_submissions_rep_id_fkey
  foreign key (rep_id) references public.weekly_reps(id) on delete cascade;

drop function if exists public.admin_remove_rep(uuid);
drop function if exists public.admin_rep_reflection_counts();
drop function if exists public.admin_security_status();
drop function if exists public.admin_mfa_mode();
drop function if exists app_private.audit_admin_change();
drop function if exists app_private.enforce_cohort_capacity();
drop function if exists app_private.guard_admin_role();
drop function if exists app_private.can_read_resource(text, uuid, uuid);
drop function if exists app_private.short(text);
drop function if exists app_private.session_aal();
drop function if exists app_private.has_verified_factor(uuid);
drop function if exists app_private.admin_mfa_mode();
drop table if exists app_private.settings;
commit;
