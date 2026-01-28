
-- Ensure gender column exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reviews' AND column_name = 'gender') THEN
        ALTER TABLE reviews ADD COLUMN gender text DEFAULT 'male';
    END IF;
END $$;

-- Ensure image_url column exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reviews' AND column_name = 'image_url') THEN
        ALTER TABLE reviews ADD COLUMN image_url text;
    END IF;
END $$;

-- Ensure post_image_url column exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reviews' AND column_name = 'post_image_url') THEN
        ALTER TABLE reviews ADD COLUMN post_image_url text;
    END IF;
END $$;
