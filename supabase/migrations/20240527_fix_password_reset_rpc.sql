-- Fix password reset RPC to correctly update password and confirmation status
-- We explicitly set the schema for crypt/gen_salt to extensions
-- We also ensure email_confirmed_at is set to prevent login blocks for unverified users who prove identity via this method.

CREATE OR REPLACE FUNCTION verify_and_reset_password(
    p_phone text,
    p_father_name text,
    p_mother_name text,
    p_hsc_batch text,
    p_new_password text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
    target_user_id uuid;
BEGIN
    -- 1. Find the user ID from profiles based on provided details
    -- We perform a case-insensitive, whitespace-trimmed comparison for robustness
    SELECT id INTO target_user_id
    FROM public.profiles
    WHERE phone = p_phone
      AND LOWER(TRIM(father_name)) = LOWER(TRIM(p_father_name))
      AND LOWER(TRIM(mother_name)) = LOWER(TRIM(p_mother_name))
      AND LOWER(TRIM(hsc_batch::text)) = LOWER(TRIM(p_hsc_batch));

    -- 2. If no matching user is found, return false
    IF target_user_id IS NULL THEN
        PERFORM pg_sleep(1);
        RETURN FALSE;
    END IF;

    -- 3. Update the password in auth.users
    -- We use gen_salt('bf', 10) to ensure a standard cost factor that Supabase/GoTrue definitely accepts.
    -- We also update updated_at and ensure email_confirmed_at is set if null.
    UPDATE auth.users
    SET encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf', 10)),
        updated_at = NOW(),
        email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
        raw_app_meta_data = raw_app_meta_data || '{"provider": "email", "providers": ["email"]}'::jsonb
    WHERE id = target_user_id;

    -- 4. Return true to indicate success
    RETURN TRUE;
END;
$$;
