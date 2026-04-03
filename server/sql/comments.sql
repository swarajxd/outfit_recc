-- Create comments table for post comments
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_clerk_id text not null,
  content text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists comments_post_id_idx
  on public.comments (post_id);

create index if not exists comments_user_clerk_id_idx
  on public.comments (user_clerk_id);

create index if not exists comments_created_at_idx
  on public.comments (created_at desc);
