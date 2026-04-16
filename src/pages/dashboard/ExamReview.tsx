import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import MathText from "@/components/MathText";
import { ArrowLeft, Check, X, Trophy, Bookmark, AlertTriangle, RotateCw, Lock, Calculator, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

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
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "correct" | "incorrect" | "skipped">("all");

  useEffect(() => {
    document.title = "Exam Review – Atlas";
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
      const { data, error } = await supabase
        .from("exam_attempts")
        .select("*, exam:exams(*)")
        .eq("id", attemptId)
        .single();
      if (error) throw error;
      return data;
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
         // Admin: fetch questions directly from exam_questions
         const { data: eqData, error: eqError } = await supabase
            .from("exam_questions")
            .select("id, question_index, question_text, option_a, option_b, option_c, option_d, correct_option, marks, explanation")
            .eq("exam_id", attempt.exam_id)
            .order("question_index", { ascending: true });

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

      // 2. Fetch bookmarks — always use the current logged-in user's bookmarks
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const questionIds = qData.map((q: any) => q.question_id || q.id); // RPC returns question_id

      const { data: bData } = questionIds.length > 0 ? await supabase
        .from("bookmarks")
        .select("question_id")
        .eq("profile_id", user!.id)
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
    enabled: !!attempt?.id && !!user,
  });

  const toggleBookmarkMutation = useMutation({
      mutationFn: async ({ questionId, isBookmarked }: { questionId: string, isBookmarked: boolean }) => {
          if (isBookmarked) {
              await supabase.from("bookmarks").delete().eq("profile_id", user!.id).eq("question_id", questionId);
          } else {
              await supabase.from("bookmarks").insert({ profile_id: user!.id, question_id: questionId });
          }
      },
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["exam-review-questions"] });
          toast({ title: "Bookmark updated" });
      }
  });

  const handleRetakeMistakes = () => {
      if (attempt?.exam_id) {
        navigate(`/dashboard/take-exam/${attempt.exam_id}?retake_from=${attempt.id}`);
      }
  };

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

  // Formula Calculation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const correctMarks = questions?.reduce((sum: number, q: any) => q.is_correct_answer ? sum + (Number(q.marks) || 1) : sum, 0) || 0;
  const negativeMarks = wrongCount * (Number(exam.negative_mark_per_question) || 0);
  const rawScore = correctMarks - negativeMarks;
  const finalScore = attempt.score !== undefined ? Number(attempt.score) : rawScore;
  // Deduction (if any, e.g. 2nd timer)
  const deduction = Math.max(0, rawScore - finalScore);

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
    <div className="min-h-screen bg-background font-sans pb-20">
      <div className="container max-w-4xl mx-auto px-[5px] py-4 md:p-8 space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
            <Button variant="ghost" onClick={() => navigate("/dashboard/live-exam")} className="pl-0">
                <ArrowLeft className="h-5 w-5 mr-2" /> Back
            </Button>
            <div className="flex gap-2">
                 {wrongCount > 0 && !shouldRestrict && (
                     <Button variant="destructive" onClick={handleRetakeMistakes} className="h-10 px-4 py-2">
                        <RotateCw className="h-5 w-5 mr-2" /> Retake
                     </Button>
                 )}
                 <Button variant="outline" onClick={() => navigate(`/dashboard/leaderboard/${attempt.exam_id}`)} className="h-10 px-4 py-2">
                    <Trophy className="h-5 w-5 mr-2 text-yellow-500" /> Leaderboard
                 </Button>
            </div>
        </div>

        {/* Score Card */}
        <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="text-center md:text-left">
                        <h1 className="text-2xl font-bold mb-1">{attempt.exam.title}</h1>
                        <p className="text-sm text-muted-foreground">Submitted on {new Date(attempt.submitted_at).toLocaleString()}</p>
                    </div>

                    <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 my-1 md:my-0">
                        {/* Marks */}
                        <div className="text-center">
                             <div className="text-4xl font-bold text-primary">
                                {Number(score).toFixed(2)}
                                <span className="text-lg text-muted-foreground font-normal"> / {exam.total_marks}</span>
                             </div>
                             <div className="text-xs uppercase font-bold text-muted-foreground mt-1">Marks Obtained</div>
                        </div>

                        {/* Pie Chart */}
                        <div className="h-40 w-40 relative flex-shrink-0 -my-2 md:my-0">
                             <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={35}
                                        outerRadius={55}
                                        paddingAngle={2}
                                        dataKey="value"
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
                    <div className="flex gap-2 justify-between w-full md:w-auto md:flex-col md:gap-2 text-center">
                         <div className="flex-1 border rounded-lg p-2 flex flex-row md:flex-col items-center justify-center gap-2 bg-background/50 md:bg-transparent md:border-0 md:p-0">
                            <div className="text-[10px] uppercase font-bold text-muted-foreground order-1 md:order-2">Correct</div>
                            <div className="text-lg sm:text-xl font-bold text-green-600 order-2 md:order-1">{correctCount}</div>
                        </div>
                         <div className="flex-1 border rounded-lg p-2 flex flex-row md:flex-col items-center justify-center gap-2 bg-background/50 md:bg-transparent md:border-0 md:p-0">
                            <div className="text-[10px] uppercase font-bold text-muted-foreground order-1 md:order-2">Wrong</div>
                            <div className="text-lg sm:text-xl font-bold text-red-500 order-2 md:order-1">{wrongCount}</div>
                        </div>
                         <div className="flex-1 border rounded-lg p-2 flex flex-row md:flex-col items-center justify-center gap-2 bg-background/50 md:bg-transparent md:border-0 md:p-0">
                            <div className="text-[10px] uppercase font-bold text-muted-foreground order-1 md:order-2">Skipped</div>
                            <div className="text-lg sm:text-xl font-bold text-slate-400 order-2 md:order-1">{skippedCount}</div>
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
                            <Card key={q.id} className="rounded-[30px] overflow-hidden shadow-sm border break-inside-avoid page-break-inside-avoid print:break-inside-avoid">
                                <CardContent className="p-5 space-y-2 relative">
                                    <div className="absolute top-3 right-4 print:hidden flex gap-0.5">
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

                                    {/* Question Header */}
                                    <div className="flex items-start gap-4 pr-12">
                                        <div className={cn(
                                            "flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm",
                                            isCorrect ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                                            isWrong ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                                            "bg-muted text-muted-foreground"
                                        )}>
                                            {q.question_index}
                                        </div>
                                        <div className="flex-1 min-w-0 pt-1 overflow-x-auto no-scrollbar scroll-smooth">
                                            <div className="text-lg font-medium leading-relaxed whitespace-normal min-w-0">
                                                <MathText text={q.question_text} className="prose dark:prose-invert max-w-none whitespace-normal min-w-0" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Options */}
                                    <div className="space-y-2 pt-2">
                                        {(["A", "B", "C", "D"] as const).map((optionKey) => {
                                            const optionText = q[`option_${optionKey.toLowerCase()}` as keyof typeof q];
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
                                                <div key={optionKey} className="flex items-start gap-4">
                                                    <div className={cn(
                                                        "flex-shrink-0 h-8 w-8 rounded-full border-2 flex items-center justify-center transition-all mt-0.5",
                                                        circleClass
                                                    )}>
                                                        {icon}
                                                    </div>
                                                    <div className={cn(
                                                        "flex-1 text-base whitespace-normal min-w-0 pt-1 overflow-x-auto no-scrollbar scroll-smooth",
                                                        // Removed highlights/borders for rows, just standard text or color if needed
                                                        isCorrectOption ? "text-green-700 dark:text-green-400 font-medium" :
                                                        isSelected ? "text-red-600 dark:text-red-400" : "text-foreground"
                                                    )}>
                                                        <MathText text={optionText} className="prose dark:prose-invert max-w-none whitespace-normal min-w-0" />
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>

                                    {/* Explanation */}
                                    {q.explanation && (
                                        <div className="mt-4 pt-4 border-t border-dashed">
                                            <h4 className="text-sm font-bold text-muted-foreground mb-1">Explanation:</h4>
                                            <div className="text-sm text-foreground/80 whitespace-normal overflow-x-auto no-scrollbar scroll-smooth">
                                                <MathText text={q.explanation} className="prose dark:prose-invert max-w-none whitespace-normal min-w-0" />
                                            </div>
                                        </div>
                                    )}

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
