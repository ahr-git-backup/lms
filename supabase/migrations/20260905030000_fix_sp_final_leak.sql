-- Bug: create_sp_final_exam inserted generated Subject/Paper Final exams with
-- is_readymade = true AND is_visible_on_free = true. That means every
-- student-generated Subject/Paper Final exam:
--   1) leaked onto the public Free Exam page (is_visible_on_free = true), and
--   2) leaked into the general Readymade Exam list for all students
--      (is_readymade = true), instead of staying private to the student who
--      generated it (visible only via "Your History", same as
--      create_custom_exam's custom exams).
-- Fix: is_readymade -> false, is_visible_on_free -> false, matching
-- create_custom_exam's pattern. Also backfill already-generated exams.

CREATE OR REPLACE FUNCTION public.create_sp_final_exam(
  p_item_id uuid,
  p_mode text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_item record;
  v_new_exam_id uuid;
  v_src record;
  v_question_index int := 0;
  v_inserted int;
  v_total_marks numeric(10,2) := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_item FROM public.sp_final_items WHERE id = p_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subject/Paper item not found';
  END IF;

  INSERT INTO public.exams (
    title, exam_type, duration_minutes, negative_mark_per_question,
    is_published, is_readymade, is_archive, is_archived, is_visible_on_free,
    subject, chapter, category
  ) VALUES (
    v_item.name || ' — ' || p_mode, 'practice', 0, 0.25,
    true, false, false, false, false,
    '{}', v_item.category, ARRAY['Subject/Paper Final']
  ) RETURNING id INTO v_new_exam_id;

  FOR v_src IN
    SELECT * FROM public.sp_final_sources
    WHERE item_id = p_item_id AND mode = p_mode
    ORDER BY sort_order ASC
  LOOP
    IF v_src.source_type = 'csv' THEN
      INSERT INTO public.exam_questions (
        exam_id, question_index, question_text,
        option_a, option_b, option_c, option_d, option_e,
        correct_option, explanation, marks
      )
      SELECT
        v_new_exam_id,
        v_question_index + row_number() OVER (),
        q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.option_e,
        q.correct_option::text, q.explanation, 1
      FROM public.sp_final_source_questions q
      WHERE q.source_id = v_src.id
      ORDER BY random()
      LIMIT v_src.question_count;
    ELSE
      INSERT INTO public.exam_questions (
        exam_id, question_index, question_text,
        option_a, option_b, option_c, option_d,
        correct_option, explanation, marks
      )
      SELECT
        v_new_exam_id,
        v_question_index + row_number() OVER (),
        q.question_text, q.option_a, q.option_b, q.option_c, q.option_d,
        q.correct_option, q.explanation, 1
      FROM public.exam_questions q
      JOIN public.exams e ON e.id = q.exam_id
      WHERE e.is_readymade = true
        AND (v_src.filter_subject IS NULL OR v_src.filter_subject = ANY(e.subject))
        AND (v_src.filter_chapter IS NULL OR q.topic = v_src.filter_chapter OR e.chapter = v_src.filter_chapter)
        AND (v_src.filter_topic IS NULL OR q.topic = v_src.filter_topic)
      ORDER BY random()
      LIMIT v_src.question_count;
    END IF;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    v_question_index := v_question_index + v_inserted;
  END LOOP;

  IF v_question_index = 0 THEN
    DELETE FROM public.exams WHERE id = v_new_exam_id;
    RAISE EXCEPTION 'This mode has no configured questions yet';
  END IF;

  -- Re-shuffle final question order across all pulled sources combined,
  -- same as create_custom_exam does.
  WITH shuffled AS (
    SELECT id, row_number() OVER (ORDER BY random()) AS new_idx
    FROM public.exam_questions WHERE exam_id = v_new_exam_id
  )
  UPDATE public.exam_questions eq
  SET question_index = s.new_idx
  FROM shuffled s
  WHERE eq.id = s.id;

  -- Hard cap: exam must be exactly 100 MCQ regardless of how many the admin
  -- configured across sources (question_count per source is a raw sum, not
  -- a controlled total) -- trim anything beyond the first 100 (post-shuffle,
  -- so it's a random 100, not a source-biased 100).
  DELETE FROM public.exam_questions
  WHERE exam_id = v_new_exam_id AND question_index > 100;

  SELECT COUNT(*) INTO v_question_index FROM public.exam_questions WHERE exam_id = v_new_exam_id;

  v_total_marks := v_question_index; -- 1 mark per question

  -- 30 seconds per MCQ, matching create_custom_exam's timing convention.
  UPDATE public.exams
  SET total_marks = v_total_marks,
      duration_minutes = GREATEST(CEIL(v_question_index * 0.5)::int, 1)
  WHERE id = v_new_exam_id;

  RETURN v_new_exam_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_sp_final_exam(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- Fix already-generated Subject/Paper Final exams that leaked onto the
-- public Free Exam page and the general Readymade list.
UPDATE public.exams
SET is_visible_on_free = false, is_readymade = false
WHERE category @> ARRAY['Subject/Paper Final']::text[]
  AND (is_visible_on_free = true OR is_readymade = true);
