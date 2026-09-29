-- Random Practice Exam unlimited access becomes a per-course toggle
-- (courses.access_unlimited_practice, already exists) instead of "any
-- enrollment = unlimited". Also return whether unlimited mode applied so
-- the UI can show the user's current status (premium vs free).
CREATE OR REPLACE FUNCTION public.mock_exam_daily_status(p_user_id uuid, p_guest_phone text)
 RETURNS TABLE(daily_limit integer, todays_count integer, is_unlimited boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    case when unlimited_from_course then 0 else free_limit end as daily_limit,
    todays_count,
    unlimited_from_course as is_unlimited
  from (
    select
      exists (
        select 1
        from public.enrollments e
        join public.courses c on c.id = e.course_id
        where p_user_id is not null
          and e.profile_id = p_user_id
          and c.access_unlimited_practice = true
          and (e.valid_until is null or e.valid_until > now())
          and (e.expires_at is null or e.expires_at > now())
      ) as unlimited_from_course,
      coalesce(
        (select
           case
             when jsonb_typeof(value) = 'number' then (value)::text::integer
             else nullif(value #>> '{}', '')::integer
           end
         from public.app_settings
         where key = 'daily_free_exam_limit'
        ), 0
      ) as free_limit,
      (
        select count(*)::integer
        from public.mock_exam_attempts a
        where a.submitted_at >= date_trunc('day', now())
          and (
            (p_user_id is not null and a.user_id = p_user_id)
            or (p_user_id is null and p_guest_phone is not null and a.guest_phone = p_guest_phone)
          )
      ) as todays_count
  ) t;
$function$;
