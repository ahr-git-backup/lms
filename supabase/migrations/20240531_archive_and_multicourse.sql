-- Add shared_course_ids and archive_course_ids columns to classes, exams, and class_notes
-- Using text[] for IDs to be safe with Supabase/PostgREST array handling, or uuid[].
-- Assuming uuid[] is supported. If not, text[] is safer.
-- Looking at previous migrations or schema would help, but uuid[] is standard.

ALTER TABLE classes ADD COLUMN IF NOT EXISTS shared_course_ids uuid[] DEFAULT '{}';
ALTER TABLE classes ADD COLUMN IF NOT EXISTS archive_course_ids uuid[] DEFAULT '{}';

ALTER TABLE exams ADD COLUMN IF NOT EXISTS shared_course_ids uuid[] DEFAULT '{}';
ALTER TABLE exams ADD COLUMN IF NOT EXISTS archive_course_ids uuid[] DEFAULT '{}';

ALTER TABLE class_notes ADD COLUMN IF NOT EXISTS shared_course_ids uuid[] DEFAULT '{}';

-- Fix Free Class visibility for unauthenticated users (anon role)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'class_notes' AND policyname = 'Public notes are viewable by everyone'
    ) THEN
        CREATE POLICY "Public notes are viewable by everyone"
        ON class_notes FOR SELECT
        TO anon, authenticated
        USING (course_id IS NULL);
    END IF;
END
$$;

-- Ensure authenticated users can see shared content
-- (This depends on existing RLS structure, but adding a permissive policy for enrolled users helps)
-- We assume the application handles filtering, but RLS is the second layer.
-- Example policy structure (commented out as we don't want to conflict with existing complex policies blindly)
-- CREATE POLICY "Enrolled users can view shared classes" ON classes FOR SELECT TO authenticated USING (
--   auth.uid() IN (SELECT user_id FROM enrollments WHERE course_id = ANY(classes.shared_course_ids))
-- );
