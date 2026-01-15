-- Create global_metadata table
CREATE TABLE IF NOT EXISTS public.global_metadata (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    type text NOT NULL, -- 'subject', 'chapter', 'topic', 'exam_code', 'year', 'tag'
    value text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE (type, value)
);

-- Enable RLS
ALTER TABLE public.global_metadata ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public can view global metadata" ON public.global_metadata
    FOR SELECT
    USING (true);

CREATE POLICY "Staff can manage global metadata" ON public.global_metadata
    FOR ALL
    USING (public.is_staff())
    WITH CHECK (public.is_staff());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_global_metadata_type ON public.global_metadata(type);

-- Seed Data from existing tables (Idempotent-ish via ON CONFLICT)

-- 1. Subjects from Constants (Manual list, simplified)
INSERT INTO public.global_metadata (type, value) VALUES
('subject', 'Physics 1st Paper'),
('subject', 'Physics 2nd Paper'),
('subject', 'Chemistry 1st Paper'),
('subject', 'Chemistry 2nd Paper'),
('subject', 'Biology 1st Paper'),
('subject', 'Biology 2nd Paper'),
('subject', 'Higher Math 1st Paper'),
('subject', 'Higher Math 2nd Paper'),
('subject', 'General Knowledge'),
('subject', 'English'),
('subject', 'Bangla'),
('subject', 'ICT')
ON CONFLICT (type, value) DO NOTHING;

-- 2. From Exams
INSERT INTO public.global_metadata (type, value)
SELECT DISTINCT 'chapter', unnest(string_to_array(chapter, ',')) FROM public.exams WHERE chapter IS NOT NULL AND chapter != ''
ON CONFLICT (type, value) DO NOTHING;

INSERT INTO public.global_metadata (type, value)
SELECT DISTINCT 'subject', unnest(subject) FROM public.exams WHERE subject IS NOT NULL
ON CONFLICT (type, value) DO NOTHING;

-- 3. From Classes
INSERT INTO public.global_metadata (type, value)
SELECT DISTINCT 'topic', topic FROM public.classes WHERE topic IS NOT NULL AND topic != ''
ON CONFLICT (type, value) DO NOTHING;

INSERT INTO public.global_metadata (type, value)
SELECT DISTINCT 'subject', unnest(subject) FROM public.classes WHERE subject IS NOT NULL
ON CONFLICT (type, value) DO NOTHING;

-- 4. From Class Notes
INSERT INTO public.global_metadata (type, value)
SELECT DISTINCT 'topic', topic FROM public.class_notes WHERE topic IS NOT NULL AND topic != ''
ON CONFLICT (type, value) DO NOTHING;

INSERT INTO public.global_metadata (type, value)
SELECT DISTINCT 'chapter', chapter FROM public.class_notes WHERE chapter IS NOT NULL AND chapter != ''
ON CONFLICT (type, value) DO NOTHING;

INSERT INTO public.global_metadata (type, value)
SELECT DISTINCT 'subject', subject FROM public.class_notes WHERE subject IS NOT NULL AND subject != ''
ON CONFLICT (type, value) DO NOTHING;

-- 5. From Question Bank
INSERT INTO public.global_metadata (type, value)
SELECT DISTINCT 'subject', subject FROM public.question_bank WHERE subject IS NOT NULL AND subject != ''
ON CONFLICT (type, value) DO NOTHING;

INSERT INTO public.global_metadata (type, value)
SELECT DISTINCT 'chapter', chapter FROM public.question_bank WHERE chapter IS NOT NULL AND chapter != ''
ON CONFLICT (type, value) DO NOTHING;

INSERT INTO public.global_metadata (type, value)
SELECT DISTINCT 'topic', topic FROM public.question_bank WHERE topic IS NOT NULL AND topic != ''
ON CONFLICT (type, value) DO NOTHING;

INSERT INTO public.global_metadata (type, value)
SELECT DISTINCT 'exam_code', exam_code FROM public.question_bank WHERE exam_code IS NOT NULL AND exam_code != ''
ON CONFLICT (type, value) DO NOTHING;

INSERT INTO public.global_metadata (type, value)
SELECT DISTINCT 'year', year FROM public.question_bank WHERE year IS NOT NULL AND year != ''
ON CONFLICT (type, value) DO NOTHING;

INSERT INTO public.global_metadata (type, value)
SELECT DISTINCT 'tag', unnest(tags) FROM public.question_bank WHERE tags IS NOT NULL
ON CONFLICT (type, value) DO NOTHING;
