import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import {
  Clock,
  Check,
  X,
  Trophy,
  Bookmark,
  Repeat,
  FileDown,
  ListChecks,
  Calculator,
  Flag,
  LayoutGrid,
  Lock,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import MathText from "@/components/MathText";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { AiExplanationBox, AiChatButton, prewarmExplanations } from "@/components/exam/AiMcqHelper";
import { openSolvePdf } from "@/lib/solvePdf";

interface PoolQuestion {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  explanation?: string;
}

const NEGATIVE_MARK = 0.25;

const ReportQuestionDialog = ({ questionText }: { questionText: string }) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [reportText, setReportText] = useState("");
  const [suggestedOption, setSuggestedOption] = useState<string | undefined>(undefined);
  const [isOpen, setIsOpen] = useState(false);

  const reportMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Must be logged in");
      const { error } = await supabase.from("question_reports").insert({
        question_id: null,
        user_id: user.id,
        report_text: `[Unlimited Mock Test] ${questionText.slice(0, 120)} — ${reportText}`,
        suggested_correct_option: suggestedOption,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "রিপোর্ট জমা হয়েছে", description: "ধন্যবাদ আপনার ফিডব্যাকের জন্য।" });
      setReportText("");
      setSuggestedOption(undefined);
      setIsOpen(false);
    },
    onError: (e: any) => toast({ title: "রিপোর্ট ব্যর্থ", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-500">
          <Flag className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report Mistake</DialogTitle>
          <DialogDescription>প্রশ্নে কোনো ভুল পেলে জানান।</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="text-sm text-muted-foreground line-clamp-2 italic bg-muted p-2 rounded">
            <MathText text={questionText} />
          </div>
          <div className="space-y-2">
            <Label>সমস্যা বর্ণনা করুন</Label>
            <Textarea value={reportText} onChange={(e) => setReportText(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>সঠিক অপশন (ঐচ্ছিক)</Label>
            <Select value={suggestedOption} onValueChange={setSuggestedOption}>
              <SelectTrigger>
                <SelectValue placeholder="নির্বাচন করুন" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A">Option A</SelectItem>
                <SelectItem value="B">Option B</SelectItem>
                <SelectItem value="C">Option C</SelectItem>
                <SelectItem value="D">Option D</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            বাতিল
          </Button>
          <Button onClick={() => reportMutation.mutate()} disabled={!reportText.trim() || reportMutation.isPending}>
            {reportMutation.isPending ? "জমা হচ্ছে..." : "জমা দিন"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const PlayUnlimitedMock = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth() as any;
  const { toast } = useToast();

  const questions: PoolQuestion[] = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem("unlimitedMockQuestions") || "[]");
    } catch {
      return [];
    }
  }, []);
  const title = sessionStorage.getItem("unlimitedMockTitle") || "Mock Test";
  const minutes = Number(sessionStorage.getItem("unlimitedMockTime") || "30");

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [secondsLeft, setSecondsLeft] = useState(minutes * 60);
  const [submitted, setSubmitted] = useState(false);
  const [filter, setFilter] = useState<"all" | "correct" | "incorrect" | "skipped">("all");
  const [bookmarked, setBookmarked] = useState<Record<string, boolean>>({});
  const [isMistakeDialogOpen, setIsMistakeDialogOpen] = useState(false);
  const [isNavigatorOpen, setIsNavigatorOpen] = useState(false);
  const [violationCount, setViolationCount] = useState(0);
  const questionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Stable key for this attempt's localStorage persistence — mirrors
  // TakeExam.tsx's LOCAL_STORAGE_KEY_PREFIX pattern, so refreshing mid-test
  // (or the browser closing) doesn't lose progress, while a genuinely new
  // test (new session id from UnlimitedMockTest.tsx) starts clean.
  const sessionId = sessionStorage.getItem("unlimitedMockSessionId") || "unlimited_mock_default";
  const STORAGE_KEY_PREFIX = `mock_attempt_${sessionId}`;

  useEffect(() => {
    if (questions.length === 0) navigate("/mock-test");
  }, [questions, navigate]);

  // Restore answers/violations from localStorage on mount (survives a page
  // refresh or the browser being closed and reopened), mirroring
  // TakeExam.tsx's persistence so a Mock Test attempt is never lost.
  useEffect(() => {
    try {
      const savedAnswers = localStorage.getItem(`${STORAGE_KEY_PREFIX}_answers`);
      const savedViolations = localStorage.getItem(`${STORAGE_KEY_PREFIX}_violations`);
      if (savedAnswers) setAnswers(JSON.parse(savedAnswers));
      if (savedViolations) setViolationCount(parseInt(savedViolations, 10) || 0);
    } catch {
      // ignore corrupt/missing saved state
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save answers/violations on every change so progress survives a refresh.
  useEffect(() => {
    if (submitted) return;
    localStorage.setItem(`${STORAGE_KEY_PREFIX}_answers`, JSON.stringify(answers));
    localStorage.setItem(`${STORAGE_KEY_PREFIX}_violations`, violationCount.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, violationCount, submitted]);

  // Anti-cheat: tab-switch detection + refresh warning — identical behavior
  // to TakeExam.tsx, so Mock Test feels the same as a real exam.
  useEffect(() => {
    if (submitted) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        setViolationCount((prev) => prev + 1);
        toast({
          title: "⚠️ Warning: Tab Switch Detected",
          description: "Leaving the test tab is recorded. Multiple violations may disqualify you.",
          variant: "destructive",
          duration: 5000,
        });
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Are you sure you want to refresh? You might lose your progress if not saved.";
      return e.returnValue;
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [submitted, toast]);

  // Clear this attempt's saved progress once submitted, so a stale answer
  // set can't leak into a future attempt that happens to reuse the same key.
  useEffect(() => {
    if (submitted) {
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}_answers`);
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}_violations`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted]);

  useEffect(() => {
    if (submitted) return;
    if (secondsLeft <= 0) {
      handleSubmit();
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, submitted]);

  useEffect(() => {
    if (submitted && questions.length > 0) {
      prewarmExplanations(questions as any);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted]);

  const stats = useMemo(() => {
    let correct = 0,
      wrong = 0,
      skipped = 0;
    questions.forEach((q) => {
      const ua = answers[q.id];
      if (!ua) skipped++;
      else if (ua === q.correct_option) correct++;
      else wrong++;
    });
    const negMark = wrong * NEGATIVE_MARK;
    const finalScore = correct - negMark;
    return { correct, wrong, skipped, negMark, correctMarks: correct, finalScore };
  }, [answers, questions]);

  const handleSubmit = async () => {
    if (submitted) return;
    setSubmitted(true);
    if (user) {
      try {
        await supabase.from("mock_exam_attempts").insert({
          mock_exam_id: null,
          user_id: user.id,
          score: stats.finalScore,
          total_marks: questions.length,
          answers,
          submitted_at: new Date().toISOString(),
        });
      } catch {
        // best-effort logging only
      }
    }
  };

  // After answering a question, auto-scroll to the next unanswered question —
  // mirrors TakeExam.tsx's behavior so Mock Test feels identical to a real exam.
  const scrollToNextUnanswered = (currentQuestionId: string, latestAnswers: Record<string, string>) => {
    const list = questions;
    if (!list || list.length === 0) return;
    const currentIndex = list.findIndex((q) => q.id === currentQuestionId);
    if (currentIndex === -1) return;

    let targetId: string | null = null;
    for (let i = currentIndex + 1; i < list.length; i++) {
      if (!latestAnswers[list[i].id]) {
        targetId = list[i].id;
        break;
      }
    }
    if (!targetId) {
      for (let i = 0; i < currentIndex; i++) {
        if (!latestAnswers[list[i].id]) {
          targetId = list[i].id;
          break;
        }
      }
    }
    if (targetId && questionRefs.current[targetId]) {
      questionRefs.current[targetId]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const scrollToQuestion = (index: number) => {
    const questionId = questions?.[index]?.id;
    if (questionId && questionRefs.current[questionId]) {
      questionRefs.current[questionId]?.scrollIntoView({ behavior: "smooth", block: "center" });
      setIsNavigatorOpen(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const questionKey = (q: PoolQuestion) => q.question_text.slice(0, 200);

  const toggleBookmark = async (q: PoolQuestion) => {
    if (!user) {
      toast({ title: "বুকমার্ক করতে লগইন করুন", variant: "destructive" });
      return;
    }
    const key = questionKey(q);
    const isBookmarked = bookmarked[q.id];
    setBookmarked((prev) => ({ ...prev, [q.id]: !isBookmarked }));
    try {
      if (isBookmarked) {
        await supabase
          .from("mock_question_bookmarks")
          .delete()
          .eq("user_id", user.id)
          .eq("question_key", key);
      } else {
        await supabase.from("mock_question_bookmarks").insert({
          user_id: user.id,
          question_key: key,
          exam_name: title,
          question_text: q.question_text,
          option_a: q.option_a,
          option_b: q.option_b,
          option_c: q.option_c,
          option_d: q.option_d,
          correct_option: q.correct_option,
          explanation: q.explanation || null,
        });
      }
    } catch {
      setBookmarked((prev) => ({ ...prev, [q.id]: isBookmarked }));
      toast({ title: "বুকমার্ক ব্যর্থ", variant: "destructive" });
    }
  };

  const retakeExam = () => {
    setAnswers({});
    setSecondsLeft(minutes * 60);
    setSubmitted(false);
    setFilter("all");
    sessionStorage.setItem(
      "unlimitedMockSessionId",
      `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    );
  };

  const startMistakePractice = (mode: "wrong" | "both") => {
    const wrongQs = questions.filter((q) => answers[q.id] && answers[q.id] !== q.correct_option);
    const skippedQs = questions.filter((q) => !answers[q.id]);
    const target = mode === "wrong" ? wrongQs : [...wrongQs, ...skippedQs];
    if (target.length === 0) return;
    setIsMistakeDialogOpen(false);
    const sessionId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem("unlimitedMockQuestions", JSON.stringify(target));
    sessionStorage.setItem("unlimitedMockTitle", `${title} — Mistake Practice`);
    sessionStorage.setItem("unlimitedMockTime", String(Math.ceil(target.length / 1.5)));
    sessionStorage.setItem("unlimitedMockSessionId", sessionId);
    window.location.reload();
  };

  const handleSolvePdf = () => {
    if (!questions.length) return;
    openSolvePdf({
      examName: title,
      studentName: profile?.full_name || undefined,
      questions: questions.map((q) => ({
        question_text: q.question_text,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        correct_option: q.correct_option,
        user_answer: answers[q.id] || null,
        explanation: q.explanation,
      })),
      totalMarks: questions.length,
      score: stats.finalScore,
    });
  };

  if (questions.length === 0) return null;

  if (submitted) {
    const pieData = [
      { name: "Correct", value: stats.correct, color: "#16a34a" },
      { name: "Wrong", value: stats.wrong, color: "#ef4444" },
      { name: "Skipped", value: stats.skipped, color: "#94a3b8" },
    ].filter((d) => d.value > 0);

    const questionPositionMap = new Map(questions.map((q, i) => [q.id, i + 1]));

    const filteredQuestions = questions.filter((q) => {
      const ua = answers[q.id];
      if (filter === "all") return true;
      if (filter === "correct") return ua === q.correct_option;
      if (filter === "incorrect") return ua && ua !== q.correct_option;
      if (filter === "skipped") return !ua;
      return true;
    });

    return (
      <div className="min-h-screen bg-background font-sans pb-20 -mt-4">
        <div className="container max-w-4xl mx-auto px-[5px] pt-0 pb-2 md:pt-0 md:pb-6 md:px-6 space-y-2 overflow-x-hidden">
          <div className="flex flex-col gap-1">
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
              {user && (
                <Button variant="outline" onClick={retakeExam} className="h-10 px-3 py-2 w-full sm:w-auto">
                  <Repeat className="h-5 w-5 mr-1.5 text-primary shrink-0" />{" "}
                  <span className="truncate">Practice Again</span>
                </Button>
              )}
              <Button variant="outline" onClick={handleSolvePdf} className="h-10 px-3 py-2 w-full sm:w-auto">
                <FileDown className="h-5 w-5 mr-1.5 text-blue-500 shrink-0" />{" "}
                <span className="truncate">Solve PDF</span>
              </Button>
              {user && (
                <Button
                  variant="outline"
                  onClick={() => setIsMistakeDialogOpen(true)}
                  className="h-10 px-2 py-2 w-full sm:w-auto"
                >
                  <ListChecks className="h-5 w-5 mr-1 text-red-500 shrink-0" />{" "}
                  <span className="text-sm whitespace-nowrap">Mistake Practice</span>
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => navigate("/mock-test")}
                className="h-10 px-3 py-2 w-full sm:w-auto"
              >
                <Trophy className="h-5 w-5 mr-1.5 text-yellow-500 shrink-0" />{" "}
                <span className="truncate">Mock Test তালিকা</span>
              </Button>
            </div>
          </div>

          {!user && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-center">
              আরও ফিচার (বুকমার্ক, Mistake Practice, ইত্যাদি) পেতে{" "}
              <a href="/register" className="font-bold text-primary underline">
                অ্যাকাউন্ট খোলো
              </a>{" "}
              — সম্পূর্ণ ফ্রি।
            </div>
          )}

          <Dialog open={isMistakeDialogOpen} onOpenChange={setIsMistakeDialogOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Mistake Practice</DialogTitle>
                <DialogDescription>Kon question gulo practice korte chao?</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3 py-2">
                <button
                  onClick={() => startMistakePractice("wrong")}
                  disabled={stats.wrong === 0}
                  className="p-4 border rounded-lg text-left hover:bg-muted/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <div className="font-semibold">Only Wrong ({stats.wrong})</div>
                  <div className="text-xs text-muted-foreground">Shudhu vul kora question gulo</div>
                </button>
                <button
                  onClick={() => startMistakePractice("both")}
                  disabled={stats.wrong + stats.skipped === 0}
                  className="p-4 border rounded-lg text-left hover:bg-muted/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <div className="font-semibold">Wrong + Skip ({stats.wrong + stats.skipped})</div>
                  <div className="text-xs text-muted-foreground">Vul o baad deya shob question</div>
                </button>
              </div>
            </DialogContent>
          </Dialog>

          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-3 md:p-4">
              <div className="flex flex-col md:flex-row justify-between items-center gap-2 md:gap-6">
                <div className="text-center md:text-left w-full md:w-auto pb-2 md:pb-0 border-b md:border-b-0 md:border-r border-border/60 md:pr-4">
                  <h1 className="text-2xl font-extrabold mb-0.5">{title}</h1>
                  <p className="text-xs text-muted-foreground">Submitted just now</p>
                </div>

                <div className="flex-1 flex flex-row items-center justify-center gap-4 md:gap-6 w-full pb-2 md:pb-0 border-b md:border-b-0 md:border-r border-border/60 md:pr-4">
                  <div className="text-center flex-shrink-0 pr-4 border-r border-border/60">
                    <div className="text-4xl font-extrabold text-primary">
                      {stats.finalScore.toFixed(2)}
                      <span className="text-4xl text-muted-foreground font-extrabold"> / {questions.length}</span>
                    </div>
                    <div className="text-[10px] uppercase font-bold text-muted-foreground mt-0.5">
                      Marks Obtained
                    </div>
                  </div>

                  <div className="shrink-0" style={{ height: 112, width: 112 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={26}
                          outerRadius={42}
                          paddingAngle={2}
                          dataKey="value"
                          isAnimationActive={false}
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="flex gap-2 justify-between w-full md:w-auto md:flex-col md:gap-1.5 text-center">
                  <div className="flex-1 border rounded-lg p-1.5 flex flex-row md:flex-col items-center justify-center gap-2 bg-background/50 md:bg-transparent md:border-0 md:p-0">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground order-1 md:order-2">
                      Correct
                    </div>
                    <div className="text-lg font-bold text-green-600 order-2 md:order-1">{stats.correct}</div>
                  </div>
                  <div className="flex-1 border rounded-lg p-1.5 flex flex-row md:flex-col items-center justify-center gap-2 bg-background/50 md:bg-transparent md:border-0 md:p-0">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground order-1 md:order-2">
                      Wrong
                    </div>
                    <div className="text-lg font-bold text-red-500 order-2 md:order-1">{stats.wrong}</div>
                  </div>
                  <div className="flex-1 border rounded-lg p-1.5 flex flex-row md:flex-col items-center justify-center gap-2 bg-background/50 md:bg-transparent md:border-0 md:p-0">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground order-1 md:order-2">
                      Skipped
                    </div>
                    <div className="text-lg font-bold text-slate-400 order-2 md:order-1">{stats.skipped}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border shadow-sm">
            <CardContent className="p-4 md:p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-muted-foreground">
                <Calculator className="h-5 w-5" /> Score Breakdown
              </h3>
              <div className="grid grid-cols-3 gap-2 md:hidden text-xs">
                <div className="p-2 bg-green-500/5 rounded-lg border border-green-500/20 text-center">
                  <div className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Correct</div>
                  <div className="text-base font-bold text-green-600 font-mono">
                    +{stats.correctMarks.toFixed(1)}
                  </div>
                </div>
                <div className="p-2 bg-red-500/5 rounded-lg border border-red-500/20 text-center">
                  <div className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Negative</div>
                  <div className="text-base font-bold text-red-500 font-mono">-{stats.negMark.toFixed(1)}</div>
                </div>
                <div className="p-2 bg-primary/5 rounded-lg border border-primary/20 text-center">
                  <div className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Total</div>
                  <div className="text-base font-bold text-primary font-mono">{stats.finalScore.toFixed(2)}</div>
                </div>
              </div>

              <div className="hidden md:flex flex-row gap-4 items-center text-sm">
                <div className="flex-1 p-3 bg-green-500/5 rounded-xl border border-green-500/20 text-left">
                  <div className="text-muted-foreground text-xs uppercase font-bold tracking-wider mb-1">
                    Correct Marks
                  </div>
                  <div className="text-xl font-bold text-green-600 font-mono">
                    +{stats.correctMarks.toFixed(2)}
                  </div>
                </div>
                <div className="text-muted-foreground font-bold text-xl">-</div>
                <div className="flex-1 p-3 bg-red-500/5 rounded-xl border border-red-500/20 text-left">
                  <div className="text-muted-foreground text-xs uppercase font-bold tracking-wider mb-1">
                    Negative ({stats.wrong})
                  </div>
                  <div className="text-xl font-bold text-red-500 font-mono">-{stats.negMark.toFixed(2)}</div>
                </div>
                <div className="text-muted-foreground font-bold text-xl">=</div>
                <div className="flex-1 p-3 bg-primary/5 rounded-xl border border-primary/20 text-left">
                  <div className="text-muted-foreground text-xs uppercase font-bold tracking-wider mb-1">
                    Final Score
                  </div>
                  <div className="text-xl font-bold text-primary font-mono">{stats.finalScore.toFixed(2)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2 pb-2">
            {[
              { label: "All", value: "all", count: questions.length },
              { label: "Correct", value: "correct", count: stats.correct },
              { label: "Incorrect", value: "incorrect", count: stats.wrong },
              { label: "Skipped", value: "skipped", count: stats.skipped },
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value as any)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs sm:text-sm font-medium border transition-colors",
                  filter === f.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:bg-muted"
                )}
              >
                {f.label} ({f.count})
              </button>
            ))}
          </div>

          <div className="space-y-6">
            {filteredQuestions.map((q) => {
              const ua = answers[q.id];
              const isCorrect = ua === q.correct_option;
              const isSkipped = !ua;
              const isWrong = !isCorrect && !isSkipped;

              return (
                <Card
                  key={q.id}
                  className="rounded-[30px] overflow-hidden shadow-sm border max-w-full break-inside-avoid page-break-inside-avoid print:break-inside-avoid"
                >
                  <CardContent className="p-5 space-y-2 max-w-full overflow-x-hidden">
                    <div className="flex items-center justify-between gap-2 print:hidden">
                      <span
                        className={cn(
                          "text-xs font-bold px-2.5 py-1 rounded-full",
                          isCorrect
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : isWrong
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {questionPositionMap.get(q.id)}/{questions.length}
                      </span>
                      <div className="flex items-center gap-0.5">
                        <AiChatButton q={q} questionId={q.id} />
                        <ReportQuestionDialog questionText={q.question_text} />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleBookmark(q)}
                          className={cn(
                            "h-8 w-8 hover:bg-transparent",
                            bookmarked[q.id] ? "text-primary fill-primary" : "text-muted-foreground"
                          )}
                        >
                          <Bookmark className={cn("h-5 w-5", bookmarked[q.id] && "fill-current")} />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0 pt-1 overflow-x-auto no-scrollbar scroll-smooth overscroll-x-contain">
                        <div className="text-lg font-medium leading-relaxed whitespace-normal min-w-0 break-words">
                          <MathText
                            text={q.question_text}
                            className="prose dark:prose-invert max-w-none whitespace-normal min-w-0 break-words"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      {(["A", "B", "C", "D"] as const).map((optionKey) => {
                        const optionText = q[`option_${optionKey.toLowerCase()}` as "option_a"];
                        if (!optionText) return null;
                        const isSelected = ua === optionKey;
                        const isCorrectOption = q.correct_option === optionKey;

                        let circleClass = "border-muted-foreground/30 text-muted-foreground";
                        let icon = <span className="text-sm font-bold">{optionKey}</span>;

                        if (isCorrectOption) {
                          circleClass = "bg-green-500 border-green-500 text-white";
                          icon = <Check className="h-4 w-4" />;
                        } else if (isSelected && !isCorrectOption) {
                          circleClass = "bg-red-500 border-red-500 text-white";
                          icon = <X className="h-4 w-4" />;
                        }

                        return (
                          <div key={optionKey} className="flex items-start gap-4 max-w-full">
                            <div
                              className={cn(
                                "flex-shrink-0 h-8 w-8 rounded-full border-2 flex items-center justify-center transition-all mt-0.5",
                                circleClass
                              )}
                            >
                              {icon}
                            </div>
                            <div
                              className={cn(
                                "flex-1 min-w-0 text-base whitespace-normal pt-1 overflow-x-auto no-scrollbar scroll-smooth overscroll-x-contain",
                                isCorrectOption
                                  ? "text-green-700 dark:text-green-400 font-medium"
                                  : isSelected
                                  ? "text-red-600 dark:text-red-400"
                                  : "text-foreground"
                              )}
                            >
                              <MathText
                                text={optionText}
                                className="prose dark:prose-invert max-w-none whitespace-normal min-w-0 break-words"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {q.explanation && (
                      <div className="mt-4 pt-4 border-t border-dashed">
                        <h4 className="text-sm font-bold text-muted-foreground mb-1">Explanation:</h4>
                        <div className="text-sm text-foreground/80 whitespace-normal overflow-x-auto no-scrollbar scroll-smooth overscroll-x-contain break-words">
                          <MathText
                            text={q.explanation}
                            className="prose dark:prose-invert max-w-none whitespace-normal min-w-0 break-words"
                          />
                        </div>
                      </div>
                    )}

                    <div className="print:hidden">
                      <AiExplanationBox q={q} questionId={q.id} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const answeredCount = questions.filter((q) => !!answers[q.id]).length;
  const isLowTime = secondsLeft < 300; // < 5 mins

  return (
    <div className="min-h-screen bg-background pb-20 relative font-sans">
      {/* Floating Status Bar (Timer) — mirrors TakeExam.tsx */}
      <div className="fixed top-16 left-0 right-0 z-50 flex justify-center pointer-events-none">
        <div className="flex gap-2 pointer-events-auto mt-2">
          <div
            className={cn(
              "px-4 py-2 rounded-full font-mono font-bold shadow-lg border flex items-center gap-2 transition-all duration-300",
              isLowTime
                ? "bg-red-600 text-white border-red-700 animate-pulse"
                : "bg-background/90 backdrop-blur border-primary/20 text-primary"
            )}
          >
            <Clock className="h-4 w-4" />
            {formatTime(secondsLeft)}
          </div>

          {violationCount > 0 && (
            <div className="px-4 py-2 rounded-full font-bold shadow-lg border bg-yellow-500/10 backdrop-blur border-yellow-500/50 text-yellow-600 dark:text-yellow-400 flex items-center gap-2 animate-in fade-in zoom-in">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">Warnings: {violationCount}</span>
            </div>
          )}
        </div>
      </div>

      <div className="container max-w-4xl mx-auto px-[5px] py-4 md:p-8 space-y-6 pt-24 overflow-x-hidden">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="text-sm text-muted-foreground">
              Answered: {answeredCount} / {questions.length}
            </p>
          </div>
        </div>

        {questions.map((q, idx) => (
          <div key={q.id} ref={(el) => { questionRefs.current[q.id] = el; }} className="scroll-mt-24">
            <Card className="shadow-sm rounded-[30px] overflow-hidden max-w-full">
              <CardContent className="p-5 space-y-2 max-w-full overflow-x-hidden">
                {/* Question Row */}
                <div className="flex items-start gap-4 max-w-full">
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0 pt-1 overflow-x-auto no-scrollbar scroll-smooth overscroll-x-contain">
                    <div className="text-lg font-medium leading-relaxed whitespace-normal min-w-0 break-words">
                      <MathText
                        text={q.question_text}
                        className="prose dark:prose-invert max-w-none whitespace-normal min-w-0 break-words"
                      />
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-1">
                    <ReportQuestionDialog questionText={q.question_text} />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-amber-500"
                      onClick={() => toggleBookmark(q)}
                    >
                      <Bookmark className={cn("h-5 w-5", bookmarked[q.id] && "fill-current text-amber-500")} />
                    </Button>
                  </div>
                </div>

                {/* Options Row */}
                <div className="space-y-2 pt-2 max-w-full">
                  {(["A", "B", "C", "D"] as const).map((opt) => {
                    const text = q[`option_${opt.toLowerCase()}` as "option_a"];
                    if (!text) return null;
                    const isSelected = answers[q.id] === opt;
                    const isAnswered = !!answers[q.id];
                    const isDisabled = isAnswered && !isSelected;

                    return (
                      <div
                        key={opt}
                        onClick={() => {
                          if (!isAnswered) {
                            const updated = { ...answers, [q.id]: opt };
                            setAnswers(updated);
                            scrollToNextUnanswered(q.id, updated);
                          }
                        }}
                        className={cn(
                          "flex items-center gap-4 group max-w-full",
                          !isAnswered && "cursor-pointer",
                          isDisabled && "opacity-50 pointer-events-none"
                        )}
                      >
                        <div
                          className={cn(
                            "flex-shrink-0 h-8 w-8 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all",
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground scale-110"
                              : "border-muted-foreground/30 text-muted-foreground",
                            !isAnswered && !isSelected && "group-hover:border-primary/50 group-hover:text-primary",
                            isDisabled && "border-muted-foreground/20 text-muted-foreground/50 cursor-not-allowed"
                          )}
                        >
                          {opt}
                        </div>
                        <div
                          className={cn(
                            "flex-1 min-w-0 text-base whitespace-normal flex items-center justify-between gap-3 p-3 rounded-lg transition-all",
                            isSelected
                              ? "text-primary font-medium bg-primary/10 border border-primary/50 shadow-sm"
                              : "text-foreground hover:bg-muted/30"
                          )}
                        >
                          <div className="flex-1 min-w-0 overflow-x-auto no-scrollbar scroll-smooth overscroll-x-contain">
                            <MathText
                              text={text}
                              className="prose dark:prose-invert max-w-none whitespace-normal min-w-0 break-words"
                            />
                          </div>
                          {isSelected && <Lock className="h-5 w-5 text-primary shrink-0 ml-auto" />}
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
            onClick={() => {
              if (confirm("Finish and submit exam?")) handleSubmit();
            }}
            className="bg-green-600 hover:bg-green-700 w-full max-w-sm h-12 text-lg rounded-full"
          >
            Finish Exam
          </Button>
        </div>
      </div>

      {/* Floating Submit Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <Button
          size="default"
          className="h-12 rounded-full shadow-xl bg-green-600 hover:bg-green-700 text-white font-bold px-5"
          onClick={() => {
            if (confirm("Are you sure you want to submit?")) handleSubmit();
          }}
        >
          Submit
        </Button>
      </div>

      {/* Floating Navigator Button */}
      <div className="fixed top-1/2 right-4 -translate-y-1/2 z-40">
        <Button
          size="icon"
          className="h-12 w-12 rounded-full shadow-xl bg-primary hover:bg-primary/90"
          onClick={() => setIsNavigatorOpen(true)}
        >
          <LayoutGrid className="h-6 w-6" />
        </Button>
      </div>

      {/* Question Navigator Modal */}
      <Dialog open={isNavigatorOpen} onOpenChange={setIsNavigatorOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Question Navigator</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-5 gap-3 p-2">
            {questions.map((q, idx) => {
              const isAnswered = !!answers[q.id];
              return (
                <button
                  key={q.id}
                  onClick={() => scrollToQuestion(idx)}
                  className={cn(
                    "h-10 w-10 rounded-lg border-2 flex items-center justify-center font-bold text-sm transition-all",
                    isAnswered
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-muted-foreground/30 text-muted-foreground hover:border-primary/50"
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
};

export default PlayUnlimitedMock;

