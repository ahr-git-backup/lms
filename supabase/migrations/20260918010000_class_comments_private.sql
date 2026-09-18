-- Class comments were visible to ALL authenticated users (public chat).
-- Change to private: each student only sees their own comments (and any
-- admin replies to their own comments); admin/staff see everyone's
-- comments (so it behaves like a private message to admin, not a public
-- chat between students).

DROP POLICY IF EXISTS "Authenticated users can view class comments" ON public.class_comments;
CREATE POLICY "Own comments, replies to them, or staff can view"
  ON public.class_comments FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_staff()
    OR parent_id IN (
      SELECT id FROM public.class_comments WHERE user_id = auth.uid()
    )
  );
