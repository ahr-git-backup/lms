-- Add linked_course_ids column to courses table
ALTER TABLE courses ADD COLUMN IF NOT EXISTS linked_course_ids UUID[] DEFAULT '{}';
