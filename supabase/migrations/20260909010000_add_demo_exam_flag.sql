-- Adds a flag so admins can mark an exam to appear in a course's "Demo" tab.
-- Demo exams are also expected to have is_visible_on_free = true and
-- allow_guest = true set (handled automatically by the admin UI toggle)
-- so that TakeExam.tsx's existing access-control logic lets any visitor
-- (enrolled or not, logged in or not) attempt them.

ALTER TABLE public.exams
ADD COLUMN IF NOT EXISTS is_demo_exam boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_exams_demo_course
  ON public.exams (course_id)
  WHERE is_demo_exam = true;
