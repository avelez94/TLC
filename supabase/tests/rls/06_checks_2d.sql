-- 2d: admin hardening (after lockdown + 2a + 2b + 2c + 2d). Same harness as 05_checks_2c.sql.
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
-- Like t(), but returns the error text instead of 'denied' (to check the reason).
create or replace function pg_temp.e(p_actor text, p_name text, p_sql text, p_expect text) returns void
language plpgsql as $$
declare v_got text;
begin
  begin
    execute p_sql into v_got;
    raise exception using errcode = 'P0001', message = '__rollback__';
  exception when others then
    if sqlerrm <> '__rollback__' then v_got := sqlerrm; end if;
  end;
  insert into pg_temp.results (actor, check_name, expected, got) values (p_actor, p_name, p_expect, coalesce(v_got, 'null'));
end $$;

-- ---------- extra fixtures (all invented)
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a2', 'admin2@example.test', '{"full_name":"Admin B"}');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000a2';
insert into auth.mfa_factors (user_id, status) values ('00000000-0000-0000-0000-0000000000a2', 'verified');
update public.cohort_enrollments set status = 'withdrawn'
 where user_id = '00000000-0000-0000-0000-0000000000b3';  -- P3 withdrew from C1
insert into public.resources (id, title, portal_type, program_id, cohort_id, type) values
  ('00000000-0000-0000-0000-0000000e0001', 'Test Program guide', 'impact', '00000000-0000-0000-0000-00000000f001', null, 'pdf'),
  ('00000000-0000-0000-0000-0000000e0002', 'Emerging Leaders guide', 'impact', (select id from programs where slug = 'emerging-leaders'), null, 'pdf'),
  ('00000000-0000-0000-0000-0000000e0003', 'Coaching worksheet', 'coaching', null, null, 'worksheet'),
  ('00000000-0000-0000-0000-0000000e0004', 'Shared reading', 'both', null, null, 'article');
update public.programs set is_public = false where slug = 'new-leaders';

-- ---------- anonymous visitor
set role anon; select set_config('request.jwt.claims', '{}', false);
select pg_temp.t('anon', 'hidden pathway not readable', $q$select count(*)::text from programs where slug = 'new-leaders'$q$, '0');
select pg_temp.t('anon', 'non-public programs not readable', 'select count(*)::text from programs where not is_public', '0');
select pg_temp.t('anon', 'public pathways still readable', $q$select count(*)::text from programs where slug in ('emerging-leaders','practicing-leaders')$q$, '2');
select pg_temp.t('anon', 'read MFA mode', 'select public.admin_mfa_mode()', 'denied');
select pg_temp.t('anon', 'read resources', 'select count(*)::text from resources', 'denied');
reset role;

-- ---------- MFA modes (admin A has no authenticator; admin B has a verified one)
\set A_AAL1 '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal1"}'
\set A_AAL2 '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal2"}'
\set B_AAL1 '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated","aal":"aal1"}'
\set B_AAL2 '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated","aal":"aal2"}'
\set P1_AAL2 '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated","aal":"aal2"}'

set role authenticated;
select set_config('request.jwt.claims', :'A_AAL1', false);
select pg_temp.t('A aal1', 'mode off: admin', 'select is_admin()::text', 'true');
select pg_temp.t('A aal1', 'mode is readable', 'select public.admin_mfa_mode()', 'off');
select pg_temp.t('A aal1', 'read settings table', 'select count(*)::text from app_private.settings', 'denied');
select pg_temp.t('A aal1', 'change MFA mode', $q$with x as (update app_private.settings set value = '"off"' returning 1) select count(*)::text from x$q$, 'denied');
select set_config('request.jwt.claims', :'B_AAL1', false);
select pg_temp.t('B aal1', 'mode off: admin even with authenticator', 'select is_admin()::text', 'true');
reset role;

update app_private.settings set value = '"enrolled"' where key = 'admin_mfa_mode';
set role authenticated;
select set_config('request.jwt.claims', :'B_AAL1', false);
select pg_temp.t('B aal1', 'mode enrolled: enrolled admin needs code', 'select is_admin()::text', 'false');
select pg_temp.t('B aal1', 'mode enrolled: no inquiry access without code', 'select count(*)::text from inquiries', '0');
select set_config('request.jwt.claims', :'B_AAL2', false);
select pg_temp.t('B aal2', 'mode enrolled: with code', 'select is_admin()::text', 'true');
select set_config('request.jwt.claims', :'A_AAL1', false);
select pg_temp.t('A aal1', 'mode enrolled: not yet enrolled admin still works', 'select is_admin()::text', 'true');
reset role;

update app_private.settings set value = '"required"' where key = 'admin_mfa_mode';
set role authenticated;
select set_config('request.jwt.claims', :'A_AAL1', false);
select pg_temp.t('A aal1', 'mode required: no code, not admin', 'select is_admin()::text', 'false');
select pg_temp.t('A aal1', 'mode required: cannot edit pathways', $q$with x as (update programs set tagline = 'x' where slug = 'emerging-leaders' returning 1) select count(*)::text from x$q$, '0');
select pg_temp.t('A aal1', 'mode required: cannot read registrations', 'select count(*)::text from registrations', '0');
select pg_temp.t('A aal1', 'mode required: can still read own profile', $q$select count(*)::text from profiles where id = auth.uid()$q$, '1');
select set_config('request.jwt.claims', :'A_AAL2', false);
select pg_temp.t('A aal2', 'mode required: with code', 'select is_admin()::text', 'true');
select pg_temp.t('A aal2', 'security overview', $q$select jsonb_array_length(admin_security_status()->'admins')::text$q$, '2');
select set_config('request.jwt.claims', :'P1_AAL2', false);
select pg_temp.t('P1 aal2', 'participant with code is not admin', 'select is_admin()::text', 'false');
select pg_temp.t('P1 aal2', 'security overview', 'select admin_security_status()::text', 'denied');
reset role;
update app_private.settings set value = '"off"' where key = 'admin_mfa_mode';

-- ---------- resources (R1 Test Program, R2 Emerging Leaders, R3 coaching, R4 shared, C2 impact file, Shared file)
\set P1 '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}'
\set P2 '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}'
\set P3 '{"sub":"00000000-0000-0000-0000-0000000000b3","role":"authenticated"}'
\set K '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}'
\set O '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}'
set role authenticated;
select set_config('request.jwt.claims', :'P1', false);
select pg_temp.t('P1', 'own program resource', $q$select count(*)::text from resources where id = '00000000-0000-0000-0000-0000000e0001'$q$, '1');
select pg_temp.t('P1', 'other program resource', $q$select count(*)::text from resources where id = '00000000-0000-0000-0000-0000000e0002'$q$, '0');
select pg_temp.t('P1', 'coaching resource', $q$select count(*)::text from resources where id = '00000000-0000-0000-0000-0000000e0003'$q$, '0');
select pg_temp.t('P1', 'shared resource', $q$select count(*)::text from resources where id = '00000000-0000-0000-0000-0000000e0004'$q$, '1');
select pg_temp.t('P1', 'other cohort file', $q$select count(*)::text from resources where title = 'C2 impact file'$q$, '0');
select set_config('request.jwt.claims', :'P2', false);
select pg_temp.t('P2', 'own cohort file', $q$select count(*)::text from resources where title = 'C2 impact file'$q$, '1');
select set_config('request.jwt.claims', :'P3', false);
select pg_temp.t('P3 withdrawn', 'program resource after withdrawal', $q$select count(*)::text from resources where id = '00000000-0000-0000-0000-0000000e0001'$q$, '0');
select set_config('request.jwt.claims', :'K', false);
select pg_temp.t('K coaching', 'coaching resource', $q$select count(*)::text from resources where id = '00000000-0000-0000-0000-0000000e0003'$q$, '1');
select pg_temp.t('K coaching', 'impact program resource', $q$select count(*)::text from resources where id = '00000000-0000-0000-0000-0000000e0001'$q$, '0');
select pg_temp.t('K coaching', 'impact cohort file', $q$select count(*)::text from resources where title = 'C2 impact file'$q$, '0');
select pg_temp.t('K coaching', 'shared resource', $q$select count(*)::text from resources where id = '00000000-0000-0000-0000-0000000e0004'$q$, '1');
select set_config('request.jwt.claims', :'O', false);
select pg_temp.t('O no cohort', 'any resource', 'select count(*)::text from resources', '0');
select set_config('request.jwt.claims', :'A_AAL1', false);
select pg_temp.t('A', 'all resources', 'select count(*)::text from resources', '6');
reset role;

-- ---------- weekly reps and reflections (rep cc01 in C1 has P1's reflection; cc02 has none)
set role authenticated;
select set_config('request.jwt.claims', :'A_AAL1', false);
select pg_temp.e('A', 'direct delete of rep with reflections', $q$with x as (delete from weekly_reps where id = '00000000-0000-0000-0000-00000000cc01' returning 1) select count(*)::text from x$q$,
  'update or delete on table "weekly_reps" violates foreign key constraint "weekly_rep_submissions_rep_id_fkey" on table "weekly_rep_submissions"');
select pg_temp.t('A', 'reflection counts (no text)', $q$select string_agg(reflections::text, ',') from admin_rep_reflection_counts()$q$, '1');
select set_config('request.jwt.claims', :'P1', false);
select pg_temp.t('P1', 'remove a rep', $q$select admin_remove_rep('00000000-0000-0000-0000-00000000cc02')$q$, 'denied');
select pg_temp.t('P1', 'reflection counts', 'select count(*)::text from admin_rep_reflection_counts()', 'denied');
select set_config('request.jwt.claims', :'A_AAL1', false);
select admin_remove_rep('00000000-0000-0000-0000-00000000cc01');  -- archived
select admin_remove_rep('00000000-0000-0000-0000-00000000cc02');  -- deleted
reset role;
select pg_temp.t('db', 'rep with reflection archived, not deleted', $q$select (archived_at is not null)::text from weekly_reps where id = '00000000-0000-0000-0000-00000000cc01'$q$, 'true');
select pg_temp.t('db', 'reflection preserved', 'select count(*)::text from weekly_rep_submissions', '1');
select pg_temp.t('db', 'empty rep deleted', $q$select count(*)::text from weekly_reps where id = '00000000-0000-0000-0000-00000000cc02'$q$, '0');
set role authenticated;
select set_config('request.jwt.claims', :'P1', false);
select pg_temp.t('P1', 'still sees archived rep they reflected on', $q$select count(*)::text from weekly_reps where id = '00000000-0000-0000-0000-00000000cc01'$q$, '1');
select pg_temp.t('P1', 'still reads own reflection', 'select count(*)::text from weekly_rep_submissions', '1');
reset role;
insert into public.cohort_enrollments (cohort_id, user_id, status) values
  ('00000000-0000-0000-0000-0000000c0001', '00000000-0000-0000-0000-0000000000d1', 'active');
set role authenticated;
select set_config('request.jwt.claims', :'O', false);
select pg_temp.t('O (C1, no reflection)', 'archived rep hidden', $q$select count(*)::text from weekly_reps where id = '00000000-0000-0000-0000-00000000cc01'$q$, '0');
reset role;
delete from public.cohort_enrollments where user_id = '00000000-0000-0000-0000-0000000000d1';

-- ---------- capacity (C1 has 1 active: P1; P3 withdrawn)
update public.cohorts set capacity = 1 where id = '00000000-0000-0000-0000-0000000c0001';
set role authenticated;
select set_config('request.jwt.claims', :'A_AAL1', false);
select pg_temp.e('A', 'enroll into a full cohort', $q$with x as (insert into cohort_enrollments (cohort_id, user_id, status) values ('00000000-0000-0000-0000-0000000c0001', '00000000-0000-0000-0000-0000000000d1', 'active') returning 1) select count(*)::text from x$q$,
  'Cohort One is full (1 of 1 seats taken).');
select pg_temp.t('A', 'reactivate withdrawn into a full cohort', $q$with x as (update cohort_enrollments set status = 'active' where user_id = '00000000-0000-0000-0000-0000000000b3' returning 1) select count(*)::text from x$q$, 'denied');
select pg_temp.t('A', 'withdraw from a full cohort', $q$with x as (update cohort_enrollments set status = 'withdrawn' where user_id = '00000000-0000-0000-0000-0000000000b1' returning 1) select count(*)::text from x$q$, '1');
select pg_temp.t('A', 'raise capacity', $q$with u as (update cohorts set capacity = 2 where id = '00000000-0000-0000-0000-0000000c0001' returning 1) select count(*)::text from u$q$, '1');
reset role;
set role service_role;
select pg_temp.t('service', 'server route also blocked when full', $q$with x as (insert into cohort_enrollments (cohort_id, user_id, status) values ('00000000-0000-0000-0000-0000000c0001', '00000000-0000-0000-0000-0000000000d1', 'active') returning 1) select count(*)::text from x$q$, 'denied');
reset role;
update public.cohorts set capacity = null where id = '00000000-0000-0000-0000-0000000c0001';
set role authenticated;
select set_config('request.jwt.claims', :'A_AAL1', false);
select pg_temp.t('A', 'no capacity: enroll allowed', $q$with x as (insert into cohort_enrollments (cohort_id, user_id, status) values ('00000000-0000-0000-0000-0000000c0001', '00000000-0000-0000-0000-0000000000d1', 'active') returning 1) select count(*)::text from x$q$, '1');
reset role;

-- ---------- admin access guard
set role authenticated;
select set_config('request.jwt.claims', :'A_AAL1', false);
select pg_temp.e('A', 'remove own admin access', $q$with x as (update profiles set role = 'impact_participant' where id = auth.uid() returning 1) select count(*)::text from x$q$,
  'You cannot remove your own administrator access. Ask the other administrator.');
select pg_temp.t('A', 'change the other admin''s role', $q$with x as (update profiles set role = 'impact_participant' where id = '00000000-0000-0000-0000-0000000000a2' returning 1) select count(*)::text from x$q$, '1');
select pg_temp.t('A', 'make a participant admin', $q$with x as (update profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000b2' returning 1) select count(*)::text from x$q$, '1');
reset role;
select set_config('request.jwt.claims', '{}', false);
set role service_role;
update public.profiles set role = 'impact_participant' where id = '00000000-0000-0000-0000-0000000000a2';
select pg_temp.e('service', 'demote the last admin', $q$with x as (update profiles set role = 'impact_participant' where id = '00000000-0000-0000-0000-0000000000a1' returning 1) select count(*)::text from x$q$,
  'This is the last administrator account; it must keep administrator access.');
reset role;
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000a2';

-- ---------- activity log (changes made for real, then inspected)
delete from public.admin_audit_log;
set role authenticated;
select set_config('request.jwt.claims', :'A_AAL1', false);
update public.cohorts set capacity = 12, zoom_link = 'https://zoom.example/secret-new' where id = '00000000-0000-0000-0000-0000000c0002';
update public.cohorts set capacity = 12 where id = '00000000-0000-0000-0000-0000000c0002';  -- no change: no entry
delete from public.community_posts where id = '00000000-0000-0000-0000-00000000aa02';
insert into public.cohorts (id, program_id, name, status) values ('00000000-0000-0000-0000-0000000c0003', '00000000-0000-0000-0000-00000000f001', 'Cohort Three', 'draft');
insert into public.cohort_sessions (cohort_id, session_number, title) values ('00000000-0000-0000-0000-0000000c0003', 1, 'S1'), ('00000000-0000-0000-0000-0000000c0003', 2, 'S2');
delete from public.cohorts where id = '00000000-0000-0000-0000-0000000c0003';
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000b2';
select set_config('request.jwt.claims', :'P1', false);
insert into public.community_posts (cohort_id, user_id, body) values ('00000000-0000-0000-0000-0000000c0001', auth.uid(), 'participant post');
reset role;

select pg_temp.t('log', 'capacity change recorded with old/new values',
  $q$select action || '|' || entity_label || '|' || outcome || '|' || coalesce(changes->'capacity'->>'from', 'null') || '>' || (changes->'capacity'->>'to') from admin_audit_log where action = 'cohort.update' order by id limit 1$q$,
  'cohort.update|Cohort Two|success|null>12');
select pg_temp.t('log', 'meeting link recorded as changed, value not stored',
  $q$select (changes->'zoom_link')::text || '|' || (position('secret' in changes::text) > 0)::text from admin_audit_log where action = 'cohort.update' order by id limit 1$q$,
  '{"changed": true}|false');
select pg_temp.t('log', 'unchanged save not recorded', $q$select count(*)::text from admin_audit_log where action = 'cohort.update'$q$, '1');
select pg_temp.t('log', 'admin delete of a post recorded, no text', $q$select action || '|' || entity_label || '|' || coalesce(changes::text, '') from admin_audit_log where entity_type = 'community_post'$q$, 'community_post.delete|Cohort Two|');
select pg_temp.t('log', 'cohort delete: one entry, sessions not repeated', $q$select string_agg(action, ',' order by id) from admin_audit_log where entity_id = '00000000-0000-0000-0000-0000000c0003' or entity_type = 'session'$q$, 'cohort.create,session.create,session.create,cohort.delete');
select pg_temp.t('log', 'role change recorded', $q$select (changes->'role'->>'from') || '>' || (changes->'role'->>'to') || '|' || entity_label from admin_audit_log where action = 'person.update'$q$, 'impact_participant>admin|Pat Two');
select pg_temp.t('log', 'participant activity not recorded', $q$select count(*)::text from admin_audit_log where actor_id = '00000000-0000-0000-0000-0000000000b1'$q$, '0');
select pg_temp.t('log', 'every entry names its admin', 'select count(*)::text from admin_audit_log where actor_id is null', '0');
set role authenticated;
select set_config('request.jwt.claims', :'A_AAL1', false);
select pg_temp.t('A', 'rewrite activity log', $q$with x as (update admin_audit_log set outcome = 'failed' returning 1) select count(*)::text from x$q$, 'denied');
select pg_temp.t('A', 'record a failed attempt', $q$with x as (insert into admin_audit_log (actor_id, action, entity_type, outcome) values (auth.uid(), 'enrollment.create', 'enrollment', 'failed') returning 1) select count(*)::text from x$q$, '1');
select pg_temp.t('A', 'record a failure as someone else', $q$with x as (insert into admin_audit_log (actor_id, action, outcome) values ('00000000-0000-0000-0000-0000000000a2', 'x', 'failed') returning 1) select count(*)::text from x$q$, 'denied');
reset role;

\o
select n, actor, check_name, expected, got, case when expected = got then 'PASS' else 'FAIL' end as result from pg_temp.results order by n;
select count(*) filter (where expected = got) as passed, count(*) filter (where expected <> got) as failed, count(*) as total from pg_temp.results;
