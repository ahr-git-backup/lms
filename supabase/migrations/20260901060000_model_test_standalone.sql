-- Model Test: standalone readymade exam type, separate from Subject/Paper
-- Final. Fixed subject-wise composition (never changes, no track):
--   Biology 30, Chemistry 25, Physics 15, English 15, GK 10, মানবিক গুণাবলী 5
-- = 100 MCQ total. Admin configures sources (existing bank filter or CSV)
-- per subject; a student's attempt pulls each subject's target count from
-- its sources and assembles one 100-question exam via the same real
-- exams/exam_questions pattern as Subject/Paper Final and Custom Exam, so
-- it gets the same TakeExam.tsx player (timer, negative marking, leaderboard).

CREATE TABLE IF NOT EXISTS public.model_test_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_key text NOT NULL UNIQUE, -- 'biology' | 'chemistry' | 'physics' | 'english' | 'gk' | 'manobik'
  name text NOT NULL,               -- display label (Bengali)
  target_count integer NOT NULL CHECK (target_count > 0),
  sort_order integer NOT NULL DEFAULT 0
);

-- Fixed rows, always exactly these six, never editable by admin via UI.
INSERT INTO public.model_test_subjects (subject_key, name, target_count, sort_order) VALUES
  ('biology', 'Biology', 30, 1),
  ('chemistry', 'Chemistry', 25, 2),
  ('physics', 'Physics', 15, 3),
  ('english', 'English', 15, 4),
  ('gk', 'GK', 10, 5),
  ('manobik', 'মানবিক গুণাবলী', 5, 6)
ON CONFLICT (subject_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.model_test_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_key text NOT NULL REFERENCES public.model_test_subjects(subject_key) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('existing_bank', 'csv')),
  label text NOT NULL,
  question_count integer NOT NULL CHECK (question_count > 0),
  filter_subject text,
  filter_chapter text,
  filter_topic text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_model_test_sources_subject ON public.model_test_sources(subject_key);

CREATE TABLE IF NOT EXISTS public.model_test_source_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.model_test_sources(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  option_a text NOT NULL,
  option_b text NOT NULL,
  option_c text NOT NULL,
  option_d text NOT NULL,
  option_e text,
  correct_option char(1) NOT NULL CHECK (correct_option IN ('A','B','C','D','E')),
  explanation text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_model_test_source_questions_source ON public.model_test_source_questions(source_id);

CREATE TABLE IF NOT EXISTS public.model_test_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  score numeric(10,2),
  total_marks numeric(10,2),
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_model_test_attempts_profile ON public.model_test_attempts(profile_id);

ALTER TABLE public.model_test_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_test_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_test_source_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_test_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "model_test_subjects_read_all" ON public.model_test_subjects;
CREATE POLICY "model_test_subjects_read_all" ON public.model_test_subjects FOR SELECT USING (true);

DROP POLICY IF EXISTS "model_test_sources_read_all" ON public.model_test_sources;
CREATE POLICY "model_test_sources_read_all" ON public.model_test_sources FOR SELECT USING (true);
DROP POLICY IF EXISTS "model_test_sources_admin_write" ON public.model_test_sources;
CREATE POLICY "model_test_sources_admin_write" ON public.model_test_sources FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "model_test_source_questions_admin_all" ON public.model_test_source_questions;
CREATE POLICY "model_test_source_questions_admin_all" ON public.model_test_source_questions FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "model_test_attempts_own_read" ON public.model_test_attempts;
CREATE POLICY "model_test_attempts_own_read" ON public.model_test_attempts FOR SELECT
  USING (auth.uid() = profile_id);
DROP POLICY IF EXISTS "model_test_attempts_own_insert" ON public.model_test_attempts;
CREATE POLICY "model_test_attempts_own_insert" ON public.model_test_attempts FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

NOTIFY pgrst, 'reload schema';

-- RPC: per-subject configured total vs target, so admin UI can show
-- "Biology: 30/30 configured".
CREATE OR REPLACE FUNCTION public.get_model_test_summary()
RETURNS TABLE(subject_key text, name text, target_count integer, configured_count integer, sort_order integer)
LANGUAGE sql SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    ms.subject_key, ms.name, ms.target_count,
    COALESCE(SUM(src.question_count), 0)::integer,
    ms.sort_order
  FROM public.model_test_subjects ms
  LEFT JOIN public.model_test_sources src ON src.subject_key = ms.subject_key
  GROUP BY ms.subject_key, ms.name, ms.target_count, ms.sort_order
  ORDER BY ms.sort_order ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_model_test_summary() TO authenticated, anon, service_role;

-- RPC: assemble a real exam. Pulls target_count random questions PER
-- SUBJECT (never per-source raw count) so subject-wise balance is always
-- exact even if a subject has multiple sources -- combined across a
-- subject's sources, capped to target_count total for that subject.
CREATE OR REPLACE FUNCTION public.create_model_test_exam()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_new_exam_id uuid;
  v_subj RECORD;
  v_question_index int := 0;
  v_pulled int;
  v_total_marks numeric(10,2) := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.exams (
    title, exam_type, duration_minutes, negative_mark_per_question,
    is_published, is_readymade, is_archive, is_archived, is_visible_on_free,
    subject, chapter, category
  ) VALUES (
    'Model Test — ' || to_char(now(), 'DD Mon YYYY HH24:MI'), 'practice', 0, 0.25,
    true, true, false, false, true,
    '{}', 'Model Test', ARRAY['Model Test']
  ) RETURNING id INTO v_new_exam_id;

  FOR v_subj IN
    SELECT * FROM public.model_test_subjects ORDER BY sort_order ASC
  LOOP
    -- Pool every configured source's questions for this subject into one
    -- randomized draw, capped at the subject's fixed target_count -- this
    -- guarantees exact subject-wise distribution regardless of how many
    -- total questions admin configured across that subject's sources.
    WITH pool AS (
      SELECT
        q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.option_e,
        q.correct_option::text AS correct_option, q.explanation
      FROM public.model_test_source_questions q
      JOIN public.model_test_sources s ON s.id = q.source_id
      WHERE s.subject_key = v_subj.subject_key AND s.source_type = 'csv'
      UNION ALL
      SELECT
        eq.question_text, eq.option_a, eq.option_b, eq.option_c, eq.option_d, NULL::text,
        eq.correct_option, eq.explanation
      FROM public.model_test_sources s
      JOIN public.exam_questions eq ON true
      JOIN public.exams e ON e.id = eq.exam_id
      WHERE s.subject_key = v_subj.subject_key AND s.source_type = 'existing_bank'
        AND e.is_readymade = true
        AND (s.filter_subject IS NULL OR s.filter_subject = ANY(e.subject))
        AND (s.filter_chapter IS NULL OR eq.topic = s.filter_chapter OR e.chapter = s.filter_chapter)
        AND (s.filter_topic IS NULL OR eq.topic = s.filter_topic)
    ),
    picked AS (
      SELECT * FROM pool ORDER BY random() LIMIT v_subj.target_count
    ),
    numbered AS (
      SELECT *, v_question_index + row_number() OVER () AS idx FROM picked
    )
    INSERT INTO public.exam_questions (
      exam_id, question_index, question_text,
      option_a, option_b, option_c, option_d, option_e,
      correct_option, explanation, marks
    )
    SELECT v_new_exam_id, idx, question_text, option_a, option_b, option_c, option_d, option_e,
           correct_option, explanation, 1
    FROM numbered;

    GET DIAGNOSTICS v_pulled = ROW_COUNT;
    v_question_index := v_question_index + v_pulled;
  END LOOP;

  IF v_question_index = 0 THEN
    DELETE FROM public.exams WHERE id = v_new_exam_id;
    RAISE EXCEPTION 'Model Test has no configured questions yet';
  END IF;

  -- Re-shuffle final order across subjects combined.
  WITH shuffled AS (
    SELECT id, row_number() OVER (ORDER BY random()) AS new_idx
    FROM public.exam_questions WHERE exam_id = v_new_exam_id
  )
  UPDATE public.exam_questions eq
  SET question_index = s.new_idx
  FROM shuffled s
  WHERE eq.id = s.id;

  v_total_marks := v_question_index;

  UPDATE public.exams
  SET total_marks = v_total_marks,
      duration_minutes = GREATEST(CEIL(v_question_index * 0.5)::int, 1)
  WHERE id = v_new_exam_id;

  RETURN v_new_exam_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_model_test_exam() TO authenticated;
