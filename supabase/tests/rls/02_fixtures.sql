-- Fake people and records for the access tests. All names and emails are invented.
--   A  = admin (Tramaine's role)        P1, P3 = participants in cohort C1
--   P2 = participant in cohort C2       K = coaching client       O = signed in, no cohort
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@example.test',  '{"full_name":"Admin A","role":"admin"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'p1@example.test',     '{"full_name":"Pat One"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'p2@example.test',     '{"full_name":"Pat Two"}'),
  ('00000000-0000-0000-0000-0000000000b3', 'p3@example.test',     '{"full_name":"Pat Three"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'k@example.test',      '{"full_name":"Kai Client","role":"coaching_client"}'),
  ('00000000-0000-0000-0000-0000000000d1', 'o@example.test',      '{"full_name":"Oz Outsider"}');
-- The pre-fix trigger trusted metadata roles; set them explicitly so fixtures match prod.
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000a1';
update public.profiles set role = 'coaching_client', hourly_rate = 150, phone = '555-0100' where id = '00000000-0000-0000-0000-0000000000c1';

insert into public.programs (id, name, price, price_label) values ('00000000-0000-0000-0000-00000000f001', 'Test Program', 97, '$97');
insert into public.cohorts (id, program_id, name, status, zoom_link) values
  ('00000000-0000-0000-0000-0000000c0001', '00000000-0000-0000-0000-00000000f001', 'Cohort One', 'active', 'https://zoom.example/one'),
  ('00000000-0000-0000-0000-0000000c0002', '00000000-0000-0000-0000-00000000f001', 'Cohort Two', 'upcoming', 'https://zoom.example/two');
insert into public.cohort_sessions (cohort_id, session_number, title) values ('00000000-0000-0000-0000-0000000c0001', 1, 'Session 1');
insert into public.cohort_enrollments (cohort_id, user_id, status) values
  ('00000000-0000-0000-0000-0000000c0001', '00000000-0000-0000-0000-0000000000b1', 'active'),
  ('00000000-0000-0000-0000-0000000c0001', '00000000-0000-0000-0000-0000000000b3', 'active'),
  ('00000000-0000-0000-0000-0000000c0002', '00000000-0000-0000-0000-0000000000b2', 'active');

insert into public.community_posts (id, cohort_id, user_id, body) values
  ('00000000-0000-0000-0000-00000000aa01', '00000000-0000-0000-0000-0000000c0001', '00000000-0000-0000-0000-0000000000b1', 'C1 post'),
  ('00000000-0000-0000-0000-00000000aa02', '00000000-0000-0000-0000-0000000c0002', '00000000-0000-0000-0000-0000000000b2', 'C2 post');
insert into public.community_comments (post_id, user_id, body) values
  ('00000000-0000-0000-0000-00000000aa01', '00000000-0000-0000-0000-0000000000b3', 'C1 comment'),
  ('00000000-0000-0000-0000-00000000aa02', '00000000-0000-0000-0000-0000000000b2', 'C2 comment');
insert into public.cohort_messages (id, cohort_id, user_id, content) values
  ('00000000-0000-0000-0000-00000000bb01', '00000000-0000-0000-0000-0000000c0001', '00000000-0000-0000-0000-0000000000b1', 'C1 chat'),
  ('00000000-0000-0000-0000-00000000bb02', '00000000-0000-0000-0000-0000000c0002', '00000000-0000-0000-0000-0000000000b2', 'C2 chat');
insert into public.weekly_reps (id, cohort_id, week_number, title) values
  ('00000000-0000-0000-0000-00000000cc01', '00000000-0000-0000-0000-0000000c0001', 1, 'C1 rep'),
  ('00000000-0000-0000-0000-00000000cc02', '00000000-0000-0000-0000-0000000c0002', 1, 'C2 rep');
insert into public.weekly_rep_submissions (rep_id, user_id, reflection) values
  ('00000000-0000-0000-0000-00000000cc01', '00000000-0000-0000-0000-0000000000b1', 'P1 private reflection');
insert into public.journal_entries (user_id, portal_type, body) values ('00000000-0000-0000-0000-0000000000b1', 'impact', 'P1 private journal');
insert into public.registrations (full_name, email, program_id, cohort_id) values ('Reg Person', 'reg@example.test', '00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000c0002');
insert into public.bookings (full_name, email, booking_date, booking_time) values ('Book Person', 'book@example.test', '2026-12-01', '10:00');
insert into public.messages (sender_id, recipient_id, body) values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', 'K to admin');
insert into public.weekly_checkins (client_id, went_well) values ('00000000-0000-0000-0000-0000000000c1', 'K checkin');
insert into public.announcements (title, cohort_id, target_user_id) values
  ('Global', null, null), ('C2 only', '00000000-0000-0000-0000-0000000c0002', null);
insert into public.resources (title, portal_type, cohort_id, type) values
  ('C2 impact file', 'impact', '00000000-0000-0000-0000-0000000c0002', 'pdf'), ('Shared file', 'both', null, 'pdf');
