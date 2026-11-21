-- Structural replica of the LIVE TLC database (project jpgvclclgnyfguatuihx) as read from
-- its catalog on 2026-11-20: tables, keys, functions, trigger, view, grants and every RLS
-- policy exactly as deployed. Contains no production rows. Local testing only.

create table public.announcements (id uuid not null default gen_random_uuid(), cohort_id uuid, title text not null, body text, created_by uuid, created_at timestamp with time zone default now(), target_role text default 'impact_participant'::text, target_user_id uuid);
create table public.assessments (id uuid not null default gen_random_uuid(), user_id uuid, type text, portal_type text, results jsonb, notes text, completed_at timestamp with time zone default now());
create table public.availability_blocks (id uuid not null default gen_random_uuid(), block_date date not null, block_time text not null, created_at timestamp with time zone default now());
create table public.bookings (id uuid not null default gen_random_uuid(), full_name text not null, email text not null, phone text, reason text, booking_date date not null, booking_time text not null, status text default 'confirmed'::text, created_at timestamp with time zone default now());
create table public.certificates (id uuid not null default gen_random_uuid(), user_id uuid, program_id uuid, cohort_id uuid, issued_at timestamp with time zone default now(), requirements_met jsonb default '{}'::jsonb);
create table public.coaching_goals (id uuid not null default gen_random_uuid(), client_id uuid, title text not null, description text, why_it_matters text, success_measures text, life_domain text, status text default 'active'::text, target_date date, created_at timestamp with time zone default now());
create table public.coaching_sessions (id uuid not null default gen_random_uuid(), client_id uuid, coach_id uuid, title text, scheduled_at timestamp with time zone, zoom_link text, summary text, notes text, status text default 'upcoming'::text, created_at timestamp with time zone default now());
create table public.cohort_enrollments (id uuid not null default gen_random_uuid(), cohort_id uuid, user_id uuid, enrolled_at timestamp with time zone default now(), status text default 'active'::text);
create table public.cohort_messages (id uuid not null default gen_random_uuid(), cohort_id uuid not null, user_id uuid not null, content text not null, created_at timestamp with time zone not null default now());
create table public.cohort_sessions (id uuid not null default gen_random_uuid(), cohort_id uuid, session_number integer not null, title text not null, session_date date, description text, created_at timestamp with time zone default now());
create table public.cohorts (id uuid not null default gen_random_uuid(), program_id uuid, name text not null, start_date date, end_date date, zoom_link text, status text default 'upcoming'::text, created_at timestamp with time zone default now(), session_day text, session_time text, includes text, expectations text, book_title text, book_image_url text, book_purchase_url text, description text);
create table public.community_comments (id uuid not null default gen_random_uuid(), post_id uuid, user_id uuid, body text not null, created_at timestamp with time zone default now());
create table public.community_likes (id uuid not null default gen_random_uuid(), post_id uuid, user_id uuid, created_at timestamp with time zone default now());
create table public.community_posts (id uuid not null default gen_random_uuid(), cohort_id uuid, user_id uuid, body text not null, created_at timestamp with time zone default now());
create table public.development_plans (id uuid not null default gen_random_uuid(), client_id uuid, coaching_objectives text, current_focus text, commitments text, progress_notes text, next_conversation text, updated_at timestamp with time zone default now());
create table public.evaluations (id uuid not null default gen_random_uuid(), user_id uuid, cohort_id uuid, session_id uuid, type text, responses jsonb default '{}'::jsonb, submitted_at timestamp with time zone default now());
create table public.growth_milestones (id uuid not null default gen_random_uuid(), client_id uuid, type text, title text, description text, related_id uuid, milestone_date timestamp with time zone default now(), created_at timestamp with time zone default now());
create table public.impact_entries (id uuid not null default gen_random_uuid(), user_id uuid, category text, title text not null, body text, life_domain text, program_id uuid, created_at timestamp with time zone default now());
create table public.insights (id uuid not null default gen_random_uuid(), client_id uuid, session_id uuid, life_domain text, biggest_insight text, biggest_awareness text, biggest_challenge text, questions_exploring text, commitment text, created_at timestamp with time zone default now());
create table public.journal_entries (id uuid not null default gen_random_uuid(), user_id uuid, portal_type text, title text, body text, life_domain text, program_id uuid, prompt_used text, created_at timestamp with time zone default now());
create table public.journal_prompts (id uuid not null default gen_random_uuid(), prompt text not null, program_id uuid, week_number integer, sort_order integer default 0, created_at timestamp with time zone default now());
create table public.life_domains (id uuid not null default gen_random_uuid(), client_id uuid, name text not null, is_active boolean default true, is_custom boolean default false, created_at timestamp with time zone default now());
create table public.messages (id uuid not null default gen_random_uuid(), sender_id uuid, recipient_id uuid, body text not null, read_at timestamp with time zone, created_at timestamp with time zone default now());
create table public.profiles (id uuid not null, full_name text, email text, phone text, organization text, role text default 'impact_participant'::text, avatar_url text, timezone text default 'America/New_York'::text, notification_preferences jsonb default '{}'::jsonb, created_at timestamp with time zone default now(), hourly_rate numeric);
create table public.program_includes (id uuid not null default gen_random_uuid(), program_id uuid, item text not null, sort_order integer default 0, created_at timestamp with time zone default now());
create table public.programs (id uuid not null default gen_random_uuid(), name text not null, description text, type text default 'cohort'::text, created_at timestamp with time zone default now(), session_day text, session_time text, duration_weeks integer, price integer, price_label text, sort_order integer default 0, leadership_goal text, focus_areas text, motto text, keywords text);
create table public.registrations (id uuid not null default gen_random_uuid(), full_name text not null, email text not null, phone text, organization text, why text, program_id uuid, cohort_id uuid, status text default 'pending'::text, created_at timestamp with time zone default now(), payment_status text default 'unpaid'::text, stripe_session_id text, amount_paid integer);
create table public.resources (id uuid not null default gen_random_uuid(), title text not null, description text, type text, url text, program_id uuid, cohort_id uuid, topic text, life_domain text, portal_type text default 'both'::text, created_at timestamp with time zone default now());
create table public.session_attendance (id uuid not null default gen_random_uuid(), cohort_id uuid, session_number integer not null, user_id uuid, attended boolean default false, recorded_at timestamp with time zone default now());
create table public.weekly_checkins (id uuid not null default gen_random_uuid(), client_id uuid, session_id uuid, went_well text, challenging text, progress text, focus_today text, anything_changed text, submitted_at timestamp with time zone default now());
create table public.weekly_rep_submissions (id uuid not null default gen_random_uuid(), rep_id uuid, user_id uuid, reflection text, completed_at timestamp with time zone default now());
create table public.weekly_reps (id uuid not null default gen_random_uuid(), cohort_id uuid, week_number integer not null, title text not null, instructions text, why_it_matters text, due_date date, created_at timestamp with time zone default now());

do $$ declare t text; begin
  foreach t in array array['announcements','assessments','availability_blocks','bookings','certificates','coaching_goals','coaching_sessions','cohort_enrollments','cohort_messages','cohort_sessions','cohorts','community_comments','community_likes','community_posts','development_plans','evaluations','growth_milestones','impact_entries','insights','journal_entries','journal_prompts','life_domains','messages','profiles','program_includes','programs','registrations','resources','session_attendance','weekly_checkins','weekly_rep_submissions','weekly_reps'] loop
    execute format('alter table public.%I add primary key (id)', t);
  end loop;
end $$;

alter table public.community_likes add constraint community_likes_post_id_user_id_key unique (post_id, user_id);
alter table public.development_plans add constraint development_plans_client_id_key unique (client_id);
alter table public.session_attendance add constraint session_attendance_cohort_id_session_number_user_id_key unique (cohort_id, session_number, user_id);
alter table public.profiles add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade;
alter table public.profiles add constraint profiles_role_check check (role = any (array['admin','coaching_client','impact_participant']));
alter table public.cohorts add constraint cohorts_program_id_fkey foreign key (program_id) references programs(id) on delete cascade;
alter table public.cohort_enrollments add constraint cohort_enrollments_cohort_id_fkey foreign key (cohort_id) references cohorts(id) on delete cascade;
alter table public.cohort_enrollments add constraint cohort_enrollments_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade;
alter table public.cohort_enrollments add constraint cohort_enrollments_status_check check (status = any (array['active','completed','withdrawn']));
alter table public.community_posts add constraint community_posts_cohort_id_fkey foreign key (cohort_id) references cohorts(id) on delete cascade;
alter table public.community_posts add constraint community_posts_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade;
alter table public.community_comments add constraint community_comments_post_id_fkey foreign key (post_id) references community_posts(id) on delete cascade;
alter table public.community_comments add constraint community_comments_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade;
alter table public.community_likes add constraint community_likes_post_id_fkey foreign key (post_id) references community_posts(id) on delete cascade;
alter table public.cohort_messages add constraint cohort_messages_cohort_id_fkey foreign key (cohort_id) references cohorts(id) on delete cascade;
alter table public.cohort_messages add constraint cohort_messages_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade;
alter table public.weekly_reps add constraint weekly_reps_cohort_id_fkey foreign key (cohort_id) references cohorts(id) on delete cascade;
alter table public.weekly_rep_submissions add constraint weekly_rep_submissions_rep_id_fkey foreign key (rep_id) references weekly_reps(id) on delete cascade;
alter table public.messages add constraint messages_sender_id_fkey foreign key (sender_id) references profiles(id) on delete cascade;
alter table public.messages add constraint messages_recipient_id_fkey foreign key (recipient_id) references profiles(id) on delete cascade;

-- Live functions (verbatim bodies)
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin')
$$;
create or replace function public.handle_new_user() returns trigger language plpgsql security definer as $function$
begin
  insert into public.profiles (id, full_name, email, role)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email, coalesce(new.raw_user_meta_data->>'role', 'impact_participant'));
  return new;
end;
$function$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

create view public.booking_availability as select booking_date, booking_time from bookings;

-- Live grants: Supabase defaults give anon and authenticated every privilege on public tables.
grant all on all tables in schema public to anon, authenticated, service_role;
-- cohorts is the one table where anon was narrowed to a column list
revoke all on public.cohorts from anon;
grant select (id, program_id, name, start_date, end_date, status, created_at, session_day, session_time, includes, expectations, book_title, book_image_url, book_purchase_url, description) on public.cohorts to anon;

do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Live policies, verbatim
create policy "Admins can create announcements" on public.announcements for insert to authenticated with check (is_admin());
create policy "Authenticated users can view announcements" on public.announcements for select to authenticated using (true);
create policy "Enrolled users view announcements" on public.announcements for select to public using (((cohort_id IS NULL) OR (EXISTS ( SELECT 1 FROM cohort_enrollments WHERE ((cohort_enrollments.cohort_id = announcements.cohort_id) AND (cohort_enrollments.user_id = auth.uid()) AND (cohort_enrollments.status = 'active'::text))))));
create policy "Admins can delete announcements" on public.announcements for delete to authenticated using (is_admin());
create policy "Admin full access" on public.announcements for all to public using (true);
create policy "Users manage own assessments" on public.assessments for all to public using ((auth.uid() = user_id));
create policy "Admin full access" on public.assessments for all to public using (true);
create policy "Anyone can view availability blocks" on public.availability_blocks for select to authenticated,anon using (true);
create policy "Admins can delete availability blocks" on public.availability_blocks for delete to authenticated using (is_admin());
create policy "Public can view blocks" on public.availability_blocks for select to public using (true);
create policy "Admin full access" on public.availability_blocks for all to public using (true);
create policy "Admins can manage availability blocks" on public.availability_blocks for insert to authenticated with check (is_admin());
create policy "Admins can delete bookings" on public.bookings for delete to authenticated using (is_admin());
create policy "Public can view" on public.bookings for select to public using (true);
create policy "Public can insert" on public.bookings for insert to public with check (true);
create policy "Admin full access" on public.bookings for all to public using (true);
create policy "Admins can view all bookings" on public.bookings for select to authenticated using (is_admin());
create policy "Users view own certificates" on public.certificates for select to public using ((auth.uid() = user_id));
create policy "Admin full access" on public.certificates for all to public using (true);
create policy "Users can view own certificates, admins view all" on public.certificates for select to authenticated using (((auth.uid() = user_id) OR is_admin()));
create policy "Admins can issue certificates" on public.certificates for insert to authenticated with check (is_admin());
create policy "Users manage own goals" on public.coaching_goals for all to public using ((auth.uid() = client_id));
create policy "Admin full access" on public.coaching_goals for all to public using (true);
create policy "Clients view own sessions" on public.coaching_sessions for select to public using ((auth.uid() = client_id));
create policy "Admin full access" on public.coaching_sessions for all to public using (true);
create policy "Coaches view their sessions" on public.coaching_sessions for select to public using ((auth.uid() = coach_id));
create policy "Users can view own enrollments, admins view all" on public.cohort_enrollments for select to authenticated using (((auth.uid() = user_id) OR is_admin()));
create policy "Users view own enrollments" on public.cohort_enrollments for select to public using ((auth.uid() = user_id));
create policy "Admin full access" on public.cohort_enrollments for all to public using (true);
create policy "Admin full access to cohort messages" on public.cohort_messages for all to public using (is_admin()) with check (is_admin());
create policy "Read own cohort messages" on public.cohort_messages for select to public using ((EXISTS ( SELECT 1 FROM cohort_enrollments WHERE ((cohort_enrollments.cohort_id = cohort_messages.cohort_id) AND (cohort_enrollments.user_id = auth.uid()) AND (cohort_enrollments.status = 'active'::text)))));
create policy "Post to own cohort" on public.cohort_messages for insert to public with check (((user_id = auth.uid()) AND (EXISTS ( SELECT 1 FROM cohort_enrollments WHERE ((cohort_enrollments.cohort_id = cohort_messages.cohort_id) AND (cohort_enrollments.user_id = auth.uid()) AND (cohort_enrollments.status = 'active'::text))))));
create policy "Anyone can view cohort sessions" on public.cohort_sessions for select to authenticated,anon using (true);
create policy "Public can view sessions" on public.cohort_sessions for select to public using (true);
create policy "Admin full access" on public.cohort_sessions for all to public using (true);
create policy "Admins can delete cohort sessions" on public.cohort_sessions for delete to authenticated using (is_admin());
create policy "Admins can update cohort sessions" on public.cohort_sessions for update to authenticated using (is_admin()) with check (is_admin());
create policy "Admins can manage cohort sessions" on public.cohort_sessions for insert to authenticated with check (is_admin());
create policy "Anyone can view cohorts" on public.cohorts for select to authenticated,anon using (true);
create policy "Admins can update cohorts" on public.cohorts for update to authenticated using (is_admin()) with check (is_admin());
create policy "Admins can delete cohorts" on public.cohorts for delete to public using (is_admin());
create policy "Admins can insert cohorts" on public.cohorts for insert to authenticated with check (is_admin());
create policy "Authenticated users can insert their own comments" on public.community_comments for insert to authenticated with check ((auth.uid() = user_id));
create policy "Authenticated select all" on public.community_comments for select to public using ((auth.uid() IS NOT NULL));
create policy "Authenticated insert own" on public.community_comments for insert to public with check ((auth.uid() = user_id));
create policy "Users can delete own comments, admins delete any" on public.community_comments for delete to authenticated using (((auth.uid() = user_id) OR is_admin()));
create policy "Authenticated users can view all comments" on public.community_comments for select to authenticated using (true);
create policy "Users manage own likes" on public.community_likes for all to public using ((auth.uid() = user_id));
create policy "Users can remove own likes" on public.community_likes for delete to authenticated using ((auth.uid() = user_id));
create policy "Users can like posts as themselves" on public.community_likes for insert to authenticated with check ((auth.uid() = user_id));
create policy "Authenticated users can view community likes" on public.community_likes for select to authenticated using (true);
create policy "Admin full access" on public.community_likes for all to public using (true);
create policy "Users can delete own posts, admins delete any" on public.community_posts for delete to authenticated using (((auth.uid() = user_id) OR is_admin()));
create policy "Enrolled users view posts" on public.community_posts for select to public using ((EXISTS ( SELECT 1 FROM cohort_enrollments WHERE ((cohort_enrollments.cohort_id = community_posts.cohort_id) AND (cohort_enrollments.user_id = auth.uid()) AND (cohort_enrollments.status = 'active'::text)))));
create policy "Enrolled users create posts" on public.community_posts for insert to public with check (((auth.uid() = user_id) AND (EXISTS ( SELECT 1 FROM cohort_enrollments WHERE ((cohort_enrollments.cohort_id = community_posts.cohort_id) AND (cohort_enrollments.user_id = auth.uid()) AND (cohort_enrollments.status = 'active'::text))))));
create policy "Users delete own posts" on public.community_posts for delete to public using ((auth.uid() = user_id));
create policy "Admin full access" on public.community_posts for all to public using (true);
create policy "Users manage own posts" on public.community_posts for all to public using ((auth.uid() = user_id));
create policy "Authenticated users can view community posts" on public.community_posts for select to authenticated using (true);
create policy "Users can create own community posts" on public.community_posts for insert to authenticated with check ((auth.uid() = user_id));
create policy "Users can edit own community posts" on public.community_posts for update to authenticated using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy "Users manage own plan" on public.development_plans for all to public using ((auth.uid() = client_id));
create policy "Admin full access" on public.development_plans for all to public using (true);
create policy "Users manage own evaluations" on public.evaluations for all to public using ((auth.uid() = user_id));
create policy "Admin full access" on public.evaluations for all to public using (true);
create policy "Users manage own milestones" on public.growth_milestones for all to public using ((auth.uid() = client_id));
create policy "Admin full access" on public.growth_milestones for all to public using (true);
create policy "Users manage own impact" on public.impact_entries for all to public using ((auth.uid() = user_id));
create policy "Admin full access" on public.impact_entries for all to public using (true);
create policy "Admin full access" on public.insights for all to public using (true);
create policy "Users manage own insights" on public.insights for all to public using ((auth.uid() = client_id));
create policy "Admin full access" on public.journal_entries for all to public using (true);
create policy "Users manage own entries" on public.journal_entries for all to public using ((auth.uid() = user_id));
create policy "Users can create own journal entries" on public.journal_entries for insert to authenticated with check ((auth.uid() = user_id));
create policy "Users can view own journal entries" on public.journal_entries for select to authenticated using ((auth.uid() = user_id));
create policy "Users manage own journal" on public.journal_entries for all to public using ((auth.uid() = user_id));
create policy "Public can view" on public.journal_prompts for select to public using (true);
create policy "Admin full access" on public.journal_prompts for all to public using (true);
create policy "Authenticated users can view journal prompts" on public.journal_prompts for select to authenticated using (true);
create policy "Admins can delete journal prompts" on public.journal_prompts for delete to authenticated using (is_admin());
create policy "Admins can create journal prompts" on public.journal_prompts for insert to authenticated with check (is_admin());
create policy "Users manage own domains" on public.life_domains for all to public using ((auth.uid() = client_id));
create policy "Admin full access" on public.life_domains for all to public using (true);
create policy "Users send messages" on public.messages for insert to public with check ((auth.uid() = sender_id));
create policy "Users can send messages as themselves" on public.messages for insert to authenticated with check ((auth.uid() = sender_id));
create policy "Users can view their own conversations" on public.messages for select to authenticated using (((auth.uid() = sender_id) OR (auth.uid() = recipient_id)));
create policy "Admin full access" on public.messages for all to public using (true);
create policy "Users see own messages" on public.messages for select to public using (((auth.uid() = sender_id) OR (auth.uid() = recipient_id)));
create policy "Users view own profile" on public.profiles for select to public using ((auth.uid() = id));
create policy "Users update own profile" on public.profiles for update to public using ((auth.uid() = id));
create policy "Allow all reads temporarily" on public.profiles for select to public using (true);
create policy "Admin full access" on public.profiles for all to public using (true);
create policy "Authenticated users can view all profiles" on public.profiles for select to authenticated using (true);
create policy "Admins can update any profile" on public.profiles for update to authenticated using (is_admin()) with check (is_admin());
create policy "Admin full access" on public.program_includes for all to public using (true);
create policy "Public can view includes" on public.program_includes for select to public using (true);
create policy "Anyone can view program includes" on public.program_includes for select to authenticated,anon using (true);
create policy "Admins can update programs" on public.programs for update to authenticated using (is_admin()) with check (is_admin());
create policy "Anyone can view programs" on public.programs for select to authenticated,anon using (true);
create policy "Admin full access" on public.programs for all to public using (true);
create policy "Admins can update registrations" on public.registrations for update to authenticated using (is_admin()) with check (is_admin());
create policy "Admins can view all registrations" on public.registrations for select to authenticated using (is_admin());
create policy "Public can insert" on public.registrations for insert to public with check (true);
create policy "Admin full access" on public.registrations for all to public using (true);
create policy "Admins can create resources" on public.resources for insert to authenticated with check (is_admin());
create policy "Authenticated users can view resources" on public.resources for select to authenticated using (true);
create policy "Users view resources" on public.resources for select to public using (((portal_type = 'both'::text) OR (cohort_id IS NULL) OR (EXISTS ( SELECT 1 FROM cohort_enrollments WHERE ((cohort_enrollments.cohort_id = resources.cohort_id) AND (cohort_enrollments.user_id = auth.uid()) AND (cohort_enrollments.status = 'active'::text))))));
create policy "Admin full access" on public.resources for all to public using (true);
create policy "Admins can delete resources" on public.resources for delete to authenticated using (is_admin());
create policy "Users view own attendance" on public.session_attendance for select to public using ((auth.uid() = user_id));
create policy "Admin full access" on public.session_attendance for all to public using (true);
create policy "Users can view own checkins, admins view all" on public.weekly_checkins for select to authenticated using (((auth.uid() = client_id) OR is_admin()));
create policy "Users can submit own checkins" on public.weekly_checkins for insert to authenticated with check ((auth.uid() = client_id));
create policy "Users manage own checkins" on public.weekly_checkins for all to public using ((auth.uid() = client_id));
create policy "Admin full access" on public.weekly_checkins for all to public using (true);
create policy "Admin full access" on public.weekly_rep_submissions for all to public using (true);
create policy "Users manage own submissions" on public.weekly_rep_submissions for all to public using ((auth.uid() = user_id));
create policy "Users can view own rep submissions" on public.weekly_rep_submissions for select to authenticated using ((auth.uid() = user_id));
create policy "Users can submit own rep reflections" on public.weekly_rep_submissions for insert to authenticated with check ((auth.uid() = user_id));
create policy "Enrolled users view reps" on public.weekly_reps for select to public using ((EXISTS ( SELECT 1 FROM cohort_enrollments WHERE ((cohort_enrollments.cohort_id = weekly_reps.cohort_id) AND (cohort_enrollments.user_id = auth.uid()) AND (cohort_enrollments.status = 'active'::text)))));
create policy "Admin full access" on public.weekly_reps for all to public using (true);
create policy "Authenticated users can view weekly reps" on public.weekly_reps for select to authenticated using (true);
create policy "Admins can create weekly reps" on public.weekly_reps for insert to authenticated with check (is_admin());
create policy "Admins can delete weekly reps" on public.weekly_reps for delete to authenticated using (is_admin());
