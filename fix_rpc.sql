CREATE OR REPLACE FUNCTION public.get_student_exam_review(p_attempt_id uuid) RETURNS TABLE(question_id uuid, question_text text, option_a text, option_b text, option_c text, option_d text, correct_option text, marks numeric, explanation text, question_index integer)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_exam_id UUID;
    v_profile_id UUID;
    v_is_admin BOOLEAN;
BEGIN
    -- Get exam_id and profile_id from attempt
    SELECT exam_id, profile_id INTO v_exam_id, v_profile_id
    FROM exam_attempts
    WHERE id = p_attempt_id;

    -- Check if current user is admin
    v_is_admin := public.is_admin();

    -- Check if the user is the owner of the attempt or an admin
    IF v_profile_id != auth.uid() AND NOT v_is_admin THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    RETURN QUERY
    SELECT
        q.id as question_id,
        q.question_text,
        q.option_a,
        q.option_b,
        q.option_c,
        q.option_d,
        q.correct_option,
        q.marks,
        q.explanation,
        eq.question_index
    FROM exam_questions eq
    JOIN question_bank q ON eq.question_id = q.id
    WHERE eq.exam_id = v_exam_id
    ORDER BY eq.question_index ASC;
END;
$$;
