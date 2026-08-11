import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Clock, CheckCircle2, XCircle, ArrowLeft, LayoutGrid, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import MathText from "@/components/MathText";

type Mode = "subject_final" | "paper_final" | "full_model";

interface Q {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_e?: string | null;
  correct_option: string;
  marks: number;
  explanation?: string | null;
  _sliceLabel?: string;
}

export default function AdmissionTestPlay() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const mode = params.get("mode") as Mode;
  const refId = params.get("refId");
  const testId = params.get("testId")!;

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [isNavigatorOpen, setIsNavigatorOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const questionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const autoSubmitTriggered = useRef(false);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const { data: test } = useQuery({
    queryKey: ["admission-test-single", testId],
    queryFn: async () => {
      const { data, error } = await supabase.from("admission_tests" as any).select("*").eq("id", testId).single();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: questions, isLoading } = useQuery({
    queryKey: ["admission-test-questions", mode, refId, testId],
    queryFn: async () => {
      if (mode === "subject_final") {
        const { data, error } = await supabase.rpc("get_admission_subject_questions" as any, { p_subject_id: refId });
        if (error) throw error;
        return (data || []) as Q[];
      }
      if (mode === "paper_final") {
        const { data, error } = await supabase.rpc("get_admission_paper_questions" as any, { p_paper_id: refId });
        if (error) throw error;
        return (data || []) as Q[];
      }
      const { data, error } = await supabase.rpc("get_admission_full_model_questions" as any, { p_admission_test_id: testId });
      if (error) throw error;
      return ((data || []) as any[]).map((row) => ({ ...row.question, _sliceLabel: row.slice_subject_name })) as Q[];
    },
    enabled: !!testId && (mode === "full_model" || !!refId),
  });

  useEffect(() => {
    if (test?.duration_minutes && secondsLeft === null) {
      setSecondsLeft(test.duration_minutes * 60);
    }
  }, [test, secondsLeft]);

  const results = useMemo(() => {
    if (!questions) return null;
    let correct = 0, wrong = 0, skipped = 0, score = 0;
    const negPerQ = Number(test?.negative_mark_per_question || 0);
    for (const q of questions) {
      const sel = answers[q.id];
      const perQMark = Number(q.marks) || 1;
      if (!sel) { skipped++; continue; }
      if (sel.toUpperCase() === String(q.correct_option).toUpperCase()) { correct++; score += perQMark; }
      else { wrong++; score -= negPerQ; }
    }
    return { correct, wrong, skipped, score, total: questions.length };
  }, [questions, answers, test]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!questions) return;
      await supabase.from("admission_test_attempts" as any).insert({
        admission_test_id: testId,
        profile_id: user?.id,
        mode,
        ref_id: refId || null,
        ref_name: mode === "full_model" ? "Full Model Test" : (questions[0] as any)?._sliceLabel || null,
        question_ids: questions.map((q) => q.id),
        answers,
        score: results?.score ?? 0,
        total_marks: questions.reduce((s, q) => s + (Number(q.marks) || 1), 0),
        correct_count: results?.correct ?? 0,
        wrong_count: results?.wrong ?? 0,
        skipped_count: results?.skipped ?? 0,
        submitted_at: new Date().toISOString(),
      });
    },
    onSuccess: () => setSubmitted(true),
  });

  useEffect(() => {
    if (submitted || secondsLeft === null) return;
    if (secondsLeft <= 0) {
      if (!autoSubmitTriggered.current) {
        autoSubmitTriggered.current = true;
        submitMutation.mutate();
      }
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => (s !== null ? s - 1 : s)), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, submitted]);

  const scrollToQuestion = (index: number) => {
    const qId = questions?.[index]?.id;
    if (qId && questionRefs.current[qId]) {
      questionRefs.current[qId]?.scrollIntoView({ behavior: "smooth", block: "center" });
      setIsNavigatorOpen(false);
    }
  };

  const scrollToNextUnanswered = (currentQuestionId: string, latestAnswers: Record<string, string>) => {
    const list = questions;
    if (!list || list.length === 0) return;
    const currentIndex = list.findIndex((q) => q.id === currentQuestionId);
    if (currentIndex === -1) return;
    let targetId: string | null = null;
    for (let i = currentIndex + 1; i < list.length; i++) {
      if (!latestAnswers[list[i].id]) { targetId = list[i].id; break; }
    }
    if (!targetId) {
      for (let i = 0; i < currentIndex; i++) {
        if (!latestAnswers[list[i].id]) { targetId = list[i].id; break; }
      }
    }
    if (!targetId) return;
    const finalTargetId = targetId;
    setTimeout(() => {
      requestAnimationFrame(() => {
        questionRefs.current[finalTargetId]?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }, 250);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  if (!questions || questions.length === 0) {
    return (
      <div className="text-center py-20 space-y-3">
        <p className="text-muted-foreground">কোনো প্রশ্ন পাওয়া যায়নি। Admin কে source সেট করতে বলুন।</p>
        <Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
      </div>
    );
  }

  if (submitted && results) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/admission-test")}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-lg font-semibold">Result</h1>
        </div>
        <Card className="rounded-[24px]">
          <CardContent className="p-4 space-y-3">
            <div className="text-center">
              <p className="text-3xl font-extrabold text-primary">{results.score.toFixed(2)} / {questions.reduce((s, q) => s + (Number(q.marks) || 1), 0)}</p>
              <p className="text-xs text-muted-foreground uppercase font-bold mt-1">Marks Obtained</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-emerald-500/10 rounded-lg p-2"><p className="text-emerald-600 font-bold">{results.correct}</p><p className="text-[10px] text-muted-foreground">Correct</p></div>
              <div className="bg-red-500/10 rounded-lg p-2"><p className="text-red-500 font-bold">{results.wrong}</p><p className="text-[10px] text-muted-foreground">Wrong</p></div>
              <div className="bg-muted rounded-lg p-2"><p className="font-bold">{results.skipped}</p><p className="text-[10px] text-muted-foreground">Skipped</p></div>
            </div>
          </CardContent>
        </Card>
        <div className="space-y-3">
          {questions.map((q, i) => {
            const sel = answers[q.id];
            const isCorrect = sel && sel.toUpperCase() === String(q.correct_option).toUpperCase();
            return (
              <Card key={q.id} className="rounded-[24px]">
                <CardContent className="p-3 space-y-2">
                  {q._sliceLabel && <Badge variant="outline">{q._sliceLabel}</Badge>}
                  <p className="text-sm font-medium flex gap-2"><span className="text-muted-foreground">{i + 1}.</span><MathText text={q.question_text} /></p>
                  <div className="flex items-center gap-2 text-xs">
                    {sel ? (isCorrect ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-red-500" />) : <Badge variant="secondary">Skipped</Badge>}
                    <span>আপনার উত্তর: {sel || "—"} | সঠিক: {q.correct_option}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  const answeredCount = Object.keys(answers).length;
  const isLowTime = secondsLeft !== null && secondsLeft < 300;

  return (
    <div className="min-h-screen bg-background pb-20 relative font-sans">
      <div className="container max-w-full lg:max-w-[92rem] mx-auto px-0.5 py-4 md:px-3 md:py-8 space-y-3 overflow-x-hidden">
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur py-2 -mx-[5px] px-[5px] md:mx-0 md:px-0 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0"><ArrowLeft className="h-5 w-5" /></Button>
              <div className="min-w-0">
                <h1 className="text-xl md:text-2xl font-bold truncate">{test?.title || "Admission Test"}</h1>
                <p className="text-sm text-muted-foreground">Answered: {answeredCount} / {questions.length}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className={cn(
                "px-3 py-1.5 rounded-full font-mono font-bold shadow-sm border flex items-center gap-1.5 transition-all duration-300 text-sm",
                isLowTime ? "bg-red-600 text-white border-red-700 animate-pulse" : "bg-background border-primary/20 text-primary"
              )}>
                <Clock className="h-3.5 w-3.5" />
                {secondsLeft !== null ? formatTime(secondsLeft) : "--:--"}
              </div>
            </div>
          </div>
        </div>

        {questions.map((q, idx) => (
          <div key={q.id} ref={(el) => { questionRefs.current[q.id] = el; }} className="scroll-mt-28">
            {q._sliceLabel && q._sliceLabel !== (questions[idx - 1] as any)?._sliceLabel && (
              <div className="sticky top-16 z-10 mb-2 flex justify-center">
                <div className="rounded-full bg-primary text-primary-foreground text-xs font-bold px-4 py-1.5 shadow-md">
                  {q._sliceLabel}
                </div>
              </div>
            )}
            <Card className="shadow-sm rounded-[30px] overflow-hidden max-w-full">
              <CardContent className="p-4 md:p-5 space-y-2 max-w-full overflow-x-hidden">
                <div className="flex items-center justify-between gap-2 max-w-full">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                    {idx + 1}/{questions.length}
                  </span>
                </div>

                <div className="w-full min-w-0 overflow-x-auto no-scrollbar scroll-smooth overscroll-x-contain">
                  <div className="text-lg font-medium leading-relaxed whitespace-pre-line min-w-0 break-words text-black dark:text-white">
                    <MathText text={q.question_text} className="prose dark:prose-invert max-w-none whitespace-pre-line min-w-0 break-words text-black dark:text-white" />
                  </div>
                </div>

                <div className="space-y-2 pt-2 max-w-full">
                  {(["A", "B", "C", "D", "E"] as const).map((optionKey) => {
                    const optionText = (q as any)[`option_${optionKey.toLowerCase()}`];
                    if (!optionText) return null;
                    const isSelected = answers[q.id] === optionKey;
                    const isAnswered = !!answers[q.id];
                    const isDisabled = isAnswered && !isSelected;

                    return (
                      <div
                        key={optionKey}
                        onClick={() => {
                          if (!isAnswered) {
                            const updated = { ...answers, [q.id]: optionKey };
                            setAnswers(updated);
                            scrollToNextUnanswered(q.id, updated);
                          }
                        }}
                        className={cn("flex items-start gap-4 group max-w-full", !isAnswered && "cursor-pointer", isDisabled && "opacity-50 pointer-events-none")}
                      >
                        <div className={cn(
                          "flex-shrink-0 h-8 w-8 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all mt-0.5",
                          isSelected ? "bg-primary border-primary text-primary-foreground scale-110" : "border-muted-foreground/30 text-muted-foreground",
                          !isAnswered && !isSelected && "group-hover:border-primary/50 group-hover:text-primary",
                          isDisabled && "border-muted-foreground/20 text-muted-foreground/50 cursor-not-allowed"
                        )}>
                          {optionKey}
                        </div>
                        <div className={cn(
                          "flex-1 min-w-0 text-base whitespace-pre-line pt-1 p-2.5 rounded-lg border overflow-x-auto no-scrollbar scroll-smooth overscroll-x-contain flex items-start justify-between gap-2",
                          isSelected ? "text-primary font-medium bg-primary/5 border-primary/40" : "text-black dark:text-white border-border/60"
                        )}>
                          <div className="flex-1 min-w-0">
                            <MathText text={optionText} className="prose dark:prose-invert max-w-none whitespace-pre-line min-w-0 break-words text-black dark:text-white" />
                          </div>
                          {isSelected && <Lock className="h-4 w-4 text-primary shrink-0 mt-0.5" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        ))}

        <div className="flex justify-center mt-8 pb-12">
          <Button
            size="lg"
            onClick={() => { if (confirm("Finish and submit exam?")) submitMutation.mutate(); }}
            disabled={submitMutation.isPending}
            className="bg-green-600 hover:bg-green-700 w-full max-w-sm h-12 text-lg rounded-full"
          >
            {submitMutation.isPending ? "Submitting..." : "Finish Exam"}
          </Button>
        </div>
      </div>

      <div className="fixed bottom-6 right-6 z-40">
        <Button
          size="default"
          className="h-12 rounded-full shadow-xl bg-green-600 hover:bg-green-700 text-white font-bold px-5"
          onClick={() => { if (confirm("Are you sure you want to submit?")) submitMutation.mutate(); }}
          disabled={submitMutation.isPending}
        >
          {submitMutation.isPending ? "Submitting..." : "Submit"}
        </Button>
      </div>

      <div className="fixed top-1/2 right-4 -translate-y-1/2 z-40">
        <Button size="icon" className="h-12 w-12 rounded-full shadow-xl bg-primary hover:bg-primary/90" onClick={() => setIsNavigatorOpen(true)}>
          <LayoutGrid className="h-6 w-6" />
        </Button>
      </div>

      <Dialog open={isNavigatorOpen} onOpenChange={setIsNavigatorOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Question Navigator</DialogTitle></DialogHeader>
          <div className="grid grid-cols-5 gap-3 p-2">
            {questions.map((qq, idx) => {
              const isAnswered = !!answers[qq.id];
              return (
                <button
                  key={qq.id}
                  onClick={() => scrollToQuestion(idx)}
                  className={cn(
                    "h-10 w-10 rounded-lg flex items-center justify-center text-sm font-bold transition-all",
                    isAnswered ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80 border border-border"
                  )}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
