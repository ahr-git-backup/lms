CREATE OR REPLACE VIEW public.leaderboard_exam_attempts WITH (security_invoker='true') AS
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
    (EXTRACT(epoch FROM (COALESCE(a.submitted_at, a.created_at) - a.started_at)))::integer AS time_taken_seconds
   FROM (public.exam_attempts a
     JOIN public.profiles p ON ((p.id = a.profile_id)));
