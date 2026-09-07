-- Turn enrollment count display OFF by default (both for existing courses and new ones).
ALTER TABLE public.courses
  ALTER COLUMN show_enrollment_count SET DEFAULT false;

-- Also flip existing courses to off, since they were created under the old (true) default.
UPDATE public.courses SET show_enrollment_count = false;

COMMENT ON COLUMN public.courses.show_enrollment_count IS 'If true, show the "X জন ভর্তি হয়েছে" enrollment count block on the public course pages. Defaults to false (hidden).';
