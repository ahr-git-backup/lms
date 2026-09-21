-- An archive class must always stay visible to its OWN course's students, on top of any extra courses the admin
-- picks manually (archive_course_ids). This trigger guarantees the class's own course_id is always part of
-- archive_course_ids, whichever way the class is saved (form, CSV/bulk, SQL). Extra manually-granted courses are
-- never removed. Existing rows are repaired by the UPDATE at the bottom.

CREATE OR REPLACE FUNCTION public.classes_keep_own_course_in_archive() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.is_archive IS TRUE OR NEW.also_archive IS TRUE) AND NEW.course_id IS NOT NULL THEN
    IF NEW.archive_course_ids IS NULL OR NOT (NEW.course_id = ANY(NEW.archive_course_ids)) THEN
      NEW.archive_course_ids := COALESCE(NEW.archive_course_ids, '{}'::uuid[]) || NEW.course_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_classes_keep_own_course_in_archive ON public.classes;
CREATE TRIGGER trg_classes_keep_own_course_in_archive
  BEFORE INSERT OR UPDATE OF course_id, archive_course_ids, is_archive, also_archive ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.classes_keep_own_course_in_archive();

UPDATE public.classes SET archive_course_ids = archive_course_ids
WHERE (is_archive OR also_archive) AND course_id IS NOT NULL
  AND NOT (COALESCE(archive_course_ids, '{}') && ARRAY[course_id]);
