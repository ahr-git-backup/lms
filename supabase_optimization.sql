-- 1. Dashboard Aggregate RPC
CREATE OR REPLACE FUNCTION get_dashboard_data()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_enrolled_course_ids uuid[];
  v_next_class json;
  v_active_live_classes json;
  v_active_live_exams json;
  v_next_exam json;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get enrolled course IDs
  SELECT array_agg(course_id)
  INTO v_enrolled_course_ids
  FROM enrollments
  WHERE profile_id = v_user_id;

  IF v_enrolled_course_ids IS NULL THEN
    v_enrolled_course_ids := '{}';
  END IF;

  -- 1. Next Class
  SELECT json_build_object(
    'id', c.id,
    'title', c.title,
    'start_at', c.start_at,
    'video_url', c.video_url,
    'course', json_build_object('name', co.name)
  )
  INTO v_next_class
  FROM classes c
  JOIN courses co ON c.course_id = co.id
  WHERE c.course_id = ANY(v_enrolled_course_ids)
    AND c.start_at > now()
  ORDER BY c.start_at ASC
  LIMIT 1;

  -- 2. Active Live Classes
  SELECT json_agg(json_build_object(
    'id', c.id,
    'title', c.title,
    'start_at', c.start_at,
    'end_at', c.end_at,
    'course', json_build_object('name', co.name)
  ))
  INTO v_active_live_classes
  FROM classes c
  JOIN courses co ON c.course_id = co.id
  WHERE c.course_id = ANY(v_enrolled_course_ids)
    AND c.class_type = 'live'
    AND c.start_at <= now()
    AND c.end_at > now()
  ORDER BY c.start_at ASC;

  -- 3. Active Live Exams
  SELECT json_agg(json_build_object(
    'id', e.id,
    'title', e.title,
    'time_window_start', e.time_window_start,
    'time_window_end', e.time_window_end,
    'exam_type', e.exam_type,
    'course', json_build_object('name', co.name)
  ))
  INTO v_active_live_exams
  FROM exams e
  JOIN courses co ON e.course_id = co.id
  WHERE e.course_id = ANY(v_enrolled_course_ids)
    AND e.exam_type = 'live'
    AND e.time_window_start <= now()
    AND e.time_window_end > now()
  ORDER BY e.time_window_end ASC;

  -- 4. Next Exam
  SELECT json_build_object(
    'id', e.id,
    'title', e.title,
    'time_window_start', e.time_window_start,
    'course', json_build_object('name', co.name)
  )
  INTO v_next_exam
  FROM exams e
  JOIN courses co ON e.course_id = co.id
  WHERE e.course_id = ANY(v_enrolled_course_ids)
    AND e.time_window_start > now()
  ORDER BY e.time_window_start ASC
  LIMIT 1;

  RETURN json_build_object(
    'next_class', v_next_class,
    'active_live_classes', COALESCE(v_active_live_classes, '[]'::json),
    'active_live_exams', COALESCE(v_active_live_exams, '[]'::json),
    'next_exam', v_next_exam
  );
END;
$$;

-- 2. Light Exam Questions RPC
CREATE OR REPLACE FUNCTION get_exam_questions_start(p_exam_id uuid)
RETURNS TABLE (
  id uuid,
  question_text text,
  option_a text,
  option_b text,
  option_c text,
  option_d text
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    q.id,
    q.question_text,
    q.option_a,
    q.option_b,
    q.option_c,
    q.option_d
  FROM exam_questions q
  WHERE q.exam_id = p_exam_id;
END;
$$;
