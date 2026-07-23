-- Reusable Subject/Chapter master lists for Unlimited Mock Test admin panel,
-- mirroring qp_subjects/qp_chapters pattern so once added, they stay available
-- as dropdown options for future adds.

create table if not exists public.mock_subjects (
  id bigint generated always as identity primary key,
  name text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.mock_chapters (
  id bigint generated always as identity primary key,
  subject_id bigint not null references public.mock_subjects(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (subject_id, name)
);

create index if not exists idx_mock_chapters_subject on public.mock_chapters(subject_id);

alter table public.mock_subjects enable row level security;
alter table public.mock_chapters enable row level security;

create policy "mock_subjects_select_all" on public.mock_subjects for select using (true);
create policy "mock_chapters_select_all" on public.mock_chapters for select using (true);

create policy "mock_subjects_admin_write" on public.mock_subjects for all
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'teacher'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'teacher'));

create policy "mock_chapters_admin_write" on public.mock_chapters for all
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'teacher'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'teacher'));
