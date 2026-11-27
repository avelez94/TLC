-- Rollback for 20261127000000_completion_review.sql. Removes the three columns (and with them any
-- recorded "completion review closed" decisions; note them first if they should be kept).
begin;
alter table public.cohorts
  drop column if exists completion_review_note,
  drop column if exists completion_review_closed_by,
  drop column if exists completion_review_closed_at;
commit;
