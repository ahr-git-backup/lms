-- Performance indexes to reduce Supabase load under concurrent traffic
-- (free tier has limited compute/connections, so query efficiency matters more).

-- Batched mock question fetch filters by subject + chapter + standard together
-- (UnlimitedMockTest.tsx: .in("subject",...).in("chapter",...).eq("standard",...)).
-- The existing idx_mock_pool_subject_chapter and idx_mock_pool_standard indexes
-- are single/partial; a combined index serves this exact query shape directly.
create index if not exists idx_mock_pool_subject_chapter_standard
  on public.mock_question_pool(subject, chapter, standard);

-- Daily free-exam-limit check filters guest attempts by phone AND submitted_at
-- (UnlimitedMockTest.tsx: .eq("guest_phone", ...).gte("submitted_at", startOfDay)).
-- Existing idx_mock_exam_attempts_guest_phone only covers phone alone.
create index if not exists idx_mock_exam_attempts_guest_phone_submitted
  on public.mock_exam_attempts(guest_phone, submitted_at desc);

-- Same daily-limit check for logged-in users filters by user_id AND submitted_at.
-- idx_mock_exam_attempts_user_submitted already covers this exactly, so no
-- new index needed there.

-- FreeExam.tsx (public Free Exam list) filters public.exams by
-- is_published + is_visible_on_free on every page load — no index existed
-- for these columns, so every visit forced a full table scan.
create index if not exists idx_exams_published_visible_free
  on public.exams(is_published, is_visible_on_free);

