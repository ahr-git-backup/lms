-- Duration is no longer mandatory when creating an exam.
ALTER TABLE public.exams ALTER COLUMN duration_minutes DROP NOT NULL;
