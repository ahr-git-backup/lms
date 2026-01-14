-- Optimize submit_exam_attempt to use set-based SQL (CPU Fix)
CREATE OR REPLACE FUNCTION public.submit_exam_attempt(p_exam_id uuid, p_answers jsonb, p_violation_count integer DEFAULT 0, p_time_taken_seconds integer DEFAULT 0) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_attempt_id UUID;
    v_total_score NUMERIC := 0;
    v_raw_score NUMERIC := 0;
    v_negative_mark NUMERIC;
    v_exam_total_marks NUMERIC;
    v_is_second_timer BOOLEAN;
    v_deduction NUMERIC := 0;
    v_attempt_number INTEGER;
    v_exam_type TEXT;
    v_time_window_end TIMESTAMPTZ;
    v_attempt_type TEXT := 'practice';
    v_question_count INTEGER := 0;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Calculate Attempt Number based on existing logs (before deleting attempt)
    SELECT count(*) + 1 INTO v_attempt_number
    FROM public.study_activity_logs
    WHERE user_id = v_user_id
    AND activity_type = 'exam'
    AND (metadata->>'exam_id')::UUID = p_exam_id;

    -- Delete previous attempts (Single Record Policy)
    DELETE FROM public.exam_attempts
    WHERE exam_id = p_exam_id AND profile_id = v_user_id;

    -- Get Exam Details
    SELECT COALESCE(negative_mark_per_question, 0), COALESCE(total_marks, 0), exam_type, time_window_end
    INTO v_negative_mark, v_exam_total_marks, v_exam_type, v_time_window_end
    FROM public.exams
    WHERE id = p_exam_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Exam not found';
    END IF;

    -- Determine Attempt Type (Live vs Practice)
    IF v_exam_type = 'live' AND v_time_window_end IS NOT NULL AND now() <= v_time_window_end THEN
        v_attempt_type := 'live';
    ELSE
        v_attempt_type := 'practice';
    END IF;

    -- OPTIMIZATION: Set-based Score Calculation
    -- Replaces loop with single query joining JSON answers to questions table
    WITH student_answers AS (
        SELECT * FROM jsonb_to_recordset(p_answers) AS x(question_id UUID, selected_option TEXT)
    ),
    scored_answers AS (
        SELECT
            sa.question_id,
            sa.selected_option,
            eq.correct_option,
            COALESCE(eq.marks, 1) as marks
        FROM student_answers sa
        JOIN public.exam_questions eq ON sa.question_id = eq.id
        WHERE eq.exam_id = p_exam_id -- Ensure we only join questions for this exam
    )
    SELECT
        COALESCE(SUM(
            CASE
                WHEN selected_option = correct_option THEN marks
                WHEN selected_option IS NOT NULL AND selected_option <> '' THEN -v_negative_mark
                ELSE 0
            END
        ), 0)
    INTO v_raw_score
    FROM scored_answers;

    -- Second Timer Logic
    SELECT COALESCE(is_second_timer, false) INTO v_is_second_timer
    FROM public.profiles
    WHERE id = v_user_id;

    IF v_is_second_timer THEN
        -- Calculate question count for the exam
        SELECT count(*) INTO v_question_count
        FROM public.exam_questions
        WHERE exam_id = p_exam_id;

        -- Use question count for deduction logic
        IF v_question_count >= 100 THEN
            v_deduction := 3;
        ELSIF v_question_count >= 50 THEN
            v_deduction := 1.5;
        ELSIF v_question_count >= 30 THEN
            v_deduction := 1;
        END IF;
    END IF;

    v_total_score := v_raw_score - v_deduction;

    -- Create Attempt Record
    INSERT INTO public.exam_attempts (
        exam_id,
        profile_id,
        score,
        total_marks,
        started_at,
        submitted_at,
        violation_count,
        answers,
        time_taken_seconds,
        attempt_number,
        attempt_type
    )
    VALUES (
        p_exam_id,
        v_user_id,
        v_total_score,
        v_total_score,
        now(),
        now(),
        p_violation_count,
        p_answers,
        p_time_taken_seconds,
        v_attempt_number,
        v_attempt_type
    )
    RETURNING id INTO v_attempt_id;

    -- Log Activity
    INSERT INTO public.study_activity_logs (
        user_id,
        activity_type,
        duration_seconds,
        metadata
    ) VALUES (
        v_user_id,
        'exam',
        p_time_taken_seconds,
        jsonb_build_object(
            'exam_id', p_exam_id,
            'attempt_id', v_attempt_id,
            'score', v_total_score,
            'raw_score', v_raw_score,
            'deduction', v_deduction,
            'attempt_number', v_attempt_number,
            'attempt_type', v_attempt_type,
            'is_second_timer', v_is_second_timer,
            'question_count', v_question_count
        )
    );

    RETURN v_attempt_id;
END;
$$;
