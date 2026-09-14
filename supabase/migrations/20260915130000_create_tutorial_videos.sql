-- Multiple captioned tutorial videos for the "Watch Tutorial" dashboard page
CREATE TABLE IF NOT EXISTS public.tutorial_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caption text NOT NULL,
  video_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tutorial_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tutorial videos"
  ON public.tutorial_videos FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage tutorial videos"
  ON public.tutorial_videos FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
