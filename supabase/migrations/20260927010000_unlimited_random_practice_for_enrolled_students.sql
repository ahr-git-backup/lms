-- Random Practice Exam daily free limit should only apply to users who are
-- NOT enrolled in any (currently valid) course. A student enrolled in any
-- course gets unlimited attempts; everyone else keeps the existing
-- app_settings-driven daily_free_exam_limit.
CREATE OR REPLACE FUNCTION public.mock_exam_daily_status(p_user_id uuid, p_guest_phone text)
 RETURNS TABLE(daily_limit integer, todays_count integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    case
      when p_user_id is not null and exists (
        select 1
        from public.enrollments e
        where e.profile_id = p_user_id
          and (e.valid_until is null or e.valid_until > now())
          and (e.expires_at is null or e.expires_at > now())
      ) then 0  -- 0 = unlimited, same convention already used when the admin setting is unset/blank
      else coalesce(
        (select
           case
             when jsonb_typeof(value) = 'number' then (value)::text::integer
             else nullif(value #>> '{}', '')::integer
           end
         from public.app_settings
         where key = 'daily_free_exam_limit'
        ), 0
      )
    end as daily_limit,
    (
      select count(*)::integer
      from public.mock_exam_attempts a
      where a.submitted_at >= date_trunc('day', now())
        and (
          (p_user_id is not null and a.user_id = p_user_id)
          or (p_user_id is null and p_guest_phone is not null and a.guest_phone = p_guest_phone)
        )
    ) as todays_count;
$function$;
