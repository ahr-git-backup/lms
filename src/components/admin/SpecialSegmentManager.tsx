import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { QuestionEditor, QuestionData } from "@/components/admin/QuestionEditor";

interface Props {
  examId: string;
  onChanged?: () => void;
}

const NO_SEG = "(No segment)";

const SpecialSegmentManager = ({ examId, onChanged }: Props) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [viewSeg, setViewSeg] = useState<string | null>(null);
  const [editing, setEditing] = useState<QuestionData | null>(null);
  const [busy, setBusy] = useState(false);
  const key = ["special-segments", examId];

  const { data: rows = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("exam_questions")
        .select("*")
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

  const segOf = (r: any) => r.subject || NO_SEG;
  const segments = Array.from(new Set(rows.map(segOf)));

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
    const ids = rows.filter((r) => segOf(r) === seg).map((r) => r.id);
    if (!confirm(`"${seg}" segment এর সব ${ids.length}টি MCQ delete করবে?`)) return;
    setBusy(true);
    const { error } = await supabase.from("exam_questions").delete().in("id", ids);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else { await syncTotals(); await refresh(); setViewSeg(null); }
    setBusy(false);
  };

  const toggleMandatory = async (seg: string, current: boolean) => {
    const ids = rows.filter((r) => segOf(r) === seg).map((r) => r.id);
    setBusy(true);
    const { error } = await (supabase as any).from("exam_questions").update({ is_segment_mandatory: !current }).in("id", ids);
    if (error) toast({ title: "Update failed", description: error.message, variant: "destructive" });
    else await refresh();
    setBusy(false);
  };

  const startEdit = (r: any) => {
    setEditing({
      id: r.id,
      question: r.question_text || "",
      options: { A: r.option_a || "", B: r.option_b || "", C: r.option_c || "", D: r.option_d || "" },
      correct_answer: r.correct_option || "A",
      explanation: r.explanation || "",
      subject: r.subject || "",
    } as QuestionData);
  };

  const saveEdit = async () => {
    if (!editing?.id) return;
    setBusy(true);
    const { error } = await (supabase as any)
      .from("exam_questions")
      .update({
        question_text: editing.question,
        option_a: editing.options?.A ?? "",
        option_b: editing.options?.B ?? "",
        option_c: editing.options?.C ?? "",
        option_d: editing.options?.D ?? "",
        correct_option: editing.correct_answer,
        explanation: editing.explanation || null,
      })
      .eq("id", editing.id);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else { toast({ title: "MCQ updated" }); setEditing(null); await refresh(); }
    setBusy(false);
  };

  if (isLoading) return <p className="text-xs text-muted-foreground">Loading segments...</p>;
  if (!rows.length) return <p className="text-xs text-muted-foreground">এই exam এ এখনো কোনো MCQ নেই।</p>;

  const viewList = viewSeg ? rows.filter((r) => segOf(r) === viewSeg) : [];
  const viewMandatory = viewList[0]?.is_segment_mandatory ?? true;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Saved: {segments.length} segment · {rows.length} MCQ</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {segments.map((seg) => {
          const list = rows.filter((r) => segOf(r) === seg);
          const mandatory = list[0]?.is_segment_mandatory ?? true;
          return (
            <div key={seg} className="border rounded-xl bg-card p-2 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{seg}</p>
                <p className="text-[10px] text-muted-foreground">{list.length} MCQ · {mandatory ? "Mandatory" : "Optional"}</p>
              </div>
              <Button type="button" size="sm" variant="outline" className="h-8 gap-1" onClick={() => setViewSeg(seg)}>
                <Eye className="h-3.5 w-3.5" /> View
              </Button>
            </div>
          );
        })}
      </div>

      <Dialog open={!!viewSeg} onOpenChange={(o) => { if (!o) { setViewSeg(null); setEditing(null); } }}>
        <DialogContent className="max-w-3xl max-h-[88vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <span className="truncate">{viewSeg}</span>
              <span className="text-xs font-normal text-muted-foreground">{viewList.length} MCQ</span>
            </DialogTitle>
          </DialogHeader>

          {editing ? (
            <div className="flex-1 overflow-y-auto">
              <QuestionEditor data={editing} onChange={setEditing} onSave={saveEdit} onCancel={() => setEditing(null)} />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => viewSeg && toggleMandatory(viewSeg, viewMandatory)}
                  className={`text-[11px] font-semibold rounded-full px-3 py-1.5 border ${viewMandatory ? "bg-primary/10 text-primary border-primary/30" : "bg-muted text-muted-foreground border-border"}`}
                >
                  {viewMandatory ? "Mandatory" : "Optional"}
                </button>
                <Button type="button" size="sm" variant="ghost" disabled={busy} className="text-destructive ml-auto h-8 gap-1" onClick={() => viewSeg && deleteSegment(viewSeg)}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete segment
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto divide-y border rounded-xl">
                {viewList.map((q, i) => (
                  <div key={q.id} className="p-3 space-y-1.5">
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-muted-foreground shrink-0 pt-0.5">{i + 1}.</span>
                      <p className="text-sm flex-1 break-words whitespace-pre-wrap">{q.question_text}</p>
                      <Button type="button" size="icon" variant="ghost" disabled={busy} className="h-7 w-7 shrink-0" onClick={() => startEdit(q)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" disabled={busy} className="h-7 w-7 text-destructive shrink-0" onClick={() => deleteOne(q.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 pl-5">
                      {(["A", "B", "C", "D"] as const).map((L) => {
                        const txt = q[`option_${L.toLowerCase()}`];
                        if (!txt) return null;
                        const ok = q.correct_option === L;
                        return (
                          <p key={L} className={`text-xs rounded px-2 py-1 break-words ${ok ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200 font-semibold" : "bg-muted/50"}`}>
                            {L}. {txt}
                          </p>
                        );
                      })}
                    </div>
                    {q.explanation && <p className="text-[11px] text-muted-foreground pl-5 break-words">Ex: {q.explanation}</p>}
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SpecialSegmentManager;
