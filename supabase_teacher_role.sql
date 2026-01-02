-- Secure Teacher Role Migration (Idempotent)

-- 1. Create/Replace Helper Functions
-- These check roles securely on the server side
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
    AND role = 'teacher'
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
    AND role IN ('admin', 'teacher')
  );
$$;

-- 2. Update RLS Policies for Content Tables
-- We use DO blocks to safely drop policies if they exist

-- A. EXAMS Table
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    -- Drop potential old admin policies
    DROP POLICY IF EXISTS "Admins can insert exams" ON public.exams;
    DROP POLICY IF EXISTS "Admins can update exams" ON public.exams;
    DROP POLICY IF EXISTS "Admins can delete exams" ON public.exams;
    DROP POLICY IF EXISTS "Admins can manage all exams" ON public.exams;
    -- Drop potential old staff policies (if re-running)
    DROP POLICY IF EXISTS "Staff can insert exams" ON public.exams;
    DROP POLICY IF EXISTS "Staff can update exams" ON public.exams;
    DROP POLICY IF EXISTS "Staff can delete exams" ON public.exams;
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

-- Create unified Staff policies (Covers Admin & Teacher)
CREATE POLICY "Staff can insert exams" ON public.exams FOR INSERT WITH CHECK (public.is_staff());
CREATE POLICY "Staff can update exams" ON public.exams FOR UPDATE USING (public.is_staff());
CREATE POLICY "Staff can delete exams" ON public.exams FOR DELETE USING (public.is_staff());
-- Ensure Read Access (Students read active, Staff read all)
-- Dropping old read policies is tricky if we don't know names, but let's add a comprehensive one if missing
-- Assuming "Public/Students can view exams" exists. If not, this might be needed:
-- CREATE POLICY "Staff can view all exams" ON public.exams FOR SELECT USING (public.is_staff());


-- B. CLASSES Table
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    DROP POLICY IF EXISTS "Admins can insert classes" ON public.classes;
    DROP POLICY IF EXISTS "Admins can update classes" ON public.classes;
    DROP POLICY IF EXISTS "Admins can delete classes" ON public.classes;
    DROP POLICY IF EXISTS "Admins can manage all classes" ON public.classes;

    DROP POLICY IF EXISTS "Staff can insert classes" ON public.classes;
    DROP POLICY IF EXISTS "Staff can update classes" ON public.classes;
    DROP POLICY IF EXISTS "Staff can delete classes" ON public.classes;
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

CREATE POLICY "Staff can insert classes" ON public.classes FOR INSERT WITH CHECK (public.is_staff());
CREATE POLICY "Staff can update classes" ON public.classes FOR UPDATE USING (public.is_staff());
CREATE POLICY "Staff can delete classes" ON public.classes FOR DELETE USING (public.is_staff());


-- C. RESOURCES Table
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    DROP POLICY IF EXISTS "Admins can insert resources" ON public.resources;
    DROP POLICY IF EXISTS "Admins can update resources" ON public.resources;
    DROP POLICY IF EXISTS "Admins can delete resources" ON public.resources;
    DROP POLICY IF EXISTS "Admins can manage all resources" ON public.resources;

    DROP POLICY IF EXISTS "Staff can insert resources" ON public.resources;
    DROP POLICY IF EXISTS "Staff can update resources" ON public.resources;
    DROP POLICY IF EXISTS "Staff can delete resources" ON public.resources;
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

CREATE POLICY "Staff can insert resources" ON public.resources FOR INSERT WITH CHECK (public.is_staff());
CREATE POLICY "Staff can update resources" ON public.resources FOR UPDATE USING (public.is_staff());
CREATE POLICY "Staff can delete resources" ON public.resources FOR DELETE USING (public.is_staff());


-- D. ANNOUNCEMENTS Table
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    DROP POLICY IF EXISTS "Admins can insert announcements" ON public.announcements;
    DROP POLICY IF EXISTS "Admins can update announcements" ON public.announcements;
    DROP POLICY IF EXISTS "Admins can delete announcements" ON public.announcements;
    DROP POLICY IF EXISTS "Admins can manage all announcements" ON public.announcements;

    DROP POLICY IF EXISTS "Staff can insert announcements" ON public.announcements;
    DROP POLICY IF EXISTS "Staff can update announcements" ON public.announcements;
    DROP POLICY IF EXISTS "Staff can delete announcements" ON public.announcements;
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

CREATE POLICY "Staff can insert announcements" ON public.announcements FOR INSERT WITH CHECK (public.is_staff());
CREATE POLICY "Staff can update announcements" ON public.announcements FOR UPDATE USING (public.is_staff());
CREATE POLICY "Staff can delete announcements" ON public.announcements FOR DELETE USING (public.is_staff());


-- E. COURSES Table (Teachers need read-only access to see list for dropdowns)
-- Admins usually have full access. We ensure Teachers can SELECT.
DO $$ BEGIN
    DROP POLICY IF EXISTS "Teachers can view courses" ON public.courses;
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

CREATE POLICY "Teachers can view courses" ON public.courses FOR SELECT USING (public.is_teacher());
-- Note: If "Public can view courses" exists (SELECT true), this is redundant but harmless.


-- 3. Fix User Roles (Admins Only)
-- Ensure only admins can manage roles (promote teachers)
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
-- (Existing policies from previous migration likely cover this, but reinforcing doesn't hurt)
-- "Admins can manage all roles" should already exist.
