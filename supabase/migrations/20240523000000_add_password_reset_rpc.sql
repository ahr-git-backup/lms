-- Create a stored procedure to verify user identity and reset password
-- This function runs with SECURITY DEFINER privileges to access profiles and auth.users

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
AS $$
DECLARE
    target_user_id uuid;
BEGIN
    -- 1. Find the user ID from profiles based on provided details
    -- We perform a case-insensitive, whitespace-trimmed comparison for robustness
    -- We cast hsc_batch to text to avoid type mismatch if the column is integer
    SELECT id INTO target_user_id
    FROM public.profiles
    WHERE phone = p_phone
      AND LOWER(TRIM(father_name)) = LOWER(TRIM(p_father_name))
      AND LOWER(TRIM(mother_name)) = LOWER(TRIM(p_mother_name))
      AND LOWER(TRIM(hsc_batch::text)) = LOWER(TRIM(p_hsc_batch));

    -- 2. If no matching user is found, return false
    -- We add a small delay to hinder high-speed brute force attacks since we lack rate limiting
    IF target_user_id IS NULL THEN
        PERFORM pg_sleep(1);
        RETURN FALSE;
    END IF;

    -- 3. Update the password in auth.users
    -- This requires the 'pgcrypto' extension to be enabled (standard in Supabase)
    UPDATE auth.users
    SET encrypted_password = crypt(p_new_password, gen_salt('bf'))
    WHERE id = target_user_id;

    -- 4. Return true to indicate success
    RETURN TRUE;
END;
$$;
