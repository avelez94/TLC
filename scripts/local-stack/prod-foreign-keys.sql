-- Foreign keys present in production (read from pg_constraint on 2026-11-23) that the RLS
-- replica does not declare. Needed so the local API can embed related rows exactly as in
-- production (e.g. registrations → programs). Applied before the migrations.
do $$
declare r record;
begin
  for r in select * from (values
    ('admin_audit_log_actor_id_fkey', 'admin_audit_log', 'foreign key (actor_id) references profiles(id) on delete set null'),
    ('announcements_cohort_id_fkey', 'announcements', 'foreign key (cohort_id) references cohorts(id) on delete cascade'),
    ('announcements_created_by_fkey', 'announcements', 'foreign key (created_by) references profiles(id)'),
    ('announcements_target_user_id_fkey', 'announcements', 'foreign key (target_user_id) references profiles(id)'),
    ('certificates_cohort_id_fkey', 'certificates', 'foreign key (cohort_id) references cohorts(id)'),
    ('certificates_program_id_fkey', 'certificates', 'foreign key (program_id) references programs(id)'),
    ('certificates_user_id_fkey', 'certificates', 'foreign key (user_id) references profiles(id) on delete cascade'),
    ('cohort_sessions_cohort_id_fkey', 'cohort_sessions', 'foreign key (cohort_id) references cohorts(id) on delete cascade'),
    ('journal_prompts_program_id_fkey', 'journal_prompts', 'foreign key (program_id) references programs(id) on delete cascade'),
    ('journal_entries_program_id_fkey', 'journal_entries', 'foreign key (program_id) references programs(id)'),
    ('journal_entries_user_id_fkey', 'journal_entries', 'foreign key (user_id) references profiles(id) on delete cascade'),
    ('program_includes_program_id_fkey', 'program_includes', 'foreign key (program_id) references programs(id) on delete cascade'),
    ('registrations_cohort_id_fkey', 'registrations', 'foreign key (cohort_id) references cohorts(id)'),
    ('registrations_program_id_fkey', 'registrations', 'foreign key (program_id) references programs(id)'),
    ('resources_cohort_id_fkey', 'resources', 'foreign key (cohort_id) references cohorts(id)'),
    ('resources_program_id_fkey', 'resources', 'foreign key (program_id) references programs(id)'),
    ('weekly_rep_submissions_user_id_fkey', 'weekly_rep_submissions', 'foreign key (user_id) references profiles(id) on delete cascade'),
    ('community_likes_user_id_fkey', 'community_likes', 'foreign key (user_id) references profiles(id) on delete cascade'),
    ('session_attendance_cohort_id_fkey', 'session_attendance', 'foreign key (cohort_id) references cohorts(id) on delete cascade'),
    ('session_attendance_user_id_fkey', 'session_attendance', 'foreign key (user_id) references profiles(id) on delete cascade')
  ) as t(name, tbl, def) loop
    if to_regclass('public.' || r.tbl) is not null and not exists (select 1 from pg_constraint where conname = r.name) then
      execute format('alter table public.%I add constraint %I %s', r.tbl, r.name, r.def);
    end if;
  end loop;
end $$;
