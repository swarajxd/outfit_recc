-- Create profiles table for user profile information
create table if not exists public.profiles (
  clerk_id text primary key,
  username text unique,
  full_name text,
  profile_image_url text,
  role text,
  bio text,
  taste_vector jsonb,
  taste_updated_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Add taste columns if table already exists
alter table public.profiles 
add column if not exists taste_vector jsonb, 
add column if not exists taste_updated_at timestamptz;

create index if not exists profiles_username_idx
  on public.profiles (username);
