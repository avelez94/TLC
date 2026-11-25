-- 2e: workflow integration. Additive and backward-compatible with the deployed 2d app:
-- new columns are nullable or defaulted, no existing record is changed or removed, and the
-- only rules made stricter are writes into cohorts that have finished (see §1).
-- Rollback: supabase/rollback/20261124000000_workflow_integration_rollback.sql
begin;

-- ======================================================================= 1. participation
-- Reading a cohort's content: active or completed enrollment (alumni keep read access).
-- Writing (reps, posts, comments, likes, chat): active enrollment AND the cohort is Upcoming or
-- Active, or an admin reopened activity until a date (cohorts.activity_open_until, ET date).
alter table public.cohorts add column if not exists activity_open_until date;
grant select (activity_open_until) on public.cohorts to anon, authenticated;

create or replace function app_private.is_cohort_participant(p_cohort uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.cohort_enrollments
    where cohort_id = p_cohort and user_id = auth.uid() and status in ('active', 'completed'))
$$;

create or replace function app_private.cohort_accepts_activity(p_cohort uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.cohorts c
    where c.id = p_cohort
      and (c.status in ('upcoming', 'active')
           or (c.activity_open_until is not null
               and c.activity_open_until >= (now() at time zone 'America/New_York')::date)))
$$;

create or replace function app_private.can_participate(p_cohort uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app_private.is_cohort_member(p_cohort) and app_private.cohort_accepts_activity(p_cohort)
$$;
revoke all on function app_private.is_cohort_participant(uuid), app_private.cohort_accepts_activity(uuid),
  app_private.can_participate(uuid) from public, anon;
grant execute on function app_private.is_cohort_participant(uuid), app_private.cohort_accepts_activity(uuid),
  app_private.can_participate(uuid) to authenticated;

-- Weekly reps: alumni still see their cohort's reps (archived ones only if they answered).
drop policy if exists "reps_read" on public.weekly_reps;
create policy "reps_read" on public.weekly_reps for select to authenticated using (
  is_admin() or (app_private.is_cohort_participant(cohort_id)
    and (archived_at is null or exists (
      select 1 from public.weekly_rep_submissions s where s.rep_id = weekly_reps.id and s.user_id = auth.uid()))));

drop policy if exists "own_submit_in_cohort" on public.weekly_rep_submissions;
create policy "own_submit_in_cohort" on public.weekly_rep_submissions for insert to authenticated
  with check (user_id = auth.uid() and app_private.can_participate(app_private.rep_cohort(rep_id)));
drop policy if exists "own_edit" on public.weekly_rep_submissions;
create policy "own_edit" on public.weekly_rep_submissions for update to authenticated
  using (user_id = auth.uid() and app_private.can_participate(app_private.rep_cohort(rep_id)))
  with check (user_id = auth.uid() and app_private.can_participate(app_private.rep_cohort(rep_id)));
drop policy if exists "own_delete" on public.weekly_rep_submissions;
create policy "own_delete" on public.weekly_rep_submissions for delete to authenticated
  using (user_id = auth.uid() and app_private.can_participate(app_private.rep_cohort(rep_id)));

drop policy if exists "enrollments_read" on public.cohort_enrollments;
create policy "enrollments_read" on public.cohort_enrollments for select to authenticated
  using (user_id = auth.uid() or is_admin() or app_private.is_cohort_participant(cohort_id));

drop policy if exists "announcements_read" on public.announcements;
create policy "announcements_read" on public.announcements for select to authenticated using (
  is_admin() or target_user_id = auth.uid()
  or (target_user_id is null and (cohort_id is null or app_private.is_cohort_participant(cohort_id))));

drop policy if exists "posts_read" on public.community_posts;
create policy "posts_read" on public.community_posts for select to authenticated
  using (is_admin() or app_private.is_cohort_participant(cohort_id));
drop policy if exists "posts_insert" on public.community_posts;
create policy "posts_insert" on public.community_posts for insert to authenticated
  with check (user_id = auth.uid() and (is_admin() or app_private.can_participate(cohort_id)));
drop policy if exists "posts_update_own" on public.community_posts;
create policy "posts_update_own" on public.community_posts for update to authenticated
  using (user_id = auth.uid() and (is_admin() or app_private.can_participate(cohort_id)))
  with check (user_id = auth.uid() and (is_admin() or app_private.can_participate(cohort_id)));
drop policy if exists "posts_delete" on public.community_posts;
create policy "posts_delete" on public.community_posts for delete to authenticated
  using (is_admin() or (user_id = auth.uid() and app_private.can_participate(cohort_id)));

drop policy if exists "comments_read" on public.community_comments;
create policy "comments_read" on public.community_comments for select to authenticated
  using (is_admin() or app_private.is_cohort_participant(app_private.post_cohort(post_id)));
drop policy if exists "comments_insert" on public.community_comments;
create policy "comments_insert" on public.community_comments for insert to authenticated
  with check (user_id = auth.uid() and (is_admin() or app_private.can_participate(app_private.post_cohort(post_id))));
drop policy if exists "comments_delete" on public.community_comments;
create policy "comments_delete" on public.community_comments for delete to authenticated
  using (is_admin() or (user_id = auth.uid() and app_private.can_participate(app_private.post_cohort(post_id))));

drop policy if exists "likes_read" on public.community_likes;
create policy "likes_read" on public.community_likes for select to authenticated
  using (is_admin() or app_private.is_cohort_participant(app_private.post_cohort(post_id)));
drop policy if exists "likes_insert" on public.community_likes;
create policy "likes_insert" on public.community_likes for insert to authenticated
  with check (user_id = auth.uid() and (is_admin() or app_private.can_participate(app_private.post_cohort(post_id))));
drop policy if exists "likes_delete_own" on public.community_likes;
create policy "likes_delete_own" on public.community_likes for delete to authenticated
  using (user_id = auth.uid() and (is_admin() or app_private.can_participate(app_private.post_cohort(post_id))));

drop policy if exists "chat_read" on public.cohort_messages;
create policy "chat_read" on public.cohort_messages for select to authenticated
  using (is_admin() or app_private.is_cohort_participant(cohort_id));
drop policy if exists "chat_insert" on public.cohort_messages;
create policy "chat_insert" on public.cohort_messages for insert to authenticated
  with check (user_id = auth.uid() and (is_admin() or app_private.can_participate(cohort_id)));

-- Cohort-mates (current or alumni) can see each other's names, as before for active members.
create or replace function app_private.shares_cohort_with(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.cohort_enrollments mine
    join public.cohort_enrollments theirs on theirs.cohort_id = mine.cohort_id
    where mine.user_id = auth.uid() and mine.status in ('active', 'completed')
      and theirs.user_id = p_user and theirs.status <> 'withdrawn'
  )
$$;

-- ======================================================================= 2. completion
-- Program completion is a manual decision by an administrator (owner decision 2026-11-23).
alter table public.cohort_enrollments
  add column if not exists completed_at timestamptz,
  add column if not exists completed_by uuid references auth.users(id) on delete set null,
  add column if not exists completion_note text check (length(completion_note) <= 500);

create or replace function app_private.track_completion() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'completed' then
    if tg_op = 'UPDATE' and old.status = 'withdrawn' then
      raise exception 'A withdrawn participant cannot be marked complete. Re-enroll them first.'
        using errcode = '23514', detail = 'withdrawn_to_completed';
    end if;
    if tg_op = 'INSERT' or old.status is distinct from 'completed' then
      new.completed_at := coalesce(new.completed_at, now());
      new.completed_by := coalesce(auth.uid(), new.completed_by);
    end if;
  else
    new.completed_at := null; new.completed_by := null; new.completion_note := null;
  end if;
  return new;
end $$;
revoke all on function app_private.track_completion() from public, anon, authenticated;
drop trigger if exists track_completion on public.cohort_enrollments;
create trigger track_completion before insert or update of status, completed_at, completed_by, completion_note
  on public.cohort_enrollments for each row execute function app_private.track_completion();

-- ======================================================================= 3. certificates
alter table public.certificates
  add column if not exists certificate_number text,
  add column if not exists participant_name text,
  add column if not exists pathway_name text,
  add column if not exists cohort_name text,
  add column if not exists completion_date date,
  add column if not exists issued_by uuid references auth.users(id) on delete set null,
  add column if not exists signer_name text check (length(signer_name) <= 120),
  add column if not exists signer_title text check (length(signer_title) <= 160),
  -- Stylized text signature (script typeface) snapshotted at issue; null on certificates issued
  -- before the design was approved, which keep their plain signer line.
  add column if not exists signature_text text check (length(signature_text) <= 80),
  add column if not exists signature_font text check (signature_font in ('great-vibes', 'pinyon-script', 'alex-brush')),
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_reason text check (length(revoked_reason) <= 300);
create unique index if not exists certificates_number_key on public.certificates (certificate_number) where certificate_number is not null;
-- One valid certificate per person per cohort; a revoked one stays on record and a corrected one
-- can then be issued.
create unique index if not exists certificates_user_cohort_key on public.certificates (user_id, cohort_id) where cohort_id is not null and revoked_at is null;
create sequence if not exists app_private.certificate_seq;

-- New certificates need a completed enrollment in the cohort; the names on the certificate
-- are captured at issue so later edits to profiles or pathways never change an issued one.
create or replace function app_private.prepare_certificate() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_enr record; v_sig jsonb;
begin
  if new.cohort_id is null or new.user_id is null then
    raise exception 'Choose the participant and the cohort they completed.' using errcode = '23514', detail = 'certificate_needs_cohort';
  end if;
  select e.status, e.completed_at, c.name as cohort_name, c.program_id, p.name as pathway_name, pr.full_name
    into v_enr
    from public.cohort_enrollments e
    join public.cohorts c on c.id = e.cohort_id
    left join public.programs p on p.id = c.program_id
    left join public.profiles pr on pr.id = e.user_id
   where e.cohort_id = new.cohort_id and e.user_id = new.user_id;
  if v_enr is null or v_enr.status is distinct from 'completed' then
    raise exception 'Mark their program complete before issuing a certificate.' using errcode = '23514', detail = 'certificate_needs_completion';
  end if;
  new.program_id := coalesce(new.program_id, v_enr.program_id);
  new.participant_name := coalesce(nullif(new.participant_name, ''), v_enr.full_name);
  new.pathway_name := coalesce(nullif(new.pathway_name, ''), v_enr.pathway_name);
  new.cohort_name := coalesce(nullif(new.cohort_name, ''), v_enr.cohort_name);
  new.completion_date := coalesce(new.completion_date, (v_enr.completed_at at time zone 'America/New_York')::date);
  -- Signature: the approved design from Settings applies to every new certificate; without
  -- approval no stylized signature is ever added (an explicitly typed signer line still works).
  select value into v_sig from app_private.settings where key = 'certificate_signature';
  if coalesce((v_sig ->> 'approved')::boolean, false) then
    new.signature_text := nullif(v_sig ->> 'signature_text', '');
    new.signature_font := coalesce(v_sig ->> 'font', 'great-vibes');
    new.signer_name := nullif(v_sig ->> 'signer_name', '');
    new.signer_title := nullif(v_sig ->> 'signer_title', '');
  else
    new.signature_text := null; new.signature_font := null;
  end if;
  new.issued_by := coalesce(auth.uid(), new.issued_by);
  new.issued_at := now();
  new.certificate_number := 'TLC-' || to_char(now() at time zone 'America/New_York', 'YYYY') || '-'
                            || lpad(nextval('app_private.certificate_seq')::text, 4, '0');
  new.revoked_at := null; new.revoked_reason := null;
  return new;
end $$;
revoke all on function app_private.prepare_certificate() from public, anon, authenticated;
drop trigger if exists prepare_certificate on public.certificates;
create trigger prepare_certificate before insert on public.certificates
  for each row execute function app_private.prepare_certificate();

create or replace function app_private.keep_certificates() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    -- Cascades from a removed account are allowed (the person's data is being erased).
    if pg_trigger_depth() > 1 then return old; end if;
    raise exception 'Issued certificates are kept permanently. Revoke it instead if it was issued in error.'
      using errcode = '23514', detail = 'certificate_keep';
  end if;
  if new.certificate_number is distinct from old.certificate_number or new.user_id is distinct from old.user_id
     or new.cohort_id is distinct from old.cohort_id or new.issued_at is distinct from old.issued_at
     or new.signer_name is distinct from old.signer_name or new.signer_title is distinct from old.signer_title
     or new.signature_text is distinct from old.signature_text or new.signature_font is distinct from old.signature_font then
    raise exception 'The certificate number, person, cohort, issue date and signature cannot be changed.'
      using errcode = '23514', detail = 'certificate_fixed';
  end if;
  return new;
end $$;
revoke all on function app_private.keep_certificates() from public, anon, authenticated;
drop trigger if exists keep_certificates on public.certificates;
create trigger keep_certificates before update or delete on public.certificates
  for each row execute function app_private.keep_certificates();

-- Certificate signature settings. Ships NOT approved: new certificates keep the current design
-- until an administrator records Tramaine's approval in Certificates → Signature.
insert into app_private.settings (key, value) values ('certificate_signature', jsonb_build_object(
  'approved', false, 'signature_text', 'Tramaine L. Crawford', 'signer_name', 'Tramaine L. Crawford',
  'signer_title', 'Founder, TLC Leadership Consulting & Coaching', 'font', 'great-vibes'))
on conflict (key) do nothing;

create or replace function public.admin_certificate_signature() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Only administrators can view certificate settings.' using errcode = '42501'; end if;
  return (select value || jsonb_build_object('updated_at', updated_at) from app_private.settings where key = 'certificate_signature');
end $$;
revoke all on function public.admin_certificate_signature() from public, anon;
grant execute on function public.admin_certificate_signature() to authenticated;

create or replace function public.admin_set_certificate_signature(
  p_signature_text text, p_signer_name text, p_signer_title text, p_font text, p_approved boolean
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_old jsonb; v_new jsonb;
begin
  if not public.is_admin() then raise exception 'Only administrators can change certificate settings.' using errcode = '42501'; end if;
  p_signature_text := btrim(regexp_replace(coalesce(p_signature_text, ''), '\s+', ' ', 'g'));
  p_signer_name := btrim(regexp_replace(coalesce(p_signer_name, ''), '\s+', ' ', 'g'));
  p_signer_title := btrim(regexp_replace(coalesce(p_signer_title, ''), '\s+', ' ', 'g'));
  if length(p_signature_text) not between 1 and 80 or length(p_signer_name) not between 1 and 120 or length(p_signer_title) > 160 then
    raise exception 'Enter the signature (up to 80 characters), the printed name (up to 120) and a title (up to 160).' using errcode = '22023';
  end if;
  if p_font not in ('great-vibes', 'pinyon-script', 'alex-brush') then
    raise exception 'Choose one of the listed signature styles.' using errcode = '22023';
  end if;
  select value into v_old from app_private.settings where key = 'certificate_signature';
  v_new := jsonb_build_object('approved', coalesce(p_approved, false), 'signature_text', p_signature_text,
    'signer_name', p_signer_name, 'signer_title', nullif(p_signer_title, ''), 'font', p_font);
  insert into app_private.settings (key, value, updated_at) values ('certificate_signature', v_new, now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
  if v_old is distinct from v_new then
    insert into public.admin_audit_log (actor_id, action, entity_type, entity_label, outcome, changes)
    values (auth.uid(), 'settings.certificate_signature', 'settings', 'Certificate signature', 'success',
      jsonb_build_object('from', v_old, 'to', v_new));
  end if;
  return v_new;
end $$;
revoke all on function public.admin_set_certificate_signature(text, text, text, text, boolean) from public, anon;
grant execute on function public.admin_set_certificate_signature(text, text, text, text, boolean) to authenticated;

-- ======================================================================= 4. participation view
-- Who submitted which weekly rep in a cohort, for administrators. Never returns reflection text.
create or replace function public.admin_cohort_participation(p_cohort uuid)
returns table (rep_id uuid, user_id uuid, submitted_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Only administrators can review participation.' using errcode = '42501';
  end if;
  return query
    select s.rep_id, s.user_id, s.completed_at
      from public.weekly_rep_submissions s
      join public.weekly_reps r on r.id = s.rep_id
     where r.cohort_id = p_cohort;
end $$;
revoke all on function public.admin_cohort_participation(uuid) from public, anon;
grant execute on function public.admin_cohort_participation(uuid) to authenticated;

-- ======================================================================= 5. inquiry → people
create table if not exists public.inquiry_participants (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.inquiries(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  cohort_id uuid references public.cohorts(id) on delete set null,
  full_name text not null check (length(full_name) between 1 and 120),
  -- Stored lower-case so one plain unique key (inquiry_id, email) works with upserts.
  email text not null check (length(email) <= 254 and email = lower(email)),
  result text not null default 'pending'
    check (result in ('pending', 'invited', 'setup_link_sent', 'enrolled', 'already_enrolled', 'failed')),
  detail text check (length(detail) <= 500),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists inquiry_participants_email_key on public.inquiry_participants (inquiry_id, email);
create index if not exists inquiry_participants_user_idx on public.inquiry_participants (user_id);
alter table public.inquiry_participants enable row level security;
drop policy if exists "admin_all" on public.inquiry_participants;
create policy "admin_all" on public.inquiry_participants for all to authenticated using (is_admin()) with check (is_admin());
revoke all on public.inquiry_participants from anon;
grant select, insert, update, delete on public.inquiry_participants to authenticated;

-- ======================================================================= 6. email log
alter table public.email_log drop constraint if exists email_log_status_check;
alter table public.email_log add constraint email_log_status_check check (status in
  ('sent', 'accepted', 'queued', 'delivered', 'delayed', 'bounced', 'complained', 'failed', 'skipped'));
alter table public.email_log
  add column if not exists related_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists related_type text check (length(related_type) <= 40),
  add column if not exists related_id text check (length(related_id) <= 80),
  add column if not exists resend_of bigint references public.email_log(id) on delete set null,
  add column if not exists idempotency_key text check (length(idempotency_key) <= 100),
  add column if not exists last_event text check (length(last_event) <= 40),
  add column if not exists last_event_at timestamptz,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references auth.users(id) on delete set null;
create unique index if not exists email_log_idempotency_key on public.email_log (idempotency_key) where idempotency_key is not null;
create index if not exists email_log_provider_idx on public.email_log (provider_id) where provider_id is not null;
create index if not exists email_log_attention_idx on public.email_log (created_at) where status in ('failed', 'bounced', 'complained') and resolved_at is null;

-- An administrator marks a failed email as handled (for example after contacting the person).
create or replace function public.admin_resolve_email(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Only administrators can do this.' using errcode = '42501'; end if;
  update public.email_log set resolved_at = now(), resolved_by = auth.uid() where id = p_id and resolved_at is null;
  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, outcome, details)
  values (auth.uid(), 'email.resolve', 'email', p_id::text, 'success', '{}'::jsonb);
end $$;
revoke all on function public.admin_resolve_email(bigint) from public, anon;
grant execute on function public.admin_resolve_email(bigint) to authenticated;

-- ======================================================================= 7. payments
-- Payment and enrollment are independent. Historical free registrations keep their records
-- ("paid" with amount 0 = free checkout completed); nothing is rewritten.
alter table public.registrations
  add column if not exists amount_paid_cents integer check (amount_paid_cents >= 0),
  add column if not exists amount_refunded_cents integer not null default 0 check (amount_refunded_cents >= 0),
  add column if not exists currency text not null default 'usd' check (length(currency) = 3),
  add column if not exists stripe_payment_intent_id text,
  add column if not exists receipt_url text check (length(receipt_url) <= 500),
  add column if not exists refunded_at timestamptz,
  add column if not exists payment_failed_at timestamptz,
  add column if not exists payment_error text check (length(payment_error) <= 300),
  add column if not exists checkout_expires_at timestamptz,
  add column if not exists enrollment_issue text
    check (enrollment_issue in ('cohort_full', 'enrollment_failed', 'cohort_unavailable', 'amount_mismatch', 'refund_review')),
  add column if not exists enrollment_issue_at timestamptz,
  add column if not exists complimentary_reason text check (length(complimentary_reason) <= 300),
  add column if not exists complimentary_approved_by uuid references auth.users(id) on delete set null,
  add column if not exists inquiry_id uuid references public.inquiries(id) on delete set null;
alter table public.registrations drop constraint if exists registrations_payment_status_check;
alter table public.registrations add constraint registrations_payment_status_check check (payment_status in
  ('unpaid', 'pending', 'paid', 'failed', 'expired', 'refunded', 'partially_refunded', 'complimentary'));
create index if not exists registrations_payment_intent_idx on public.registrations (stripe_payment_intent_id) where stripe_payment_intent_id is not null;

-- Payment requests (payment links / invoices / offline arrangements), mainly for organizations.
create table if not exists public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid references public.inquiries(id) on delete set null,
  registration_id uuid references public.registrations(id) on delete set null,
  cohort_id uuid references public.cohorts(id) on delete set null,
  payer_name text not null check (length(payer_name) between 1 and 160),
  payer_email text check (length(payer_email) <= 254),
  description text not null check (length(description) between 1 and 300),
  method text not null check (method in ('payment_link', 'invoice', 'offline')),
  seats integer check (seats between 1 and 500),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'usd' check (length(currency) = 3),
  status text not null default 'draft'
    check (status in ('draft', 'open', 'paid', 'partially_paid', 'failed', 'void', 'expired', 'refunded', 'partially_refunded')),
  amount_paid_cents integer not null default 0 check (amount_paid_cents >= 0),
  amount_refunded_cents integer not null default 0 check (amount_refunded_cents >= 0),
  stripe_object_id text,
  stripe_url text check (length(stripe_url) <= 500),
  due_date date,
  paid_at timestamptz,
  notes text check (length(notes) <= 2000),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists payment_requests_stripe_key on public.payment_requests (stripe_object_id) where stripe_object_id is not null;
alter table public.payment_requests enable row level security;
drop policy if exists "admin_all" on public.payment_requests;
create policy "admin_all" on public.payment_requests for all to authenticated using (is_admin()) with check (is_admin());
revoke all on public.payment_requests from anon;
grant select, insert, update on public.payment_requests to authenticated;

-- Stripe events already handled, so a redelivered event is never processed twice.
create table if not exists public.stripe_events (
  id text primary key check (length(id) <= 255),
  type text not null check (length(type) <= 100),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  outcome text check (length(outcome) <= 60),
  detail text check (length(detail) <= 500)
);
alter table public.stripe_events enable row level security;
drop policy if exists "admin_read" on public.stripe_events;
create policy "admin_read" on public.stripe_events for select to authenticated using (is_admin());
revoke all on public.stripe_events from anon, authenticated;
grant select on public.stripe_events to authenticated;

insert into app_private.settings (key, value) values ('enroll_on_payment', '"review"') on conflict (key) do nothing;
create or replace function public.enroll_on_payment_mode() returns text
language sql stable security definer set search_path = '' as $$
  select case when public.is_admin()
    then coalesce((select value #>> '{}' from app_private.settings where key = 'enroll_on_payment'), 'review') end
$$;
revoke all on function public.enroll_on_payment_mode() from public, anon;
grant execute on function public.enroll_on_payment_mode() to authenticated, service_role;
-- The webhook runs as the service role (no admin session), so it reads the setting here.
create or replace function public.system_enroll_on_payment_mode() returns text
language sql stable security definer set search_path = '' as $$
  select case when (select value #>> '{}' from app_private.settings where key = 'enroll_on_payment') = 'automatic'
    then 'automatic' else 'review' end
$$;
revoke all on function public.system_enroll_on_payment_mode() from public, anon, authenticated;
grant execute on function public.system_enroll_on_payment_mode() to service_role;
-- The server (service role) writes the new tables. Supabase grants this by default; stated
-- explicitly so a project with tightened defaults still works.
grant select, insert, update, delete on public.inquiry_participants, public.payment_requests, public.stripe_events to service_role;

-- ======================================================================= 8. system actions
alter table public.admin_audit_log add column if not exists actor_type text not null default 'admin'
  check (actor_type in ('admin', 'system'));

-- The daily status job: Upcoming → Active on the start date, Active → Completed after the end
-- date (New York calendar date). Each change is logged once, in the same transaction, so a
-- job that runs twice changes and logs nothing the second time. Participant completion is not
-- touched: that stays a decision for an administrator.
create or replace function public.system_update_cohort_statuses()
returns table (cohort_id uuid, cohort_name text, from_status text, to_status text)
language plpgsql security definer set search_path = '' as $$
declare v_today date := (now() at time zone 'America/New_York')::date;
begin
  return query
  with started as (
    update public.cohorts c set status = 'active'
     where c.status = 'upcoming' and c.start_date is not null and c.start_date <= v_today
    returning c.id, c.name, 'upcoming'::text as f, 'active'::text as t, 'start date reached ('::text || c.start_date || ')' as why
  ), logged as (
    insert into public.admin_audit_log (actor_id, actor_type, action, entity_type, entity_id, entity_label, outcome, changes, details)
    select null, 'system', 'cohort.status_auto', 'cohort', s.id::text, app_private.short(s.name), 'success',
           jsonb_build_object('status', jsonb_build_object('from', s.f, 'to', s.t)),
           jsonb_build_object('reason', s.why, 'run_date', v_today)
      from started s
    returning entity_id
  )
  select s.id, s.name, s.f, s.t from started s;

  return query
  with finished as (
    update public.cohorts c set status = 'completed'
     where c.status = 'active' and c.end_date is not null and c.end_date < v_today
    returning c.id, c.name, 'active'::text as f, 'completed'::text as t, 'end date passed ('::text || c.end_date || ')' as why
  ), logged as (
    insert into public.admin_audit_log (actor_id, actor_type, action, entity_type, entity_id, entity_label, outcome, changes, details)
    select null, 'system', 'cohort.status_auto', 'cohort', f.id::text, app_private.short(f.name), 'success',
           jsonb_build_object('status', jsonb_build_object('from', f.f, 'to', f.t)),
           jsonb_build_object('reason', f.why, 'run_date', v_today)
      from finished f
    returning entity_id
  )
  select f.id, f.name, f.f, f.t from finished f;
end $$;
revoke all on function public.system_update_cohort_statuses() from public, anon, authenticated;
grant execute on function public.system_update_cohort_statuses() to service_role;

-- ======================================================================= 9. activity log coverage
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
  if pg_trigger_depth() > 1 then return coalesce(new, old); end if;

  case tg_table_name
    when 'programs' then v_entity := 'program'; v_label := v_row->>'name';
      v_tracked := array['name','tagline','price','price_label','is_public','enrollment_open','session_day','session_time'];
      v_redacted := array['opening_statement','audience','description','leadership_goal','keywords'];
    when 'cohorts' then v_entity := 'cohort'; v_label := v_row->>'name';
      v_tracked := array['name','program_id','status','start_date','end_date','capacity','session_day','session_time','activity_open_until'];
      v_redacted := array['zoom_link','description','includes','expectations','book_title','book_image_url','book_purchase_url'];
    when 'cohort_enrollments' then v_entity := 'enrollment';
      v_label := concat_ws(' — ', (select full_name from profiles where id = (v_row->>'user_id')::uuid),
                                 (select name from cohorts where id = (v_row->>'cohort_id')::uuid));
      v_tracked := array['status','cohort_id']; v_redacted := array['completion_note'];
    when 'cohort_sessions' then v_entity := 'session';
      v_label := concat_ws(' — ', (select name from cohorts where id = (v_row->>'cohort_id')::uuid), 'Session ' || (v_row->>'session_number'));
      v_tracked := array['title','session_date','session_number'];
    when 'session_attendance' then v_entity := 'attendance';
      v_label := concat_ws(' — ', (select full_name from profiles where id = (v_row->>'user_id')::uuid),
                                 (select name from cohorts where id = (v_row->>'cohort_id')::uuid), 'Session ' || (v_row->>'session_number'));
      v_tracked := array['attended'];
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
      v_label := concat_ws(' — ', coalesce(v_row->>'participant_name', (select full_name from profiles where id = (v_row->>'user_id')::uuid)),
                                 coalesce(v_row->>'cohort_name', (select name from programs where id = (v_row->>'program_id')::uuid)));
      v_tracked := array['user_id','program_id','cohort_id','certificate_number','participant_name','pathway_name','cohort_name','completion_date','revoked_at','signer_name'];
      v_redacted := array['revoked_reason'];
    when 'registrations' then v_entity := 'registration'; v_label := v_row->>'full_name';
      v_tracked := array['status','cohort_id','payment_status','enrollment_issue'];
      v_redacted := array['amount_paid','amount_paid_cents','complimentary_reason'];
    when 'payment_requests' then v_entity := 'payment_request'; v_label := concat_ws(' — ', v_row->>'payer_name', v_row->>'description');
      v_tracked := array['status','amount_cents','seats','method','cohort_id','due_date'];
      v_redacted := array['notes','stripe_url'];
    when 'inquiries' then v_entity := 'inquiry'; v_label := coalesce(nullif(v_row->>'organization', ''), v_row->>'contact_name');
      v_tracked := array['status','follow_up_on','cohort_id'];
    when 'inquiry_notes' then v_entity := 'inquiry_note';
      v_label := (select coalesce(nullif(organization, ''), contact_name) from inquiries where id = (v_row->>'inquiry_id')::uuid);
      v_tracked := '{}';
    when 'inquiry_participants' then v_entity := 'inquiry_participant';
      v_label := concat_ws(' — ', v_row->>'full_name', (select coalesce(nullif(organization, ''), contact_name) from inquiries where id = (v_row->>'inquiry_id')::uuid));
      v_tracked := array['result','cohort_id','user_id'];
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
    if v_changes = '{}'::jsonb then return new; end if;
  end if;

  v_action := v_entity || '.' || case tg_op when 'INSERT' then 'create' when 'UPDATE' then 'update' else 'delete' end;
  if tg_table_name = 'weekly_reps' and tg_op = 'UPDATE' and v_changes ? 'archived_at' and (v_new->>'archived_at') is not null then
    v_action := 'weekly_rep.archive';
  end if;
  if tg_table_name = 'cohort_enrollments' and tg_op = 'UPDATE' and v_changes ? 'status' then
    v_action := case v_new->>'status' when 'completed' then 'enrollment.complete'
                                       when 'withdrawn' then 'enrollment.withdraw'
                                       else case when v_old->>'status' = 'completed' then 'enrollment.uncomplete' else 'enrollment.update' end end;
  end if;
  if tg_table_name = 'certificates' and tg_op = 'UPDATE' and v_changes ? 'revoked_at' and (v_new->>'revoked_at') is not null then
    v_action := 'certificate.revoke';
  end if;
  if tg_table_name = 'profiles' and tg_op <> 'UPDATE' then return coalesce(new, old); end if;
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
  foreach t in array array['session_attendance','inquiry_participants','payment_requests'] loop
    execute format('drop trigger if exists audit_admin_change on public.%I', t);
    execute format('create trigger audit_admin_change after insert or update or delete on public.%I
                    for each row execute function app_private.audit_admin_change()', t);
  end loop;
end $$;

commit;
