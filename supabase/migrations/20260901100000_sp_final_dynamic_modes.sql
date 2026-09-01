-- Subject/Paper Final: replace hardcoded medical_standard/standard_hard/
-- varsity_standard with an admin-managed modes table, same pattern as
-- Model Test's model_test_modes. get_sp_final_items can no longer return
-- fixed per-mode columns since modes are dynamic now -- returns a jsonb
-- map {mode_key: configured_count} instead; frontend reads
-- item.mode_counts[mode_key] || 0.

CREATE TABLE public.sp_final_modes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode_key text NOT NULL UNIQUE,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.sp_final_modes (mode_key, label, sort_order) VALUES
  ('medical_standard', 'Medical Standard', 1),
  ('standard_hard', 'Standard+Hard', 2),
  ('varsity_standard', 'Varsity Standard', 3);

ALTER TABLE public.sp_final_modes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sp_final_modes_read_all" ON public.sp_final_modes FOR SELECT USING (true);
CREATE POLICY "sp_final_modes_admin_write" ON public.sp_final_modes FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

ALTER TABLE public.sp_final_sources DROP CONSTRAINT IF EXISTS sp_final_sources_mode_check;
ALTER TABLE public.sp_final_sources DROP CONSTRAINT IF EXISTS sp_final_sources_mode_fkey;
ALTER TABLE public.sp_final_sources
  ADD CONSTRAINT sp_final_sources_mode_fkey FOREIGN KEY (mode)
    REFERENCES public.sp_final_modes(mode_key) ON DELETE RESTRICT;

-- sp_final_attempts may not exist in every environment (older/newer
-- deploys) -- guard the constraint swap so this migration is safe either way.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sp_final_attempts') THEN
    ALTER TABLE public.sp_final_attempts DROP CONSTRAINT IF EXISTS sp_final_attempts_mode_check;
    ALTER TABLE public.sp_final_attempts DROP CONSTRAINT IF EXISTS sp_final_attempts_mode_fkey;
    ALTER TABLE public.sp_final_attempts
      ADD CONSTRAINT sp_final_attempts_mode_fkey FOREIGN KEY (mode)
        REFERENCES public.sp_final_modes(mode_key) ON DELETE RESTRICT;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.get_sp_final_items(text);

CREATE OR REPLACE FUNCTION public.get_sp_final_items(p_category text)
RETURNS TABLE(id uuid, name text, sort_order integer, mode_counts jsonb)
LANGUAGE sql SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    i.id, i.name, i.sort_order,
    COALESCE(
      (SELECT jsonb_object_agg(s.mode, s.total)
       FROM (
         SELECT mode, SUM(question_count)::integer AS total
         FROM public.sp_final_sources
         WHERE item_id = i.id
         GROUP BY mode
       ) s),
      '{}'::jsonb
    )
  FROM public.sp_final_items i
  WHERE i.category = p_category AND i.is_hidden = false
  GROUP BY i.id, i.name, i.sort_order
  ORDER BY i.sort_order ASC, i.name ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_sp_final_items(text) TO authenticated, anon, service_role;

-- Add/rename/delete mode RPCs, same pattern as Model Test.
CREATE OR REPLACE FUNCTION public.add_sp_final_mode(p_key text, p_label text)
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
  SELECT COALESCE(MAX(sort_order), 0) + 1 INTO v_next_sort FROM public.sp_final_modes;
  INSERT INTO public.sp_final_modes (mode_key, label, sort_order)
  VALUES (lower(regexp_replace(trim(p_key), '[^a-zA-Z0-9]+', '_', 'g')), trim(p_label), v_next_sort)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_sp_final_mode(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.rename_sp_final_mode(p_mode_key text, p_new_label text)
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
  UPDATE public.sp_final_modes SET label = trim(p_new_label) WHERE mode_key = p_mode_key;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mode not found';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rename_sp_final_mode(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_sp_final_mode(p_mode_key text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin can delete modes';
  END IF;
  IF EXISTS (SELECT 1 FROM public.sp_final_sources WHERE mode = p_mode_key) THEN
    RAISE EXCEPTION 'Remove all sources under this mode before deleting it';
  END IF;
  DELETE FROM public.sp_final_modes WHERE mode_key = p_mode_key;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_sp_final_mode(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
