-- Simplifies the Top Performer leaderboard per product decision:
-- Only show users who did NOT miss any daily live exam that occurred since
-- they enrolled (i.e. attempted every 'live' exam whose time_window_end
-- falls between their enrollment date and now, within the period).
-- Rank by average exam score % (desc); tie-break by average seconds per
-- question (asc — faster wins). No composite score, no class/focus/regularity
-- weighting anymore.

DROP FUNCTION IF EXISTS public.get_top_performers(integer);

CREATE OR REPLACE FUNCTION public.get_top_performers(p_days integer DEFAULT 30)
RETURNS TABLE (
    profile_id uuid,
    full_name text,
    avatar_url text,
    exam_count bigint,
    avg_score_pct numeric,
    avg_seconds_per_question numeric,
    class_watch_seconds bigint,
    focus_seconds bigint,
    active_days bigint,
    composite_score numeric,
    rank_position bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_period_start timestamptz;
BEGIN
    v_period_start := CASE
        WHEN p_days <= 0 THEN date_trunc('day', now())
        ELSE now() - (p_days || ' days')::interval
    END;

    RETURN QUERY
    WITH live_exams AS (
        SELECT e.id, e.time_window_end
        FROM public.exams e
        WHERE e.exam_type = 'live'
          AND e.time_window_end IS NOT NULL
          AND e.time_window_end >= v_period_start
          AND e.time_window_end <= now()
    ),
    -- Earliest enrollment date per user — a live exam before this date
    -- shouldn't count against them as "missed".
    user_enrollment AS (
        SELECT e.profile_id, MIN(e.created_at) AS enrolled_at
        FROM public.enrollments e
        GROUP BY e.profile_id
    ),
    -- Live exams each user was actually eligible for (occurred after they enrolled).
    eligible_exams AS (
        SELECT ue.profile_id, le.id AS exam_id
        FROM user_enrollment ue
        JOIN live_exams le ON le.time_window_end >= ue.enrolled_at
    ),
    attempts_in_period AS (
        SELECT a.profile_id, a.exam_id, a.score, a.total_marks, a.time_taken_seconds,
               (SELECT COUNT(*) FROM public.exam_questions eq WHERE eq.exam_id = a.exam_id) AS q_count
        FROM public.exam_attempts a
        JOIN live_exams le ON le.id = a.exam_id
    ),
    -- Only users who attempted every live exam they were eligible for
    -- (and had at least one eligible exam in the period).
    full_attendance AS (
        SELECT ee.profile_id
        FROM eligible_exams ee
        GROUP BY ee.profile_id
        HAVING COUNT(DISTINCT ee.exam_id) = (
            SELECT COUNT(DISTINCT ee2.exam_id) FROM eligible_exams ee2 WHERE ee2.profile_id = ee.profile_id
        )
        AND COUNT(DISTINCT ee.exam_id) = (
            SELECT COUNT(DISTINCT ap.exam_id) FROM attempts_in_period ap WHERE ap.profile_id = ee.profile_id
        )
    ),
    per_user AS (
        SELECT
            ap.profile_id,
            COUNT(*) AS v_exam_count,
            AVG(CASE WHEN ap.total_marks > 0 THEN (ap.score / ap.total_marks) * 100 ELSE NULL END) AS v_avg_score_pct,
            AVG(CASE WHEN ap.time_taken_seconds > 0 AND ap.q_count > 0
                     THEN ap.time_taken_seconds::numeric / ap.q_count ELSE NULL END) AS v_avg_seconds_per_question
        FROM attempts_in_period ap
        JOIN full_attendance fa ON fa.profile_id = ap.profile_id
        GROUP BY ap.profile_id
    )
    SELECT
        pu.profile_id,
        p.full_name,
        p.avatar_url,
        pu.v_exam_count,
        ROUND(pu.v_avg_score_pct::numeric, 2),
        ROUND(pu.v_avg_seconds_per_question::numeric, 1),
        0::bigint AS class_watch_seconds,
        0::bigint AS focus_seconds,
        0::bigint AS active_days,
        ROUND(pu.v_avg_score_pct::numeric, 2) AS composite_score,
        RANK() OVER (
            ORDER BY pu.v_avg_score_pct DESC,
                     pu.v_avg_seconds_per_question ASC NULLS LAST
        ) AS rank_position
    FROM per_user pu
    JOIN public.profiles p ON p.id = pu.profile_id
    ORDER BY rank_position ASC, p.full_name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_top_performers(integer) TO authenticated;
