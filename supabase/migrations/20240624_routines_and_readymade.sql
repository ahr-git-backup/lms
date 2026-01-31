-- Create routines table
CREATE TABLE IF NOT EXISTS public.routines (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT,
    media_urls TEXT[] DEFAULT '{}',
    is_visible BOOLEAN DEFAULT true
);

-- Add readymade_course_ids to exams
ALTER TABLE public.exams
ADD COLUMN IF NOT EXISTS readymade_course_ids UUID[] DEFAULT '{}';

-- Enable RLS
ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;

-- Policies for routines
CREATE POLICY "Routines are viewable by everyone" ON public.routines
FOR SELECT USING (true);

CREATE POLICY "Admins can insert routines" ON public.routines
FOR INSERT WITH CHECK (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'super_admin')));

CREATE POLICY "Admins can update routines" ON public.routines
FOR UPDATE USING (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'super_admin')));

CREATE POLICY "Admins can delete routines" ON public.routines
FOR DELETE USING (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'super_admin')));
