-- When a student posts a new class comment, notify all staff (admin/teacher)
-- so they know a comment came in and which class it belongs to.
-- Skip notifying when the comment author is themself staff (admin replying).

CREATE OR REPLACE FUNCTION public.notify_staff_on_class_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class_title text;
  v_author_name text;
  v_is_author_staff boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = NEW.user_id AND role IN ('admin', 'teacher')
  ) INTO v_is_author_staff;

  -- Only notify staff about comments from students, not staff replies.
  IF v_is_author_staff THEN
    RETURN NEW;
  END IF;

  SELECT title INTO v_class_title FROM public.classes WHERE id = NEW.class_id;
  SELECT full_name INTO v_author_name FROM public.profiles WHERE id = NEW.user_id;

  INSERT INTO public.user_notifications (user_id, title, body, type)
  SELECT
    ur.user_id,
    'New class comment',
    COALESCE(v_author_name, 'A student') || ' commented on "' || COALESCE(v_class_title, 'a class') || '": ' ||
      (CASE WHEN length(NEW.comment_text) > 120 THEN left(NEW.comment_text, 120) || '...' ELSE NEW.comment_text END),
    'class_comment'
  FROM public.user_roles ur
  WHERE ur.role IN ('admin', 'teacher');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_staff_on_class_comment ON public.class_comments;
CREATE TRIGGER trg_notify_staff_on_class_comment
  AFTER INSERT ON public.class_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_staff_on_class_comment();
