-- Add restrict_solution column to exams table
ALTER TABLE exams ADD COLUMN IF NOT EXISTS restrict_solution BOOLEAN DEFAULT false;
