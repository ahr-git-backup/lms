-- Audit log for the ATLAS SMS Relay Android app (android-app/atlas-sms-relay).
-- Every SMS the app parses as a payment gets logged here, matched or not,
-- so admin can see what came in and manually approve anything the
-- auto-matcher couldn't confidently match to a payment_requests row.
create table if not exists public.sms_payment_relay_log (
  id uuid primary key default gen_random_uuid(),
  trx_id text not null,
  amount numeric,
  sender_phone text,
  raw_sms text,
  received_at timestamptz,
  matched_payment_request_id uuid references public.payment_requests(id) on delete set null,
  status text not null default 'unmatched', -- unmatched | matched | error
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_sms_relay_trx on public.sms_payment_relay_log (trx_id);
create index if not exists idx_sms_relay_status on public.sms_payment_relay_log (status, created_at desc);

alter table public.sms_payment_relay_log enable row level security;

create policy "Admins manage sms_payment_relay_log"
  on public.sms_payment_relay_log
  for all
  using (public.is_admin())
  with check (public.is_admin());
