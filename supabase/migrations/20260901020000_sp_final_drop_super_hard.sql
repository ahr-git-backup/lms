-- Remove the Super Hard mode entirely -- only Medical Standard and
-- Standard+Hard remain. (existing_bank sources already correctly pull from
-- exam_questions/exams -- that IS "the existing bank" ExamForm's Question
-- Bank Selector itself draws from, so no change needed there.)

DELETE FROM public.sp_final_sources WHERE mode = 'super_hard';

ALTER TABLE public.sp_final_sources DROP CONSTRAINT IF EXISTS sp_final_sources_mode_check;
ALTER TABLE public.sp_final_sources
  ADD CONSTRAINT sp_final_sources_mode_check CHECK (mode IN ('medical_standard', 'standard_hard'));

DELETE FROM public.sp_final_attempts WHERE mode = 'super_hard';
ALTER TABLE public.sp_final_attempts DROP CONSTRAINT IF EXISTS sp_final_attempts_mode_check;
ALTER TABLE public.sp_final_attempts
  ADD CONSTRAINT sp_final_attempts_mode_check CHECK (mode IN ('medical_standard', 'standard_hard'));

CREATE OR REPLACE FUNCTION public.get_sp_final_items(p_category text)
RETURNS TABLE(
  id uuid, name text, sort_order integer,
  medical_standard_configured integer,
  standard_hard_configured integer
)
LANGUAGE sql SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    i.id, i.name, i.sort_order,
    COALESCE(SUM(s.question_count) FILTER (WHERE s.mode = 'medical_standard'), 0)::integer,
    COALESCE(SUM(s.question_count) FILTER (WHERE s.mode = 'standard_hard'), 0)::integer
  FROM public.sp_final_items i
  LEFT JOIN public.sp_final_sources s ON s.item_id = i.id
  WHERE i.category = p_category AND i.is_hidden = false
  GROUP BY i.id, i.name, i.sort_order
  ORDER BY i.sort_order ASC, i.name ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_sp_final_items(text) TO authenticated, anon, service_role;

NOTIFY pgrst, 'reload schema';
