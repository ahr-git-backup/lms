
-- Add linked_course_ids to courses if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'courses' AND column_name = 'linked_course_ids') THEN
        ALTER TABLE courses ADD COLUMN linked_course_ids text[] DEFAULT '{}';
    END IF;
END $$;

-- Create reviews table if not exists
CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,
    student_name text NOT NULL,
    college_name text,
    review_text text,
    rating integer DEFAULT 5,
    gender text DEFAULT 'male',
    image_url text,
    post_image_url text,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS on reviews
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Allow public read access to reviews
DROP POLICY IF EXISTS "Public reviews are viewable by everyone" ON reviews;
CREATE POLICY "Public reviews are viewable by everyone" ON reviews FOR SELECT USING (true);

-- Allow admin insert/update/delete
-- Assuming admin has role or check via auth.uid()
DROP POLICY IF EXISTS "Admins can manage reviews" ON reviews;
CREATE POLICY "Admins can manage reviews" ON reviews USING (
    (SELECT role FROM user_roles WHERE user_id = auth.uid()) = 'admin'
) WITH CHECK (
    (SELECT role FROM user_roles WHERE user_id = auth.uid()) = 'admin'
);


-- If reviews table existed but missing post_image_url
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reviews' AND column_name = 'post_image_url') THEN
        ALTER TABLE reviews ADD COLUMN post_image_url text;
    END IF;
END $$;

-- Add is_visible_on_free to exams if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exams' AND column_name = 'is_visible_on_free') THEN
        ALTER TABLE exams ADD COLUMN is_visible_on_free boolean DEFAULT true;
    END IF;
END $$;
