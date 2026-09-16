-- Allow a class to be manually placed in BOTH Record AND Archive at the
-- same time (previously is_archive was exclusive: true meant "archive
-- only", excluded from Record/course lists). New separate flag
-- `also_archive` additionally surfaces a class in Archive without
-- removing it from its normal Record/course listing.

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS also_archive boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_classes_also_archive
  ON public.classes (also_archive) WHERE also_archive = true;

-- Auto-archive should also set also_archive so the ended live class
-- keeps showing in Record/Past Class (until admin decides otherwise)
-- while simultaneously appearing in the central Archive.
CREATE OR REPLACE FUNCTION public.auto_archive_ended_live_classes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.classes
  SET also_archive = true
  WHERE class_type = 'live'
    AND also_archive IS DISTINCT FROM true
    AND is_archive IS DISTINCT FROM true
    AND end_at IS NOT NULL
    AND end_at < NOW();
END;
$$;
