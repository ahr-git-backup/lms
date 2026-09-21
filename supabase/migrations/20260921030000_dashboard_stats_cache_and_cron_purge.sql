-- Disk-IO relief (applied directly on the project; kept here for the record).
-- 1) get_dashboard_stats(): the heavy 4-scan computation is kept as _get_dashboard_stats_compute() and the public
--    name now serves a saved copy refreshed at most every 30 minutes (identical output).
-- 2) pg_cron history purge so cron.job_run_details stops growing.
CREATE TABLE IF NOT EXISTS public._dashboard_stats_cache (
  id int PRIMARY KEY DEFAULT 1, data json NOT NULL, refreshed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT one_row CHECK (id = 1));
ALTER TABLE public._dashboard_stats_cache ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname='get_dashboard_stats' AND pronamespace='public'::regnamespace)
     AND NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='_get_dashboard_stats_compute') THEN
    ALTER FUNCTION public.get_dashboard_stats() RENAME TO _get_dashboard_stats_compute;
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.get_dashboard_stats() RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public._dashboard_stats_cache%rowtype;
BEGIN
  SELECT * INTO r FROM public._dashboard_stats_cache WHERE id = 1;
  IF r.id IS NULL OR r.refreshed_at < now() - interval '30 minutes' THEN
    INSERT INTO public._dashboard_stats_cache(id, data, refreshed_at) VALUES (1, public._get_dashboard_stats_compute(), now())
    ON CONFLICT (id) DO UPDATE SET data = excluded.data, refreshed_at = excluded.refreshed_at RETURNING * INTO r;
  END IF;
  RETURN r.data;
END $$;
REVOKE ALL ON FUNCTION public._get_dashboard_stats_compute() FROM public, anon, authenticated;
SELECT cron.schedule('purge-cron-history', '17 3 * * *', $$delete from cron.job_run_details where end_time < now() - interval '2 days'$$);
