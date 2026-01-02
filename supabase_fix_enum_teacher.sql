-- Fix Enum for Teacher Role

-- 1. Add 'teacher' to app_role enum
-- We must do this before we can use 'teacher' in queries against user_roles.
DO $$
BEGIN
    ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'teacher';
EXCEPTION
    WHEN duplicate_object THEN null; -- Ignore if already exists
END $$;

-- 2. Re-run the Teacher Role functions and policies (safe to re-run)
-- This ensures the functions are defined AFTER the enum supports the value.

CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'teacher'::public.app_role -- Explicit cast optional but safe
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin'::public.app_role, 'teacher'::public.app_role)
  );
$$;

-- Note: The policies defined in supabase_teacher_role.sql rely on these functions.
-- You can re-run supabase_teacher_role.sql after this script, or assume they are fine
-- since they just call public.is_staff() which is now fixed.
