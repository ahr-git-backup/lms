-- Enhanced password reset RPC to support Email verification with stricter checks
-- Drops the old signature to avoid confusion/overloading issues

DROP FUNCTION IF EXISTS verify_and_reset_password(text, text, text, text, text);

CREATE OR REPLACE FUNCTION verify_and_reset_password(
    p_identifier text,
    p_method text, -- 'phone' or 'email'
    p_father_name text,
    p_mother_name text,
    p_hsc_batch text,
    p_college_name text DEFAULT NULL,
    p_ssc_gpa numeric DEFAULT NULL,
    p_new_password text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
    target_user_id uuid;
    found_ssc_gpa numeric;
BEGIN
    -- 1. Determine Target User ID based on method
    IF p_method = 'phone' THEN
        SELECT id INTO target_user_id
        FROM public.profiles
        WHERE phone = p_identifier
          AND LOWER(TRIM(father_name)) = LOWER(TRIM(p_father_name))
          AND LOWER(TRIM(mother_name)) = LOWER(TRIM(p_mother_name))
          AND LOWER(TRIM(hsc_batch::text)) = LOWER(TRIM(p_hsc_batch));

    ELSIF p_method = 'email' THEN
        -- First find the user ID from auth.users by email
        -- We join with profiles to verify the details
        SELECT u.id, p.ssc_gpa INTO target_user_id, found_ssc_gpa
        FROM auth.users u
        JOIN public.profiles p ON u.id = p.id
        WHERE u.email = p_identifier
          AND LOWER(TRIM(p.father_name)) = LOWER(TRIM(p_father_name))
          AND LOWER(TRIM(p.mother_name)) = LOWER(TRIM(p_mother_name))
          AND LOWER(TRIM(p.hsc_batch::text)) = LOWER(TRIM(p_hsc_batch))
          -- Extra protection for Email users
          AND LOWER(TRIM(p.college_name)) = LOWER(TRIM(p_college_name));

        -- Check SSC GPA if user was found (floating point safe comparison)
        IF target_user_id IS NOT NULL THEN
             IF p_ssc_gpa IS NULL OR found_ssc_gpa IS NULL OR ABS(found_ssc_gpa - p_ssc_gpa) > 0.01 THEN
                target_user_id := NULL; -- Invalidate if GPA doesn't match
             END IF;
        END IF;

    ELSE
        -- Invalid method
        RETURN FALSE;
    END IF;

    -- 2. If no matching user is found, return false with a delay
    IF target_user_id IS NULL THEN
        PERFORM pg_sleep(1);
        RETURN FALSE;
    END IF;

    -- 3. Update the password in auth.users
    IF p_new_password IS NOT NULL THEN
        UPDATE auth.users
        SET encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf', 10)),
            updated_at = NOW(),
            email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
            raw_app_meta_data = raw_app_meta_data || '{"provider": "email", "providers": ["email"]}'::jsonb
        WHERE id = target_user_id;
    END IF;

    -- 4. Return true to indicate success
    RETURN TRUE;
END;
$$;
