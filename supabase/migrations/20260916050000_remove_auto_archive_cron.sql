-- Remove pg_cron based auto-archive: no scheduled job needed (avoids
-- constant background job / egress). Replaced by query-time filtering
-- in the frontend: a live class is treated as "ended" purely by
-- checking end_at < now() at query time, same pattern already used by
-- Recordings/Past Class. also_archive column stays (manual toggle only).

SELECT cron.unschedule('auto-archive-ended-live-classes')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'auto-archive-ended-live-classes'
);

DROP FUNCTION IF EXISTS public.auto_archive_ended_live_classes();
