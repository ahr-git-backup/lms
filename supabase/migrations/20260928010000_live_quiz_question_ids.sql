-- Live Quiz can now also be built from manually-picked individual MCQs
-- (Question Bank checkbox selection) instead of always a whole exam.
-- exam_id becomes optional; question_ids holds the picked exam_questions
-- rows in the order the admin selected them, when that path was used.
alter table public.scheduled_live_quizzes
  alter column exam_id drop not null;

alter table public.scheduled_live_quizzes
  add column if not exists question_ids uuid[];

alter table public.scheduled_live_quizzes
  add constraint scheduled_live_quizzes_source_check
  check (exam_id is not null or question_ids is not null);
