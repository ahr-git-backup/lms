-- Auto-archive live classes once their live time window ends.
-- (They already auto-appear in "past class"/Recordings via query-time
-- end_at < now filter — that part needs no change. This adds the
-- missing piece: automatically moving them into the Archive section too,
-- by flipping is_archive = true once end_at has passed.)

CREATE OR REPLACE FUNCTION public.auto_archive_ended_live_classes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.classes
  SET is_archive = true
  WHERE class_type = 'live'
    AND is_archive IS DISTINCT FROM true
    AND end_at IS NOT NULL
    AND end_at < NOW();
END;
$$;

SELECT cron.schedule(
  'auto-archive-ended-live-classes',
  '* * * * *',
  $$SELECT public.auto_archive_ended_live_classes();$$
);
