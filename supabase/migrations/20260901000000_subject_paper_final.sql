-- Subject Final / Paper Final: a new Readymade exam type where admin builds,
-- per (subject-or-paper item x difficulty mode), a set of "sources" -- each
-- source is either a filtered slice of the existing question bank or its own
-- uploaded CSV question pool, with a target question count. A student's
-- attempt in a given mode pulls that mode's sources and randomly assembles a
-- 100-question exam from them (each source contributing its set count).

-- 1) Category is fixed to exactly two kinds: subject_final / paper_final.
--    Items are the A-Z admin-added names under each (e.g. "Biology",
--    "Physics Paper 1").
CREATE TABLE IF NOT EXISTS public.sp_final_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('subject_final', 'paper_final')),
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category, name)
);

-- 2) Per item, per mode, the list of sources admin configured and how many
--    MCQs each contributes. `existing_bank` sources reference a filter into
--    exam_questions (by subject/chapter/topic — reusing the same fields
--    Readymade already filters on); `csv` sources own their own question
--    rows in sp_final_source_questions below.
CREATE TABLE IF NOT EXISTS public.sp_final_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.sp_final_items(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('medical_standard', 'standard_hard', 'super_hard')),
  source_type text NOT NULL CHECK (source_type IN ('existing_bank', 'csv')),
  label text NOT NULL, -- admin-facing name for this source, e.g. "HSC Board Qs 2023-24"
  question_count integer NOT NULL CHECK (question_count > 0),
  -- existing_bank filter (all optional/AND'ed; null = don't filter on that field)
  filter_subject text,
  filter_chapter text,
  filter_topic text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sp_final_sources_item_mode ON public.sp_final_sources(item_id, mode);

-- 3) CSV-uploaded question pool, owned by a single source row (source_type='csv').
CREATE TABLE IF NOT EXISTS public.sp_final_source_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.sp_final_sources(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  option_a text NOT NULL,
  option_b text NOT NULL,
  option_c text NOT NULL,
  option_d text NOT NULL,
  option_e text,
  correct_option char(1) NOT NULL CHECK (correct_option IN ('A','B','C','D','E')),
  explanation text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sp_final_source_questions_source ON public.sp_final_source_questions(source_id);

-- RLS: admins manage everything; any authenticated (and anon, matching the
-- rest of Readymade's guest-exam support) user can read items/sources to
-- browse and take exams. Question rows themselves are only exposed via the
-- SECURITY DEFINER assembly RPC below, never directly, so answers can't be
-- read off the table by a student before attempting.
ALTER TABLE public.sp_final_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sp_final_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sp_final_source_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sp_final_items_read_all" ON public.sp_final_items;
CREATE POLICY "sp_final_items_read_all" ON public.sp_final_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "sp_final_items_admin_write" ON public.sp_final_items;
CREATE POLICY "sp_final_items_admin_write" ON public.sp_final_items FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "sp_final_sources_read_all" ON public.sp_final_sources;
CREATE POLICY "sp_final_sources_read_all" ON public.sp_final_sources FOR SELECT USING (true);

DROP POLICY IF EXISTS "sp_final_sources_admin_write" ON public.sp_final_sources;
CREATE POLICY "sp_final_sources_admin_write" ON public.sp_final_sources FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- No public SELECT policy on sp_final_source_questions -- admin-only direct
-- access, students only ever see rows via the assembly RPC.
DROP POLICY IF EXISTS "sp_final_source_questions_admin_all" ON public.sp_final_source_questions;
CREATE POLICY "sp_final_source_questions_admin_all" ON public.sp_final_source_questions FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

NOTIFY pgrst, 'reload schema';

-- RPC: list distinct subject_id/paper_id items for a category, with total
-- configured questions per mode (so the UI can show e.g. "Standard: 100/100
-- configured" and warn if a mode isn't fully set up yet).
CREATE OR REPLACE FUNCTION public.get_sp_final_items(p_category text)
RETURNS TABLE(
  id uuid, name text, sort_order integer,
  medical_standard_configured integer,
  standard_hard_configured integer,
  super_hard_configured integer
)
LANGUAGE sql SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    i.id, i.name, i.sort_order,
    COALESCE(SUM(s.question_count) FILTER (WHERE s.mode = 'medical_standard'), 0)::integer,
    COALESCE(SUM(s.question_count) FILTER (WHERE s.mode = 'standard_hard'), 0)::integer,
    COALESCE(SUM(s.question_count) FILTER (WHERE s.mode = 'super_hard'), 0)::integer
  FROM public.sp_final_items i
  LEFT JOIN public.sp_final_sources s ON s.item_id = i.id
  WHERE i.category = p_category AND i.is_hidden = false
  GROUP BY i.id, i.name, i.sort_order
  ORDER BY i.sort_order ASC, i.name ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_sp_final_items(text) TO authenticated, anon, service_role;

-- RPC: assemble a random exam for (item, mode) -- pulls `question_count`
-- random rows from each configured source (existing_bank filters into
-- exam_questions, csv reads sp_final_source_questions) and returns them
-- pre-shuffled as one pool. SECURITY DEFINER so a student can never read
-- sp_final_source_questions directly (RLS blocks that), only through this.
CREATE OR REPLACE FUNCTION public.get_sp_final_exam_questions(p_item_id uuid, p_mode text)
RETURNS TABLE(
  question_text text, option_a text, option_b text, option_c text, option_d text, option_e text,
  correct_option text, explanation text
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  src RECORD;
BEGIN
  FOR src IN
    SELECT * FROM public.sp_final_sources
    WHERE item_id = p_item_id AND mode = p_mode
    ORDER BY sort_order ASC
  LOOP
    IF src.source_type = 'csv' THEN
      RETURN QUERY
      SELECT q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.option_e,
             q.correct_option::text, q.explanation
      FROM public.sp_final_source_questions q
      WHERE q.source_id = src.id
      ORDER BY random()
      LIMIT src.question_count;
    ELSE
      RETURN QUERY
      SELECT q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, NULL::text,
             q.correct_option::text, q.explanation
      FROM public.exam_questions q
      JOIN public.exams e ON e.id = q.exam_id
      WHERE e.is_readymade = true
        AND (src.filter_subject IS NULL OR src.filter_subject = ANY(e.subject))
        AND (src.filter_chapter IS NULL OR q.topic = src.filter_chapter OR e.chapter = src.filter_chapter)
        AND (src.filter_topic IS NULL OR q.topic = src.filter_topic)
      ORDER BY random()
      LIMIT src.question_count;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_sp_final_exam_questions(uuid, text) TO authenticated, anon, service_role;
