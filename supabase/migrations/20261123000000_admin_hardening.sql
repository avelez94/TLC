-- 2d: admin hardening (2026-11-23). Additive and reversible: supabase/rollback/20261123000000_admin_hardening_rollback.sql
--
--  1. Two-step verification in the database. is_admin() now looks at the session's verified
--     assurance level (the `aal` claim of the signed-in session), controlled by one setting:
--        off       – today's behaviour (no database check).            <- shipped value
--        enrolled  – an admin who has a verified authenticator must be signed in with it.
--        required  – every admin must be signed in with a verified authenticator.
--     Turn it on only after both admins are enrolled and recovery is verified:
--        update app_private.settings set value = '"required"' where key = 'admin_mfa_mode';
--  2. Hidden pathways: anonymous visitors can read only public programs.
--  3. Learning resources: participants see a resource only through an enrollment that matches
--     its cohort / program / portal; coaching clients only coaching or shared resources.
--  4. Weekly reps with reflections are archived, never deleted; the database refuses a delete
--     that would remove reflections.
--  5. Cohort capacity is enforced in the database (row lock, so simultaneous enrollments
--     cannot overfill a cohort).
--  6. An administrator cannot remove their own admin access or the last admin's.
--  7. Activity log: every admin change is recorded by the database itself, with the record's
--     name, outcome and previous/new values (never passwords, tokens, reflections, journal or
--     message content).
begin;

-- ---------------------------------------------------------------- 1. settings + MFA
create schema if not exists app_private;
create table if not exists app_private.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
revoke all on app_private.settings from public, anon, authenticated;
insert into app_private.settings (key, value) values ('admin_mfa_mode', '"off"')
  on conflict (key) do nothing;

create or replace function app_private.admin_mfa_mode() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select value #>> '{}' from app_private.settings where key = 'admin_mfa_mode'), 'off')
$$;

create or replace function app_private.has_verified_factor(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from auth.mfa_factors f where f.user_id = p_user and f.status::text = 'verified')
$$;

create or replace function app_private.session_aal() returns text
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal', 'aal1')
$$;

-- Same signature and grants as before; every policy that calls is_admin() inherits the check.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin')
    and case app_private.admin_mfa_mode()
          when 'required' then app_private.session_aal() = 'aal2'
          when 'enrolled' then app_private.session_aal() = 'aal2' or not app_private.has_verified_factor(auth.uid())
          else true
        end
$$;

-- Readable by any signed-in user (the sign-in screen needs it); reveals only the mode.
create or replace function public.admin_mfa_mode() returns text
language sql stable security definer set search_path = public as $$ select app_private.admin_mfa_mode() $$;
revoke all on function public.admin_mfa_mode() from public, anon;
grant execute on function public.admin_mfa_mode() to authenticated, service_role;

-- Security overview for the admin Security page: who is enrolled (counts only).
create or replace function public.admin_security_status() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Administrators only' using errcode = '42501'; end if;
  return jsonb_build_object(
    'mode', app_private.admin_mfa_mode(),
    'admins', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.full_name,
                         'enrolled', app_private.has_verified_factor(p.id)) order by p.full_name)
                        from profiles p where p.role = 'admin'), '[]'::jsonb));
end $$;
revoke all on function public.admin_security_status() from public, anon;
grant execute on function public.admin_security_status() to authenticated;

revoke all on all functions in schema app_private from public, anon;
grant execute on all functions in schema app_private to authenticated, service_role;

-- ---------------------------------------------------------------- 2. hidden pathways
drop policy if exists "catalog_read" on public.programs;
create policy "catalog_read_public" on public.programs for select to anon using (is_public);
create policy "catalog_read" on public.programs for select to authenticated using (true);

-- ---------------------------------------------------------------- 3. resources
create or replace function app_private.can_read_resource(p_portal text, p_program uuid, p_cohort uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    -- Cohort resources: members of that cohort (active or completed) only.
    when p_cohort is not null then exists (
      select 1 from cohort_enrollments e
      where e.cohort_id = p_cohort and e.user_id = auth.uid() and e.status in ('active', 'completed'))
    else exists (
      select 1 from profiles p where p.id = auth.uid() and (
        (p.role = 'coaching_client' and coalesce(p_portal, 'impact') in ('coaching', 'both'))
        or (p.role = 'impact_participant' and coalesce(p_portal, 'impact') in ('impact', 'both')
            and exists (
              select 1 from cohort_enrollments e join cohorts c on c.id = e.cohort_id
              where e.user_id = p.id and e.status in ('active', 'completed')
                and (p_program is null or c.program_id = p_program)))))
  end
$$;
revoke all on function app_private.can_read_resource(text, uuid, uuid) from public, anon;
grant execute on function app_private.can_read_resource(text, uuid, uuid) to authenticated, service_role;

drop policy if exists "resources_read" on public.resources;
create policy "resources_read" on public.resources for select to authenticated
  using (is_admin() or app_private.can_read_resource(portal_type, program_id, cohort_id));

-- ---------------------------------------------------------------- 4. weekly reps
alter table public.weekly_reps add column if not exists archived_at timestamptz;
alter table public.weekly_rep_submissions drop constraint if exists weekly_rep_submissions_rep_id_fkey;
alter table public.weekly_rep_submissions add constraint weekly_rep_submissions_rep_id_fkey
  foreign key (rep_id) references public.weekly_reps(id) on delete restrict;

-- Members see current reps, plus archived reps they wrote a reflection for.
drop policy if exists "reps_read" on public.weekly_reps;
create policy "reps_read" on public.weekly_reps for select to authenticated using (
  is_admin()
  or (app_private.is_cohort_member(cohort_id)
      and (archived_at is null
           or exists (select 1 from weekly_rep_submissions s where s.rep_id = weekly_reps.id and s.user_id = auth.uid()))));

-- Counts only; reflections stay private to their authors.
create or replace function public.admin_rep_reflection_counts() returns table (rep_id uuid, reflections integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Administrators only' using errcode = '42501'; end if;
  return query select s.rep_id, count(*)::integer from weekly_rep_submissions s group by s.rep_id;
end $$;

-- Removes a rep: archived when it has reflections, deleted when it has none.
create or replace function public.admin_remove_rep(p_rep uuid) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Administrators only' using errcode = '42501'; end if;
  if not exists (select 1 from weekly_reps where id = p_rep) then raise exception 'Weekly rep not found' using errcode = 'P0002'; end if;
  if exists (select 1 from weekly_rep_submissions where rep_id = p_rep) then
    update weekly_reps set archived_at = coalesce(archived_at, now()) where id = p_rep;
    return 'archived';
  end if;
  delete from weekly_reps where id = p_rep;
  return 'deleted';
end $$;
revoke all on function public.admin_rep_reflection_counts() from public, anon;
revoke all on function public.admin_remove_rep(uuid) from public, anon;
grant execute on function public.admin_rep_reflection_counts() to authenticated;
grant execute on function public.admin_remove_rep(uuid) to authenticated;

-- ---------------------------------------------------------------- 5. capacity
create or replace function app_private.enforce_cohort_capacity() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_cap integer; v_taken integer; v_name text;
begin
  if new.status is distinct from 'active' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'active' and old.cohort_id = new.cohort_id then return new; end if;
  -- Lock the cohort row: concurrent enrollments into the same cohort wait here in turn.
  select capacity, name into v_cap, v_name from cohorts where id = new.cohort_id for update;
  if v_cap is null then return new; end if;
  select count(*) into v_taken from cohort_enrollments
   where cohort_id = new.cohort_id and status = 'active' and id is distinct from new.id;
  if v_taken >= v_cap then
    raise exception '% is full (% of % seats taken).', v_name, v_taken, v_cap
      using errcode = '23514', detail = 'cohort_full', hint = 'Raise the capacity in Cohorts or withdraw someone first.';
  end if;
  return new;
end $$;
revoke all on function app_private.enforce_cohort_capacity() from public, anon, authenticated;
drop trigger if exists enforce_cohort_capacity on public.cohort_enrollments;
create trigger enforce_cohort_capacity before insert or update of status, cohort_id on public.cohort_enrollments
  for each row execute function app_private.enforce_cohort_capacity();

-- ---------------------------------------------------------------- 6. admin access guard
create or replace function app_private.guard_admin_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'admin' and new.role is distinct from 'admin' then
    if old.id = auth.uid() then
      raise exception 'You cannot remove your own administrator access. Ask the other administrator.'
        using errcode = '42501', detail = 'self_demotion';
    end if;
    if not exists (select 1 from profiles where role = 'admin' and id <> old.id) then
      raise exception 'This is the last administrator account; it must keep administrator access.'
        using errcode = '42501', detail = 'last_admin';
    end if;
  end if;
  return new;
end $$;
revoke all on function app_private.guard_admin_role() from public, anon, authenticated;
drop trigger if exists guard_admin_role on public.profiles;
create trigger guard_admin_role before update of role on public.profiles
  for each row execute function app_private.guard_admin_role();

-- ---------------------------------------------------------------- 7. activity log
alter table public.admin_audit_log
  add column if not exists entity_label text check (length(entity_label) <= 200),
  add column if not exists outcome text not null default 'success' check (outcome in ('success', 'failed', 'blocked')),
  add column if not exists changes jsonb;
create index if not exists admin_audit_log_created_idx on public.admin_audit_log (created_at desc);

create or replace function app_private.short(p text) returns text language sql immutable as $$
  select case when p is null then null when length(p) > 120 then left(p, 117) || '…' else p end
$$;

-- Records changes made by a signed-in administrator. Service-role routes (invites, payments)
-- log their own entries. Content fields are recorded as "changed", never their text.
create or replace function app_private.audit_admin_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_entity text; v_label text; v_tracked text[]; v_redacted text[] := '{}';
  v_changes jsonb := '{}'::jsonb; k text; v_action text;
begin
  if auth.uid() is null or not app_private.is_admin_user(auth.uid()) then
    return coalesce(new, old);
  end if;
  -- Rows removed by a cascade (e.g. the sessions of a deleted cohort) are covered by the
  -- parent's entry.
  if pg_trigger_depth() > 1 then return coalesce(new, old); end if;

  case tg_table_name
    when 'programs' then v_entity := 'program'; v_label := v_row->>'name';
      v_tracked := array['name','tagline','price','price_label','is_public','enrollment_open','session_day','session_time'];
      v_redacted := array['opening_statement','audience','description','leadership_goal','keywords'];
    when 'cohorts' then v_entity := 'cohort'; v_label := v_row->>'name';
      v_tracked := array['name','program_id','status','start_date','end_date','capacity','session_day','session_time'];
      v_redacted := array['zoom_link','description','includes','expectations','book_title','book_image_url','book_purchase_url'];
    when 'cohort_enrollments' then v_entity := 'enrollment';
      v_label := concat_ws(' — ', (select full_name from profiles where id = (v_row->>'user_id')::uuid),
                                 (select name from cohorts where id = (v_row->>'cohort_id')::uuid));
      v_tracked := array['status','cohort_id'];
    when 'cohort_sessions' then v_entity := 'session';
      v_label := concat_ws(' — ', (select name from cohorts where id = (v_row->>'cohort_id')::uuid), 'Session ' || (v_row->>'session_number'));
      v_tracked := array['title','session_date','session_number'];
    when 'weekly_reps' then v_entity := 'weekly_rep';
      v_label := concat_ws(' — ', (select name from cohorts where id = (v_row->>'cohort_id')::uuid), 'Week ' || (v_row->>'week_number') || ': ' || (v_row->>'title'));
      v_tracked := array['title','week_number','due_date','archived_at','cohort_id'];
      v_redacted := array['instructions','why_it_matters'];
    when 'journal_prompts' then v_entity := 'journal_prompt'; v_label := app_private.short(v_row->>'prompt');
      v_tracked := array['prompt','program_id','week_number'];
    when 'announcements' then v_entity := 'announcement'; v_label := v_row->>'title';
      v_tracked := array['title','cohort_id']; v_redacted := array['body'];
    when 'resources' then v_entity := 'resource'; v_label := v_row->>'title';
      v_tracked := array['title','type','portal_type','program_id','cohort_id']; v_redacted := array['url','description'];
    when 'certificates' then v_entity := 'certificate';
      v_label := concat_ws(' — ', (select full_name from profiles where id = (v_row->>'user_id')::uuid),
                                 (select name from programs where id = (v_row->>'program_id')::uuid));
      v_tracked := array['user_id','program_id','cohort_id'];
    when 'registrations' then v_entity := 'registration'; v_label := v_row->>'full_name';
      v_tracked := array['status','cohort_id']; v_redacted := array['payment_status','amount_paid'];
    when 'inquiries' then v_entity := 'inquiry'; v_label := coalesce(nullif(v_row->>'organization', ''), v_row->>'contact_name');
      v_tracked := array['status','follow_up_on','cohort_id'];
    when 'inquiry_notes' then v_entity := 'inquiry_note';
      v_label := (select coalesce(nullif(organization, ''), contact_name) from inquiries where id = (v_row->>'inquiry_id')::uuid);
      v_tracked := '{}';
    when 'profiles' then v_entity := 'person'; v_label := v_row->>'full_name';
      v_tracked := array['role','hourly_rate'];
    when 'community_posts' then v_entity := 'community_post';
      v_label := (select name from cohorts where id = (v_row->>'cohort_id')::uuid); v_tracked := '{}';
    when 'community_comments' then v_entity := 'community_comment'; v_label := null; v_tracked := '{}';
    when 'cohort_messages' then v_entity := 'chat_message';
      v_label := (select name from cohorts where id = (v_row->>'cohort_id')::uuid); v_tracked := '{}';
    else v_entity := tg_table_name; v_tracked := '{}';
  end case;

  if tg_op = 'UPDATE' then
    foreach k in array v_tracked loop
      if (v_old->k) is distinct from (v_new->k) then
        v_changes := v_changes || jsonb_build_object(k, jsonb_build_object('from', v_old->k, 'to', v_new->k));
      end if;
    end loop;
    foreach k in array v_redacted loop
      if (v_old->k) is distinct from (v_new->k) then
        v_changes := v_changes || jsonb_build_object(k, jsonb_build_object('changed', true));
      end if;
    end loop;
    -- Profiles: only role / rate changes are admin actions worth recording.
    if v_changes = '{}'::jsonb then return new; end if;
  end if;

  v_action := v_entity || '.' || case tg_op when 'INSERT' then 'create' when 'UPDATE' then 'update' else 'delete' end;
  if tg_table_name = 'weekly_reps' and tg_op = 'UPDATE' and v_changes ? 'archived_at' and (v_new->>'archived_at') is not null then
    v_action := 'weekly_rep.archive';
  end if;
  if tg_table_name = 'profiles' and tg_op <> 'UPDATE' then return coalesce(new, old); end if;
  -- Participants' own posts, comments and chat are not admin actions; only admin deletes are.
  if tg_table_name in ('community_posts', 'community_comments', 'cohort_messages') and tg_op <> 'DELETE' then
    return coalesce(new, old);
  end if;

  insert into admin_audit_log (actor_id, action, entity_type, entity_id, entity_label, outcome, changes, details)
  values (auth.uid(), v_action, v_entity, v_row->>'id', app_private.short(v_label), 'success',
          case when v_changes = '{}'::jsonb then null else v_changes end, '{}'::jsonb);
  return coalesce(new, old);
end $$;
revoke all on function app_private.audit_admin_change() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['programs','cohorts','cohort_enrollments','cohort_sessions','weekly_reps','journal_prompts',
                           'announcements','resources','certificates','registrations','inquiries','inquiry_notes',
                           'profiles','community_posts','community_comments','cohort_messages'] loop
    execute format('drop trigger if exists audit_admin_change on public.%I', t);
    execute format('create trigger audit_admin_change after insert or update or delete on public.%I
                    for each row execute function app_private.audit_admin_change()', t);
  end loop;
end $$;

-- Admins may record failed or blocked attempts (the database records successes itself).
drop policy if exists "admin_append" on public.admin_audit_log;
create policy "admin_append" on public.admin_audit_log for insert to authenticated
  with check (is_admin() and actor_id = auth.uid());

commit;
