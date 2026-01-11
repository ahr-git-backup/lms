
ALTER TABLE public.courses
ADD COLUMN category text,
ADD COLUMN sub_category text,
ADD COLUMN priority integer DEFAULT 0;

-- Optional: Add an index for better filtering performance if needed in the future
-- CREATE INDEX idx_courses_category ON public.courses(category);
