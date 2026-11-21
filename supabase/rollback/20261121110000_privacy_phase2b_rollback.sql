-- ROLLBACK for 20261121110000_privacy_phase2b_column_restrictions.sql (run by hand only).
-- Restores table-level reads of profiles and cohorts for signed-in users. Row-level rules
-- from the emergency lockdown stay in place.
begin;
grant select on public.profiles to authenticated;
grant select on public.cohorts to authenticated;
commit;
