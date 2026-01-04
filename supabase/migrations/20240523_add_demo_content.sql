
ALTER TABLE public.courses
ADD COLUMN demo_content jsonb DEFAULT '[]'::jsonb;
