-- trx_id dropped from the SMS payment relay matching flow entirely —
-- students are matched by amount + sender phone number only, never asked
-- for trx_id. Column stays (harmless, unused) but must allow null now.
alter table public.sms_payment_relay_log alter column trx_id drop not null;
