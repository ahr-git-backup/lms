-- Fix for "record 'v_request' has no field 'user_id'" error
-- Redefining functions to ensure robust handling of profile_id/user_id

-- 1. Redefine approve_payment_request
CREATE OR REPLACE FUNCTION public.approve_payment_request(p_request_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_course_id UUID;
    v_profile_id UUID;
BEGIN
    -- Check if user is admin
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access denied: User is not an admin';
    END IF;

    -- Get request details explicitly into variables
    SELECT course_id, profile_id INTO v_course_id, v_profile_id
    FROM public.payment_requests
    WHERE id = p_request_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment request not found';
    END IF;

    -- Update payment request status
    UPDATE public.payment_requests
    SET status = 'approved', updated_at = now()
    WHERE id = p_request_id;

    -- Insert enrollment (ignore if already exists)
    INSERT INTO public.enrollments (profile_id, course_id)
    VALUES (v_profile_id, v_course_id)
    ON CONFLICT (profile_id, course_id) DO NOTHING;

END;
$$;

-- 2. Redefine handle_payment_status_change trigger function
CREATE OR REPLACE FUNCTION public.handle_payment_status_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_user_id UUID;
    v_course_name TEXT;
    v_data JSONB;
    v_status TEXT;
BEGIN
    IF NEW.status = OLD.status THEN RETURN NEW; END IF;

    v_data := to_jsonb(NEW);

    -- Robust check for user_id or profile_id
    IF v_data ? 'user_id' THEN
        v_user_id := (v_data ->> 'user_id')::UUID;
    ELSIF v_data ? 'profile_id' THEN
        v_user_id := (v_data ->> 'profile_id')::UUID;
    END IF;

    IF v_user_id IS NULL THEN
        -- Fallback: try to select from table if JSONB conversion failed (rare)
        v_user_id := NEW.profile_id;
    END IF;

    IF v_user_id IS NULL THEN RETURN NEW; END IF;

    SELECT name INTO v_course_name FROM courses WHERE id = NEW.course_id;
    v_status := LOWER(NEW.status);

    IF v_status = 'approved' THEN
        INSERT INTO user_notifications (user_id, title, body, type)
        VALUES (
            v_user_id,
            'Course Enrollment Approved! 🎉',
            'Congratulations! Your payment for ' || COALESCE(v_course_name, 'the course') || ' has been approved.',
            'payment_approved'
        );
    ELSIF v_status IN ('rejected', 'declined') THEN
        INSERT INTO user_notifications (user_id, title, body, type)
        VALUES (
            v_user_id,
            'Enrollment Request Declined ⚠️',
            'Your payment request for ' || COALESCE(v_course_name, 'the course') || ' was declined.',
            'payment_rejected'
        );
    END IF;

    RETURN NEW;
END;
$$;
