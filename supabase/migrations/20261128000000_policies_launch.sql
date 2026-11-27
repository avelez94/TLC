-- 2h: Policies & Legal, policy acceptance on registrations, and launch checks.
--  * public.policies: one row per policy (privacy, terms, refund) holding the working draft and
--    a pointer to the published version. Nothing is published by this migration.
--  * public.policy_versions: append-only history. Every manual save and every publish adds a
--    version; versions can never be changed or deleted (a participant's accepted terms stay
--    exactly as they were).
--  * public.launch_checks: results of server-side launch checks (e.g. the Stripe webhook
--    verification), written only by the server.
--  * registrations.policies_accepted / policies_accepted_at: which published versions a
--    participant accepted before paying, and when.
-- Signed-in administrators can read these tables; all writes go through server routes that
-- check for an administrator (service role). Visitors read published text only through
-- public.published_policy(s)(), which never return drafts.
-- Rollback: supabase/rollback/20261128000000_policies_launch_rollback.sql
begin;

create table if not exists public.policies (
  slug text primary key check (slug in ('privacy', 'terms', 'refund')),
  draft jsonb not null default '{"title":"","intro":[],"sections":[]}'::jsonb,
  draft_updated_at timestamptz,
  draft_updated_by uuid references auth.users(id) on delete set null,
  published_version_id uuid,
  published_at timestamptz,
  published_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.policy_versions (
  id uuid primary key default gen_random_uuid(),
  policy_slug text not null references public.policies(slug) on delete restrict,
  version_number integer not null check (version_number > 0),
  kind text not null check (kind in ('saved', 'published')),
  content jsonb not null,
  content_hash text not null check (length(content_hash) = 64),
  note text check (length(note) <= 200),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (policy_slug, version_number)
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'policies_published_version_fk') then
    alter table public.policies add constraint policies_published_version_fk
      foreign key (published_version_id) references public.policy_versions(id) on delete restrict;
  end if;
end $$;

insert into public.policies (slug) values ('privacy'), ('terms'), ('refund') on conflict (slug) do nothing;

-- Versions are a permanent record: never deleted, and their content never changes. (Only
-- created_by may be cleared, when an administrator's account is removed.)
create or replace function public.policy_versions_immutable() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'policy versions cannot be deleted';
  end if;
  if new.id <> old.id or new.policy_slug <> old.policy_slug or new.version_number <> old.version_number
     or new.kind <> old.kind or new.content <> old.content or new.content_hash <> old.content_hash
     or new.note is distinct from old.note or new.created_at <> old.created_at
     or (new.created_by is distinct from old.created_by and new.created_by is not null) then
    raise exception 'policy versions cannot be changed';
  end if;
  return new;
end $$;
drop trigger if exists policy_versions_immutable on public.policy_versions;
create trigger policy_versions_immutable before update or delete on public.policy_versions
  for each row execute function public.policy_versions_immutable();

create table if not exists public.launch_checks (
  key text primary key check (length(key) <= 60),
  value jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now(),
  checked_by uuid references auth.users(id) on delete set null
);

alter table public.registrations
  add column if not exists policies_accepted jsonb,
  add column if not exists policies_accepted_at timestamptz;

-- Access: administrators read; nobody writes from the browser.
alter table public.policies enable row level security;
alter table public.policy_versions enable row level security;
alter table public.launch_checks enable row level security;
revoke all on public.policies, public.policy_versions, public.launch_checks from anon;
revoke insert, update, delete, truncate on public.policies, public.policy_versions, public.launch_checks from authenticated;
grant select on public.policies, public.policy_versions, public.launch_checks to authenticated;
-- The server (service role) writes; versions can be added but never deleted (the trigger also
-- refuses changes to their content).
grant select, insert, update on public.policies, public.launch_checks to service_role;
grant select, insert, update on public.policy_versions to service_role;
drop policy if exists "admin_read" on public.policies;
drop policy if exists "admin_read" on public.policy_versions;
drop policy if exists "admin_read" on public.launch_checks;
create policy "admin_read" on public.policies for select to authenticated using (public.is_admin());
create policy "admin_read" on public.policy_versions for select to authenticated using (public.is_admin());
create policy "admin_read" on public.launch_checks for select to authenticated using (public.is_admin());

-- Published text for visitors (never drafts).
create or replace function public.published_policies()
returns table (slug text, version_id uuid, version_number integer, published_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.slug, v.id, v.version_number, p.published_at
  from public.policies p join public.policy_versions v on v.id = p.published_version_id
  where p.published_version_id is not null
$$;
create or replace function public.published_policy(p_slug text)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('slug', p.slug, 'version_id', v.id, 'version_number', v.version_number,
                            'published_at', p.published_at, 'content', v.content)
  from public.policies p join public.policy_versions v on v.id = p.published_version_id
  where p.slug = p_slug and p.published_version_id is not null
$$;
revoke all on function public.published_policies() from public;
revoke all on function public.published_policy(text) from public;
grant execute on function public.published_policies() to anon, authenticated, service_role;
grant execute on function public.published_policy(text) to anon, authenticated, service_role;

commit;
