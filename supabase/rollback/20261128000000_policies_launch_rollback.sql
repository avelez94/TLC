-- Rollback for 20261128000000_policies_launch.sql. Roll the application back first.
-- WARNING: removes all policy drafts, versions and the policy-acceptance record on registrations.
-- Export them first if any policy was published or any registration accepted one:
--   select * from public.policy_versions;  select id, policies_accepted, policies_accepted_at from public.registrations where policies_accepted is not null;
begin;
drop function if exists public.published_policy(text);
drop function if exists public.published_policies();
alter table public.registrations drop column if exists policies_accepted_at, drop column if exists policies_accepted;
drop table if exists public.launch_checks;
alter table if exists public.policies drop constraint if exists policies_published_version_fk;
drop trigger if exists policy_versions_immutable on public.policy_versions;
drop table if exists public.policy_versions;
drop table if exists public.policies;
drop function if exists public.policy_versions_immutable();
commit;
