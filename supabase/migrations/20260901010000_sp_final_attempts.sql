-- Stores each Subject/Paper Final attempt so it shows up in the new
-- "Your History" page. Mirrors admission_test_attempts' shape (question_ids
-- aren't meaningful here since questions are randomly assembled and not
-- individually IDed, so a full questions_snapshot is stored instead so a
-- result/review page can be rebuilt without re-querying the random pool).
CREATE TABLE IF NOT EXISTS public.sp_final_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.sp_final_items(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  category text NOT NULL CHECK (category IN ('subject_final', 'paper_final')),
  mode text NOT NULL CHECK (mode IN ('medical_standard', 'standard_hard', 'super_hard')),
  questions_snapshot jsonb NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  correct_count integer NOT NULL DEFAULT 0,
  wrong_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  total_questions integer NOT NULL DEFAULT 0,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sp_final_attempts_profile ON public.sp_final_attempts(profile_id, submitted_at DESC);

ALTER TABLE public.sp_final_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sp_final_attempts_own_rw" ON public.sp_final_attempts;
CREATE POLICY "sp_final_attempts_own_rw" ON public.sp_final_attempts FOR ALL
  USING (profile_id = auth.uid() OR public.is_admin())
  WITH CHECK (profile_id = auth.uid() OR public.is_admin());

NOTIFY pgrst, 'reload schema';
