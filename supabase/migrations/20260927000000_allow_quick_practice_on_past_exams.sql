-- Quick Practice Mode was restricted to readymade exams only, so the
-- toggle didn't work on Past Exams (a live exam whose window has ended,
-- or a dedicated practice exam) shown in PastExamCatalog. This extends
-- the same RPC to also serve those, while still blocking a live exam
-- whose window is still open (no early answer leakage).
DROP FUNCTION IF EXISTS public.get_exam_questions_practice(uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_exam_questions_practice(p_exam_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS TABLE(
  id uuid,
  question_text text,
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  option_e text,
  correct_option text,
  explanation text,
  question_index integer,
  topic text,
  subtopic text
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $$
DECLARE
  v_is_readymade boolean;
  v_exam_type text;
  v_time_window_end timestamptz;
  v_parent_exam_id uuid;
  v_split_start integer;
  v_split_end integer;
  v_source_exam_id uuid;
  v_is_visible_on_free boolean;
  v_allow_guest boolean;
  v_allowed boolean;
BEGIN
  SELECT ex.is_readymade, ex.exam_type, ex.time_window_end, ex.parent_exam_id,
         ex.split_start, ex.split_end, ex.is_visible_on_free, ex.allow_guest
  INTO v_is_readymade, v_exam_type, v_time_window_end, v_parent_exam_id,
       v_split_start, v_split_end, v_is_visible_on_free, v_allow_guest
  FROM public.exams ex
  WHERE ex.id = p_exam_id;

  -- Allowed when: readymade (original behavior), OR a dedicated practice
  -- exam, OR a live exam whose window has already ended (Past Exam).
  -- A live exam still within its window is never allowed here.
  v_allowed := v_is_readymade IS TRUE
    OR v_exam_type = 'practice'
    OR (v_exam_type = 'live' AND v_time_window_end IS NOT NULL AND v_time_window_end < now());

  IF v_allowed IS NOT TRUE THEN
    RETURN;
  END IF;

  -- Logged-in users always allowed. Guests (p_user_id IS NULL) are only
  -- allowed when the exam is explicitly free/guest-accessible.
  IF p_user_id IS NULL AND v_is_visible_on_free IS NOT TRUE AND v_allow_guest IS NOT TRUE THEN
    RETURN;
  END IF;

  v_source_exam_id := COALESCE(v_parent_exam_id, p_exam_id);

  RETURN QUERY
  SELECT
    q.id,
    q.question_text,
    q.option_a,
    q.option_b,
    q.option_c,
    q.option_d,
    q.option_e,
    q.correct_option::text,
    q.explanation,
    q.question_index,
    q.topic,
    q.subtopic
  FROM public.exam_questions q
  WHERE q.exam_id = v_source_exam_id
    AND (v_parent_exam_id IS NULL OR q.question_index BETWEEN v_split_start AND v_split_end)
  ORDER BY q.question_index ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_exam_questions_practice(uuid, uuid) TO authenticated, anon;
