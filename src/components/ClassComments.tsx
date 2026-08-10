import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MessageCircle, Trash2, CornerDownRight, Send } from "lucide-react";

type CommentRow = {
  id: string;
  class_id: string;
  user_id: string;
  parent_id: string | null;
  comment_text: string;
  created_at: string;
  profiles?: { full_name: string | null; avatar_url: string | null } | null;
};

const timeAgo = (iso: string) => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "এইমাত্র";
  if (mins < 60) return `${mins} মিনিট আগে`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ঘণ্টা আগে`;
  const days = Math.floor(hrs / 24);
  return `${days} দিন আগে`;
};

const ClassComments = ({ classId }: { classId: string }) => {
  const { user, profile, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const { data: comments, isLoading } = useQuery({
    queryKey: ["class-comments", classId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_comments")
        .select("*, profiles:profiles(full_name, avatar_url)")
        .eq("class_id", classId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as CommentRow[];
    },
    enabled: !!classId,
  });

  const addCommentMutation = useMutation({
    mutationFn: async ({ text, parentId }: { text: string; parentId: string | null }) => {
      if (!user) throw new Error("Login required");
      const { error } = await supabase.from("class_comments").insert({
        class_id: classId,
        user_id: user.id,
        parent_id: parentId,
        comment_text: text.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class-comments", classId] });
      setNewComment("");
      setReplyText("");
      setReplyingTo(null);
    },
    onError: (e: any) => toast({ title: "কমেন্ট করা যায়নি", description: e.message, variant: "destructive" }),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("class_comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class-comments", classId] });
    },
    onError: (e: any) => toast({ title: "ডিলিট করা যায়নি", description: e.message, variant: "destructive" }),
  });

  const topLevel = (comments || []).filter((c) => !c.parent_id);
  const repliesOf = (id: string) => (comments || []).filter((c) => c.parent_id === id);

  const CommentItem = ({ c }: { c: CommentRow }) => {
    const canDelete = user && (c.user_id === user.id || isAdmin);
    return (
      <div className="flex gap-2.5">
        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
          {c.profiles?.avatar_url ? (
            <img src={c.profiles.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            (c.profiles?.full_name || "U").charAt(0).toUpperCase()
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="bg-muted/50 rounded-2xl px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold">{c.profiles?.full_name || "User"}</span>
              <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(c.created_at)}</span>
            </div>
            <p className="text-sm mt-0.5 whitespace-pre-wrap break-words">{c.comment_text}</p>
          </div>
          <div className="flex items-center gap-3 mt-1 pl-1">
            {!c.parent_id && (
              <button
                className="text-[11px] font-medium text-muted-foreground hover:text-primary"
                onClick={() => setReplyingTo(replyingTo === c.id ? null : c.id)}
              >
                Reply
              </button>
            )}
            {canDelete && (
              <button
                className="text-[11px] font-medium text-muted-foreground hover:text-destructive flex items-center gap-1"
                onClick={() => {
                  if (confirm("এই কমেন্ট ডিলিট করবেন?")) deleteCommentMutation.mutate(c.id);
                }}
              >
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            )}
          </div>

          {replyingTo === c.id && (
            <div className="flex items-start gap-2 mt-2">
              <CornerDownRight className="h-4 w-4 text-muted-foreground mt-2 shrink-0" />
              <div className="flex-1 flex gap-2">
                <Textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="উত্তর লিখুন..."
                  className="min-h-[36px] text-sm rounded-2xl py-2"
                  rows={1}
                />
                <Button
                  size="icon"
                  className="rounded-full shrink-0"
                  disabled={!replyText.trim() || addCommentMutation.isPending}
                  onClick={() => addCommentMutation.mutate({ text: replyText, parentId: c.id })}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {repliesOf(c.id).length > 0 && (
            <div className="mt-2 space-y-2 pl-3 border-l-2 border-border/50">
              {repliesOf(c.id).map((r) => (
                <CommentItem key={r.id} c={r} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card className="rounded-xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          কমেন্ট {comments && comments.length > 0 ? `(${comments.length})` : ""}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {user ? (
          <div className="flex items-start gap-2">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="একটি কমেন্ট লিখুন..."
              className="min-h-[40px] text-sm rounded-2xl py-2"
              rows={1}
            />
            <Button
              size="icon"
              className="rounded-full shrink-0"
              disabled={!newComment.trim() || addCommentMutation.isPending}
              onClick={() => addCommentMutation.mutate({ text: newComment, parentId: null })}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">কমেন্ট করতে লগইন করুন।</p>
        )}

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : topLevel.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">এখনো কোনো কমেন্ট নেই। প্রথম কমেন্টটি করুন!</p>
        ) : (
          <div className="space-y-4">
            {topLevel.map((c) => (
              <CommentItem key={c.id} c={c} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ClassComments;
