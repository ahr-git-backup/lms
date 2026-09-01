-- Model Test: allow admin to rename an existing mode's display label.

CREATE OR REPLACE FUNCTION public.rename_model_test_mode(p_mode_key text, p_new_label text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin can rename modes';
  END IF;
  IF p_new_label IS NULL OR trim(p_new_label) = '' THEN
    RAISE EXCEPTION 'Label cannot be empty';
  END IF;
  UPDATE public.model_test_modes SET label = trim(p_new_label) WHERE mode_key = p_mode_key;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mode not found';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rename_model_test_mode(text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
