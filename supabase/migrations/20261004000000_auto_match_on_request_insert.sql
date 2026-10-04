-- Auto-approve a new payment request when its matching SMS already arrived.
-- Match rule is the same as QuizBot's sms_payment_relay.py:
--   amount equal + last 5 digits of sender equal, SMS unmatched/error, within 48h.
-- approve_payment_request() can't be used here (it requires is_admin()), so the
-- same steps are done inline: approve, enroll, confirm email, mark SMS matched.

CREATE OR REPLACE FUNCTION public.auto_match_pending_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sms RECORD;
BEGIN
    IF NEW.status IS DISTINCT FROM 'pending'
       OR NEW.amount_sent IS NULL
       OR NEW.sender_last5 IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT id, amount, sender_phone
    INTO v_sms
    FROM public.sms_payment_relay_log
    WHERE status IN ('unmatched', 'error')
      AND amount = NEW.amount_sent
      AND sender_phone IS NOT NULL
      AND right(sender_phone, 5) = NEW.sender_last5
      AND created_at >= now() - interval '48 hours'
    ORDER BY created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN NEW;
    END IF;

    UPDATE public.payment_requests
    SET status = 'approved', updated_at = now()
    WHERE id = NEW.id;

    INSERT INTO public.enrollments (profile_id, course_id)
    VALUES (NEW.profile_id, NEW.course_id)
    ON CONFLICT (profile_id, course_id) DO NOTHING;

    UPDATE auth.users
    SET email_confirmed_at = COALESCE(email_confirmed_at, now())
    WHERE id = NEW.profile_id AND email_confirmed_at IS NULL;

    UPDATE public.sms_payment_relay_log
    SET status = 'matched',
        matched_payment_request_id = NEW.id,
        note = 'Auto-approved (request created after SMS)'
    WHERE id = v_sms.id;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_match_pending_request ON public.payment_requests;
CREATE TRIGGER trg_auto_match_pending_request
AFTER INSERT ON public.payment_requests
FOR EACH ROW
EXECUTE FUNCTION public.auto_match_pending_request();
