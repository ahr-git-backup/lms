-- BUG FIX: get_exam_attempt_for_review raised 'Unauthorized' for ANY
-- attempt not owned by the caller, with no staff/admin override. This
-- meant the Leaderboard "Review" button (which is only shown to staff,
-- specifically so they can review OTHER students' attempts) always
-- failed silently — ExamReview.tsx caught the RPC error and rendered
-- nothing.
--
-- Fix: allow the call through when the caller is staff (is_staff()),
-- in addition to the existing owner/guest-attempt rules.

CREATE OR REPLACE FUNCTION public.get_exam_attempt_for_review(p_attempt_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_profile_id UUID;
    v_result JSONB;
BEGIN
    SELECT profile_id INTO v_profile_id
    FROM public.exam_attempts
    WHERE id = p_attempt_id;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Owner can always view their own attempt; a guest attempt
    -- (profile_id NULL) is accessible to anyone holding the attempt id;
    -- staff/admin can view any attempt (needed for the Leaderboard
    -- "Review" button, which reviews other students' attempts).
    IF v_profile_id IS NOT NULL
       AND v_profile_id != auth.uid()
       AND NOT public.is_staff() THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT to_jsonb(a) || jsonb_build_object('exam', to_jsonb(e))
    INTO v_result
    FROM public.exam_attempts a
    JOIN public.exams e ON e.id = a.exam_id
    WHERE a.id = p_attempt_id;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_exam_attempt_for_review(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_exam_attempt_for_review(uuid) TO anon;

NOTIFY pgrst, 'reload schema';
