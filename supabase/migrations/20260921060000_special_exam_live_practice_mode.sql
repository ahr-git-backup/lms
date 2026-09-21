-- Special exams can run in 'live' (time window, one attempt) or 'practice' mode.
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS special_mode TEXT NOT NULL DEFAULT 'practice';
ALTER TABLE public.exams DROP CONSTRAINT IF EXISTS exams_special_mode_check;
ALTER TABLE public.exams ADD CONSTRAINT exams_special_mode_check CHECK (special_mode IN ('live','practice'));

-- Dashboard RPC: include live-mode special exams in active_live_exams / next_exam.
DO $mig$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND pg_get_functiondef(p.oid) ILIKE '%v_active_live_exams%'
  LIMIT 1;
  IF v_def IS NOT NULL THEN
    v_def := replace(v_def, 'AND e.exam_type = ''live''', 'AND (e.exam_type = ''live'' OR (e.exam_type = ''special'' AND e.special_mode = ''live''))');
    EXECUTE v_def;
  END IF;
END
$mig$;
