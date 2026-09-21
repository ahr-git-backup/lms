-- record_class_view() referenced columns that do not exist on class_views (first_viewed_at/last_viewed_at/view_count),
-- so every call failed with 400 and NO view was ever recorded. Fixed to use the real columns.
-- One row per (student, class) via the existing unique (profile_id, class_id) index: re-watching never inflates the count.
CREATE OR REPLACE FUNCTION public.record_class_view(p_class_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  INSERT INTO public.class_views (class_id, profile_id) VALUES (p_class_id, auth.uid())
  ON CONFLICT (profile_id, class_id) DO NOTHING;
END $$;
GRANT EXECUTE ON FUNCTION public.record_class_view(uuid) TO authenticated;
