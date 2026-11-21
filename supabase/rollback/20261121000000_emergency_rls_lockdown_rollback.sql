-- ROLLBACK for 20261121000000_emergency_rls_lockdown.sql
-- Restores the exact pre-migration policies, anon/authenticated grants and functions from
-- the security_backup snapshot. WARNING: this re-opens the exposure the migration closed.
-- Use only if the lockdown breaks the site and there is no faster forward fix.
-- (Kept outside the normal migration order on purpose: run by hand in the SQL editor.)

begin;

do $$
declare r record; v_roles text;
begin
  if to_regclass('security_backup.policies_20261121') is null then
    raise exception 'Backup table security_backup.policies_20261121 not found; aborting';
  end if;

  for r in select tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;

  for r in select * from security_backup.policies_20261121 loop
    select string_agg(case when x = 'public' then 'public' else quote_ident(x) end, ', ')
      into v_roles from unnest(r.roles) as x;
    execute format('create policy %I on public.%I as %s for %s to %s%s%s',
      r.policyname, r.tablename, lower(r.permissive), r.cmd, v_roles,
      case when r.qual is not null then ' using (' || r.qual || ')' else '' end,
      case when r.with_check is not null then ' with check (' || r.with_check || ')' else '' end);
  end loop;

  for r in select * from security_backup.table_grants_20261121 loop
    execute format('grant %s on public.%I to %I', r.privilege_type, r.table_name, r.grantee);
  end loop;

  for r in select * from security_backup.functions_20261121 loop
    execute r.definition;
  end loop;
end $$;

alter view public.booking_availability reset (security_invoker);
grant execute on function public.handle_new_user(), public.is_admin() to public;
do $$ begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    grant execute on function public.rls_auto_enable() to public;
  end if;
end $$;

drop trigger if exists guard_profile_privileged_columns on public.profiles;
drop schema if exists app_private cascade;
drop function if exists public.guard_profile_privileged_columns();
alter default privileges in schema public grant all on tables to anon;

commit;
