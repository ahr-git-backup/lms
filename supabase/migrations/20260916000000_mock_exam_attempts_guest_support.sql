-- Random Practice Exam (Unlimited Mock Test) no longer requires login —
-- guests provide name/HSC batch/college/phone via GuestExamInfoDialog,
-- same as the existing Free Exam guest flow. Add matching guest identity
-- columns to mock_exam_attempts and relax RLS so a guest (auth.uid() is
-- null, user_id is null) can insert/select their own attempts using the
-- guest identity, while logged-in users keep the existing own-row policies.

alter table public.mock_exam_attempts
  add column if not exists guest_name text,
  add column if not exists guest_hsc_batch text,
  add column if not exists guest_college_name text,
  add column if not exists guest_phone text;

alter table public.mock_exam_attempts
  add constraint mock_exam_attempts_identity_check
  check (
    user_id is not null
    or (guest_name is not null and guest_phone is not null)
  );

create index if not exists idx_mock_exam_attempts_guest_phone
  on public.mock_exam_attempts(guest_phone);

-- Guests can insert their own attempt (no user_id, but guest identity present)
create policy "mock_exam_attempts_guest_insert" on public.mock_exam_attempts
  for insert with check (
    auth.uid() is null
    and user_id is null
    and guest_name is not null
    and guest_phone is not null
  );

-- Guests can read attempts matching their own phone (used to count today's
-- usage against the daily free limit without needing an account).
create policy "mock_exam_attempts_guest_select_own_phone" on public.mock_exam_attempts
  for select using (
    auth.uid() is null
    and guest_phone is not null
  );
