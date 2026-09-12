-- Student self-service "pay off due" flow.
--
-- Students can now submit a bKash/Nagad transaction against their own
-- overdue payment_request row (course due_amount > amount_paid). The
-- submission is recorded immediately as an emi_logs entry and applied to
-- amount_paid right away (no gateway exists in this app — all payments here
-- are manually-claimed trx ids, so this mirrors how admin's own "reduce due"
-- action already works). Admins can still see every submission in the
-- existing EMI History tab and edit/correct it there (e.g. if a trx id turns
-- out to be fake, they can adjust amount_paid back down manually).
--
-- Previously emi_logs was admin-only (RLS-wise), so students couldn't even
-- see their own partial-payment history despite StudentProfile querying it.

-- 1. Students may view their own EMI log rows.
CREATE POLICY "Users can view own emi_logs" ON public.emi_logs
  FOR SELECT USING (auth.uid() = profile_id);

-- 2. RPC: student submits a due payment. Verifies the payment_request
--    belongs to the caller and has remaining due, applies the amount,
--    and logs it. SECURITY DEFINER because emi_logs INSERT has no student
--    policy (admin-only writes) and payment_requests UPDATE is admin-only;
--    this function is the sole sanctioned student-facing write path.
CREATE OR REPLACE FUNCTION public.submit_due_payment(
  p_payment_request_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_sender_last5 text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.payment_requests;
  v_remaining numeric;
  v_new_paid numeric;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;

  SELECT * INTO v_request
  FROM public.payment_requests
  WHERE id = p_payment_request_id
    AND profile_id = auth.uid()
  FOR UPDATE;

  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Payment request not found';
  END IF;

  v_remaining := COALESCE(v_request.due_amount, 0) - COALESCE(v_request.amount_paid, 0);
  IF v_remaining <= 0 THEN
    RAISE EXCEPTION 'No due amount remaining for this course';
  END IF;

  v_new_paid := COALESCE(v_request.amount_paid, 0) + p_amount;

  UPDATE public.payment_requests
  SET amount_paid = v_new_paid,
      admin_note = COALESCE(admin_note || E'\n', '') ||
        'Student self-paid ৳' || p_amount || ' via ' || p_payment_method || ' (last5: ' || p_sender_last5 || ')',
      updated_at = now()
  WHERE id = p_payment_request_id;

  INSERT INTO public.emi_logs (payment_request_id, profile_id, course_id, amount, admin_note)
  VALUES (
    p_payment_request_id,
    v_request.profile_id,
    v_request.course_id,
    p_amount,
    'Self-service payment via ' || p_payment_method || ' (last5: ' || p_sender_last5 || ')'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_due_payment(uuid, numeric, text, text) TO authenticated;

-- 3. Support WhatsApp number, stored in the existing public app_settings
--    key/value table (publicly readable, admin-writable). Seed a
--    placeholder the admin should replace via AdminPayments.
INSERT INTO public.app_settings (key, value)
VALUES ('support_whatsapp_number', '"8801999681290"'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
