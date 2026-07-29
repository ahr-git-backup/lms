-- Run this in Supabase SQL Editor to check whether "Quick Practice" data is
-- actually present inside mock_exam_attempts (which would confirm a real
-- leak) or whether these are genuinely separate Mock Test rows that just
-- happen to share the subject name "সাধারণ".

-- 1. Show raw mock_exam_attempts rows for your user, with subject = 'সাধারণ'
select id, user_id, mock_exam_id, subject, chapter, score, total_marks,
       total_questions, submitted_at
from public.mock_exam_attempts
where subject = 'সাধারণ'
order by submitted_at desc
limit 20;

-- 2. Show raw qp_attempts rows for the same user (compare scores/dates)
select id, user_id, mode, chapter_ids, total_questions, correct_count,
       points_earned, created_at
from public.qp_attempts
order by created_at desc
limit 20;

-- 3. Check if mock_exam_id on the "সাধারণ" rows points to a real mock_exams row
select mea.id as attempt_id, mea.mock_exam_id, me.id as exam_exists,
       me.title, me.subject as exam_subject
from public.mock_exam_attempts mea
left join public.mock_exams me on me.id = mea.mock_exam_id
where mea.subject = 'সাধারণ'
order by mea.submitted_at desc
limit 20;

-- If query 3 shows exam_exists = NULL for these rows, that means the
-- mock_exam_id doesn't point to a real mock exam — a strong sign these rows
-- were inserted incorrectly (possibly from a different/older code path)
-- rather than through the normal Unlimited Mock Test flow.
