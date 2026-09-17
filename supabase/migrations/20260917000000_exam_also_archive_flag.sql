-- Same dual-presence mechanism as classes.also_archive, but for exams:
-- an exam can stay visible in its normal Live/Practice listing AND
-- also show in the central Archive at the same time.

ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS also_archive boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_exams_also_archive
  ON public.exams (also_archive) WHERE also_archive = true;

-- Course-level "All Archive Exams" toggle, mirroring archive_full_access
-- for classes. Lets admins grant a course full access to every archive
-- exam (including future ones) instead of picking subject/chapter by
-- subject/chapter via course_readymade_access (mode='archive-exam').
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS archive_exam_full_access boolean DEFAULT false;

COMMENT ON COLUMN public.courses.archive_exam_full_access IS 'If true, students enrolled in this course have access to all Archive Exams (including future ones), bypassing per-chapter course_readymade_access grants.';
