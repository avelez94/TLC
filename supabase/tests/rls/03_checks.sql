-- Access matrix. Each check runs as a given role/user inside a sub-transaction that is
-- always rolled back, so checks never affect each other. "denied" = Postgres refused.
-- Expected values describe the SECURE state (after the lockdown migration).
\set ON_ERROR_STOP on
drop table if exists pg_temp.results;
create temp table results (n serial, actor text, check_name text, expected text, got text);
grant all on pg_temp.results to public;
grant usage on sequence pg_temp.results_n_seq to public;
\o /dev/null

create or replace function pg_temp.t(p_actor text, p_name text, p_sql text, p_expect text) returns void
language plpgsql as $$
declare v_got text;
begin
  begin
    execute p_sql into v_got;
    raise exception using errcode = 'P0001', message = '__rollback__';
  exception when others then
    if sqlerrm <> '__rollback__' then v_got := 'denied'; end if;
  end;
  insert into pg_temp.results (actor, check_name, expected, got) values (p_actor, p_name, p_expect, coalesce(v_got, 'null'));
end $$;

-- ------------------------------------------------------------------ anonymous visitor
set role anon; select set_config('request.jwt.claims', '{}', false);
select pg_temp.t('anon', 'read profiles (emails, phones)', 'select count(*)::text from profiles', 'denied');
select pg_temp.t('anon', 'read registrations', 'select count(*)::text from registrations', 'denied');
select pg_temp.t('anon', 'read private journals', 'select count(*)::text from journal_entries', 'denied');
select pg_temp.t('anon', 'read rep reflections', 'select count(*)::text from weekly_rep_submissions', 'denied');
select pg_temp.t('anon', 'read 1:1 messages', 'select count(*)::text from messages', 'denied');
select pg_temp.t('anon', 'read cohort chat', 'select count(*)::text from cohort_messages', 'denied');
select pg_temp.t('anon', 'read coaching check-ins', 'select count(*)::text from weekly_checkins', 'denied');
select pg_temp.t('anon', 'read bookings', 'select count(*)::text from bookings', 'denied');
select pg_temp.t('anon', 'make someone admin', $q$with x as (update profiles set role='admin' where id='00000000-0000-0000-0000-0000000000d1' returning 1) select count(*)::text from x$q$, 'denied');
select pg_temp.t('anon', 'delete all journals', 'with x as (delete from journal_entries returning 1) select count(*)::text from x', 'denied');
select pg_temp.t('anon', 'insert fake registration', $q$with x as (insert into registrations(full_name,email) values ('x','x@x.test') returning 1) select count(*)::text from x$q$, 'denied');
select pg_temp.t('anon', 'write bookings via view', $q$with x as (insert into booking_availability(booking_date,booking_time) values ('2026-12-02','11:00') returning 1) select count(*)::text from x$q$, 'denied');
select pg_temp.t('anon', 'change a program price', 'with x as (update programs set price = 1 returning 1) select count(*)::text from x', 'denied');
select pg_temp.t('anon', 'read programs (public page)', 'select count(*)::text from programs', '1');
select pg_temp.t('anon', 'read cohort public columns', 'select count(name)::text from cohorts', '2');
select pg_temp.t('anon', 'read cohort zoom links', 'select count(zoom_link)::text from cohorts', 'denied');
select pg_temp.t('anon', 'read session schedule', 'select count(*)::text from cohort_sessions', '1');
select pg_temp.t('anon', 'read bookings through view', 'select count(*)::text from booking_availability', 'denied');
select pg_temp.t('anon', 'can call trigger function via API', $q$select has_function_privilege('anon','public.handle_new_user()','execute')::text$q$, 'false');
reset role;

-- ------------------------------------------------------------------ participant P1 (cohort C1)
set role authenticated; select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', false);
select pg_temp.t('P1', 'profiles visible (self, admin, C1 peer)', 'select count(*)::text from profiles', '3');
select pg_temp.t('P1', 'see coaching client hourly rate', $q$select count(*)::text from profiles where hourly_rate is not null$q$, '0');
select pg_temp.t('P1', 'promote self to admin', $q$with x as (update profiles set role='admin' where id=auth.uid() returning 1) select count(*)::text from x$q$, '0');
select pg_temp.t('P1', 'read own cohort posts only', 'select string_agg(body, '','') from community_posts', 'C1 post');
select pg_temp.t('P1', 'read own cohort comments only', 'select string_agg(body, '','') from community_comments', 'C1 comment');
select pg_temp.t('P1', 'post in own cohort', $q$with x as (insert into community_posts(cohort_id,user_id,body) values ('00000000-0000-0000-0000-0000000c0001',auth.uid(),'hi') returning 1) select count(*)::text from x$q$, '1');
select pg_temp.t('P1', 'post in another cohort', $q$with x as (insert into community_posts(cohort_id,user_id,body) values ('00000000-0000-0000-0000-0000000c0002',auth.uid(),'hi') returning 1) select count(*)::text from x$q$, 'denied');
select pg_temp.t('P1', 'post as someone else', $q$with x as (insert into community_posts(cohort_id,user_id,body) values ('00000000-0000-0000-0000-0000000c0001','00000000-0000-0000-0000-0000000000b3','hi') returning 1) select count(*)::text from x$q$, 'denied');
select pg_temp.t('P1', 'comment on another cohort post', $q$with x as (insert into community_comments(post_id,user_id,body) values ('00000000-0000-0000-0000-00000000aa02',auth.uid(),'hi') returning 1) select count(*)::text from x$q$, 'denied');
select pg_temp.t('P1', 'like own cohort post', $q$with x as (insert into community_likes(post_id,user_id) values ('00000000-0000-0000-0000-00000000aa01',auth.uid()) returning 1) select count(*)::text from x$q$, '1');
select pg_temp.t('P1', 'edit another member post', $q$with x as (update community_posts set body='x' where id='00000000-0000-0000-0000-00000000aa02' returning 1) select count(*)::text from x$q$, '0');
select pg_temp.t('P1', 'read own cohort chat only', 'select string_agg(content, '','') from cohort_messages', 'C1 chat');
select pg_temp.t('P1', 'send chat to own cohort', $q$with x as (insert into cohort_messages(cohort_id,user_id,content) values ('00000000-0000-0000-0000-0000000c0001',auth.uid(),'yo') returning 1) select count(*)::text from x$q$, '1');
select pg_temp.t('P1', 'send chat to another cohort', $q$with x as (insert into cohort_messages(cohort_id,user_id,content) values ('00000000-0000-0000-0000-0000000c0002',auth.uid(),'yo') returning 1) select count(*)::text from x$q$, 'denied');
select pg_temp.t('P1', 'delete cohort chat', 'with x as (delete from cohort_messages returning 1) select count(*)::text from x', '0');
select pg_temp.t('P1', 'members list (own cohort)', 'select count(*)::text from cohort_enrollments', '2');
select pg_temp.t('P1', 'weekly reps (own cohort)', 'select string_agg(title, '','') from weekly_reps', 'C1 rep');
select pg_temp.t('P1', 'own journal', 'select count(*)::text from journal_entries', '1');
select pg_temp.t('P1', 'own rep reflection', 'select count(*)::text from weekly_rep_submissions', '1');
select pg_temp.t('P1', 'read registrations', 'select count(*)::text from registrations', '0');
select pg_temp.t('P1', 'announcements (global only)', 'select string_agg(title, '','') from announcements', 'Global');
select pg_temp.t('P1', 'resources (shared only)', 'select string_agg(title, '','') from resources', 'Shared file');
select pg_temp.t('P1', 'message another participant', $q$with x as (insert into messages(sender_id,recipient_id,body) values (auth.uid(),'00000000-0000-0000-0000-0000000000b2','hi') returning 1) select count(*)::text from x$q$, 'denied');
select pg_temp.t('P1', 'read others 1:1 messages', 'select count(*)::text from messages', '0');
select pg_temp.t('P1', 'create a cohort', $q$with x as (insert into cohorts(name) values ('x') returning 1) select count(*)::text from x$q$, 'denied');
reset role;

-- ------------------------------------------------------------------ participant P3 (same cohort as P1)
set role authenticated; select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b3","role":"authenticated"}', false);
select pg_temp.t('P3', 'read peer P1 journal', 'select count(*)::text from journal_entries', '0');
select pg_temp.t('P3', 'read peer P1 reflection', 'select count(*)::text from weekly_rep_submissions', '0');
reset role;

-- ------------------------------------------------------------------ outsider O (signed in, no cohort)
set role authenticated; select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', false);
select pg_temp.t('O', 'profiles visible (self + admin)', 'select count(*)::text from profiles', '2');
select pg_temp.t('O', 'read any cohort posts', 'select count(*)::text from community_posts', '0');
select pg_temp.t('O', 'read any cohort chat', 'select count(*)::text from cohort_messages', '0');
reset role;

-- ------------------------------------------------------------------ coaching client K
set role authenticated; select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', false);
select pg_temp.t('K', 'coaching portal loads admin profile', $q$select count(*)::text from profiles where role='admin'$q$, '1');
select pg_temp.t('K', 'own 1:1 thread', 'select count(*)::text from messages', '1');
select pg_temp.t('K', 'message the coach', $q$with x as (insert into messages(sender_id,recipient_id,body) values (auth.uid(),'00000000-0000-0000-0000-0000000000a1','hi') returning 1) select count(*)::text from x$q$, '1');
select pg_temp.t('K', 'submit own check-in', $q$with x as (insert into weekly_checkins(client_id,went_well) values (auth.uid(),'ok') returning 1) select count(*)::text from x$q$, '1');
select pg_temp.t('K', 'change own hourly rate', $q$with x as (update profiles set hourly_rate=1 where id=auth.uid() returning 1) select count(*)::text from x$q$, '0');
select pg_temp.t('K', 'read cohort community', 'select count(*)::text from community_posts', '0');
reset role;

-- ------------------------------------------------------------------ defence in depth: guard trigger alone
-- Temporarily add an over-broad self-update policy (as a future mistake might) and confirm
-- the trigger still blocks role and hourly-rate changes while allowing ordinary edits.
create policy "test_only_self_update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
set role authenticated; select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', false);
select pg_temp.t('guard', 'self-promote despite permissive policy', $q$with x as (update profiles set role='admin' where id=auth.uid() returning 1) select count(*)::text from x$q$, 'denied');
select pg_temp.t('guard', 'set own hourly rate despite permissive policy', $q$with x as (update profiles set hourly_rate=1 where id=auth.uid() returning 1) select count(*)::text from x$q$, 'denied');
select pg_temp.t('guard', 'ordinary self edit still allowed', $q$with x as (update profiles set full_name='Pat 1' where id=auth.uid() returning 1) select count(*)::text from x$q$, '1');
reset role;
drop policy "test_only_self_update" on public.profiles;

-- ------------------------------------------------------------------ admin A
set role authenticated; select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', false);
select pg_temp.t('A', 'all profiles', 'select count(*)::text from profiles', '6');
select pg_temp.t('A', 'registrations', 'select count(*)::text from registrations', '1');
select pg_temp.t('A', 'confirm registration', $q$with x as (update registrations set status='confirmed' returning 1) select count(*)::text from x$q$, '1');
select pg_temp.t('A', 'change a user role', $q$with x as (update profiles set role='coaching_client' where id='00000000-0000-0000-0000-0000000000d1' returning 1) select count(*)::text from x$q$, '1');
select pg_temp.t('A', 'set hourly rate', $q$with x as (update profiles set hourly_rate=175 where id='00000000-0000-0000-0000-0000000000c1' returning 1) select count(*)::text from x$q$, '1');
select pg_temp.t('A', 'participant journals stay private', 'select count(*)::text from journal_entries', '0');
select pg_temp.t('A', 'participant reflections stay private', 'select count(*)::text from weekly_rep_submissions', '0');
select pg_temp.t('A', 'create cohort', $q$with x as (insert into cohorts(name,program_id) values ('New','00000000-0000-0000-0000-00000000f001') returning 1) select count(*)::text from x$q$, '1');
select pg_temp.t('A', 'delete cohort', $q$with x as (delete from cohorts where id='00000000-0000-0000-0000-0000000c0002' returning 1) select count(*)::text from x$q$, '1');
select pg_temp.t('A', 'edit weekly rep', $q$with x as (update weekly_reps set title='t' returning 1) select count(*)::text from x$q$, '2');
select pg_temp.t('A', 'update program price', $q$with x as (update programs set price=97 returning 1) select count(*)::text from x$q$, '1');
select pg_temp.t('A', 'all cohort chat', 'select count(*)::text from cohort_messages', '2');
select pg_temp.t('A', 'chat in any cohort', $q$with x as (insert into cohort_messages(cohort_id,user_id,content) values ('00000000-0000-0000-0000-0000000c0002',auth.uid(),'hello') returning 1) select count(*)::text from x$q$, '1');
select pg_temp.t('A', 'delete chat message', $q$with x as (delete from cohort_messages where id='00000000-0000-0000-0000-00000000bb02' returning 1) select count(*)::text from x$q$, '1');
select pg_temp.t('A', 'post to a cohort', $q$with x as (insert into community_posts(cohort_id,user_id,body) values ('00000000-0000-0000-0000-0000000c0001',auth.uid(),'from admin') returning 1) select count(*)::text from x$q$, '1');
select pg_temp.t('A', 'delete member post', $q$with x as (delete from community_posts where id='00000000-0000-0000-0000-00000000aa02' returning 1) select count(*)::text from x$q$, '1');
select pg_temp.t('A', 'read coaching check-ins', 'select count(*)::text from weekly_checkins', '1');
select pg_temp.t('A', 'post announcement', $q$with x as (insert into announcements(title) values ('n') returning 1) select count(*)::text from x$q$, '1');
select pg_temp.t('A', 'issue certificate', $q$with x as (insert into certificates(user_id,program_id) values ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-00000000f001') returning 1) select count(*)::text from x$q$, '1');
reset role;

-- ------------------------------------------------------------------ sign-up and service role
-- Simulates Supabase Auth creating a user who asked for role "admin" in sign-up metadata.
set role supabase_auth_admin;  -- the role Supabase Auth uses when it creates users
insert into auth.users(email, raw_user_meta_data) values ('evil@example.test', '{"role":"admin"}');
reset role;
select pg_temp.t('signup', 'self sign-up requesting admin role', $q$select role from profiles where email = 'evil@example.test'$q$, 'impact_participant');
set role service_role;
select pg_temp.t('service', 'invite route sets role', $q$with x as (update profiles set role='coaching_client' where id='00000000-0000-0000-0000-0000000000b2' returning 1) select count(*)::text from x$q$, '1');
reset role;

\o
select n, actor, check_name, expected, got,
  case when expected = got then 'PASS' else 'FAIL' end as result
from pg_temp.results order by n;
select count(*) filter (where expected = got) as passed, count(*) filter (where expected <> got) as failed, count(*) as total from pg_temp.results;
