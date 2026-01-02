
create table if not exists public.user_note_states (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  note_id uuid not null references public.class_notes(id) on delete cascade,
  is_bookmarked boolean default false,
  sort_order int default 0,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(profile_id, note_id)
);

alter table public.user_note_states enable row level security;

create policy "Users can view own note states"
  on public.user_note_states for select
  using (auth.uid() = profile_id);

create policy "Users can insert own note states"
  on public.user_note_states for insert
  with check (auth.uid() = profile_id);

create policy "Users can update own note states"
  on public.user_note_states for update
  using (auth.uid() = profile_id);
