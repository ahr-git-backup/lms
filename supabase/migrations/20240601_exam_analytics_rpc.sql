-- Add index for efficient rank and max score calculation
CREATE INDEX IF NOT EXISTS idx_exam_attempts_stats ON public.exam_attempts (exam_id, attempt_type, score DESC);

-- Create the RPC function
CREATE OR REPLACE FUNCTION public.get_student_exam_analytics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_result jsonb;
BEGIN
    -- Return empty list if no user (though security definer handles permissions, auth.uid() is needed)
    IF v_user_id IS NULL THEN
        RETURN '[]'::jsonb;
    END IF;

    WITH relevant_exams AS (
        SELECT
            e.id,
            e.title,
            e.total_marks,
            e.time_window_start,
            e.time_window_end,
            e.created_at,
            e.course_id,
            c.name as course_name
        FROM public.exams e
        LEFT JOIN public.courses c ON e.course_id = c.id
        WHERE
            e.course_id IS NULL -- Public
            OR
            e.course_id IN (SELECT course_id FROM public.enrollments WHERE profile_id = v_user_id) -- Enrolled
    ),
    my_attempts AS (
        SELECT
            exam_id,
            attempt_type,
            score,
            submitted_at
        FROM public.exam_attempts
        WHERE profile_id = v_user_id
    ),
    exam_stats AS (
        SELECT
            exam_id,
            attempt_type,
            MAX(score) as max_score
        FROM public.exam_attempts
        WHERE exam_id IN (SELECT id FROM relevant_exams)
        GROUP BY exam_id, attempt_type
    ),
    my_ranks AS (
         -- Calculate rank only for my attempts
         -- Rank = (Count of people with score > my_score) + 1
         SELECT
            ma.exam_id,
            ma.attempt_type,
            (
                SELECT COUNT(*) + 1
                FROM public.exam_attempts ea
                WHERE ea.exam_id = ma.exam_id
                  AND ea.attempt_type = ma.attempt_type
                  AND ea.score > ma.score
            ) as rank
         FROM my_attempts ma
    )
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', e.id,
            'title', e.title,
            'total_marks', e.total_marks,
            'time_window_start', e.time_window_start,
            'time_window_end', e.time_window_end,
            'created_at', e.created_at,
            'course_name', COALESCE(e.course_name, 'Public Exams'),

            -- Live Attempt Data
            'live_attempt', (
               SELECT jsonb_build_object(
                   'score', ma.score,
                   'rank', mr.rank,
                   'highest_score', es.max_score
               )
               FROM (SELECT 1) dummy
               LEFT JOIN my_attempts ma ON ma.exam_id = e.id AND ma.attempt_type = 'live'
               LEFT JOIN my_ranks mr ON mr.exam_id = e.id AND mr.attempt_type = 'live'
               LEFT JOIN exam_stats es ON es.exam_id = e.id AND es.attempt_type = 'live'
               WHERE ma.score IS NOT NULL
            ),

            -- Practice Attempt Data
            'practice_attempt', (
                 SELECT jsonb_build_object(
                    'score', ma.score,
                    'rank', mr.rank,
                    'highest_score', es.max_score
                )
                FROM (SELECT 1) dummy
                LEFT JOIN my_attempts ma ON ma.exam_id = e.id AND ma.attempt_type <> 'live'
                LEFT JOIN my_ranks mr ON mr.exam_id = e.id AND mr.attempt_type = ma.attempt_type
                LEFT JOIN exam_stats es ON es.exam_id = e.id AND es.attempt_type = ma.attempt_type
                WHERE ma.score IS NOT NULL
            ),

             -- Global High Scores (even if not attempted)
            'highest_live_score', (SELECT max_score FROM exam_stats WHERE exam_id = e.id AND attempt_type = 'live'),
            'highest_practice_score', (SELECT MAX(max_score) FROM exam_stats WHERE exam_id = e.id AND attempt_type <> 'live')
        ) ORDER BY COALESCE(e.time_window_start, e.created_at) DESC
    ) INTO v_result
    FROM relevant_exams e;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;
