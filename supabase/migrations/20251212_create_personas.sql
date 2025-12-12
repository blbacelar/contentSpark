-- Create Personas Table if it doesn't exist
create table if not exists personas (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  gender text,
  age_range text,
  occupation text,
  education text,
  marital_status text,
  has_children boolean default false,
  income_level text,
  social_networks text,
  pains_list text[],
  goals_list text[],
  questions_list text[],
  created_at timestamptz default now()
);

-- Enable RLS (safe to re-run)
alter table personas enable row level security;

-- Drop existing policies to ensure clean state
drop policy if exists "Users can view own personas" on personas;
drop policy if exists "Users can insert own personas" on personas;
drop policy if exists "Users can update own personas" on personas;
drop policy if exists "Users can delete own personas" on personas;

-- Policy: Users can view their own personas
create policy "Users can view own personas" on personas
  for select using (auth.uid() = user_id);

-- Policy: Users can insert their own personas
create policy "Users can insert own personas" on personas
  for insert with check (auth.uid() = user_id);

-- Policy: Users can update their own personas
create policy "Users can update own personas" on personas
  for update using (auth.uid() = user_id);

-- Policy: Users can delete their own personas
create policy "Users can delete own personas" on personas
  for delete using (auth.uid() = user_id);
