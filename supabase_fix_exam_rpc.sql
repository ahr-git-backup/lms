-- Fix Exam Access for Extra Courses (Linked Courses)
-- This function replaces the previous lightweight RPC.
-- It is now SECURITY DEFINER to perform advanced access checks (Linked Courses)
-- that standard RLS policies on 'exam_questions' cannot easily handle.

CREATE OR REPLACE FUNCTION get_exam_questions_start(p_exam_id uuid)
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
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_exam_course_id uuid;
  v_is_visible_on_free boolean;
  v_shared_course_ids uuid[];
  v_has_access boolean := false;
BEGIN
  -- 1. Get Exam Metadata
  SELECT course_id, is_visible_on_free, shared_course_ids
  INTO v_exam_course_id, v_is_visible_on_free, v_shared_course_ids
  FROM exams
  WHERE id = p_exam_id;

  -- 2. Check Access Logic
  IF v_exam_course_id IS NULL THEN
      -- Public Exam (check visibility flag)
      IF v_is_visible_on_free IS TRUE THEN
          v_has_access := true;
      END IF;
  ELSE
      -- Check Direct Enrollment OR Linked Course Enrollment OR Shared Course Enrollment
      SELECT EXISTS (
          SELECT 1
          FROM enrollments e
          JOIN courses c ON e.course_id = c.id
          WHERE e.profile_id = v_user_id
          AND (
              -- Case A: Direct Enrollment
              e.course_id = v_exam_course_id
              OR
              -- Case B: Linked Course (Extra Course)
              -- User is enrolled in 'c', and 'c' links to 'v_exam_course_id'
              (c.linked_course_ids IS NOT NULL AND v_exam_course_id::text = ANY(c.linked_course_ids))
              OR
              -- Case C: Shared Course (Exam shared with a course user is enrolled in)
              (v_shared_course_ids IS NOT NULL AND e.course_id = ANY(v_shared_course_ids))
          )
      ) INTO v_has_access;
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
      FROM exam_questions q
      WHERE q.exam_id = p_exam_id
      ORDER BY q.question_index ASC;
  ELSE
      -- Return Empty (Access Denied)
      -- We return empty set, front-end handles "no questions"
      RETURN;
  END IF;
END;
$$;
