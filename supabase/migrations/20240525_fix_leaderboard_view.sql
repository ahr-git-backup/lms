DROP VIEW IF EXISTS public.leaderboard_exam_attempts;

CREATE VIEW public.leaderboard_exam_attempts AS
 SELECT a.id,
    a.exam_id,
    a.profile_id,
    a.score,
    a.started_at,
    a.submitted_at,
    a.attempt_type,
    a.created_at,
    jsonb_build_object('full_name', p.full_name, 'registration_id', p.registration_id, 'is_second_timer', p.is_second_timer) AS profile,
    a.attempt_number,
    a.time_taken_seconds
   FROM (public.exam_attempts a
     JOIN public.profiles p ON ((p.id = a.profile_id)));

GRANT SELECT ON public.leaderboard_exam_attempts TO authenticated;
GRANT SELECT ON public.leaderboard_exam_attempts TO service_role;
