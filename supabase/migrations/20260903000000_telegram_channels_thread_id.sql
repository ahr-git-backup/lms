-- Add optional thread_id (group topic/forum thread) alongside the existing
-- chat_id, so saved Telegram channels/groups can be reused from the LMS
-- "Send to Telegram channel" dialog without retyping chat_id/thread_id.
alter table public.telegram_channels add column if not exists thread_id text;
