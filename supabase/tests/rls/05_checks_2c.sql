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
-- 2c: pathways, inquiries, audit and email logs (after lockdown + 2a + 2b + 2c)
set role anon; select set_config('request.jwt.claims', '{}', false);
select pg_temp.t('anon', 'public pathways (3 new)', $q$select count(*)::text from programs where is_public and slug is not null$q$, '3');
select pg_temp.t('anon', 'historical programs kept, not public', $q$select count(*)::text from programs where not is_public$q$, '1');
select pg_temp.t('anon', 'read inquiries', 'select count(*)::text from inquiries', 'denied');
select pg_temp.t('anon', 'submit inquiry directly', $q$with x as (insert into inquiries(kind, contact_name, email) values ('organization','x','x@x.test') returning 1) select count(*)::text from x$q$, 'denied');
select pg_temp.t('anon', 'cohort capacity readable', 'select count(capacity)::text from cohorts', '0');
reset role;

set role authenticated; select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', false);
select pg_temp.t('P1', 'read inquiries', 'select count(*)::text from inquiries', '0');
select pg_temp.t('P1', 'read audit log', 'select count(*)::text from admin_audit_log', '0');
select pg_temp.t('P1', 'write audit log', $q$with x as (insert into admin_audit_log(actor_id, action) values (auth.uid(), 'x') returning 1) select count(*)::text from x$q$, 'denied');
select pg_temp.t('P1', 'read email log', 'select count(*)::text from email_log', '0');
select pg_temp.t('P1', 'edit a pathway', $q$with x as (update programs set tagline='x' where slug='new-leaders' returning 1) select count(*)::text from x$q$, '0');
reset role;

set role service_role;
select pg_temp.t('service', 'store an organizational inquiry', $q$with x as (insert into inquiries(kind, contact_name, organization, email, pathways) values ('organization','Jordan Test','Example Agency','jordan@example.test', '{new-leaders}') returning 1) select count(*)::text from x$q$, '1');
insert into inquiries(id, kind, contact_name, email) values ('00000000-0000-0000-0000-0000000aa001', 'organization', 'Kept', 'kept@example.test');
select pg_temp.t('service', 'record an email send', $q$with x as (insert into email_log(template, recipient, status) values ('inquiry_owner', 'owner@example.test', 'sent') returning 1) select count(*)::text from x$q$, '1');
reset role;

set role authenticated; select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', false);
select pg_temp.t('A', 'see inquiries', 'select count(*)::text from inquiries', '1');
select pg_temp.t('A', 'update inquiry status', $q$with x as (update inquiries set status='contacted', follow_up_on=current_date + 7 where id='00000000-0000-0000-0000-0000000aa001' returning 1) select count(*)::text from x$q$, '1');
select pg_temp.t('A', 'invalid inquiry status', $q$with x as (update inquiries set status='spam' returning 1) select count(*)::text from x$q$, 'denied');
select pg_temp.t('A', 'add note as self', $q$with x as (insert into inquiry_notes(inquiry_id, author_id, body) values ('00000000-0000-0000-0000-0000000aa001', auth.uid(), 'Called') returning 1) select count(*)::text from x$q$, '1');
select pg_temp.t('A', 'add note as someone else', $q$with x as (insert into inquiry_notes(inquiry_id, author_id, body) values ('00000000-0000-0000-0000-0000000aa001', '00000000-0000-0000-0000-0000000000b1', 'x') returning 1) select count(*)::text from x$q$, 'denied');
select pg_temp.t('A', 'append audit entry', $q$with x as (insert into admin_audit_log(actor_id, action, entity_type) values (auth.uid(), 'inquiry.status', 'inquiry') returning 1) select count(*)::text from x$q$, '1');
select pg_temp.t('A', 'rewrite audit history', $q$with x as (update admin_audit_log set action='y' returning 1) select count(*)::text from x$q$, 'denied');
select pg_temp.t('A', 'delete audit history', $q$with x as (delete from admin_audit_log returning 1) select count(*)::text from x$q$, 'denied');
select pg_temp.t('A', 'forge email log', $q$with x as (insert into email_log(template, recipient, status) values ('x','x','sent') returning 1) select count(*)::text from x$q$, 'denied');
select pg_temp.t('A', 'edit pathway copy and price', $q$with x as (update programs set tagline='Prepare to Lead', price=250, price_label='$250' where slug='emerging-leaders' returning 1) select count(*)::text from x$q$, '1');
select pg_temp.t('A', 'tagline too long for layout', $q$with x as (update programs set tagline=repeat('x', 81) where slug='emerging-leaders' returning 1) select count(*)::text from x$q$, 'denied');
select pg_temp.t('A', 'archive a cohort', $q$with x as (update cohorts set status='archived' where id='00000000-0000-0000-0000-0000000c0002' returning 1) select count(*)::text from x$q$, '1');
select pg_temp.t('A', 'set cohort capacity', $q$with x as (update cohorts set capacity=20 where id='00000000-0000-0000-0000-0000000c0001' returning 1) select count(*)::text from x$q$, '1');
reset role;

\o
select n, actor, check_name, expected, got, case when expected = got then 'PASS' else 'FAIL' end as result from pg_temp.results order by n;
select count(*) filter (where expected = got) as passed, count(*) filter (where expected <> got) as failed, count(*) as total from pg_temp.results;
