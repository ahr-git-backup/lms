-- Tracks which due-date reminder buckets (7/3/1 days left) have already been
-- sent for a given payment_request, so re-triggering the check on the same
-- day (e.g. two admins logging in) doesn't re-notify the same student.
--
-- No cron job is used — due-payment-reminder (the edge function) is instead
-- triggered client-side, once per calendar day, the first time an admin
-- opens the dashboard (see DashboardLayout.tsx).
ALTER TABLE public.payment_requests
  ADD COLUMN IF NOT EXISTS due_reminders_sent integer[] DEFAULT '{}';

