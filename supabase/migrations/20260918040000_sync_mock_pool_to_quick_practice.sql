-- Auto-sync: any MCQ added to Mock Test's question pool (mock_question_pool)
-- automatically also becomes available in Quick Practice, under a matching
-- Subject/Chapter (auto-created by name if they don't already exist there).
-- Runs on INSERT and on UPDATE of questions_json, and de-dupes existing
-- Quick Practice MCQs for this pool row before re-inserting, so editing a
-- pool row doesn't pile up duplicates.

CREATE OR REPLACE FUNCTION public.sync_mock_pool_to_quick_practice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subject_id bigint;
  v_chapter_id bigint;
  v_q jsonb;
  v_options jsonb;
  v_correct_index int;
BEGIN
  -- Find or create the matching Quick Practice subject (by name).
  SELECT id INTO v_subject_id FROM public.qp_subjects WHERE name = NEW.subject LIMIT 1;
  IF v_subject_id IS NULL THEN
    INSERT INTO public.qp_subjects (name) VALUES (NEW.subject) RETURNING id INTO v_subject_id;
  END IF;

  -- Find or create the matching Quick Practice chapter under that subject.
  SELECT id INTO v_chapter_id FROM public.qp_chapters WHERE subject_id = v_subject_id AND name = NEW.chapter LIMIT 1;
  IF v_chapter_id IS NULL THEN
    INSERT INTO public.qp_chapters (subject_id, name) VALUES (v_subject_id, NEW.chapter) RETURNING id INTO v_chapter_id;
  END IF;

  -- Remove any previously-synced MCQs for this exact pool row (identified by
  -- source_pool_id) so an edit/update doesn't create duplicates.
  DELETE FROM public.qp_mcqs WHERE source_pool_id = NEW.id;

  -- Insert each question from questions_json into qp_mcqs.
  FOR v_q IN SELECT * FROM jsonb_array_elements(COALESCE(NEW.questions_json, '[]'::jsonb))
  LOOP
    v_options := jsonb_build_array(
      v_q->>'option_a', v_q->>'option_b', v_q->>'option_c', v_q->>'option_d'
    );
    v_correct_index := CASE UPPER(COALESCE(v_q->>'correct_option', 'A'))
      WHEN 'A' THEN 0 WHEN 'B' THEN 1 WHEN 'C' THEN 2 WHEN 'D' THEN 3 ELSE 0
    END;

    INSERT INTO public.qp_mcqs (chapter_id, question, options, correct_index, explanation, source_pool_id)
    VALUES (
      v_chapter_id,
      COALESCE(v_q->>'question_text', ''),
      v_options,
      v_correct_index,
      v_q->>'explanation',
      NEW.id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Track which pool row a qp_mcqs entry came from, so edits/deletes can be
-- kept in sync without duplicating or leaving orphans.
ALTER TABLE public.qp_mcqs ADD COLUMN IF NOT EXISTS source_pool_id uuid REFERENCES public.mock_question_pool(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_qp_mcqs_source_pool ON public.qp_mcqs(source_pool_id);

DROP TRIGGER IF EXISTS trg_sync_mock_pool_to_quick_practice ON public.mock_question_pool;
CREATE TRIGGER trg_sync_mock_pool_to_quick_practice
  AFTER INSERT OR UPDATE OF questions_json, subject, chapter ON public.mock_question_pool
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_mock_pool_to_quick_practice();
