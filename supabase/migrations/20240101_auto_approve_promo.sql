-- Trigger function to automatically approve promo-free requests
CREATE OR REPLACE FUNCTION public.handle_promo_payment_request()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if it's a promo-free request
    IF NEW.trx_id = 'PROMO-FREE' THEN
        NEW.status := 'approved';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to run BEFORE INSERT
DROP TRIGGER IF EXISTS trigger_auto_approve_promo_before ON public.payment_requests;
CREATE TRIGGER trigger_auto_approve_promo_before
    BEFORE INSERT ON public.payment_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_promo_payment_request();

-- Trigger function to handle actions after a request is inserted as approved
CREATE OR REPLACE FUNCTION public.handle_approved_payment_insert()
RETURNS TRIGGER AS $$
DECLARE
    v_course_name TEXT;
BEGIN
    IF NEW.status = 'approved' THEN
        -- 1. Create Enrollment
        INSERT INTO public.enrollments (profile_id, course_id)
        VALUES (NEW.profile_id, NEW.course_id)
        ON CONFLICT (profile_id, course_id) DO NOTHING;

        -- 2. Send Notification
        SELECT name INTO v_course_name FROM public.courses WHERE id = NEW.course_id;

        INSERT INTO public.user_notifications (user_id, title, body, type)
        VALUES (
            NEW.profile_id,
            'Course Enrollment Approved! 🎉',
            'Congratulations! Your enrollment for ' || COALESCE(v_course_name, 'the course') || ' has been approved automatically.',
            'payment_approved'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to run AFTER INSERT
DROP TRIGGER IF EXISTS trigger_handle_approved_insert ON public.payment_requests;
CREATE TRIGGER trigger_handle_approved_insert
    AFTER INSERT ON public.payment_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_approved_payment_insert();
