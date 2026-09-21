-- Two things that were silently failing on the live project (visible as constant 404/400 in the API logs):
-- 1) get_all_course_enrollment_counts() existed only as a migration file, never in the database (home page counts empty).
-- 2) class_comments.user_id referenced auth.users only, so the  profiles:profiles(full_name, avatar_url)  embed 400'd and
--    NO class comment could load. A second FK to public.profiles lets PostgREST resolve the embed.
CREATE OR REPLACE FUNCTION public.get_all_course_enrollment_counts()
RETURNS TABLE(course_id uuid, enrollment_count integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT course_id, COUNT(*)::integer AS enrollment_count FROM public.enrollments GROUP BY course_id; $$;
GRANT EXECUTE ON FUNCTION public.get_all_course_enrollment_counts() TO anon, authenticated;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'class_comments_user_id_profiles_fkey') THEN
    ALTER TABLE public.class_comments ADD CONSTRAINT class_comments_user_id_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';
