ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS deleted_prev_published boolean;
CREATE INDEX IF NOT EXISTS idx_exams_deleted_at ON public.exams (deleted_at);

-- Soft delete: hides exam from students/public (is_published=false) while keeping all data.
CREATE OR REPLACE FUNCTION public.soft_delete_exam(p_exam_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'not allowed'; END IF;
  UPDATE public.exams
     SET deleted_prev_published = is_published, is_published = false, deleted_at = now()
   WHERE id = p_exam_id AND deleted_at IS NULL;
END $$;

CREATE OR REPLACE FUNCTION public.restore_exam(p_exam_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'not allowed'; END IF;
  UPDATE public.exams
     SET is_published = COALESCE(deleted_prev_published, false), deleted_at = NULL, deleted_prev_published = NULL
   WHERE id = p_exam_id AND deleted_at IS NOT NULL;
END $$;

GRANT EXECUTE ON FUNCTION public.soft_delete_exam(uuid), public.restore_exam(uuid) TO authenticated;
