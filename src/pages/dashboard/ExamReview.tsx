import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import MathText from "@/components/MathText";
import { ArrowLeft, Check, X, Trophy, Bookmark, AlertTriangle, Lock, Calculator, Flag, Repeat, FileDown, ListChecks, ListOrdered, Sparkles } from "lucide-react";
import { getExamSourceList } from "@/lib/examSourceTracker";
import { openSolvePdf } from "@/lib/solvePdf";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { AiExplanationBox, AiChatButton, prewarmExplanations } from "@/components/exam/AiMcqHelper";

// Report Dialog Component
const ReportQuestionDialog = ({ questionId, questionText, onClose }: { questionId: string, questionText: string, onClose: () => void }) => {
    const { toast } = useToast();
    const [reportText, setReportText] = useState("");
    const [suggestedOption, setSuggestedOption] = useState<string | undefined>(undefined);
    const [isOpen, setIsOpen] = useState(false);
    const { user } = useAuth();

    const reportMutation = useMutation({
        mutationFn: async () => {
            if (!user) throw new Error("Must be logged in");

            // Debug Log
            console.log("Submitting report:", { questionId, userId: user.id, reportText, suggestedOption });

            const { error } = await supabase.from("question_reports").insert({
                question_id: questionId,
                user_id: user.id,
                report_text: reportText,
                suggested_correct_option: suggestedOption
            });

            if (error) {
                console.error("Report submission error:", error);
                throw error;
            }
        },
        onSuccess: () => {
            toast({ title: "Report submitted successfully", description: "Thank you for your feedback." });
            setReportText("");
            setSuggestedOption(undefined);
            setIsOpen(false);
            onClose();
        },
        onError: (error) => {
            console.error("Report mutation error:", error);
            toast({ title: "Failed to submit report", description: error.message, variant: "destructive" });
        }
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
                    <DialogDescription>
                        Found an error in this question? Let us know.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="text-sm text-muted-foreground line-clamp-2 italic bg-muted p-2 rounded">
                        <MathText text={questionText} />
                    </div>
                    <div className="space-y-2">
                        <Label>Describe the issue</Label>
                        <Textarea
                            placeholder="Explain what is wrong..."
                            value={reportText}
                            onChange={(e) => setReportText(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Suggested Correct Option (Optional)</Label>
                        <Select value={suggestedOption} onValueChange={setSuggestedOption}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select correct option" />
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
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                    <Button
                        onClick={() => reportMutation.mutate()}
                        disabled={!reportText.trim() || reportMutation.isPending}
                    >
                        {reportMutation.isPending ? "Submitting..." : "Submit Report"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const ExamReview = () => {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin, profile: authProfile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "correct" | "incorrect" | "skipped">("all");
  const [isMistakeDialogOpen, setIsMistakeDialogOpen] = useState(false);
  const [isQpDialogOpen, setIsQpDialogOpen] = useState(false);
  const [qpCustomMode, setQpCustomMode] = useState(false);
  const [qpCustomCount, setQpCustomCount] = useState("");

  useEffect(() => {
    document.title = "Exam Review – Atlas";
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  const { data: profile } = useQuery({
      queryKey: ["profile", user?.id],
      queryFn: async () => {
          if (!user) return null;
          const { data, error } = await supabase
              .from("profiles")
              .select("is_second_timer")
              .eq("id", user.id)
              .single();
          if (error) throw error;
          return data;
      },
      enabled: !!user
  });

  const { data: attempt, isLoading: attemptLoading } = useQuery({
    queryKey: ["exam-attempt", attemptId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_exam_attempt_for_review", {
        p_attempt_id: attemptId,
      });
      if (error) throw error;
      if (!data) throw new Error("Attempt not found");
      return data as any;
    },
    enabled: !!attemptId,
  });

  // Detect if admin is reviewing a different student's attempt
  const isViewingOtherUser = isAdmin && attempt && attempt.profile_id !== user?.id;

  // Calculate restriction status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const exam = attempt?.exam as any;
  const isRestrictedByConfig = exam?.restrict_solution;
  const isLiveAndActive = exam?.exam_type === 'live' && exam?.time_window_end && new Date() < new Date(exam.time_window_end);
  const shouldRestrict = (isRestrictedByConfig || isLiveAndActive) && !isAdmin;

  const { data: questions, isLoading: questionsLoading } = useQuery({
    queryKey: ["exam-review-questions", attempt?.id, isAdmin], // isAdmin in key ensures refetch when role loads
    queryFn: async () => {
      if (!attempt?.id) return [];

      // 1. Fetch questions securely via RPC
      let qData: any[] = [];
      const qError: any = null;

      // If user is admin, directly query. Else use RPC.
      let rpcData: any = null;
      let rpcErr: any = null;

      if (isAdmin) {
         // Admin: fetch questions directly from exam_questions.
         // If this is the admin's OWN attempt (not reviewing another student's),
         // scope to only the questions that were part of the attempt — same as
         // the student RPC does — so readymade count-mode exams show correctly.
         const isOwnAttempt = attempt.profile_id === user?.id;
         const answeredIds: string[] | null =
             isOwnAttempt && attempt?.answers && Array.isArray(attempt.answers)
                 ? attempt.answers.map((a: any) => a.question_id)
                 : null;

         let eqQuery = supabase
            .from("exam_questions")
            .select("id, question_index, question_text, option_a, option_b, option_c, option_d, option_e, correct_option, marks, explanation")
            .eq("exam_id", attempt.exam_id)
            .order("question_index", { ascending: true });

         if (answeredIds && answeredIds.length > 0) {
             eqQuery = eqQuery.in("id", answeredIds);
         }

         const { data: eqData, error: eqError } = await eqQuery;

         if (eqError) { console.error("Admin question fetch error:", eqError); }

         qData = eqData?.map((eq: any) => ({
             ...eq,
             question_id: eq.id
         })) || [];
      } else {
          const { data, error } = await supabase.rpc("get_student_exam_review", {
            p_attempt_id: attempt.id
          });
          rpcData = data;
          rpcErr = error;

          if (rpcErr) {
             throw rpcErr;
          } else {
             qData = rpcData || [];
          }
      }

      // 2. Fetch bookmarks — only meaningful for a logged-in user (guests have
      // no account to bookmark against).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const questionIds = qData.map((q: any) => q.question_id || q.id); // RPC returns question_id

      const { data: bData } = (user && questionIds.length > 0) ? await supabase
        .from("bookmarks")
        .select("question_id")
        .eq("profile_id", user.id)
        .in("question_id", questionIds) : { data: [] };

      const bookmarkedIds = new Set(bData?.map(b => b.question_id));

      // 3. Parse answers from JSONB
      // The `answers` column in `exam_attempts` is a JSON array of { question_id, selected_option }
      const answersMap = new Map();
      if (attempt?.answers && Array.isArray(attempt.answers)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          attempt.answers.forEach((ans: any) => {
              answersMap.set(ans.question_id, ans.selected_option);
          });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return qData.map((q: any) => {
          // Normalize ID from RPC result
          const qId = q.question_id || q.id;
          const userAnswer = answersMap.get(qId);
          const isCorrectAnswer = userAnswer === q.correct_option;
          return {
            ...q,
            id: qId, // Ensure ID is present
            user_answer: userAnswer || null,
            is_correct_answer: isCorrectAnswer,
            is_bookmarked: bookmarkedIds.has(qId)
          };
      });
    },
    enabled: !!attempt?.id,
  });

  const toggleBookmarkMutation = useMutation({
      mutationFn: async ({ questionId, isBookmarked }: { questionId: string, isBookmarked: boolean }) => {
          if (!user) return; // guests have no account to bookmark against
          if (isBookmarked) {
              await supabase.from("bookmarks").delete().eq("profile_id", user.id).eq("question_id", questionId);
          } else {
              await supabase.from("bookmarks").insert({ profile_id: user.id, question_id: questionId });
          }
      },
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["exam-review-questions"] });
          toast({ title: "Bookmark updated" });
      }
  });

  const handleStartMistakePractice = (mode: "wrong" | "both") => {
      if (attempt?.exam_id) {
        setIsMistakeDialogOpen(false);
        navigate("/dashboard/take-mistakes", {
          state: { examIds: [attempt.exam_id], filterMode: mode, sourceAttemptId: attemptId }
        });
      }
  };

  const handleStartAllQuickPractice = () => {
      if (!attempt?.exam_id) return;
      setIsQpDialogOpen(false);
      navigate(`/dashboard/take-exam/${attempt.exam_id}?qp=1`);
  };

  const handleStartCustomQuickPractice = () => {
      const count = parseInt(qpCustomCount, 10);
      if (!count || count <= 0 || !attempt?.exam_id) return;
      setIsQpDialogOpen(false);
      setQpCustomMode(false);
      setQpCustomCount("");
      navigate(`/dashboard/take-exam/${attempt.exam_id}?qp=1&count=${count}`);
  };

  const handleSolvePdf = () => {
      if (!questions || questions.length === 0) return;
      openSolvePdf({
          examName: attempt?.exam?.title || "Exam",
          studentName: authProfile?.full_name || undefined,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          questions: questions.map((q: any) => ({
              question_text: q.question_text,
              option_a: q.option_a,
              option_b: q.option_b,
              option_c: q.option_c,
              option_d: q.option_d,
              option_e: q.option_e,
              correct_option: q.correct_option,
              user_answer: q.user_answer,
              explanation: q.explanation,
          })),
          totalMarks: displayTotalMarks,
          score: Number(score),
          style: "style1",
      });
  };

  const handlePracticeAgain = () => {
      if (attempt?.exam_id) {
        // No retake_from param -> lands on the fresh pre-exam screen,
        // so the student can choose all questions or a new MCQ count (for readymade exams).
        navigate(`/dashboard/take-exam/${attempt.exam_id}`);
      }
  };

  useEffect(() => {
    if (!attemptLoading && !questionsLoading) {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, [attemptLoading, questionsLoading]);

  // Pre-warm AI explanations in the background as soon as questions are loaded,
  // so most clicks on "ব্যাখ্যা" / "AI Chat" hit an instant cache instead of
  // waiting on a live AI call.
  useEffect(() => {
    if (questions && questions.length > 0) {
      prewarmExplanations(questions as any);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions]);

  if (attemptLoading || questionsLoading) {
    return <div className="p-8 text-center">Loading result...</div>;
  }

  if (!attempt) return <div>Attempt not found.</div>;

  const totalQuestions = questions?.length || 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const correctCount = questions?.filter((q: any) => q.is_correct_answer).length || 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wrongCount = questions?.filter((q: any) => q.user_answer && !q.is_correct_answer).length || 0;
  const skippedCount = totalQuestions - (correctCount + wrongCount);
  const score = attempt.total_marks !== undefined && attempt.total_marks !== null ? attempt.total_marks : attempt.score;

  // For readymade exams where the student picked a subset of MCQs, the denominator
  // should reflect only the attempted questions' total marks, not the full exam bank.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const attemptedTotalMarks = questions?.reduce((sum: number, q: any) => sum + (Number(q.marks) || 1), 0) || 0;
  const displayTotalMarks = (exam.is_readymade && attempt?.answers && Array.isArray(attempt.answers) && attempt.answers.length > 0)
      ? attemptedTotalMarks
      : exam.total_marks;

  // Formula Calculation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const correctMarks = questions?.reduce((sum: number, q: any) => q.is_correct_answer ? sum + (Number(q.marks) || 1) : sum, 0) || 0;
  const negativeMarks = wrongCount * (Number(exam.negative_mark_per_question) || 0);
  const rawScore = correctMarks - negativeMarks;
  const finalScore = attempt.score !== undefined ? Number(attempt.score) : rawScore;
  // Deduction (if any, e.g. 2nd timer)
  const deduction = Math.max(0, rawScore - finalScore);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const questionPositionMap = new Map((questions || []).map((q: any, i: number) => [q.id, i + 1]));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filteredQuestions = questions?.filter((q: any) => {
      if (filter === "all") return true;
      if (filter === "correct") return q.is_correct_answer;
      if (filter === "incorrect") return q.user_answer && !q.is_correct_answer;
      if (filter === "skipped") return !q.user_answer;
      return true;
  });

  // Data for Pie Chart
  const pieData = [
    { name: 'Correct', value: correctCount, color: '#16a34a' }, // green-600
    { name: 'Wrong', value: wrongCount, color: '#ef4444' }, // red-500
    { name: 'Skipped', value: skippedCount, color: '#94a3b8' }, // slate-400
  ].filter(d => d.value > 0);

  return (
    <div className="min-h-screen bg-background font-sans pb-20 -mt-4">
      <div className="container max-w-4xl mx-auto px-[5px] pt-0 pb-2 md:pt-0 md:pb-6 md:px-6 space-y-2 overflow-x-hidden">

        {/* Header */}
        <div className="flex flex-col gap-1">
            <Button variant="ghost" onClick={() => navigate(-1)} className="pl-0 h-7 self-start">
                <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
            </Button>
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                 {user && exam.is_readymade && (
                 <Button variant="outline" onClick={() => setIsQpDialogOpen(true)} className="h-10 px-3 py-2 w-full sm:w-auto">
                    <Sparkles className="h-5 w-5 mr-1.5 text-violet-500 shrink-0" /> <span className="truncate">Quick Practice</span>
                 </Button>
                 )}
                 {user && (
                 <Button variant="outline" onClick={() => navigate(`/dashboard/leaderboard/${attempt.exam_id}`)} className="h-10 px-3 py-2 w-full sm:w-auto">
                    <Trophy className="h-5 w-5 mr-1.5 text-yellow-500 shrink-0" /> <span className="truncate">Leaderboard</span>
                 </Button>
                 )}
                 {user && (
                 <Button variant="outline" onClick={handlePracticeAgain} className="h-10 px-3 py-2 w-full sm:w-auto">
                    <Repeat className="h-5 w-5 mr-1.5 text-primary shrink-0" /> <span className="truncate">Practice Again</span>
                 </Button>
                 )}
                 <Button variant="outline" onClick={handleSolvePdf} className="h-10 px-3 py-2 w-full sm:w-auto">
                    <FileDown className="h-5 w-5 mr-1.5 text-blue-500 shrink-0" /> <span className="truncate">Solve PDF</span>
                 </Button>
                 {user && (
                 <Button variant="outline" onClick={() => setIsMistakeDialogOpen(true)} className="h-10 px-2 py-2 w-full sm:w-auto">
                    <ListChecks className="h-5 w-5 mr-1 text-red-500 shrink-0" /> <span className="text-sm whitespace-nowrap">Mistake Practice</span>
                 </Button>
                 )}
                 {user && (
                 <Button variant="outline" onClick={() => navigate(getExamSourceList(attempt.exam_id))} className="h-10 px-3 py-2 w-full sm:w-auto">
                    <ListOrdered className="h-5 w-5 mr-1.5 text-emerald-500 shrink-0" /> <span className="truncate">Exam List</span>
                 </Button>
                 )}
            </div>
        </div>

        {!user && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-center">
            আরও ফিচার (Leaderboard, Mistake Practice, ইত্যাদি) পেতে <a href="/register" className="font-bold text-primary underline">অ্যাকাউন্ট খোলো</a> — সম্পূর্ণ ফ্রি।
          </div>
        )}

        {/* Quick Practice Mood Select Dialog */}
        <Dialog open={isQpDialogOpen} onOpenChange={(open) => { setIsQpDialogOpen(open); if (!open) { setQpCustomMode(false); setQpCustomCount(""); } }}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>Quick Practice</DialogTitle>
                    <DialogDescription>Kivabe practice korte chao?</DialogDescription>
                </DialogHeader>
                {!qpCustomMode ? (
                    <div className="flex flex-col gap-3 py-2">
                        <button
                            onClick={handleStartAllQuickPractice}
                            className="p-4 border rounded-lg text-left hover:bg-muted/50 transition-all"
                        >
                            <div className="font-semibold">সকল প্রশ্নে প্রাক্টিস</div>
                            <div className="text-xs text-muted-foreground">Shob subject/chapter theke random MCQ</div>
                        </button>
                        <button
                            onClick={() => setQpCustomMode(true)}
                            className="p-4 border rounded-lg text-left hover:bg-muted/50 transition-all"
                        >
                            <div className="font-semibold">ইচ্ছামতো প্রাক্টিস</div>
                            <div className="text-xs text-muted-foreground">Koyta MCQ practice korte chao, likhe shuru koro</div>
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3 py-2">
                        <Label htmlFor="qp-custom-count">Koyta MCQ diye exam dite chao?</Label>
                        <input
                            id="qp-custom-count"
                            type="number"
                            min={1}
                            inputMode="numeric"
                            value={qpCustomCount}
                            onChange={(e) => setQpCustomCount(e.target.value)}
                            placeholder="Example: 20"
                            className="border rounded-lg px-3 py-2 text-sm bg-background"
                            autoFocus
                        />
                        <div className="flex gap-2">
                            <Button variant="outline" className="flex-1" onClick={() => setQpCustomMode(false)}>Back</Button>
                            <Button
                                className="flex-1"
                                disabled={!qpCustomCount || parseInt(qpCustomCount, 10) <= 0}
                                onClick={handleStartCustomQuickPractice}
                            >
                                শুরু করো
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>

        {/* Mistake Practice Mood Select Dialog */}
        <Dialog open={isMistakeDialogOpen} onOpenChange={setIsMistakeDialogOpen}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>Mistake Practice</DialogTitle>
                    <DialogDescription>Kon question gulo practice korte chao?</DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-3 py-2">
                    <button
                        onClick={() => handleStartMistakePractice("wrong")}
                        disabled={wrongCount === 0}
                        className="p-4 border rounded-lg text-left hover:bg-muted/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <div className="font-semibold">Only Wrong ({wrongCount})</div>
                        <div className="text-xs text-muted-foreground">Shudhu vul kora question gulo</div>
                    </button>
                    <button
                        onClick={() => handleStartMistakePractice("both")}
                        disabled={(wrongCount + skippedCount) === 0}
                        className="p-4 border rounded-lg text-left hover:bg-muted/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <div className="font-semibold">Wrong + Skip ({wrongCount + skippedCount})</div>
                        <div className="text-xs text-muted-foreground">Vul o baad deya shob question</div>
                    </button>
                </div>
            </DialogContent>
        </Dialog>

        {/* Score Card */}
        <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-3 md:p-4">
                <div className="flex flex-col md:flex-row justify-between items-center gap-2 md:gap-6">
                    <div className="text-center md:text-left w-full md:w-auto pb-2 md:pb-0 border-b md:border-b-0 md:border-r border-border/60 md:pr-4">
                        <h1 className="text-2xl font-extrabold mb-0.5">{attempt.exam.title}</h1>
                        <p className="text-xs text-muted-foreground">Submitted on {new Date(attempt.submitted_at).toLocaleString()}</p>
                    </div>

                    <div className="flex-1 flex flex-row items-center justify-center gap-4 md:gap-6 w-full pb-2 md:pb-0 border-b md:border-b-0 md:border-r border-border/60 md:pr-4">
                        {/* Marks */}
                        <div className="text-center flex-shrink-0 pr-4 border-r border-border/60">
                             <div className="text-4xl font-extrabold text-primary">
                                {Number(score).toFixed(2)}
                                <span className="text-4xl text-muted-foreground font-extrabold"> / {displayTotalMarks}</span>
                             </div>
                             <div className="text-[10px] uppercase font-bold text-muted-foreground mt-0.5">Marks Obtained</div>
                        </div>

                        {/* Pie Chart */}
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

                    {/* Stats */}
                    <div className="flex gap-2 justify-between w-full md:w-auto md:flex-col md:gap-1.5 text-center">
                         <div className="flex-1 border rounded-lg p-1.5 flex flex-row md:flex-col items-center justify-center gap-2 bg-background/50 md:bg-transparent md:border-0 md:p-0">
                            <div className="text-[10px] uppercase font-bold text-muted-foreground order-1 md:order-2">Correct</div>
                            <div className="text-lg font-bold text-green-600 order-2 md:order-1">{correctCount}</div>
                        </div>
                         <div className="flex-1 border rounded-lg p-1.5 flex flex-row md:flex-col items-center justify-center gap-2 bg-background/50 md:bg-transparent md:border-0 md:p-0">
                            <div className="text-[10px] uppercase font-bold text-muted-foreground order-1 md:order-2">Wrong</div>
                            <div className="text-lg font-bold text-red-500 order-2 md:order-1">{wrongCount}</div>
                        </div>
                         <div className="flex-1 border rounded-lg p-1.5 flex flex-row md:flex-col items-center justify-center gap-2 bg-background/50 md:bg-transparent md:border-0 md:p-0">
                            <div className="text-[10px] uppercase font-bold text-muted-foreground order-1 md:order-2">Skipped</div>
                            <div className="text-lg font-bold text-slate-400 order-2 md:order-1">{skippedCount}</div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>

        {/* Formula Card */}
        <Card className="bg-card border-border shadow-sm">
            <CardContent className="p-4 md:p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-muted-foreground">
                    <Calculator className="h-5 w-5" /> Score Breakdown
                </h3>
                {/* Mobile: Grid Layout (Side by Side) */}
                <div className="grid grid-cols-3 gap-2 md:hidden text-xs">
                    <div className="p-2 bg-green-500/5 rounded-lg border border-green-500/20 text-center">
                        <div className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Correct</div>
                        <div className="text-base font-bold text-green-600 font-mono">+{correctMarks.toFixed(1)}</div>
                    </div>

                    <div className="p-2 bg-red-500/5 rounded-lg border border-red-500/20 text-center">
                        <div className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Negative</div>
                        <div className="text-base font-bold text-red-500 font-mono">-{negativeMarks.toFixed(1)}</div>
                    </div>

                    {deduction > 0.01 ? (
                        <div className="p-2 bg-orange-500/5 rounded-lg border border-orange-500/20 text-center">
                            <div className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Deduct</div>
                            <div className="text-base font-bold text-orange-500 font-mono">-{deduction.toFixed(1)}</div>
                        </div>
                    ) : (
                        <div className="p-2 bg-primary/5 rounded-lg border border-primary/20 text-center">
                            <div className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Total</div>
                            <div className="text-base font-bold text-primary font-mono">{finalScore.toFixed(2)}</div>
                        </div>
                    )}
                </div>

                {/* Mobile: Final Score Row if Deduction exists (since grid is 3 cols) */}
                {deduction > 0.01 && (
                    <div className="mt-2 md:hidden">
                         <div className="p-2 bg-primary/5 rounded-lg border border-primary/20 flex justify-between items-center px-4">
                            <span className="text-xs font-bold uppercase text-muted-foreground">Final Score</span>
                            <span className="text-lg font-bold text-primary font-mono">{finalScore.toFixed(2)}</span>
                        </div>
                    </div>
                )}

                {/* Desktop: Flex Row */}
                <div className="hidden md:flex flex-row gap-4 items-center text-sm">
                    <div className="flex-1 p-3 bg-green-500/5 rounded-xl border border-green-500/20 text-left">
                        <div className="text-muted-foreground text-xs uppercase font-bold tracking-wider mb-1">Correct Marks</div>
                        <div className="text-xl font-bold text-green-600 font-mono">+{correctMarks.toFixed(2)}</div>
                    </div>

                    <div className="text-muted-foreground font-bold text-xl">-</div>

                    <div className="flex-1 p-3 bg-red-500/5 rounded-xl border border-red-500/20 text-left">
                        <div className="text-muted-foreground text-xs uppercase font-bold tracking-wider mb-1">Negative ({wrongCount})</div>
                        <div className="text-xl font-bold text-red-500 font-mono">-{negativeMarks.toFixed(2)}</div>
                    </div>

                    {deduction > 0.01 && (
                        <>
                            <div className="text-muted-foreground font-bold text-xl">-</div>
                            <div className="flex-1 p-3 bg-orange-500/5 rounded-xl border border-orange-500/20 text-left">
                                <div className="text-muted-foreground text-xs uppercase font-bold tracking-wider mb-1">Deduction</div>
                                <div className="text-xl font-bold text-orange-500 font-mono">-{deduction.toFixed(2)}</div>
                            </div>
                        </>
                    )}

                    <div className="text-muted-foreground font-bold text-xl">=</div>

                    <div className="flex-1 p-3 bg-primary/5 rounded-xl border border-primary/20 text-left">
                        <div className="text-muted-foreground text-xs uppercase font-bold tracking-wider mb-1">Final Score</div>
                        <div className="text-xl font-bold text-primary font-mono">{finalScore.toFixed(2)}</div>
                    </div>
                </div>

                {/* Second Timer Warning in Breakdown */}
                {profile?.is_second_timer && (
                    <div className="mt-4 pt-4 border-t border-dashed flex items-start gap-2 text-xs text-muted-foreground">
                        <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                        <p>
                            সেকেন্ড টাইমার হিসেবে আপনার প্রাপ্ত নম্বর থেকে কর্তন করা হবে: ৩০ বা তার কম নম্বরের পরীক্ষায় ১ নম্বর, ৩০-৫০ নম্বরের পরীক্ষায় ১.৫ নম্বর, এবং ৫০ এর বেশি নম্বরের পরীক্ষায় ৩ নম্বর।
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>

        {shouldRestrict ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-4 border rounded-xl bg-muted/10">
                <div className="p-4 bg-muted rounded-full">
                    <Lock className="h-8 w-8 text-muted-foreground" />
                </div>
                <h2 className="text-xl font-bold">Solvesheet Restricted</h2>
                <p className="text-muted-foreground text-center max-w-md">
                    {isLiveAndActive
                        ? "The detailed solution will be available after the live exam period ends."
                        : "The solution for this exam is restricted by the administrator."}
                </p>
            </div>
        ) : (
            <>
                {/* Filters */}
                <div className="flex flex-wrap gap-2 pb-2">
                    {[
                        { label: "All", value: "all", count: totalQuestions },
                        { label: "Correct", value: "correct", count: correctCount },
                        { label: "Incorrect", value: "incorrect", count: wrongCount },
                        { label: "Skipped", value: "skipped", count: skippedCount },
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

                {/* Questions List */}
                <div className="space-y-6">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {filteredQuestions?.map((q: any) => {
                        const isCorrect = q.is_correct_answer;
                        const isSkipped = !q.user_answer;
                        const isWrong = !isCorrect && !isSkipped;

                        return (
                            <Card key={q.id} className="rounded-[30px] overflow-hidden shadow-sm border max-w-full break-inside-avoid page-break-inside-avoid print:break-inside-avoid">
                                <CardContent className="p-5 space-y-2 max-w-full overflow-x-hidden">
                                    {/* Header row: serial number + AI Chat/Report/Bookmark, AtlasApp-style */}
                                    <div className="flex items-center justify-between gap-2 print:hidden">
                                        <span className={cn(
                                            "text-xs font-bold px-2.5 py-1 rounded-full",
                                            isCorrect ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                                            isWrong ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                                            "bg-muted text-muted-foreground"
                                        )}>
                                            {questionPositionMap.get(q.id) ?? q.question_index}/{filteredQuestions?.length ?? questions?.length ?? ""}
                                        </span>
                                        <div className="flex items-center gap-0.5">
                                            <AiChatButton q={q} questionId={q.id} />
                                            <ReportQuestionDialog
                                                questionId={q.id}
                                                questionText={q.question_text}
                                                onClose={() => {}}
                                            />
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => toggleBookmarkMutation.mutate({ questionId: q.id, isBookmarked: q.is_bookmarked })}
                                                className={cn("h-8 w-8 hover:bg-transparent", q.is_bookmarked ? "text-primary fill-primary" : "text-muted-foreground")}
                                            >
                                                <Bookmark className={cn("h-5 w-5", q.is_bookmarked && "fill-current")} />
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Question text */}
                                    <div className="flex items-start gap-4">
                                        <div className="flex-1 min-w-0 pt-1 overflow-x-auto no-scrollbar scroll-smooth overscroll-x-contain">
                                            <div className="text-lg font-medium leading-relaxed whitespace-normal min-w-0 break-words">
                                                <MathText text={q.question_text} className="prose dark:prose-invert max-w-none whitespace-normal min-w-0 break-words" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Options */}
                                    <div className="space-y-2 pt-2">
                                        {(["A", "B", "C", "D", "E"] as const).map((optionKey) => {
                                            const optionText = q[`option_${optionKey.toLowerCase()}` as keyof typeof q];
                                            if (!optionText) return null;
                                            const isSelected = q.user_answer === optionKey;
                                            const isCorrectOption = q.correct_option === optionKey;

                                            // Determine circle style
                                            let circleClass = "border-muted-foreground/30 text-muted-foreground";
                                            let icon = <span className="text-sm font-bold">{optionKey}</span>;

                                            if (isCorrectOption) {
                                                // Always show green for correct option
                                                circleClass = "bg-green-500 border-green-500 text-white";
                                                icon = <Check className="h-4 w-4" />;
                                            } else if (isSelected && !isCorrectOption) {
                                                // Selected but wrong -> Red
                                                circleClass = "bg-red-500 border-red-500 text-white";
                                                icon = <X className="h-4 w-4" />;
                                            } else if (isSelected) {
                                                // Selected and correct (handled above usually, but fallback)
                                                circleClass = "bg-green-500 border-green-500 text-white";
                                                icon = <Check className="h-4 w-4" />;
                                            }

                                            return (
                                                <div key={optionKey} className="flex items-start gap-4 max-w-full">
                                                    <div className={cn(
                                                        "flex-shrink-0 h-8 w-8 rounded-full border-2 flex items-center justify-center transition-all mt-0.5",
                                                        circleClass
                                                    )}>
                                                        {icon}
                                                    </div>
                                                    <div className={cn(
                                                        "flex-1 min-w-0 text-base whitespace-normal pt-1 overflow-x-auto no-scrollbar scroll-smooth overscroll-x-contain",
                                                        // Removed highlights/borders for rows, just standard text or color if needed
                                                        isCorrectOption ? "text-green-700 dark:text-green-400 font-medium" :
                                                        isSelected ? "text-red-600 dark:text-red-400" : "text-foreground"
                                                    )}>
                                                        <MathText text={optionText} className="prose dark:prose-invert max-w-none whitespace-normal min-w-0 break-words" />
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>

                                    {/* Explanation */}
                                    {q.explanation && (
                                        <div className="mt-4 pt-4 border-t border-dashed">
                                            <h4 className="text-sm font-bold text-muted-foreground mb-1">Explanation:</h4>
                                            <div className="text-sm text-foreground/80 whitespace-normal overflow-x-auto no-scrollbar scroll-smooth overscroll-x-contain break-words">
                                                <MathText text={q.explanation} className="prose dark:prose-invert max-w-none whitespace-normal min-w-0 break-words" />
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
            </>
        )}

      </div>
    </div>
  );
};

export default ExamReview;
