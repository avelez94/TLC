-- Phase 2 access matrix (after lockdown + 2a + 2b). Same harness as 03_checks.sql.
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

-- ---------- participant P1 (cohort C1)
set role authenticated; select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', false);
select pg_temp.t('P1', 'directory: names of visible people', 'select count(full_name)::text from profiles', '3');
select pg_temp.t('P1', 'read a peer email', $q$select email from profiles where id='00000000-0000-0000-0000-0000000000b3'$q$, 'denied');
select pg_temp.t('P1', 'read phones / hourly rates', 'select count(phone)::text from profiles', 'denied');
select pg_temp.t('P1', 'select * from profiles', 'select count(*)::text from (select * from profiles) x', 'denied');
select pg_temp.t('P1', 'own full profile via my_profile()', 'select email from my_profile()', 'p1@example.test');
select pg_temp.t('P1', 'read zoom links directly', 'select count(zoom_link)::text from cohorts', 'denied');
select pg_temp.t('P1', 'meeting links: own cohort only', 'select string_agg(zoom_link, '','') from cohort_meeting_links()', 'https://zoom.example/one');
select pg_temp.t('P1', 'cohort public columns still readable', 'select count(name)::text from cohorts', '2');
select pg_temp.t('P1', 'call rate limiter', $q$select rate_limit_hit('x', 5, 60)::text$q$, 'denied');
select pg_temp.t('P1', 'new journal entry (live columns)', $q$with x as (insert into journal_entries(user_id, portal_type, body, prompt_used) values (auth.uid(), 'impact', 'note', 'prompt') returning 1) select count(*)::text from x$q$, '1');
select pg_temp.t('P1', 'edit own journal entry', $q$with x as (update journal_entries set body='edited' where user_id=auth.uid() returning 1) select count(*)::text from x$q$, '1');
select pg_temp.t('P1', 'write journal as someone else', $q$with x as (insert into journal_entries(user_id, portal_type, body) values ('00000000-0000-0000-0000-0000000000b3', 'impact', 'x') returning 1) select count(*)::text from x$q$, 'denied');
select pg_temp.t('P1', 'view own previous rep submission', 'select count(*)::text from weekly_rep_submissions', '1');
select pg_temp.t('P1', 'submit same rep twice', $q$with x as (insert into weekly_rep_submissions(rep_id, user_id, reflection) values ('00000000-0000-0000-0000-00000000cc01', auth.uid(), 'again') returning 1) select count(*)::text from x$q$, 'denied');
select pg_temp.t('P1', 'submit a rep from another cohort', $q$with x as (insert into weekly_rep_submissions(rep_id, user_id, reflection) values ('00000000-0000-0000-0000-00000000cc02', auth.uid(), 'x') returning 1) select count(*)::text from x$q$, 'denied');
reset role;

-- ---------- P3 (same cohort): new rep submission, peer privacy
insert into public.weekly_reps (id, cohort_id, week_number, title) values ('00000000-0000-0000-0000-00000000cc03', '00000000-0000-0000-0000-0000000c0001', 2, 'C1 rep 2');
set role authenticated; select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b3","role":"authenticated"}', false);
select pg_temp.t('P3', 'submit rep in own cohort', $q$with x as (insert into weekly_rep_submissions(rep_id, user_id, reflection) values ('00000000-0000-0000-0000-00000000cc03', auth.uid(), 'mine') returning 1) select count(*)::text from x$q$, '1');
select pg_temp.t('P3', 'edit peer journal', $q$with x as (update journal_entries set body='x' where user_id='00000000-0000-0000-0000-0000000000b1' returning 1) select count(*)::text from x$q$, '0');
select pg_temp.t('P3', 'read peer reflection', $q$select count(*)::text from weekly_rep_submissions where user_id='00000000-0000-0000-0000-0000000000b1'$q$, '0');
reset role;

-- ---------- outsider and coaching client
set role authenticated; select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', false);
select pg_temp.t('O', 'meeting links (no cohort)', 'select count(*)::text from cohort_meeting_links()', '0');
reset role;
set role authenticated; select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', false);
select pg_temp.t('K', 'coaching client own phone via my_profile()', 'select phone from my_profile()', '555-0100');
select pg_temp.t('K', 'coach name for messaging', $q$select count(full_name)::text from profiles where role='admin'$q$, '1');
reset role;

-- ---------- admin
set role authenticated; select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', false);
select pg_temp.t('A', 'all meeting links', 'select count(*)::text from cohort_meeting_links()', '2');
select pg_temp.t('A', 'edit a zoom link', $q$with x as (update cohorts set zoom_link='https://zoom.example/new' where id='00000000-0000-0000-0000-0000000c0001' returning 1) select count(*)::text from x$q$, '1');
select pg_temp.t('A', 'change role (no select on other columns needed)', $q$with x as (update profiles set role='coaching_client' where id='00000000-0000-0000-0000-0000000000d1' returning id) select count(*)::text from x$q$, '1');
select pg_temp.t('A', 'participant journals stay private', 'select count(*)::text from journal_entries', '0');
select pg_temp.t('A', 'participant reflections stay private', 'select count(*)::text from weekly_rep_submissions', '0');
select pg_temp.t('A', 'enroll same person twice', $q$with x as (insert into cohort_enrollments(cohort_id, user_id) values ('00000000-0000-0000-0000-0000000c0001', '00000000-0000-0000-0000-0000000000b1') returning 1) select count(*)::text from x$q$, 'denied');
reset role;

-- ---------- service role (server routes)
set role service_role;
select pg_temp.t('service', 'rate limiter allows 2 of 2', $q$select (rate_limit_hit('t', 2, 3600) and rate_limit_hit('t', 2, 3600))::text$q$, 'true');
select pg_temp.t('service', 'rate limiter blocks the 3rd', $q$select (rate_limit_hit('u', 2, 3600) and rate_limit_hit('u', 2, 3600) and not rate_limit_hit('u', 2, 3600))::text$q$, 'true');
select pg_temp.t('service', 'second registration for same Stripe session', $q$with x as (insert into registrations(full_name, email, stripe_session_id) values ('a','a@x.test','cs_test_1'), ('b','b@x.test','cs_test_1') returning 1) select count(*)::text from x$q$, 'denied');
select pg_temp.t('service', 'notification columns exist', $q$select count(paid_at)::text from registrations$q$, '0');
reset role;

\o
select n, actor, check_name, expected, got, case when expected = got then 'PASS' else 'FAIL' end as result from pg_temp.results order by n;
select count(*) filter (where expected = got) as passed, count(*) filter (where expected <> got) as failed, count(*) as total from pg_temp.results;
