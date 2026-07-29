import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEnrollments } from "@/hooks/useEnrollments";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ArrowLeft, ChevronRight, Sparkles, Loader2, ListChecks } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isExamUnlocked = (exam: any, enrolledIds: string[], isAdmin: boolean): boolean => {
  if (isAdmin) return true;
  if (exam.is_visible_on_free) return true;
  if (enrolledIds.length === 0) return false;
  if (exam.course_id && enrolledIds.includes(exam.course_id)) return true;
  if (Array.isArray(exam.shared_course_ids) && exam.shared_course_ids.some((id: string) => enrolledIds.includes(id))) return true;
  if (Array.isArray(exam.readymade_course_ids) && exam.readymade_course_ids.some((id: string) => enrolledIds.includes(id))) return true;
  return false;
};

type PickedExam = {
  id: string;
  title: string;
  subject: string;
  chapter: string | null;
  totalMcq: number;
  count: number; // user-editable MCQ count to pull from this exam
};

const SESSION_KEY = "customExamBuilderState";

type StoredState = {
  picked: [string, PickedExam][];
  targetMarks: number | null;
};

function loadStoredState(): StoredState | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const CustomExamBuilder = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isAdmin } = useAuth();
  const { data: enrollments } = useEnrollments();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enrolledIds: string[] = enrollments?.map((e: any) => e.course_id) || [];

  const initialStored = loadStoredState();

  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [picked, setPicked] = useState<Map<string, PickedExam>>(new Map(initialStored?.picked || []));
  const [creating, setCreating] = useState(false);
  const [targetMarks, setTargetMarks] = useState<number | null>(initialStored?.targetMarks ?? null);
  const [showTargetDialog, setShowTargetDialog] = useState(!initialStored?.targetMarks);
  const [customTargetInput, setCustomTargetInput] = useState(initialStored?.targetMarks ? String(initialStored.targetMarks) : "");

  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        picked: Array.from(picked.entries()),
        targetMarks,
      }));
    } catch {
      // ignore quota errors
    }
  }, [picked, targetMarks]);

  // --- Subjects ---
  const { data: subjects, isLoading: loadingSubjects } = useQuery({
    queryKey: ["custom-exam-subjects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exams")
        .select("subject")
        .eq("is_readymade", true).eq("is_published", true)
        .is("parent_exam_id", null);
      if (error) throw error;
      const unique = new Set<string>();
      (data || []).forEach((row: any) => {
        if (Array.isArray(row.subject)) row.subject.forEach((s: string) => unique.add(s));
        else if (typeof row.subject === "string") unique.add(row.subject);
      });
      return Array.from(unique).sort();
    },
  });

  // --- Chapters for selected subject ---
  const { data: chapters, isLoading: loadingChapters } = useQuery({
    queryKey: ["custom-exam-chapters", selectedSubject],
    queryFn: async () => {
      if (!selectedSubject) return [];
      const { data, error } = await supabase
        .from("exams")
        .select("chapter")
        .eq("is_readymade", true).eq("is_published", true)
        .is("parent_exam_id", null)
        .contains("subject", [selectedSubject]);
      if (error) throw error;
      const unique = new Set<string>();
      (data || []).forEach((row: any) => { if (row.chapter) unique.add(row.chapter); });
      return Array.from(unique).sort();
    },
    enabled: !!selectedSubject,
  });

  // --- Exams for selected subject+chapter ---
  const { data: chapterExams, isLoading: loadingExams } = useQuery({
    queryKey: ["custom-exam-exam-list", selectedSubject, selectedChapter],
    queryFn: async () => {
      if (!selectedSubject || !selectedChapter) return [];
      const { data, error } = await supabase
        .from("exams")
        .select("id, title, subject, chapter, course_id, shared_course_ids, readymade_course_ids, is_visible_on_free, questions_count:exam_questions(count)")
        .eq("is_readymade", true).eq("is_published", true)
        .is("parent_exam_id", null)
        .contains("subject", [selectedSubject])
        .eq("chapter", selectedChapter)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedSubject && !!selectedChapter,
  });

  const pickedList = useMemo(() => Array.from(picked.values()), [picked]);

  // Whenever the picked set changes, rebalance every exam's count to an equal
  // average, floor-rounded, with the remainder distributed to the first exams.
  const rebalance = (map: Map<string, PickedExam>, target: number | null) => {
    const list = Array.from(map.values());
    if (list.length === 0) return map;
    const totalAvailable = list.reduce((sum, e) => sum + e.totalMcq, 0);
    const goal = target && target > 0 ? Math.min(target, totalAvailable) : totalAvailable;
    const base = Math.max(1, Math.floor(goal / list.length));
    let remainder = 0;
    const next = new Map<string, PickedExam>();
    list.forEach((e) => {
      const count = Math.min(base, e.totalMcq);
      remainder += base - count; // if capped below base, track leftover to redistribute
      next.set(e.id, { ...e, count: count || Math.min(1, e.totalMcq) });
    });
    // Redistribute any leftover (from capped exams) to exams that have headroom
    let idx = 0;
    while (remainder > 0 && idx < list.length * 3) {
      const e = list[idx % list.length];
      const cur = next.get(e.id)!;
      if (cur.count < e.totalMcq) {
        next.set(e.id, { ...cur, count: cur.count + 1 });
        remainder--;
      }
      idx++;
    }
    return next;
  };

  const toggleExam = (exam: any) => {
    const totalMcq = exam.questions_count?.[0]?.count || 0;
    if (totalMcq <= 0) {
      toast({ title: "এই এক্সামে কোনো MCQ নেই", variant: "destructive" });
      return;
    }
    setPicked((prev) => {
      const next = new Map(prev);
      if (next.has(exam.id)) {
        next.delete(exam.id);
      } else {
        next.set(exam.id, {
          id: exam.id,
          title: exam.title,
          subject: selectedSubject!,
          chapter: selectedChapter,
          totalMcq,
          count: totalMcq,
        });
      }
      return rebalance(next, targetMarks);
    });
  };

  const updateCount = (id: string, value: number) => {
    setPicked((prev) => {
      const next = new Map(prev);
      const cur = next.get(id);
      if (!cur) return prev;
      const clamped = Math.max(1, Math.min(value || 1, cur.totalMcq));
      next.set(id, { ...cur, count: clamped });
      return next;
    });
  };

  const removeExam = (id: string) => {
    setPicked((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  };

  const totalSelectedMcq = pickedList.reduce((sum, e) => sum + e.count, 0);

  const handleCreate = async () => {
    if (pickedList.length === 0) return;
    setCreating(true);
    try {
      const { data, error } = await supabase.rpc("create_custom_exam", {
        p_exam_ids: pickedList.map((e) => e.id),
        p_counts: pickedList.map((e) => e.count),
        p_title: `Custom Exam (${pickedList.length} sources)`,
      });
      if (error) throw error;
      toast({ title: "কাস্টম এক্সাম তৈরি হয়েছে!" });
      try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
      navigate(`/dashboard/take-exam/${data}`);
    } catch (err: any) {
      toast({ title: "এক্সাম তৈরি করা যায়নি", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4 pb-24">
      <Dialog open={showTargetDialog} onOpenChange={(open) => { if (!open && targetMarks) setShowTargetDialog(false); }}>
        <DialogContent
          className="w-[90vw] max-w-sm rounded-2xl [&>button]:hidden"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              কত মার্কের এক্সাম বানাতে চাও?
            </DialogTitle>
            <DialogDescription className="text-xs">
              একটি টার্গেট বেছে নাও। পরে যতগুলো এক্সাম সিলেক্ট করবে, MCQ সংখ্যা এই টার্গেট অনুযায়ী auto-average হয়ে বসবে — চাইলে কমাতে/বাড়াতে পারবে।
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-2">
            {[25, 50, 100, 150, 200].map((n) => (
              <Button
                key={n}
                type="button"
                variant={targetMarks === n ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setTargetMarks(n);
                  setCustomTargetInput("");
                }}
              >
                {n}
              </Button>
            ))}
          </div>

          <Input
            type="number"
            min={1}
            placeholder="নিজের মতো সংখ্যা লিখো"
            value={customTargetInput}
            onChange={(e) => {
              setCustomTargetInput(e.target.value);
              const v = parseInt(e.target.value, 10);
              setTargetMarks(v > 0 ? v : null);
            }}
          />

          <Button
            className="w-full"
            disabled={!targetMarks || targetMarks <= 0}
            onClick={() => {
              setPicked((prev) => rebalance(prev, targetMarks));
              setShowTargetDialog(false);
            }}
          >
            পরবর্তী ধাপ
          </Button>
        </DialogContent>
      </Dialog>

      {!showTargetDialog && (
      <>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            if (selectedChapter) setSelectedChapter(null);
            else if (selectedSubject) setSelectedSubject(null);
            else navigate(-1);
          }}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-lg font-semibold tracking-tight flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> কাস্টম এক্সাম বানাও
        </h1>
        <Badge variant="secondary" className="ml-auto cursor-pointer" onClick={() => setShowTargetDialog(true)}>
          টার্গেট: {targetMarks} মার্ক
        </Badge>
      </div>

      {/* Breadcrumb / navigation */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
        <button className="hover:underline" onClick={() => { setSelectedSubject(null); setSelectedChapter(null); }}>বিষয়সমূহ</button>
        {selectedSubject && (<><ChevronRight className="h-3 w-3" /><button className="hover:underline" onClick={() => setSelectedChapter(null)}>{selectedSubject}</button></>)}
        {selectedChapter && (<><ChevronRight className="h-3 w-3" /><span>{selectedChapter}</span></>)}
      </div>

      {/* Subject grid */}
      {!selectedSubject && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {loadingSubjects ? <Loader2 className="h-5 w-5 animate-spin" /> : subjects?.map((s) => (
            <Card key={s} className="cursor-pointer hover:border-primary/50" onClick={() => setSelectedSubject(s)}>
              <CardContent className="p-3 flex items-center justify-between">
                <span className="text-sm font-medium">{s}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Chapter grid */}
      {selectedSubject && !selectedChapter && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {loadingChapters ? <Loader2 className="h-5 w-5 animate-spin" /> : chapters?.map((c) => (
            <Card key={c} className="cursor-pointer hover:border-primary/50" onClick={() => setSelectedChapter(c)}>
              <CardContent className="p-3 flex items-center justify-between">
                <span className="text-sm font-medium">{c}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Exam checklist */}
      {selectedSubject && selectedChapter && (
        <div className="space-y-2">
          {loadingExams ? <Loader2 className="h-5 w-5 animate-spin" /> : chapterExams?.map((exam: any) => {
            const unlocked = isExamUnlocked(exam, enrolledIds, isAdmin);
            const totalMcq = exam.questions_count?.[0]?.count || 0;
            const isPicked = picked.has(exam.id);
            return (
              <Card key={exam.id} className={`${!unlocked ? "opacity-50" : ""}`}>
                <CardContent className="p-3 flex items-center gap-3">
                  <Checkbox
                    checked={isPicked}
                    disabled={!unlocked}
                    onCheckedChange={() => unlocked && toggleExam(exam)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{exam.title}</p>
                    <p className="text-xs text-muted-foreground">{totalMcq} MCQ</p>
                  </div>
                  {!unlocked && <Badge variant="secondary" className="text-[10px]">লকড</Badge>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Sticky selection summary + count editor + submit */}
      {pickedList.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 sm:left-auto sm:right-4 sm:bottom-4 sm:w-96 bg-background border rounded-t-xl sm:rounded-xl shadow-2xl z-50 flex flex-col max-h-[75vh]">
          <div className="flex items-center justify-between p-3 pb-2 shrink-0">
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <ListChecks className="h-4 w-4 text-primary" /> নির্বাচিত: {pickedList.length}টি এক্সাম
            </p>
            <Badge className="bg-primary/10 text-primary border-primary/30">মোট MCQ: {totalSelectedMcq}</Badge>
          </div>
          <div className="space-y-1.5 px-3 overflow-y-auto flex-1 min-h-0">
            {pickedList.map((e) => (
              <div key={e.id} className="flex items-center gap-1.5 text-xs border rounded-lg px-2 py-1.5">
                <p className="flex-1 min-w-0 truncate font-medium" title={e.title}>{e.title}</p>
                <Input
                  type="number"
                  min={1}
                  max={e.totalMcq}
                  value={e.count}
                  onChange={(ev) => updateCount(e.id, parseInt(ev.target.value, 10))}
                  className="w-14 h-7 text-xs text-center px-1 shrink-0"
                />
                <span className="text-muted-foreground shrink-0">/{e.totalMcq}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeExam(e.id)}>×</Button>
              </div>
            ))}
          </div>
          <div className="p-3 pt-2 shrink-0 border-t">
            <Button className="w-full" disabled={creating} onClick={handleCreate}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              এক্সাম শুরু করো
            </Button>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
};

export default CustomExamBuilder;
