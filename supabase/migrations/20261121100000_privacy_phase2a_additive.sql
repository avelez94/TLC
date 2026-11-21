-- =====================================================================================
-- PRIVACY HARDENING 2a (ADDITIVE) — TLC Leadership (project jpgvclclgnyfguatuihx)
-- Status: NOT APPLIED. Safe with the code currently in production: it only adds
-- functions, columns, indexes and a table, and makes the (empty) resources bucket private.
-- Deployment order: 2a -> deploy application release -> 2b.
--
--  * my_profile(): a user's own full profile.
--  * cohort_meeting_links(): Zoom links for the caller's own active cohorts (admins: all).
--  * resources bucket: private, 50 MB limit, document/media types only; admin-only writes.
--  * rate_limit_hit(): durable rate limiting shared by all server instances (service role).
--  * registrations: paid_at / confirmation_email_sent_at / owner_notified_at, and one
--    registration per Stripe session; one enrollment per person per cohort; one rep
--    submission per person per rep.
-- No existing rows are changed or deleted (verified 2026-11-21: no duplicates; bucket empty).
-- =====================================================================================

begin;
-- ---------------------------------------------------------------- 1. own-profile function

-- A user's own full profile (portals show your own email/phone/organization).
create or replace function public.my_profile()
returns table (id uuid, full_name text, email text, phone text, organization text, role text,
               avatar_url text, timezone text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.email, p.phone, p.organization, p.role, p.avatar_url, p.timezone, p.created_at
  from public.profiles p where p.id = auth.uid()
$$;
revoke all on function public.my_profile() from public, anon;
grant execute on function public.my_profile() to authenticated;

-- ---------------------------------------------------------------- 2. meeting links

create or replace function public.cohort_meeting_links()
returns table (cohort_id uuid, zoom_link text)
language sql stable security definer set search_path = public as $$
  select c.id, c.zoom_link from public.cohorts c
  where c.zoom_link is not null
    and (public.is_admin() or app_private.is_cohort_member(c.id))
$$;
revoke all on function public.cohort_meeting_links() from public, anon;
grant execute on function public.cohort_meeting_links() to authenticated;

-- ---------------------------------------------------------------- 3. storage
do $$
begin
  if to_regclass('storage.buckets') is not null then
    update storage.buckets
       set public = false,
           file_size_limit = 52428800,  -- 50 MB (free-plan maximum)
           allowed_mime_types = array[
             'application/pdf',
             'application/msword',
             'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
             'application/vnd.ms-powerpoint',
             'application/vnd.openxmlformats-officedocument.presentationml.presentation',
             'application/vnd.ms-excel',
             'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
             'video/mp4', 'video/quicktime', 'audio/mpeg', 'image/png', 'image/jpeg']
     where id = 'resources';

    drop policy if exists "resources_admin_read" on storage.objects;
    drop policy if exists "resources_admin_insert" on storage.objects;
    drop policy if exists "resources_admin_update" on storage.objects;
    drop policy if exists "resources_admin_delete" on storage.objects;
    create policy "resources_admin_read" on storage.objects for select to authenticated
      using (bucket_id = 'resources' and public.is_admin());
    create policy "resources_admin_insert" on storage.objects for insert to authenticated
      with check (bucket_id = 'resources' and public.is_admin());
    create policy "resources_admin_update" on storage.objects for update to authenticated
      using (bucket_id = 'resources' and public.is_admin()) with check (bucket_id = 'resources' and public.is_admin());
    create policy "resources_admin_delete" on storage.objects for delete to authenticated
      using (bucket_id = 'resources' and public.is_admin());
  end if;
end $$;

-- ---------------------------------------------------------------- 4. rate limiting
create table if not exists app_private.rate_limits (
  key_hash text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key_hash, window_start)
);
revoke all on app_private.rate_limits from public, anon, authenticated;

-- Returns true if the request is allowed. Keys are hashed (they contain IPs or emails).
create or replace function public.rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  insert into app_private.rate_limits as r (key_hash, window_start, hits)
  values (md5(p_key), v_window, 1)
  on conflict (key_hash, window_start) do update set hits = r.hits + 1
  returning hits into v_hits;
  if random() < 0.01 then
    delete from app_private.rate_limits where window_start < now() - interval '1 day';
  end if;
  return v_hits <= p_limit;
end;
$$;
revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;

-- ---------------------------------------------------------------- 5. integrity
alter table public.registrations
  add column if not exists paid_at timestamptz,
  add column if not exists confirmation_email_sent_at timestamptz,
  add column if not exists owner_notified_at timestamptz;

create unique index if not exists registrations_stripe_session_id_key
  on public.registrations (stripe_session_id) where stripe_session_id is not null;
create unique index if not exists cohort_enrollments_cohort_user_key
  on public.cohort_enrollments (cohort_id, user_id);
create unique index if not exists weekly_rep_submissions_rep_user_key
  on public.weekly_rep_submissions (rep_id, user_id);

-- ---------------------------------------------------------------- 6. rep submissions
-- Participants may submit reflections only for reps in their own active cohorts (the
-- lockdown allowed any rep id). Still private to the author: no admin read.
create or replace function app_private.rep_cohort(p_rep uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select cohort_id from public.weekly_reps where id = p_rep
$$;
revoke all on function app_private.rep_cohort(uuid) from public, anon;
grant execute on function app_private.rep_cohort(uuid) to authenticated, service_role;

drop policy if exists "own_only" on public.weekly_rep_submissions;
create policy "own_read" on public.weekly_rep_submissions for select to authenticated
  using (user_id = auth.uid());
create policy "own_submit_in_cohort" on public.weekly_rep_submissions for insert to authenticated
  with check (user_id = auth.uid() and app_private.is_cohort_member(app_private.rep_cohort(rep_id)));
create policy "own_edit" on public.weekly_rep_submissions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and app_private.is_cohort_member(app_private.rep_cohort(rep_id)));
create policy "own_delete" on public.weekly_rep_submissions for delete to authenticated
  using (user_id = auth.uid());

commit;
