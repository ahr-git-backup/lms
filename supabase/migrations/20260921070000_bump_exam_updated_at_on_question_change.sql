-- When MCQs of an exam are added/edited/deleted, bump exams.updated_at so student-side question caches can invalidate.
CREATE OR REPLACE FUNCTION public.bump_exam_updated_at_on_question_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.exams SET updated_at = now() WHERE id IN (SELECT DISTINCT exam_id FROM old_rows);
  ELSE
    UPDATE public.exams SET updated_at = now() WHERE id IN (SELECT DISTINCT exam_id FROM new_rows);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS exam_questions_bump_updated_ins ON public.exam_questions;
DROP TRIGGER IF EXISTS exam_questions_bump_updated_upd ON public.exam_questions;
DROP TRIGGER IF EXISTS exam_questions_bump_updated_del ON public.exam_questions;
CREATE TRIGGER exam_questions_bump_updated_ins AFTER INSERT ON public.exam_questions
  REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.bump_exam_updated_at_on_question_change();
CREATE TRIGGER exam_questions_bump_updated_upd AFTER UPDATE ON public.exam_questions
  REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.bump_exam_updated_at_on_question_change();
CREATE TRIGGER exam_questions_bump_updated_del AFTER DELETE ON public.exam_questions
  REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION public.bump_exam_updated_at_on_question_change();

-- One-time: invalidate all existing student caches.
UPDATE public.exams SET updated_at = now() WHERE exam_type = 'special';
