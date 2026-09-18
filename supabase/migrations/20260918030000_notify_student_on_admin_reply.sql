-- Extend notify_staff_on_class_comment: when a STAFF member replies
-- (parent_id set, author is staff), notify the original student who
-- wrote the root comment, instead of notifying all staff.

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
  v_root_user_id uuid;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = NEW.user_id AND role IN ('admin', 'teacher')
  ) INTO v_is_author_staff;

  SELECT title INTO v_class_title FROM public.classes WHERE id = NEW.class_id;
  SELECT full_name INTO v_author_name FROM public.profiles WHERE id = NEW.user_id;

  IF v_is_author_staff THEN
    -- Staff reply: notify the original student who wrote the root comment
    -- (skip if staff is replying to their own earlier comment).
    IF NEW.parent_id IS NOT NULL THEN
      SELECT user_id INTO v_root_user_id FROM public.class_comments WHERE id = NEW.parent_id;
      IF v_root_user_id IS NOT NULL AND v_root_user_id <> NEW.user_id THEN
        INSERT INTO public.user_notifications (user_id, title, body, type)
        VALUES (
          v_root_user_id,
          'Admin replied to your comment',
          'On "' || COALESCE(v_class_title, 'a class') || '": ' ||
            (CASE WHEN length(NEW.comment_text) > 120 THEN left(NEW.comment_text, 120) || '...' ELSE NEW.comment_text END),
          'class_comment_reply'
        );
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- Student comment: notify all staff.
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
