-- Add missing columns to profiles table if they don't exist

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS father_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mother_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS college_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ssc_gpa numeric DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hsc_gpa numeric DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hsc_batch text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_second_timer boolean DEFAULT false;
