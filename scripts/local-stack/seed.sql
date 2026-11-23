-- Synthetic records for local end-to-end testing. Every name, email and text is invented.
-- Test sign-ins (local stack only; password for all accounts below): LocalTest-only-1!
--   admin1@example.test (Taylor Admin), admin2@example.test (Jordan Admin)
--   p1..p8@example.test (participants), coach@example.test (coaching client), none@example.test (no cohort)
\set pw '''LocalTest-only-1!'''

insert into auth.users (id, email, raw_user_meta_data, encrypted_password) values
  ('10000000-0000-0000-0000-0000000000a1', 'admin1@example.test', '{"full_name":"Taylor Admin"}', encode(sha256(convert_to('tlc-local:' || :pw, 'UTF8')), 'hex')),
  ('10000000-0000-0000-0000-0000000000a2', 'admin2@example.test', '{"full_name":"Jordan Admin"}', encode(sha256(convert_to('tlc-local:' || :pw, 'UTF8')), 'hex')),
  ('10000000-0000-0000-0000-0000000000b1', 'p1@example.test', '{"full_name":"Avery Brooks"}', encode(sha256(convert_to('tlc-local:' || :pw, 'UTF8')), 'hex')),
  ('10000000-0000-0000-0000-0000000000b2', 'p2@example.test', '{"full_name":"Casey Diaz"}', encode(sha256(convert_to('tlc-local:' || :pw, 'UTF8')), 'hex')),
  ('10000000-0000-0000-0000-0000000000b3', 'p3@example.test', '{"full_name":"Devon Ellis"}', encode(sha256(convert_to('tlc-local:' || :pw, 'UTF8')), 'hex')),
  ('10000000-0000-0000-0000-0000000000b4', 'p4@example.test', '{"full_name":"Emery Fox"}', encode(sha256(convert_to('tlc-local:' || :pw, 'UTF8')), 'hex')),
  ('10000000-0000-0000-0000-0000000000b5', 'p5@example.test', '{"full_name":"Finley Gray"}', encode(sha256(convert_to('tlc-local:' || :pw, 'UTF8')), 'hex')),
  ('10000000-0000-0000-0000-0000000000b6', 'p6@example.test', '{"full_name":"Harper Hill"}', encode(sha256(convert_to('tlc-local:' || :pw, 'UTF8')), 'hex')),
  ('10000000-0000-0000-0000-0000000000b7', 'p7@example.test', '{"full_name":"Indigo James"}', encode(sha256(convert_to('tlc-local:' || :pw, 'UTF8')), 'hex')),
  ('10000000-0000-0000-0000-0000000000b8', 'p8@example.test', '{"full_name":"Jules Kim"}', encode(sha256(convert_to('tlc-local:' || :pw, 'UTF8')), 'hex')),
  ('10000000-0000-0000-0000-0000000000c1', 'coach@example.test', '{"full_name":"Kai Lane"}', encode(sha256(convert_to('tlc-local:' || :pw, 'UTF8')), 'hex')),
  ('10000000-0000-0000-0000-0000000000d1', 'none@example.test', '{"full_name":"Logan Moss"}', encode(sha256(convert_to('tlc-local:' || :pw, 'UTF8')), 'hex'));
update public.profiles set role = 'admin' where id in ('10000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-0000000000a2');
update public.profiles set role = 'coaching_client', hourly_rate = 150 where id = '10000000-0000-0000-0000-0000000000c1';
update public.profiles p set email = u.email from auth.users u where u.id = p.id;

-- Historical program (hidden) plus the three pathways the 2c migration created.
insert into public.programs (id, name, type, is_public, price, price_label, session_day, session_time)
values ('20000000-0000-0000-0000-0000000000f1', 'Impact Makers', 'cohort', false, 149, '$97', 'Tuesday', '18:30');

insert into public.cohorts (id, program_id, name, status, start_date, end_date, capacity, session_day, session_time) values
  ('30000000-0000-0000-0000-0000000000c1', '20000000-0000-0000-0000-0000000000f1', 'Impact Makers - Fall 2026', 'completed', '2026-08-18', '2026-09-29', null, 'Tuesday', '18:30'),
  ('30000000-0000-0000-0000-0000000000c2', (select id from programs where slug = 'emerging-leaders'), 'Emerging Leaders - Winter 2027', 'active', current_date - 14, current_date + 28, 8, 'Thursday', '18:00'),
  ('30000000-0000-0000-0000-0000000000c3', (select id from programs where slug = 'new-leaders'), 'New Leaders - Spring 2027', 'upcoming', current_date + 60, current_date + 102, 6, 'Tuesday', '18:30'),
  ('30000000-0000-0000-0000-0000000000c4', (select id from programs where slug = 'practicing-leaders'), 'Practicing Leaders - Summer 2027', 'draft', null, null, null, null, null);

insert into public.cohort_enrollments (cohort_id, user_id, status) values
  ('30000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-0000000000b1', 'active'),
  ('30000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-0000000000b2', 'active'),
  ('30000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-0000000000b3', 'active'),
  ('30000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-0000000000b4', 'withdrawn'),
  ('30000000-0000-0000-0000-0000000000c2', '10000000-0000-0000-0000-0000000000b5', 'active'),
  ('30000000-0000-0000-0000-0000000000c2', '10000000-0000-0000-0000-0000000000b6', 'active'),
  ('30000000-0000-0000-0000-0000000000c3', '10000000-0000-0000-0000-0000000000b7', 'active'),
  ('30000000-0000-0000-0000-0000000000c3', '10000000-0000-0000-0000-0000000000b8', 'active'),
  ('30000000-0000-0000-0000-0000000000c3', '10000000-0000-0000-0000-0000000000b1', 'active');

insert into public.cohort_sessions (cohort_id, session_number, title, session_date)
select '30000000-0000-0000-0000-0000000000c2', n, 'Session ' || n, current_date - 14 + (n - 1) * 7 from generate_series(1, 7) n;

insert into public.weekly_reps (id, cohort_id, week_number, title, instructions, due_date) values
  ('40000000-0000-0000-0000-0000000000e1', '30000000-0000-0000-0000-0000000000c2', 1, 'Ask one person for feedback', 'Ask a colleague what you could do differently.', current_date - 7),
  ('40000000-0000-0000-0000-0000000000e2', '30000000-0000-0000-0000-0000000000c2', 2, 'Listen before you answer', 'In one meeting, summarise before responding.', current_date + 1);
insert into public.weekly_rep_submissions (rep_id, user_id, reflection) values
  ('40000000-0000-0000-0000-0000000000e1', '10000000-0000-0000-0000-0000000000b5', 'Synthetic private reflection (never visible to admins).');
insert into public.journal_prompts (prompt, program_id, sort_order) values
  ('What did you notice about how you lead this week?', (select id from programs where slug = 'emerging-leaders'), 1);

-- Registration history: the historical program was free; "paid" = checkout completed.
insert into public.registrations (full_name, email, program_id, cohort_id, status, payment_status, why) values
  ('Avery Brooks', 'p1@example.test', '20000000-0000-0000-0000-0000000000f1', '30000000-0000-0000-0000-0000000000c1', 'confirmed', 'paid', 'Grow as a leader'),
  ('Emery Fox', 'p4@example.test', '20000000-0000-0000-0000-0000000000f1', '30000000-0000-0000-0000-0000000000c1', 'confirmed', 'paid', 'Synthetic: confirmed but later withdrew'),
  ('Logan Moss', 'none@example.test', '20000000-0000-0000-0000-0000000000f1', '30000000-0000-0000-0000-0000000000c1', 'confirmed', 'paid', 'Synthetic: confirmed, never enrolled'),
  ('Sam Test', 'sam@example.test', '20000000-0000-0000-0000-0000000000f1', '30000000-0000-0000-0000-0000000000c1', 'declined', 'unpaid', 'Synthetic: declined');

insert into public.inquiries (kind, contact_name, organization, email, pathways, status, follow_up_on, message, source) values
  ('organization', 'Riley North', 'Example County Library', 'riley@example.test', '{new-leaders}', 'contacted', current_date, 'Synthetic: 12 new supervisors.', 'impact-lab-page'),
  ('individual', 'Morgan Oak', null, 'morgan@example.test', '{emerging-leaders}', 'new', null, 'Synthetic: interested in the next cohort. =1+1 formula test', 'impact-lab-page'),
  ('organization', 'Quinn Park', 'Example Health, Inc.', 'quinn@example.test', '{practicing-leaders}', 'closed', current_date - 10, 'Synthetic: "quoted", commas, and — dashes.', 'impact-lab-page');

insert into public.resources (title, type, url, portal_type, program_id, cohort_id) values
  ('Emerging Leaders reading guide', 'article', 'https://example.com/guide', 'impact', (select id from programs where slug = 'emerging-leaders'), null),
  ('Coaching worksheet', 'worksheet', 'https://example.com/coaching', 'coaching', null, null);
insert into public.announcements (title, body, cohort_id, created_by) values
  ('Welcome to Winter 2027', 'Synthetic announcement.', '30000000-0000-0000-0000-0000000000c2', '10000000-0000-0000-0000-0000000000a1');
insert into public.community_posts (cohort_id, user_id, body) values
  ('30000000-0000-0000-0000-0000000000c2', '10000000-0000-0000-0000-0000000000b5', 'Synthetic post from a participant.');

-- Seeding is not an admin action: start the activity log empty.
delete from public.admin_audit_log;
