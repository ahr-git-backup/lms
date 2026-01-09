-- Allow public (anon) access to exams that have no course_id (public exams)
CREATE POLICY "Public can view public exams" ON public.exams
FOR SELECT
TO anon
USING (course_id IS NULL AND is_published = true);
