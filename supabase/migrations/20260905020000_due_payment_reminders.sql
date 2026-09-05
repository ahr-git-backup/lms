-- Tracks which due-date reminder buckets (7/3/1 days left) have already been
-- sent for a given payment_request, so the daily cron doesn't re-notify the
-- same student every day within a bucket.
ALTER TABLE public.payment_requests
  ADD COLUMN IF NOT EXISTS due_reminders_sent integer[] DEFAULT '{}';

-- Schedule the due-payment-reminder edge function once daily at 09:00 UTC
-- (~15:00 BD time, a reasonable hour for students to see a push notification).
-- Replace <TARGET_PROJECT_REF> / <SERVICE_ROLE_KEY> with this (main) project's
-- own values when running this migration.
-- SELECT cron.schedule(
--   'due-payment-reminder-job',
--   '0 9 * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://<TARGET_PROJECT_REF>.supabase.co/functions/v1/due-payment-reminder',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
--     )
--   );
--   $$
-- );
