-- Admin-controlled toggle: when true, students may attempt a live exam more
-- than once. Every attempt is stored as its own row in exam_attempts (as
-- already supported by the attempt_number column), so all attempts —
-- including the 2nd, 3rd, etc. — naturally appear in leaderboard_exam_attempts
-- with no further changes needed there.

ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS allow_multiple_attempts boolean DEFAULT false NOT NULL;
