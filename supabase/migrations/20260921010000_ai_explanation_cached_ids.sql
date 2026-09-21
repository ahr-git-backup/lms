-- Disk-IO fix: prewarmExplanations used to call the AI + the write RPC for EVERY question on every
-- review/result page view (80k+ RPC calls, each a row lock + WAL write even when the write was a no-op).
-- This lets the client ask ONE cheap read: "which of these question ids already have an explanation?"
-- and only generate/write for the ones that don't.
CREATE OR REPLACE FUNCTION public.get_cached_ai_explanation_ids(p_ids uuid[])
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(array_agg(id), '{}'::uuid[])
  FROM public.exam_questions
  WHERE id = ANY(p_ids) AND ai_explanation IS NOT NULL;
$$;
GRANT EXECUTE ON FUNCTION public.get_cached_ai_explanation_ids(uuid[]) TO authenticated, anon;
