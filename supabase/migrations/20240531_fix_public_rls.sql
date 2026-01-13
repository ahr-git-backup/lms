
-- Additional RLS policies to ensure public access is consistent across content types

-- 1. Ensure 'classes' are viewable by anon if public (course_id IS NULL)
-- This might not be currently used by FreeClass (which uses notes), but good for future proofing if FreeClass starts using 'classes'.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'classes' AND policyname = 'Public classes are viewable by everyone'
    ) THEN
        CREATE POLICY "Public classes are viewable by everyone"
        ON classes FOR SELECT
        TO anon, authenticated
        USING (course_id IS NULL);
    END IF;
END
$$;

-- 2. Ensure 'exams' are viewable by anon if public (course_id IS NULL)
-- This IS used by FreeExam page.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'exams' AND policyname = 'Public exams are viewable by everyone'
    ) THEN
        CREATE POLICY "Public exams are viewable by everyone"
        ON exams FOR SELECT
        TO anon, authenticated
        USING (course_id IS NULL);
    END IF;
END
$$;
