
-- Convert category and sub_category to text arrays
ALTER TABLE public.courses
ALTER COLUMN category TYPE text[] USING CASE
    WHEN category IS NULL THEN '{}'::text[]
    WHEN category = '' THEN '{}'::text[]
    ELSE ARRAY[category]
END,
ALTER COLUMN sub_category TYPE text[] USING CASE
    WHEN sub_category IS NULL THEN '{}'::text[]
    WHEN sub_category = '' THEN '{}'::text[]
    ELSE ARRAY[sub_category]
END;

-- Set defaults to empty array
ALTER TABLE public.courses ALTER COLUMN category SET DEFAULT '{}'::text[];
ALTER TABLE public.courses ALTER COLUMN sub_category SET DEFAULT '{}'::text[];
