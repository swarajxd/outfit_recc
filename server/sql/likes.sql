-- Create likes table for post likes
create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz default now()
);

create unique index if not exists likes_user_post_unique
  on public.likes (user_id, post_id);

create index if not exists likes_post_id_idx
  on public.likes (post_id);

create index if not exists likes_user_id_idx
  on public.likes (user_id);

