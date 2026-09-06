-- Same leak bug as create_sp_final_exam: create_model_test_exam inserted
-- generated Model Test exams with is_readymade = true AND
-- is_visible_on_free = true, leaking every student-generated Model Test
-- onto the public Free Exam page and into the general Readymade Exam list
-- for all students, instead of staying private to the student who
-- generated it (visible only via "Your History").
-- Fix: is_readymade -> false, is_visible_on_free -> false. Also backfill
-- already-generated exams.

CREATE OR REPLACE FUNCTION public.create_model_test_exam(p_mode text DEFAULT 'standard')
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
  v_mode_label text := CASE WHEN p_mode = 'standard_hard' THEN 'Standard+Hard' ELSE 'Standard' END;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_mode NOT IN ('standard', 'standard_hard') THEN
    RAISE EXCEPTION 'Invalid mode: %', p_mode;
  END IF;

  INSERT INTO public.exams (
    title, exam_type, duration_minutes, negative_mark_per_question,
    is_published, is_readymade, is_archive, is_archived, is_visible_on_free,
    subject, chapter, category
  ) VALUES (
    'Model Test (' || v_mode_label || ') — ' || to_char(now(), 'DD Mon YYYY HH24:MI'), 'practice', 0, 0.25,
    true, false, false, false, false,
    '{}', 'Model Test', ARRAY['Model Test']
  ) RETURNING id INTO v_new_exam_id;

  FOR v_subj IN
    SELECT * FROM public.model_test_subjects ORDER BY sort_order ASC
  LOOP
    -- Pool every configured source's questions for this (subject, mode)
    -- into one randomized draw, capped at the subject's fixed
    -- target_count -- guarantees exact subject-wise distribution
    -- regardless of how many total questions admin configured.
    WITH pool AS (
      SELECT
        q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.option_e,
        q.correct_option::text AS correct_option, q.explanation
      FROM public.model_test_source_questions q
      JOIN public.model_test_sources s ON s.id = q.source_id
      WHERE s.subject_key = v_subj.subject_key AND s.source_type = 'csv' AND s.mode = p_mode
      UNION ALL
      SELECT
        eq.question_text, eq.option_a, eq.option_b, eq.option_c, eq.option_d, NULL::text,
        eq.correct_option, eq.explanation
      FROM public.model_test_sources s
      JOIN public.exam_questions eq ON true
      JOIN public.exams e ON e.id = eq.exam_id
      WHERE s.subject_key = v_subj.subject_key AND s.source_type = 'existing_bank' AND s.mode = p_mode
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
    RAISE EXCEPTION 'Model Test (%) has no configured questions yet', v_mode_label;
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

GRANT EXECUTE ON FUNCTION public.create_model_test_exam(text) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- Fix already-generated Model Test exams that leaked onto the public Free
-- Exam page and the general Readymade list.
UPDATE public.exams
SET is_visible_on_free = false, is_readymade = false
WHERE category @> ARRAY['Model Test']::text[]
  AND (is_visible_on_free = true OR is_readymade = true);
