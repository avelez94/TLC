-- ROLLBACK for 20261121100000_privacy_phase2a_additive.sql (run by hand only).
-- Only needed if 2a itself causes a problem. Restores the previous bucket settings; the
-- added functions, columns, indexes and table are left in place (unused by older code).
begin;
do $$ begin
  if to_regclass('storage.buckets') is not null then
    update storage.buckets set public = true, file_size_limit = null, allowed_mime_types = null where id = 'resources';
    drop policy if exists "resources_admin_read" on storage.objects;
    drop policy if exists "resources_admin_insert" on storage.objects;
    drop policy if exists "resources_admin_update" on storage.objects;
    drop policy if exists "resources_admin_delete" on storage.objects;
  end if;
end $$;
commit;
