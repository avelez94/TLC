-- =====================================================================================
-- 2c — PATHWAYS, ORGANIZATIONAL INQUIRIES, ADMIN RECORDS — TLC Leadership
-- Status: NOT APPLIED. Ships with the Impact Lab redesign release (owner review first).
-- Additive only: no existing row is changed or deleted. Historical programs (Impact
-- Finders/Makers/Leaders), their cohorts, registrations, enrollments and certificates are
-- preserved as they are; they are simply not flagged as public pathways.
-- =====================================================================================
begin;

-- ---------------------------------------------------------------- pathways
alter table public.programs
  add column if not exists slug text,
  add column if not exists pathway_number integer,
  add column if not exists tagline text,
  add column if not exists opening_statement text,
  add column if not exists audience text,
  add column if not exists is_public boolean not null default false,
  add column if not exists enrollment_open boolean not null default false;
create unique index if not exists programs_slug_key on public.programs (slug) where slug is not null;

-- Length limits keep admin edits from breaking the public layout.
alter table public.programs drop constraint if exists programs_pathway_text_lengths;
alter table public.programs add constraint programs_pathway_text_lengths check (
  coalesce(length(tagline), 0) <= 80 and coalesce(length(opening_statement), 0) <= 220
  and coalesce(length(audience), 0) <= 600 and coalesce(length(description), 0) <= 1500
  and coalesce(length(leadership_goal), 0) <= 400 and coalesce(length(keywords), 0) <= 160
  and coalesce(length(price_label), 0) <= 60);

insert into public.programs (name, type, slug, pathway_number, sort_order, tagline, opening_statement, audience, description, leadership_goal, keywords, is_public, enrollment_open, price, price_label)
select v.* from (values
  ('Emerging Leaders', 'cohort', 'emerging-leaders', 1, 10, 'Prepare to Lead',
   'Leadership begins before you receive a title.',
   'The Emerging Leaders pathway is designed for aspiring supervisors, high-potential employees, and professionals preparing for greater leadership responsibility.',
   'Through guided learning, practical discussion, deliberate practice, and real-world application, participants develop the mindset, skills, and professional behaviors needed to lead themselves effectively, influence others, solve problems, and demonstrate readiness for leadership.',
   'Build the foundational leadership capabilities needed to take initiative, exercise sound judgment, communicate effectively, influence others, and prepare for greater responsibility.',
   'Self-Leadership, Communication, Accountability, Influence', true, false, null::integer, null::text),
  ('New Leaders', 'cohort', 'new-leaders', 2, 11, 'Make the Transition to Leadership',
   'Being good at your job does not automatically prepare you to lead others.',
   'The New Leaders pathway is designed for newly promoted supervisors, first-time managers, and professionals transitioning into formal leadership responsibilities.',
   'Through practical learning, real-world scenarios, guided discussion, and deliberate practice, participants develop the foundational supervisory skills needed to establish expectations, communicate effectively, delegate responsibilities, address performance concerns, and build productive relationships with employees.',
   'Develop the knowledge, skills, and judgment needed to transition successfully into leadership and effectively manage the responsibilities of supervising others.',
   'Supervision, Communication, Accountability, Performance', true, false, null, null),
  ('Practicing Leaders', 'cohort', 'practicing-leaders', 3, 12, 'Strengthen Your Leadership Effectiveness',
   'Leadership effectiveness is measured by more than what you accomplish personally.',
   'It is reflected in how well you lead, develop, and enable others to perform. The Practicing Leaders pathway is designed for established supervisors, team leaders, and frontline managers seeking to strengthen their effectiveness in leading people and teams.',
   'Through guided learning, meaningful discussion, deliberate practice, and workplace application, participants strengthen the skills and judgment needed to coach and develop others, navigate complex workplace challenges, lead change, and create conditions where individuals and teams perform at a higher level.',
   'Strengthen the leadership capabilities needed to develop employees, navigate complex workplace challenges, improve team effectiveness, and achieve results through others.',
   'People Development, Team Performance, Influence, Results', true, false, null, null)
) as v(name, type, slug, pathway_number, sort_order, tagline, opening_statement, audience, description, leadership_goal, keywords, is_public, enrollment_open, price, price_label)
where not exists (select 1 from public.programs p where p.slug = v.slug);

-- ---------------------------------------------------------------- cohorts
alter table public.cohorts add column if not exists capacity integer check (capacity is null or capacity between 1 and 500);
alter table public.cohorts drop constraint if exists cohorts_status_check;
alter table public.cohorts add constraint cohorts_status_check
  check (status = any (array['draft', 'upcoming', 'active', 'completed', 'archived', 'cancelled']));
-- anon/authenticated column lists gain capacity (not sensitive; used for "spots left")
grant select (capacity) on public.cohorts to anon, authenticated;

-- ---------------------------------------------------------------- inquiries
create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('organization', 'individual')),
  contact_name text not null check (length(contact_name) between 1 and 120),
  organization text check (length(organization) <= 160),
  email text not null check (length(email) <= 254),
  phone text check (length(phone) <= 40),
  organization_type text check (length(organization_type) <= 60),
  pathways text[] not null default '{}',
  participants_estimate text check (length(participants_estimate) <= 40),
  timeline text check (length(timeline) <= 60),
  message text check (length(message) <= 4000),
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'follow_up', 'converted', 'closed')),
  follow_up_on date,
  cohort_id uuid references public.cohorts(id) on delete set null,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists inquiries_status_created_idx on public.inquiries (status, created_at desc);

create table if not exists public.inquiry_notes (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.inquiries(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

alter table public.inquiries enable row level security;
alter table public.inquiry_notes enable row level security;
revoke all on public.inquiries, public.inquiry_notes from anon;
-- Public submissions go through /api/inquiries with the service role; only admins read/manage.
create policy "admin_all" on public.inquiries for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin_read" on public.inquiry_notes for select to authenticated using (is_admin());
create policy "admin_add" on public.inquiry_notes for insert to authenticated with check (is_admin() and author_id = auth.uid());

-- ---------------------------------------------------------------- audit + email logs
create table if not exists public.admin_audit_log (
  id bigserial primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (length(action) <= 80),
  entity_type text check (length(entity_type) <= 40),
  entity_id text check (length(entity_id) <= 80),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from anon;
revoke update, delete on public.admin_audit_log from authenticated;  -- append-only
create policy "admin_read" on public.admin_audit_log for select to authenticated using (is_admin());
create policy "admin_append" on public.admin_audit_log for insert to authenticated with check (is_admin() and actor_id = auth.uid());

create table if not exists public.email_log (
  id bigserial primary key,
  template text not null check (length(template) <= 60),
  recipient text not null check (length(recipient) <= 254),
  subject text check (length(subject) <= 200),
  status text not null check (status in ('sent', 'failed', 'skipped')),
  provider_id text,
  error text check (length(error) <= 500),
  created_at timestamptz not null default now()
);
alter table public.email_log enable row level security;
revoke all on public.email_log from anon;
revoke insert, update, delete on public.email_log from authenticated;  -- written by the server only
create policy "admin_read" on public.email_log for select to authenticated using (is_admin());

-- ---------------------------------------------------------------- explicit grants
-- Stated explicitly rather than relying on Supabase default privileges.
grant select, insert, update, delete on public.inquiries to authenticated;
grant select, insert on public.inquiry_notes to authenticated;
grant select, insert on public.admin_audit_log to authenticated;
grant select on public.email_log to authenticated;
grant all on public.inquiries, public.inquiry_notes, public.admin_audit_log, public.email_log to service_role;
grant usage on sequence public.admin_audit_log_id_seq to authenticated, service_role;
grant usage on sequence public.email_log_id_seq to service_role;

commit;
