-- ROLLBACK for 20261122000000_pathways_inquiries_admin.sql (2c). Run by hand only.
--
-- Usually NOT needed: the previous application release works with 2c in place, so an
-- application rollback (Vercel Instant Rollback) does not require this script.
--
-- WARNING: this permanently removes every inquiry, inquiry note, admin activity-log entry
-- and email-log entry recorded since 2c was applied. Take an encrypted backup first
-- (supabase/scripts/backup.sh) and export anything you need to keep.
--
-- What it does NOT touch: historical programs, cohorts, registrations, enrollments,
-- certificates. The three pathway records are removed only if nothing refers to them;
-- otherwise they are hidden (is_public = false) so no participant record is lost. The
-- added program/cohort columns are left in place (older code ignores them).
begin;

drop table if exists public.inquiry_notes;
drop table if exists public.inquiries;
drop table if exists public.admin_audit_log;
drop table if exists public.email_log;

-- Pathway records: delete only when unreferenced; otherwise hide.
delete from public.programs p
 where p.slug in ('emerging-leaders', 'new-leaders', 'practicing-leaders')
   and not exists (select 1 from public.cohorts c where c.program_id = p.id)
   and not exists (select 1 from public.registrations r where r.program_id = p.id)
   and not exists (select 1 from public.resources x where x.program_id = p.id)
   and not exists (select 1 from public.certificates x where x.program_id = p.id);
update public.programs set is_public = false, enrollment_open = false
 where slug in ('emerging-leaders', 'new-leaders', 'practicing-leaders');

alter table public.programs drop constraint if exists programs_pathway_text_lengths;

-- Cohort statuses: restore the rule production had before 2c (recorded 2026-11-22:
-- active / upcoming / completed). This fails, and the whole rollback is undone, if any
-- cohort is still Draft, Archived or Cancelled: change those cohorts first.
alter table public.cohorts drop constraint if exists cohorts_status_check;
alter table public.cohorts add constraint cohorts_status_check
  check (status = any (array['active'::text, 'upcoming'::text, 'completed'::text]));
commit;
