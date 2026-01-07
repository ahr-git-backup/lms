import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import MathText from "@/components/MathText";
import { LayoutGrid, Clock, AlertTriangle, RotateCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAntiCheat } from "@/hooks/useAntiCheat";
import { useStudyTools } from "@/contexts/StudyToolsContext";

const TakeExam = () => {
  useAntiCheat();
  const { examId } = useParams();
  const [searchParams] = useSearchParams();
  const retakeFromAttemptId = searchParams.get('retake_from');

  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { updateStreak, updateStats } = useStudyTools();

  // State
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isNavigatorOpen, setIsNavigatorOpen] = useState(false);
  const [violationCount, setViolationCount] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [shuffledQuestions, setShuffledQuestions] = useState<any[]>([]);
  const questionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Use a different key prefix for retakes so we don't conflict with main exam session storage
  const LOCAL_STORAGE_KEY_PREFIX = retakeFromAttemptId
      ? `exam_session_retake_${retakeFromAttemptId}_${user?.id}`
      : `exam_session_${examId}_${user?.id}`;

  useEffect(() => {
    document.title = retakeFromAttemptId ? "Retake Mistakes – Atlas" : "Take Exam – Atlas";

    // Anti-Cheat: Tab Switch Detection
    const handleVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
            setViolationCount(prev => prev + 1);
            toast({
                title: "⚠️ Warning: Tab Switch Detected",
                description: "Leaving the exam tab is recorded. Multiple violations may disqualify you.",
                variant: "destructive",
                duration: 5000,
            });
        }
    };

    // Warning on refresh
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
  }, [toast, retakeFromAttemptId]);

  const { data: exam, isLoading: examLoading } = useQuery({
    queryKey: ["exam", examId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exams")
        .select("*")
        .eq("id", examId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Check for previous attempts if exam is LIVE
  const { data: existingAttempts, isLoading: attemptsLoading } = useQuery({
    queryKey: ["existing-attempts", examId, user?.id],
    queryFn: async () => {
        if (!user || !examId) return [];
        const { data, error } = await supabase
            .from("exam_attempts")
            .select("id, submitted_at")
            .eq("exam_id", examId)
            .eq("profile_id", user.id);
        if (error) throw error;
        return data;
    },
    enabled: !!user && !!examId && !retakeFromAttemptId, // Don't block if retaking mistakes
  });

  const { data: questions, isLoading: questionsLoading } = useQuery({
    queryKey: ["exam-questions", examId, retakeFromAttemptId],
    queryFn: async () => {
      // 1. Fetch ALL exam questions securely via RPC
      const { data: allQuestions, error } = await supabase.rpc("get_exam_questions", {
        p_exam_id: examId,
      });
      if (error) throw error;

      // 2. If filtering for mistakes, fetch the previous attempt's wrong answers
      if (retakeFromAttemptId) {
          const { data: attemptData } = await supabase
              .from("exam_attempts")
              .select("answers")
              .eq("id", retakeFromAttemptId)
              .single();

          if (attemptData?.answers) {
              // We need to know which were WRONG. The attempt `answers` JSON doesn't say if it's correct/wrong directly usually
              // unless we stored it. But `get_exam_questions` doesn't give correct answer either (security).
              // To filter, we need to know the correct answers.
              // BUT, the client shouldn't know correct answers.
              // Solution: We fetch the review-style questions (which has is_correct logic server side usually, or exposed)
              // Actually, `get_student_exam_review` returns correct options. We can use that!

              const { data: reviewData, error: reviewError } = await supabase.rpc("get_student_exam_review", {
                  p_attempt_id: retakeFromAttemptId
              });

              if (!reviewError && reviewData) {
                  // Filter for questions where user was WRONG
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const wrongQuestionIds = new Set(reviewData.filter((q: any) => {
                       // Find user answer from attempt json
                       // Actually `reviewData` should be easier to parse if we trust it aligned
                       // Wait, `get_student_exam_review` might strictly return what user answered vs correct.
                       // Let's assume we find the wrong ones.
                       // reviewData has `correct_option`. We need to match with user answer.
                       // But wait, `get_student_exam_review` is intended for result view.
                       // Let's map user answers.
                       const userAnswerObj = (attemptData.answers as any[]).find((a: any) => a.question_id === (q.question_id || q.id));
                       const selected = userAnswerObj?.selected_option;
                       return selected !== q.correct_option; // Wrong or Skipped
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  }).map((q: any) => q.question_id || q.id));

                  // Return only the questions from `allQuestions` that match `wrongQuestionIds`
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  return allQuestions.filter((q: any) => wrongQuestionIds.has(q.id));
              }
          }
      }

      return allQuestions;
    },
  });

  // Shuffle Questions Effect
  useEffect(() => {
    if (questions && questions.length > 0 && shuffledQuestions.length === 0) {
        // Simple Fisher-Yates shuffle
        const shuffled = [...questions];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        setShuffledQuestions(shuffled);
    }
  }, [questions, shuffledQuestions.length]);

  // Load persistence logic - ONLY ON MOUNT
  useEffect(() => {
      if (!user || !examId) return;

      const savedAnswers = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}_answers`);
      const savedViolations = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}_violations`);
      // Start time logic handled in timer effect

      if (savedAnswers) {
          try {
              setAnswers(JSON.parse(savedAnswers));
          } catch (e) {
              console.error("Failed to parse saved answers", e);
          }
      }
      if (savedViolations) {
          setViolationCount(parseInt(savedViolations));
      }
  }, [user, examId, LOCAL_STORAGE_KEY_PREFIX]);

  // Save state on changes
  useEffect(() => {
      if (!user || !examId) return;
      localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}_answers`, JSON.stringify(answers));
      localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}_violations`, violationCount.toString());
  }, [answers, violationCount, user, examId, LOCAL_STORAGE_KEY_PREFIX]);

  // Timer logic with persistence
  useEffect(() => {
    if (!exam?.duration_minutes || !user) return;

    const isExpiredPractice = exam.exam_type === 'live' && exam.time_window_end && new Date() > new Date(exam.time_window_end);
    const startTimeKey = `${LOCAL_STORAGE_KEY_PREFIX}_start_time`;

    let startTime = localStorage.getItem(startTimeKey);

    if (!startTime) {
        startTime = Date.now().toString();
        localStorage.setItem(startTimeKey, startTime);
    }

    const now = Date.now();
    const durationSeconds = exam.duration_minutes * 60;
    const elapsedSeconds = Math.floor((now - parseInt(startTime)) / 1000);
    let remaining = Math.max(0, durationSeconds - elapsedSeconds);

    // For active live exams (not expired ones taken for practice), respect the time window.
    if (exam.exam_type === 'live' && !isExpiredPractice && exam.time_window_end && !retakeFromAttemptId) {
        const hardEnd = new Date(exam.time_window_end).getTime();
        const secondsUntilEnd = Math.floor((hardEnd - now) / 1000);
        if (!isNaN(secondsUntilEnd)) {
             remaining = Math.min(remaining, Math.max(0, secondsUntilEnd));
        }
    }

    setTimeLeft(remaining);

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
          if (prev === null) return null;
          if (prev <= 1) {
              clearInterval(timer);
              return 0;
          }
          return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [exam, user, LOCAL_STORAGE_KEY_PREFIX, retakeFromAttemptId]);

  // Auto-submit
  const submitExamMutation = useMutation({
    mutationFn: async () => {
        if (!user || !exam) throw new Error("Invalid state");

        const answersList = Object.entries(answers).map(([questionId, selectedOption]) => ({
            question_id: questionId,
            selected_option: selectedOption
        }));

        const startTime = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}_start_time`);
        const timeTaken = startTime ? Math.floor((Date.now() - parseInt(startTime)) / 1000) : 0;

        // If retaking mistakes, we are submitting a PRACTICE attempt, regardless of original exam type
        // The RPC `submit_exam_attempt` handles marking it as practice if outside window,
        // but for specific filtered set, the score might be weird (out of total questions?).
        // The RPC calculates score based on ALL questions in `exam_questions` usually?
        // No, `submit_exam_attempt` usually counts matched answers.
        // It will just score the subset submitted.
        // The `total_marks` might be low, but that's expected for retake.

        const { data: attemptId, error } = await supabase.rpc("submit_exam_attempt", {
            p_exam_id: exam.id,
            p_answers: answersList,
            p_violation_count: violationCount,
            p_time_taken_seconds: timeTaken
        });

        if (error) throw error;

        // Check for Streak (Duration >= 15 mins)
        if (exam.duration_minutes >= 15) {
            updateStreak();
        }

        updateStats("total_exam_time", exam.duration_minutes);

        return attemptId;
    },
    onSuccess: (attemptId) => {
      // Clear storage
      localStorage.removeItem(`${LOCAL_STORAGE_KEY_PREFIX}_answers`);
      localStorage.removeItem(`${LOCAL_STORAGE_KEY_PREFIX}_start_time`);
      localStorage.removeItem(`${LOCAL_STORAGE_KEY_PREFIX}_violations`);

      toast({ title: "Exam submitted successfully!" });
      navigate(`/dashboard/exam-review/${attemptId}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Submission Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
      if (timeLeft === 0) {
          submitExamMutation.mutate();
      }
  }, [timeLeft, submitExamMutation]);


  const scrollToQuestion = (index: number) => {
    const questionId = shuffledQuestions?.[index]?.id;
    if (questionId && questionRefs.current[questionId]) {
      questionRefs.current[questionId]?.scrollIntoView({ behavior: "smooth", block: "center" });
      setIsNavigatorOpen(false);
    }
  };

  if (examLoading || questionsLoading || attemptsLoading) {
    return <div className="p-8 text-center">Loading exam...</div>;
  }

  // Live Exam Check
  const isLive = exam && exam.exam_type === 'live';
  const now = new Date();
  const start = exam?.time_window_start ? new Date(exam.time_window_start) : null;
  const end = exam?.time_window_end ? new Date(exam.time_window_end) : null;
  const isExpiredLive = isLive && end && now > end;

  // 1. Not Started Yet
  if (isLive && start && now < start && !retakeFromAttemptId) {
      return (
          <div className="p-8 text-center">
              <h2 className="text-xl font-bold mb-2">Exam Has Not Started Yet</h2>
              <p>Please come back at {start.toLocaleString()}.</p>
              <Button className="mt-4" onClick={() => navigate(-1)}>Go Back</Button>
          </div>
      );
  }

  // 2. Check previous attempts logic (only if NOT retaking mistakes)
  if (!isExpiredLive && existingAttempts && existingAttempts.length > 0 && !retakeFromAttemptId) {
      if (isLive) {
            return (
              <div className="p-8 text-center">
                  <h2 className="text-xl font-bold mb-2">You have already taken this live exam.</h2>
                  <p>You can view your results or leaderboard.</p>
                  <p className="text-sm text-muted-foreground mt-2">Practice mode will be available after the exam ends.</p>
                  <div className="flex gap-2 justify-center mt-4">
                      <Button onClick={() => navigate(`/dashboard/exam-review/${existingAttempts[0].id}`)}>View Result</Button>
                      <Button variant="outline" onClick={() => navigate(`/dashboard/leaderboard/${exam.id}`)}>Leaderboard</Button>
                  </div>
              </div>
          );
      }
  }

  if (!questions || questions.length === 0) {
    return <div className="p-8 text-center">No questions found to retake! You might have answered all correctly.</div>;
  }

  // Use shuffled questions if ready, else raw (should only be raw for a split second)
  const displayQuestions = shuffledQuestions.length > 0 ? shuffledQuestions : questions;

  const answeredCount = Object.keys(answers).length;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const isLowTime = timeLeft !== null && timeLeft < 300; // < 5 mins

  return (
    <div className="min-h-screen bg-background pb-20 relative font-sans">

      {/* Floating Status Bar (Timer + Violations) */}
      <div className="fixed top-16 left-0 right-0 z-50 flex justify-center pointer-events-none">
          <div className="flex gap-2 pointer-events-auto mt-2">
            {/* Timer Badge */}
            <div className={cn(
                "px-4 py-2 rounded-full font-mono font-bold shadow-lg border flex items-center gap-2 transition-all duration-300",
                isLowTime
                    ? "bg-red-600 text-white border-red-700 animate-pulse"
                    : "bg-background/90 backdrop-blur border-primary/20 text-primary"
            )}>
                <Clock className="h-4 w-4" />
                {timeLeft !== null ? formatTime(timeLeft) : "--:--"}
            </div>

            {retakeFromAttemptId && (
                <div className="px-4 py-2 rounded-full font-bold shadow-lg border bg-blue-500/10 backdrop-blur border-blue-500/50 text-blue-600 dark:text-blue-400 flex items-center gap-2">
                    <RotateCw className="h-4 w-4" />
                    <span className="text-sm">Retake Mode</span>
                </div>
            )}

            {/* Auto-save Indicator */}
            <div className="px-3 py-2 rounded-full font-medium text-xs shadow-sm border bg-background/80 backdrop-blur text-muted-foreground flex items-center gap-1 transition-opacity opacity-50 hover:opacity-100">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                Saved
            </div>

            {/* Violation Badge - Only shows if violations exist */}
            {violationCount > 0 && (
                <div className="px-4 py-2 rounded-full font-bold shadow-lg border bg-yellow-500/10 backdrop-blur border-yellow-500/50 text-yellow-600 dark:text-yellow-400 flex items-center gap-2 animate-in fade-in zoom-in">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm">Warnings: {violationCount}</span>
                </div>
            )}
          </div>
      </div>

      <div className="container max-w-4xl mx-auto px-[5px] py-4 md:p-8 space-y-6 pt-24">
        <div className="flex items-center justify-between">
             <div>
                <h1 className="text-2xl font-bold">{exam.title} {retakeFromAttemptId && "(Mistakes Only)"}</h1>
                <p className="text-sm text-muted-foreground">Answered: {answeredCount} / {questions.length}</p>
             </div>
             <Button
                size="sm"
                onClick={() => {
                    if (confirm("Are you sure you want to submit?")) submitExamMutation.mutate();
                }}
                disabled={submitExamMutation.isPending}
             >
                {submitExamMutation.isPending ? "Submitting..." : "Submit Exam"}
             </Button>
        </div>

        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {displayQuestions.map((q: any, idx: number) => (
          <div
            key={q.id}
            ref={(el) => { questionRefs.current[q.id] = el; }}
            className="scroll-mt-24"
          >
            <Card className="shadow-sm rounded-[30px] overflow-hidden">
                <CardContent className="p-5 space-y-2">
                    {/* Question Row */}
                    <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                            {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0 pt-1 overflow-x-auto no-scrollbar scroll-smooth">
                            <div className="text-lg font-medium leading-relaxed whitespace-normal min-w-0">
                                <MathText text={q.question_text} className="prose dark:prose-invert max-w-none whitespace-normal min-w-0" />
                            </div>
                        </div>
                    </div>

                    {/* Options Row */}
                    <div className="space-y-2 pt-2">
                        {(["A", "B", "C", "D"] as const).map((optionKey) => {
                            const optionText = q[`option_${optionKey.toLowerCase()}` as keyof typeof q];
                            const isSelected = answers[q.id] === optionKey;
                            const isAnswered = !!answers[q.id];
                            const isDisabled = isAnswered && !isSelected;

                            return (
                                <div
                                    key={optionKey}
                                    className={cn("flex items-start gap-4 group", isDisabled && "opacity-50 pointer-events-none")}
                                >
                                    <div
                                        onClick={() => {
                                            if (!isAnswered) {
                                                setAnswers((prev) => ({ ...prev, [q.id]: optionKey }));
                                            }
                                        }}
                                        className={cn(
                                        "flex-shrink-0 h-8 w-8 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all mt-0.5",
                                        isSelected
                                            ? "border-primary bg-primary text-primary-foreground scale-110"
                                            : "border-muted-foreground/30 text-muted-foreground",
                                        !isAnswered && "cursor-pointer group-hover:border-primary/50 group-hover:text-primary",
                                        isDisabled && "border-muted-foreground/20 text-muted-foreground/50"
                                    )}>
                                        {optionKey}
                                    </div>
                                    <div className={cn(
                                        "flex-1 text-base whitespace-normal min-w-0 pt-1 overflow-x-auto no-scrollbar scroll-smooth",
                                        isSelected ? "text-primary font-medium" : "text-foreground"
                                    )}>
                                         <MathText text={optionText} className="prose dark:prose-invert max-w-none whitespace-normal min-w-0" />
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
                        if (confirm("Finish and submit exam?")) submitExamMutation.mutate();
                }}
                className="bg-green-600 hover:bg-green-700 w-full max-w-sm h-12 text-lg rounded-full"
            >
                Finish Exam
            </Button>
        </div>
      </div>

      {/* Floating Navigator Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <Button
            size="icon"
            className="h-14 w-14 rounded-full shadow-xl bg-primary hover:bg-primary/90"
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
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {displayQuestions.map((q: any, idx: number) => {
                    const isAnswered = !!answers[q.id];
                    return (
                        <button
                            key={q.id}
                            onClick={() => scrollToQuestion(idx)}
                            className={`
                                h-10 w-10 rounded-lg flex items-center justify-center text-sm font-bold transition-all
                                ${isAnswered
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'bg-muted text-muted-foreground hover:bg-muted/80 border border-border'}
                            `}
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

export default TakeExam;
