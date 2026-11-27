-- 2g: private storage for the administrators' training videos and guide (Admin → Training).
-- No storage policies are added: nobody can read the bucket directly, including signed-in
-- participants. The site serves each file through /api/admin/training/<file>, which checks for
-- a signed-in administrator and then hands out a short-lived signed link.
-- Additive: no table or existing bucket changes.
-- Rollback: supabase/rollback/20261127100000_admin_training_bucket_rollback.sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('admin-training', 'admin-training', false, 52428800, array['video/mp4', 'application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
