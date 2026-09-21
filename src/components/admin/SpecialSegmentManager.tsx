import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";

interface Props {
  examId: string;
  onChanged?: () => void;
}

const SpecialSegmentManager = ({ examId, onChanged }: Props) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const key = ["special-segments", examId];

  const { data: rows = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("exam_questions")
        .select("id, question_index, question_text, correct_option, subject, is_segment_mandatory")
        .eq("exam_id", examId)
        .order("question_index", { ascending: true });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: key });
    queryClient.invalidateQueries({ queryKey: ["admin-exams"] });
    onChanged?.();
  };

  const segments = Array.from(new Set(rows.map((r) => r.subject || "(No segment)")));

  const syncTotals = async () => {
    const { count } = await supabase.from("exam_questions").select("id", { count: "exact", head: true }).eq("exam_id", examId);
    if (count !== null) await supabase.from("exams").update({ total_marks: count } as any).eq("id", examId);
  };

  const deleteOne = async (id: string) => {
    if (!confirm("এই MCQ টি delete করবে?")) return;
    setBusy(true);
    const { error } = await supabase.from("exam_questions").delete().eq("id", id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else { await syncTotals(); await refresh(); }
    setBusy(false);
  };

  const deleteSegment = async (seg: string) => {
    const ids = rows.filter((r) => (r.subject || "(No segment)") === seg).map((r) => r.id);
    if (!confirm(`"${seg}" segment এর সব ${ids.length}টি MCQ delete করবে?`)) return;
    setBusy(true);
    const { error } = await supabase.from("exam_questions").delete().in("id", ids);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else { await syncTotals(); await refresh(); }
    setBusy(false);
  };

  const toggleMandatory = async (seg: string, current: boolean) => {
    const ids = rows.filter((r) => (r.subject || "(No segment)") === seg).map((r) => r.id);
    setBusy(true);
    const { error } = await (supabase as any).from("exam_questions").update({ is_segment_mandatory: !current }).in("id", ids);
    if (error) toast({ title: "Update failed", description: error.message, variant: "destructive" });
    else await refresh();
    setBusy(false);
  };

  if (isLoading) return <p className="text-xs text-muted-foreground">Loading segments...</p>;
  if (!rows.length) return <p className="text-xs text-muted-foreground">এই exam এ এখনো কোনো MCQ নেই।</p>;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Saved: {segments.length} segment · {rows.length} MCQ</p>
      {segments.map((seg) => {
        const list = rows.filter((r) => (r.subject || "(No segment)") === seg);
        const mandatory = list[0]?.is_segment_mandatory ?? true;
        const isOpen = !!open[seg];
        return (
          <div key={seg} className="border rounded-xl bg-card">
            <div className="flex items-center gap-2 p-2">
              <button type="button" className="flex items-center gap-1 flex-1 text-left min-w-0" onClick={() => setOpen((p) => ({ ...p, [seg]: !isOpen }))}>
                {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                <span className="text-sm font-semibold truncate">{seg}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">{list.length} MCQ</span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => toggleMandatory(seg, mandatory)}
                className={`text-[10px] font-semibold rounded-full px-2 py-1 border shrink-0 ${mandatory ? "bg-primary/10 text-primary border-primary/30" : "bg-muted text-muted-foreground border-border"}`}
              >
                {mandatory ? "Mandatory" : "Optional"}
              </button>
              <Button type="button" size="icon" variant="ghost" disabled={busy} className="h-7 w-7 text-destructive shrink-0" onClick={() => deleteSegment(seg)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            {isOpen && (
              <div className="border-t divide-y">
                {list.map((q, i) => (
                  <div key={q.id} className="flex items-start gap-2 p-2">
                    <span className="text-[10px] text-muted-foreground w-6 shrink-0 pt-0.5">{i + 1}.</span>
                    <p className="text-xs flex-1 line-clamp-2 break-words">{q.question_text}</p>
                    <span className="text-[10px] font-mono text-emerald-600 shrink-0">{q.correct_option}</span>
                    <Button type="button" size="icon" variant="ghost" disabled={busy} className="h-6 w-6 text-destructive shrink-0" onClick={() => deleteOne(q.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default SpecialSegmentManager;
