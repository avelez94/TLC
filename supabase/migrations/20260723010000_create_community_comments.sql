-- Community posts need threaded comments for the impact portal and admin community board.
create table if not exists community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references community_posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

alter table community_comments enable row level security;

create policy "Authenticated users can view all comments"
  on community_comments for select
  to authenticated
  using (true);

create policy "Authenticated users can insert their own comments"
  on community_comments for insert
  to authenticated
  with check (auth.uid() = user_id);
