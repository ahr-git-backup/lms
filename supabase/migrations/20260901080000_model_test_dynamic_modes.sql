-- Model Test: replace hardcoded Standard/Standard+Hard with an
-- admin-managed modes table. Admin can add/rename/delete/reorder modes
-- freely from the UI; existing_bank/csv sources still key off mode (now a
-- free text key referencing this table instead of a fixed CHECK).

CREATE TABLE IF NOT EXISTS public.model_test_modes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode_key text NOT NULL UNIQUE,   -- slug used everywhere mode is stored/passed
  label text NOT NULL,             -- display name shown to admin/student
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.model_test_modes (mode_key, label, sort_order) VALUES
  ('standard', 'Standard', 1),
  ('standard_hard', 'Standard+Hard', 2)
ON CONFLICT (mode_key) DO NOTHING;

ALTER TABLE public.model_test_modes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "model_test_modes_read_all" ON public.model_test_modes;
CREATE POLICY "model_test_modes_read_all" ON public.model_test_modes FOR SELECT USING (true);

DROP POLICY IF EXISTS "model_test_modes_admin_write" ON public.model_test_modes;
CREATE POLICY "model_test_modes_admin_write" ON public.model_test_modes FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Drop the old fixed CHECK on model_test_sources.mode; it now references
-- model_test_modes(mode_key) dynamically instead of a hardcoded set.
ALTER TABLE public.model_test_sources DROP CONSTRAINT IF EXISTS model_test_sources_mode_check;
ALTER TABLE public.model_test_sources
  ADD CONSTRAINT model_test_sources_mode_fkey FOREIGN KEY (mode)
    REFERENCES public.model_test_modes(mode_key) ON DELETE RESTRICT;

-- RPC: admin adds a new mode.
CREATE OR REPLACE FUNCTION public.add_model_test_mode(p_key text, p_label text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_next_sort int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin can add modes';
  END IF;
  IF p_key IS NULL OR trim(p_key) = '' OR p_label IS NULL OR trim(p_label) = '' THEN
    RAISE EXCEPTION 'Mode key and label are required';
  END IF;

  SELECT COALESCE(MAX(sort_order), 0) + 1 INTO v_next_sort FROM public.model_test_modes;

  INSERT INTO public.model_test_modes (mode_key, label, sort_order)
  VALUES (lower(regexp_replace(trim(p_key), '[^a-zA-Z0-9]+', '_', 'g')), trim(p_label), v_next_sort)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_model_test_mode(text, text) TO authenticated;

-- RPC: admin deletes a mode (blocks if sources still exist under it).
CREATE OR REPLACE FUNCTION public.delete_model_test_mode(p_mode_key text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin can delete modes';
  END IF;
  IF EXISTS (SELECT 1 FROM public.model_test_sources WHERE mode = p_mode_key) THEN
    RAISE EXCEPTION 'Remove all sources under this mode before deleting it';
  END IF;
  DELETE FROM public.model_test_modes WHERE mode_key = p_mode_key;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_model_test_mode(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
