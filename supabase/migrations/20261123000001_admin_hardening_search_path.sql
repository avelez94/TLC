-- 2d follow-up (applied 2026-11-23): pin search_path on two helper functions flagged by the
-- Supabase security advisor. No behaviour change (neither function reads tables).
alter function app_private.session_aal() set search_path = '';
alter function app_private.short(text) set search_path = '';
