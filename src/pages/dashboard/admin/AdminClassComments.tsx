import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MessageCircle, Send, Trash2, ChevronDown, ChevronUp } from "lucide-react";

type CommentRow = {
  id: string;
  class_id: string;
  user_id: string;
  parent_id: string | null;
  comment_text: string;
  created_at: string;
  profiles?: { full_name: string | null } | null;
  classes?: { title: string | null } | null;
};

const timeAgo = (iso: string) => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "এইমাত্র";
  if (mins < 60) return `${mins}মি`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}ঘ`;
  const days = Math.floor(hrs / 24);
  return `${days}দি`;
};

const AdminClassComments = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);

  const { data: comments, isLoading } = useQuery({
    queryKey: ["admin-class-comments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_comments")
        .select("*, profiles:profiles(full_name), classes:classes(title)")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as CommentRow[];
    },
  });

  const grouped = new Map<string, { title: string; threads: { root: CommentRow; replies: CommentRow[] }[] }>();
  (comments || []).forEach((c) => {
    if (c.parent_id) return;
    if (!grouped.has(c.class_id)) {
      grouped.set(c.class_id, { title: c.classes?.title || "Untitled Class", threads: [] });
    }
    grouped.get(c.class_id)!.threads.push({ root: c, replies: [] });
  });
  (comments || []).forEach((c) => {
    if (!c.parent_id) return;
    const group = grouped.get(c.class_id);
    const thread = group?.threads.find((t) => t.root.id === c.parent_id);
    thread?.replies.push(c);
  });

  const classList = Array.from(grouped.entries()).sort((a, b) => {
    const aLatest = Math.max(...a[1].threads.flatMap((t) => [new Date(t.root.created_at).getTime(), ...t.replies.map((r) => new Date(r.created_at).getTime())]));
    const bLatest = Math.max(...b[1].threads.flatMap((t) => [new Date(t.root.created_at).getTime(), ...t.replies.map((r) => new Date(r.created_at).getTime())]));
    return bLatest - aLatest;
  });

  const sendReply = async (classId: string, rootId: string) => {
    const text = (replyText[rootId] || "").trim();
    if (!text || !user) return;
    setSendingId(rootId);
    const { error } = await supabase.from("class_comments").insert({
      class_id: classId,
      user_id: user.id,
      parent_id: rootId,
      comment_text: text,
    });
    setSendingId(null);
    if (error) {
      toast({ title: "রিপ্লাই পাঠানো যায়নি", description: error.message, variant: "destructive" });
      return;
    }
    setReplyText((prev) => ({ ...prev, [rootId]: "" }));
    queryClient.invalidateQueries({ queryKey: ["admin-class-comments"] });
  };

  const deleteComment = async (id: string) => {
    if (!confirm("এই কমেন্ট ডিলিট করবেন?")) return;
    const { error } = await supabase.from("class_comments").delete().eq("id", id);
    if (error) {
      toast({ title: "ডিলিট করা যায়নি", description: error.message, variant: "destructive" });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["admin-class-comments"] });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <MessageCircle className="h-5 w-5" /> Class Comments
        </h1>
        <p className="text-sm text-muted-foreground">Every class is shown separately below — reply directly under a student's comment.</p>
      </div>

      {classList.length === 0 && (
        <p className="text-center text-muted-foreground py-10">কোনো কমেন্ট পাওয়া যায়নি।</p>
      )}

      {classList.map(([classId, group]) => {
        const isExpanded = expandedClassId === classId;
        const totalComments = group.threads.reduce((sum, t) => sum + 1 + t.replies.length, 0);
        return (
          <Card key={classId} className="overflow-hidden">
            <CardHeader
              className="p-4 bg-muted/20 border-b cursor-pointer flex flex-row items-center justify-between"
              onClick={() => setExpandedClassId(isExpanded ? null : classId)}
            >
              <div>
                <CardTitle className="text-base">{group.title}</CardTitle>
                <Badge variant="secondary" className="mt-1 text-[10px]">{totalComments} comment{totalComments !== 1 ? "s" : ""}</Badge>
              </div>
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CardHeader>

            {isExpanded && (
              <CardContent className="p-4 space-y-4">
                {group.threads
                  .sort((a, b) => new Date(b.root.created_at).getTime() - new Date(a.root.created_at).getTime())
                  .map(({ root, replies }) => (
                    <div key={root.id} className="border rounded-lg p-3 space-y-2 bg-card">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm">
                          <span className="font-semibold mr-1.5">{root.profiles?.full_name || "User"}</span>
                          <span className="text-[10px] text-muted-foreground mr-1.5">{timeAgo(root.created_at)}</span>
                          <div className="mt-0.5">{root.comment_text}</div>
                        </div>
                        <button
                          className="text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => deleteComment(root.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {replies.length > 0 && (
                        <div className="pl-4 border-l-2 border-primary/20 space-y-2">
                          {replies
                            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                            .map((r) => (
                              <div key={r.id} className="flex items-start justify-between gap-2 text-sm">
                                <div>
                                  <span className="font-semibold mr-1.5 text-primary">{r.profiles?.full_name || "Admin"}</span>
                                  <span className="text-[10px] text-muted-foreground mr-1.5">{timeAgo(r.created_at)}</span>
                                  <div className="mt-0.5">{r.comment_text}</div>
                                </div>
                                <button
                                  className="text-muted-foreground hover:text-destructive shrink-0"
                                  onClick={() => deleteComment(r.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        <Input
                          value={replyText[root.id] || ""}
                          onChange={(e) => setReplyText((prev) => ({ ...prev, [root.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              sendReply(classId, root.id);
                            }
                          }}
                          placeholder="রিপ্লাই লিখুন..."
                          className="h-8 text-sm rounded-full"
                        />
                        <Button
                          size="icon"
                          className="h-8 w-8 rounded-full shrink-0"
                          disabled={!replyText[root.id]?.trim() || sendingId === root.id}
                          onClick={() => sendReply(classId, root.id)}
                        >
                          <Send className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
};

export default AdminClassComments;
