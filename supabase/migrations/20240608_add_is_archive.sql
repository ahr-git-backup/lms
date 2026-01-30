-- Add is_archive column to classes and exams
ALTER TABLE classes ADD COLUMN IF NOT EXISTS is_archive BOOLEAN DEFAULT FALSE;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS is_archive BOOLEAN DEFAULT FALSE;

-- Backfill existing archives
-- We assume items that are public (course_id IS NULL) and have been assigned to archives (archive_course_ids has items)
-- are the ones the user wants to convert to "Archive" type.

UPDATE classes
SET is_archive = TRUE
WHERE course_id IS NULL
  AND archive_course_ids IS NOT NULL
  AND array_length(archive_course_ids, 1) > 0;

UPDATE exams
SET is_archive = TRUE
WHERE course_id IS NULL
  AND archive_course_ids IS NOT NULL
  AND array_length(archive_course_ids, 1) > 0;
