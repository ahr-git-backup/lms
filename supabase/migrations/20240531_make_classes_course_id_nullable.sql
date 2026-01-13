-- Make course_id nullable in classes table to support Archive-only classes
ALTER TABLE classes ALTER COLUMN course_id DROP NOT NULL;
