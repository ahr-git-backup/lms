-- Admin-controlled label for the second course-details tab (default "Demo Class"),
-- so admins can rename it (e.g. "Free Class", "Sample Lecture") per course.
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS demo_tab_label text;

COMMENT ON COLUMN public.courses.demo_tab_label IS 'Custom label for the demo-content tab on the public course details page. Falls back to "Demo Class" if null/empty.';
