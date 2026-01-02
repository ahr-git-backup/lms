-- 1) Restrict profiles exposure and add leaderboard view

-- Revert broad profiles SELECT policy if present
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;

-- Ensure users can view only their own profile (keep admin policy as-is)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Users can view own profile'
  ) THEN
    CREATE POLICY "Users can view own profile" ON public.profiles
      FOR SELECT USING (auth.uid() = id);
  END IF;
END $$;

-- Create a dedicated leaderboard view exposing only non-sensitive fields
CREATE OR REPLACE VIEW public.leaderboard_exam_attempts AS
SELECT
  ea.id,
  ea.exam_id,
  ea.score,
  ea.total_marks,
  ea.time_taken_seconds,
  ea.submitted_at,
  ea.attempt_number,
  ea.attempt_type,
  ea.profile_id,
  p.full_name,
  p.registration_id,
  p.batch_year,
  p.is_second_timer
FROM public.exam_attempts ea
JOIN public.profiles p
  ON p.id = ea.profile_id;

GRANT SELECT ON public.leaderboard_exam_attempts TO authenticated;

-- 2) Add validation to submit_exam_attempt RPC

CREATE OR REPLACE FUNCTION submit_exam_attempt(
    p_exam_id UUID,
    p_answers JSONB,
    p_violation_count INTEGER DEFAULT 0,
    p_time_taken_seconds INTEGER DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_attempt_id UUID;
    v_total_score NUMERIC := 0;
    v_raw_score NUMERIC := 0;
    v_negative_mark NUMERIC;
    v_exam_total_marks NUMERIC;
    v_is_second_timer BOOLEAN;
    v_answer RECORD;
    v_correct_option TEXT;
    v_question_marks NUMERIC;
    v_deduction NUMERIC := 0;
    v_attempt_number INTEGER;
    v_exam_type TEXT;
    v_time_window_end TIMESTAMPTZ;
    v_attempt_type TEXT := 'practice';
    v_question_count INTEGER := 0;
    v_duration_minutes INTEGER;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Basic bounds validation
    IF p_violation_count < 0 OR p_violation_count > 100 THEN
        RAISE EXCEPTION 'Invalid violation count';
    END IF;

    -- Get Exam Details
    SELECT COALESCE(negative_mark_per_question, 0),
           COALESCE(total_marks, 0),
           exam_type,
           time_window_end,
           duration_minutes
    INTO v_negative_mark, v_exam_total_marks, v_exam_type, v_time_window_end, v_duration_minutes
    FROM public.exams
    WHERE id = p_exam_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Exam not found';
    END IF;

    -- Validate time taken: not negative and not absurdly large (2x duration)
    IF p_time_taken_seconds < 0 OR p_time_taken_seconds > (v_duration_minutes * 120) THEN
        RAISE EXCEPTION 'Invalid time taken';
    END IF;

    -- Determine Attempt Type (Live vs Practice)
    IF v_exam_type = 'live' AND v_time_window_end IS NOT NULL AND now() <= v_time_window_end THEN
        v_attempt_type := 'live';
    ELSE
        v_attempt_type := 'practice';
    END IF;

    -- Calculate Score with per-answer validation
    FOR v_answer IN SELECT * FROM jsonb_to_recordset(p_answers) AS x(question_id UUID, selected_option TEXT)
    LOOP
        -- Ensure question belongs to this exam
        SELECT correct_option, COALESCE(marks, 1) INTO v_correct_option, v_question_marks
        FROM public.exam_questions
        WHERE id = v_answer.question_id
          AND exam_id = p_exam_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Invalid question ID % for exam %', v_answer.question_id, p_exam_id;
        END IF;

        -- Validate selected option
        IF v_answer.selected_option IS NOT NULL AND v_answer.selected_option <> ''
           AND v_answer.selected_option NOT IN ('A', 'B', 'C', 'D') THEN
            RAISE EXCEPTION 'Invalid option selected: %', v_answer.selected_option;
        END IF;

        IF v_answer.selected_option = v_correct_option THEN
            v_raw_score := v_raw_score + v_question_marks;
        ELSIF v_answer.selected_option IS NOT NULL AND v_answer.selected_option <> '' THEN
            v_raw_score := v_raw_score - v_negative_mark;
        END IF;

        v_question_count := v_question_count + 1;
    END LOOP;

    -- Second Timer Logic
    SELECT is_second_timer INTO v_is_second_timer
    FROM public.profiles
    WHERE id = v_user_id;

    IF v_is_second_timer THEN
        IF v_question_count >= 100 THEN
            v_deduction := 3;
        ELSIF v_question_count >= 50 THEN
            v_deduction := 1.5;
        ELSIF v_question_count >= 30 THEN
            v_deduction := 1;
        END IF;
    END IF;

    v_total_score := v_raw_score - v_deduction;

    -- Calculate Attempt Number based on existing logs
    SELECT count(*) + 1 INTO v_attempt_number
    FROM public.study_activity_logs
    WHERE user_id = v_user_id
      AND activity_type = 'exam'
      AND (metadata->>'exam_id')::UUID = p_exam_id;

    -- Delete previous attempts (Single Record Policy)
    DELETE FROM public.exam_attempts
    WHERE exam_id = p_exam_id AND profile_id = v_user_id;

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
            'attempt_type', v_attempt_type
        )
    );

    RETURN v_attempt_id;
END;
$$;

-- 3) Ensure class_notes table exists to match schema

CREATE TABLE IF NOT EXISTS public.class_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  chapter TEXT,
  topic TEXT,
  notes_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
