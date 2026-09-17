-- My Mistakes page was making one get_student_exam_review() RPC call PER
-- attempted exam (N+1 pattern) to compute wrong/skip counts, causing very
-- slow loading for users with many attempts. This adds a single bulk RPC
-- that computes wrong/skip counts for ALL of the current user's exam
-- attempts in one query.

CREATE OR REPLACE FUNCTION public.get_my_mistakes_summary()
RETURNS TABLE(attempt_id uuid, exam_id uuid, wrong_count integer, skip_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH my_attempts AS (
        SELECT ea.id AS attempt_id, ea.exam_id, ea.answers
        FROM exam_attempts ea
        WHERE ea.profile_id = auth.uid()
    ),
    latest_attempt_per_exam AS (
        -- Match the existing frontend de-dup: keep only the most recent
        -- attempt per exam (ordered by submitted_at desc client-side, but
        -- since we key on exam_id here we just need any one row's answers
        -- per exam that the frontend actually used - the frontend already
        -- fetches full attempt list separately, so here we compute for
        -- every attempt row and let the frontend match by attempt_id).
        SELECT * FROM my_attempts
    ),
    answer_questions AS (
        SELECT
            la.attempt_id,
            la.exam_id,
            (ans->>'question_id')::uuid AS question_id,
            ans->>'selected_option' AS selected_option
        FROM latest_attempt_per_exam la
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(la.answers, '[]'::jsonb)) AS ans
    ),
    joined AS (
        SELECT
            aq.attempt_id,
            aq.exam_id,
            aq.selected_option,
            eq.correct_option::text AS correct_option
        FROM answer_questions aq
        LEFT JOIN exam_questions eq ON eq.id = aq.question_id
    )
    SELECT
        j.attempt_id,
        j.exam_id,
        COUNT(*) FILTER (
            WHERE j.selected_option IS NOT NULL
              AND j.selected_option <> ''
              AND j.selected_option IS DISTINCT FROM j.correct_option
        )::int AS wrong_count,
        COUNT(*) FILTER (
            WHERE j.selected_option IS NULL OR j.selected_option = ''
        )::int AS skip_count
    FROM joined j
    GROUP BY j.attempt_id, j.exam_id;
END;
$$;
