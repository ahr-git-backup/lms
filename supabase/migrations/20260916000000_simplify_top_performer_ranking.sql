-- Top Performer leaderboard: shows every enrolled user who was eligible for
-- at least one live exam within the period (i.e. enrolled before that exam's
-- time_window_end) — whether they attended it or missed it. Missed exams do
-- not exclude a user; they just don't contribute a score for that exam.
-- Rank by average exam score % across attempted exams only (desc); tie-break
-- by average seconds per question (asc — faster wins).

DROP FUNCTION IF EXISTS public.get_top_performers(integer);

CREATE OR REPLACE FUNCTION public.get_top_performers(p_days integer DEFAULT 30)
RETURNS TABLE (
    profile_id uuid,
    full_name text,
    avatar_url text,
    college_name text,
    hsc_batch text,
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
    user_enrollment AS (
        SELECT e.profile_id, MIN(e.created_at) AS enrolled_at
        FROM public.enrollments e
        GROUP BY e.profile_id
    ),
    -- Every user eligible for at least one live exam in this period.
    eligible_users AS (
        SELECT DISTINCT ue.profile_id
        FROM user_enrollment ue
        JOIN live_exams le ON le.time_window_end >= ue.enrolled_at
    ),
    attempts_in_period AS (
        SELECT a.profile_id, a.exam_id, a.score, a.total_marks, a.time_taken_seconds,
               (SELECT COUNT(*) FROM public.exam_questions eq WHERE eq.exam_id = a.exam_id) AS q_count
        FROM public.exam_attempts a
        JOIN live_exams le ON le.id = a.exam_id
    ),
    per_user AS (
        SELECT
            ap.profile_id,
            COUNT(*) AS v_exam_count,
            AVG(CASE WHEN ap.total_marks > 0 THEN (ap.score / ap.total_marks) * 100 ELSE NULL END) AS v_avg_score_pct,
            AVG(CASE WHEN ap.time_taken_seconds > 0 AND ap.q_count > 0
                     THEN ap.time_taken_seconds::numeric / ap.q_count ELSE NULL END) AS v_avg_seconds_per_question
        FROM attempts_in_period ap
        GROUP BY ap.profile_id
    )
    SELECT
        eu.profile_id,
        p.full_name,
        p.avatar_url,
        p.college_name,
        p.hsc_batch,
        COALESCE(pu.v_exam_count, 0) AS exam_count,
        ROUND(COALESCE(pu.v_avg_score_pct, 0)::numeric, 2) AS avg_score_pct,
        ROUND(pu.v_avg_seconds_per_question::numeric, 1) AS avg_seconds_per_question,
        0::bigint AS class_watch_seconds,
        0::bigint AS focus_seconds,
        0::bigint AS active_days,
        ROUND(COALESCE(pu.v_avg_score_pct, 0)::numeric, 2) AS composite_score,
        RANK() OVER (
            ORDER BY COALESCE(pu.v_avg_score_pct, 0) DESC,
                     pu.v_avg_seconds_per_question ASC NULLS LAST
        ) AS rank_position
    FROM eligible_users eu
    JOIN public.profiles p ON p.id = eu.profile_id
    LEFT JOIN per_user pu ON pu.profile_id = eu.profile_id
    ORDER BY rank_position ASC, p.full_name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_top_performers(integer) TO authenticated;
