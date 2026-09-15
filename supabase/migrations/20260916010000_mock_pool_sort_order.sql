-- Manual position/order control for Random Practice Exam (Unlimited Mock Test)
-- subjects, chapters, and topics. mock_question_pool has no dedicated
-- metadata rows for these (they're just distinct string values across
-- pool rows), so store custom ordering separately, keyed by scope.
--
-- item_type: 'subject' | 'chapter' | 'topic'
-- parent_key: '' for subject, subject name for chapter, "subject||chapter" for topic
-- item_key: the subject/chapter/topic name being ordered

create table if not exists public.mock_pool_sort_order (
  id uuid primary key default gen_random_uuid(),
  item_type text not null check (item_type in ('subject', 'chapter', 'topic')),
  parent_key text not null default '',
  item_key text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_type, parent_key, item_key)
);

create index if not exists idx_mock_pool_sort_order_lookup
  on public.mock_pool_sort_order(item_type, parent_key, sort_order);

alter table public.mock_pool_sort_order enable row level security;

create policy "mock_pool_sort_order_select_all" on public.mock_pool_sort_order
  for select using (true);

create policy "mock_pool_sort_order_admin_all" on public.mock_pool_sort_order
  for all using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'teacher'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'teacher'));
