ALTER TABLE class_notes ADD COLUMN IF NOT EXISTS is_free BOOLEAN DEFAULT false;

-- Backfill existing notes from public courses to be free
UPDATE class_notes
SET is_free = true
FROM courses
WHERE class_notes.course_id = courses.id AND courses.is_public = true;
