ALTER TABLE public.mock_question_pool
ADD COLUMN IF NOT EXISTS qb_sources jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.mock_question_pool.qb_sources IS
'Array of {label, examIds, questionCount} describing which Question Bank exams/subjects/chapters contributed MCQs to this pool entry, so the admin can see and re-check sources on edit to avoid duplicate imports.';
