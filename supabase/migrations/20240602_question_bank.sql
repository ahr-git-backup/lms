-- Create question_bank table
CREATE TABLE IF NOT EXISTS public.question_bank (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    question_text text NOT NULL,
    option_a text NOT NULL,
    option_b text NOT NULL,
    option_c text NOT NULL,
    option_d text NOT NULL,
    correct_option text NOT NULL CHECK (correct_option IN ('A', 'B', 'C', 'D')),
    explanation text,
    tags text[] DEFAULT '{}'::text[],
    subject text,
    chapter text,
    topic text,
    exam_code text,
    year text,
    difficulty text DEFAULT 'medium',
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.question_bank ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Staff can manage question bank" ON public.question_bank
    FOR ALL
    USING (public.is_staff())
    WITH CHECK (public.is_staff());

-- Indexes for filtering
CREATE INDEX IF NOT EXISTS idx_question_bank_subject ON public.question_bank(subject);
CREATE INDEX IF NOT EXISTS idx_question_bank_chapter ON public.question_bank(chapter);
CREATE INDEX IF NOT EXISTS idx_question_bank_topic ON public.question_bank(topic);
CREATE INDEX IF NOT EXISTS idx_question_bank_exam_code ON public.question_bank(exam_code);
