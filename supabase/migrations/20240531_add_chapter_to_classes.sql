-- Add chapter column to classes table if it doesn't exist
ALTER TABLE classes ADD COLUMN IF NOT EXISTS chapter text;
