-- Fix Exam Access - Clean up and Robust Implementation
-- Drops previous versions to resolve overloading conflicts.
-- Uses fully qualified table names and explicit search path.
-- Fixes "ambiguous column" error by aliasing all column references.

DROP FUNCTION IF EXISTS get_exam_questions_start(uuid);
DROP FUNCTION IF EXISTS get_exam_questions_start(uuid, uuid);

CREATE OR REPLACE FUNCTION get_exam_questions_start(p_exam_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS TABLE (
  id uuid,
  question_text text,
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  question_index integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
  v_exam_course_id uuid;
  v_is_visible_on_free boolean;
  v_shared_course_ids uuid[];
  v_has_access boolean := false;
BEGIN
  -- 1. Get Exam Metadata
  SELECT ex.course_id, ex.is_visible_on_free, ex.shared_course_ids
  INTO v_exam_course_id, v_is_visible_on_free, v_shared_course_ids
  FROM public.exams ex
  WHERE ex.id = p_exam_id;

  -- 2. Check Access Logic
  IF v_exam_course_id IS NULL THEN
      -- Case: Public Exam
      IF v_is_visible_on_free IS TRUE THEN
          v_has_access := true;
      END IF;
  ELSE
      -- Case: Course Exam

      -- Check A: Direct Enrollment
      IF NOT v_has_access THEN
          SELECT EXISTS (
              SELECT 1 FROM public.enrollments en
              WHERE en.profile_id = p_user_id
              AND en.course_id = v_exam_course_id
          ) INTO v_has_access;
      END IF;

      -- Check B: Linked Course (Extra Course)
      IF NOT v_has_access THEN
          SELECT EXISTS (
              SELECT 1
              FROM public.enrollments e
              JOIN public.courses c ON e.course_id = c.id
              WHERE e.profile_id = p_user_id
              AND c.linked_course_ids IS NOT NULL
              -- Compare UUID (v_exam_course_id) against Text Array (linked_course_ids) safely
              AND v_exam_course_id::text = ANY(COALESCE(c.linked_course_ids, '{}')::text[])
          ) INTO v_has_access;
      END IF;

      -- Check C: Shared Course
      IF NOT v_has_access AND v_shared_course_ids IS NOT NULL THEN
          SELECT EXISTS (
              SELECT 1 FROM public.enrollments en_shared
              WHERE en_shared.profile_id = p_user_id
              AND en_shared.course_id = ANY(v_shared_course_ids)
          ) INTO v_has_access;
      END IF;
  END IF;

  -- 3. Return Questions if Access Granted
  IF v_has_access THEN
      RETURN QUERY
      SELECT
        q.id,
        q.question_text,
        q.option_a,
        q.option_b,
        q.option_c,
        q.option_d,
        q.question_index
      FROM public.exam_questions q
      WHERE q.exam_id = p_exam_id
      ORDER BY q.question_index ASC;
  ELSE
      -- Return Empty (Access Denied)
      RETURN;
  END IF;
END;
$$;
