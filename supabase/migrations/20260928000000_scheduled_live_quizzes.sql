-- Live Quiz mode (send-icon → "Live Quiz" tab): schedule or instantly fire
-- a QuizBot /live-style live quiz for an existing exam's question bank,
-- sent to a saved telegram_channels entry. Backend cron picks up "pending"
-- rows whose scheduled_at has arrived and runs them.
create table if not exists public.scheduled_live_quizzes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  exam_id uuid not null references public.exams(id) on delete cascade,
  channel_id uuid references public.telegram_channels(id) on delete set null,
  chat_id text not null,
  thread_id bigint,
  per_q_time_sec integer not null default 20,
  scheduled_at timestamptz not null default now(),
  status text not null default 'pending', -- pending | running | done | error | cancelled
  error text,
  job_session_id text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create index if not exists idx_scheduled_live_quizzes_due
  on public.scheduled_live_quizzes (status, scheduled_at);

alter table public.scheduled_live_quizzes enable row level security;

create policy "Admins manage scheduled live quizzes"
  on public.scheduled_live_quizzes
  for all
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));
