
-- Update class_notes table to support Markdown notes and hierarchy
ALTER TABLE class_notes ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE class_notes ADD COLUMN IF NOT EXISTS content text;
ALTER TABLE class_notes ALTER COLUMN notes_url DROP NOT NULL;
