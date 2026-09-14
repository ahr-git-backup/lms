-- Success Gallery: student achievement photos shown on the homepage
CREATE TABLE IF NOT EXISTS public.success_gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text NOT NULL,
  caption text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.success_gallery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Success gallery is publicly readable"
  ON public.success_gallery FOR SELECT
  USING (true);

CREATE POLICY "Admins and teachers can manage success gallery"
  ON public.success_gallery FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'teacher'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'teacher'));

-- Section heading/subtitle settings (singleton row, id = 1)
CREATE TABLE IF NOT EXISTS public.success_gallery_settings (
  id integer PRIMARY KEY DEFAULT 1,
  title text,
  subtitle text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT success_gallery_settings_singleton CHECK (id = 1)
);

INSERT INTO public.success_gallery_settings (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.success_gallery_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Success gallery settings are publicly readable"
  ON public.success_gallery_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins and teachers can manage success gallery settings"
  ON public.success_gallery_settings FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'teacher'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'teacher'));
