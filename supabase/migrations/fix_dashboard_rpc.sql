CREATE OR REPLACE FUNCTION get_dashboard_data()
RETURNS JSON AS $$
DECLARE
    v_user_id UUID;
    v_enrolled_course_ids UUID[];
    v_next_class JSON;
    v_active_live_classes JSON;
    v_active_live_exams JSON;
    v_next_exam JSON;
BEGIN
    v_user_id := auth.uid();

    -- Get enrolled course IDs (including linked courses if implemented, but for now direct enrollments)
    -- If you have linked courses logic in SQL, use it. Otherwise, strictly enrollments.
    SELECT ARRAY_AGG(course_id) INTO v_enrolled_course_ids
    FROM enrollments
    WHERE profile_id = v_user_id;

    -- 1. Next Class (First upcoming live class)
    SELECT json_build_object(
        'id', c.id,
        'title', c.title,
        'start_at', c.start_at,
        'video_url', c.video_url,
        'course', json_build_object('name', co.name)
    ) INTO v_next_class
    FROM classes c
    JOIN courses co ON c.course_id = co.id
    WHERE (c.course_id = ANY(v_enrolled_course_ids) OR c.shared_course_ids && v_enrolled_course_ids)
      AND c.class_type = 'live'
      AND c.start_at > NOW()
    ORDER BY c.start_at ASC
    LIMIT 1;

    -- 2. Active Live Classes (Happening NOW)
    SELECT json_agg(
        json_build_object(
            'id', c.id,
            'title', c.title,
            'start_at', c.start_at,
            'video_url', c.video_url,
            'course', json_build_object('name', co.name)
        ) ORDER BY c.start_at ASC
    ) INTO v_active_live_classes
    FROM classes c
    JOIN courses co ON c.course_id = co.id
    WHERE (c.course_id = ANY(v_enrolled_course_ids) OR c.shared_course_ids && v_enrolled_course_ids)
      AND c.class_type = 'live'
      AND c.start_at <= NOW()
      AND c.end_at >= NOW();

    -- 3. Active Live Exams (Happening NOW)
    SELECT json_agg(
        json_build_object(
            'id', e.id,
            'title', e.title,
            'time_window_end', e.time_window_end,
            'course', json_build_object('name', co.name)
        )
    ) INTO v_active_live_exams
    FROM exams e
    JOIN courses co ON e.course_id = co.id
    WHERE (e.course_id = ANY(v_enrolled_course_ids) OR e.shared_course_ids && v_enrolled_course_ids)
      AND e.exam_type = 'live'
      AND e.is_published = true
      AND e.time_window_start <= NOW()
      AND e.time_window_end >= NOW();

    -- 4. Next Exam
    SELECT json_build_object(
        'id', e.id,
        'title', e.title,
        'time_window_start', e.time_window_start,
        'course', json_build_object('name', co.name)
    ) INTO v_next_exam
    FROM exams e
    JOIN courses co ON e.course_id = co.id
    WHERE (e.course_id = ANY(v_enrolled_course_ids) OR e.shared_course_ids && v_enrolled_course_ids)
      AND e.exam_type = 'live'
      AND e.is_published = true
      AND e.time_window_start > NOW()
    ORDER BY e.time_window_start ASC
    LIMIT 1;

    RETURN json_build_object(
        'next_class', v_next_class,
        'active_live_classes', COALESCE(v_active_live_classes, '[]'::json),
        'active_live_exams', COALESCE(v_active_live_exams, '[]'::json),
        'next_exam', v_next_exam
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
