-- Coaching clients need a stored hourly rate to generate payment requests from the admin panel.
alter table profiles
  add column if not exists hourly_rate numeric;
