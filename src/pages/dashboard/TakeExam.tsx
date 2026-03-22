import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import MathText from "@/components/MathText";
import { LayoutGrid, Clock, AlertTriangle, RotateCw, CheckCircle2, ChevronLeft, Loader2, Lock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAntiCheat } from "@/hooks/useAntiCheat";
import { useStudyTools } from "@/contexts/StudyToolsContext";
import { Checkbox } from "@/components/ui/checkbox";
import { useEnrollments } from "@/hooks/useEnrollments";
import { OmrExamScanner } from "@/components/exam/OmrExamScanner";

const TakeExam = () => {
  useAntiCheat();
  const { examId } = useParams();
  const [searchParams] = useSearchParams();
  const retakeFromAttemptId = searchParams.get('retake_from');

  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile, loading: authLoading } = useAuth();
  const { updateStreak, updateStats } = useStudyTools();
  const { data: enrollments, isLoading: enrollmentsLoading } = useEnrollments();

  // State
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isNavigatorOpen, setIsNavigatorOpen] = useState(false);
  const [violationCount, setViolationCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [agreedToInstructions, setAgreedToInstructions] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [shuffledQuestions, setShuffledQuestions] = useState<any[]>([]);
  const questionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const autoSubmitTriggered = useRef(false);

  // Use a different key prefix for retakes so we don't conflict with main exam session storage
  const LOCAL_STORAGE_KEY_PREFIX = retakeFromAttemptId
      ? `exam_session_retake_${retakeFromAttemptId}_${user?.id}`
      : `exam_session_${examId}_${user?.id}`;

  const QUESTIONS_STORAGE_KEY = `${LOCAL_STORAGE_KEY_PREFIX}_questions`;

  useEffect(() => {
    if (!hasStarted) return;

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
  }, [toast, retakeFromAttemptId, hasStarted]);

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
      let allQuestions;

      // 1. Check LocalStorage
      const cached = localStorage.getItem(QUESTIONS_STORAGE_KEY);
      if (cached) {
          try {
            allQuestions = JSON.parse(cached);
            console.log("Loaded questions from cache");

            // Validate cache structure - ensure it's a non-empty array if supposed to be
            if (!Array.isArray(allQuestions) || allQuestions.length === 0) {
                console.warn("Cached questions empty or invalid, refetching...");
                allQuestions = null; // Force refetch
            }
          } catch(e) {
            console.error("Cache parse error", e);
            allQuestions = null;
          }
      }

      // 2. Fetch if missing
      if (!allQuestions) {
          // Use light RPC: get_exam_questions_start
          // We pass p_user_id explicitly to ensure the SECURITY DEFINER function uses the correct context
          const { data, error } = await supabase.rpc("get_exam_questions_start", {
            p_exam_id: examId,
            p_user_id: user?.id
          });

          if (error) {
              console.error("RPC Error:", error);
              throw error;
          }

          // Fallback: If RPC returns empty but we know questions exist (admin view),
          // try direct fetch if RPC logic is too strict (e.g. published check)
          // Only do this if user has access (already checked in logic below, but RLS might block)
          if (!data || data.length === 0) {
               console.warn("RPC returned no questions. Attempting direct fallback...");
               const { data: directData, error: directError } = await supabase
                   .from("exam_questions")
                   .select("id, question_text, option_a, option_b, option_c, option_d, question_index")
                   .eq("exam_id", examId)
                   .order("question_index", { ascending: true });

               if (!directError && directData && directData.length > 0) {
                   allQuestions = directData;
               } else {
                   allQuestions = [];
               }
          } else {
              allQuestions = data;
          }
      }

      // 3. If filtering for mistakes, fetch the previous attempt's wrong answers
      if (retakeFromAttemptId) {
          const { data: attemptData } = await supabase
              .from("exam_attempts")
              .select("answers")
              .eq("id", retakeFromAttemptId)
              .single();

          if (attemptData?.answers) {
              const { data: reviewData, error: reviewError } = await supabase.rpc("get_student_exam_review", {
                  p_attempt_id: retakeFromAttemptId
              });

              if (!reviewError && reviewData) {
                  // Filter for questions where user was WRONG
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const wrongQuestionIds = new Set(reviewData.filter((q: any) => {
                       const userAnswerObj = (attemptData.answers as any[]).find((a: any) => a.question_id === (q.question_id || q.id));
                       const selected = userAnswerObj?.selected_option;
                       return selected !== q.correct_option; // Wrong or Skipped
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  }).map((q: any) => q.question_id || q.id));

                  // Return only the questions from `allQuestions` that match `wrongQuestionIds`
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  allQuestions = allQuestions.filter((q: any) => wrongQuestionIds.has(q.id));
              }
          }
      }

      // Update cache with the final list (filtered or full)
      // Since the key is specific to the session (retake vs normal), caching the result is correct.
      try {
         localStorage.setItem(QUESTIONS_STORAGE_KEY, JSON.stringify(allQuestions));
      } catch (e) {
         console.error("Cache save error", e);
      }

      return allQuestions;
    },
  });

  // Shuffle Questions Effect
  useEffect(() => {
    if (exam && questions && questions.length > 0 && shuffledQuestions.length === 0) {
        // If the exam is an OMR exam, DO NOT SHUFFLE so the question numbers align with the OMR sheet
        if (exam.is_omr_enabled || exam.is_omr) {
            setShuffledQuestions([...questions]);
            return;
        }

        // Simple Fisher-Yates shuffle
        const shuffled = [...questions];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        setShuffledQuestions(shuffled);
    }
  }, [questions, shuffledQuestions.length, exam]);

  // Load persistence logic - ONLY ON MOUNT
  useEffect(() => {
      if (!user || !examId) return;

      const savedAnswers = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}_answers`);
      const savedViolations = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}_violations`);
      const savedStartTime = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}_start_time`);

      if (savedStartTime) {
          setHasStarted(true);
      }

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
    if (!exam?.duration_minutes || !user || !hasStarted) return;

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
  }, [exam, user, LOCAL_STORAGE_KEY_PREFIX, retakeFromAttemptId, hasStarted]);

  // Auto-submit
  const submitExamMutation = useMutation({
    mutationFn: async () => {
        if (!user || !exam) throw new Error("Invalid state");
        // Explicitly check profile presence before submission
        if (!profile || !profile.id) throw new Error("User profile not found. Please contact support.");

        const answersList = Object.entries(answers).map(([questionId, selectedOption]) => ({
            question_id: questionId,
            selected_option: selectedOption
        }));

        const startTime = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}_start_time`);
        const timeTaken = startTime ? Math.floor((Date.now() - parseInt(startTime)) / 1000) : 0;

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
      localStorage.removeItem(QUESTIONS_STORAGE_KEY); // Clear questions cache

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
      if (timeLeft === 0 && !autoSubmitTriggered.current && !submitExamMutation.isPending) {
          autoSubmitTriggered.current = true;
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

  // 0. Auth Loading / Profile Check
  if (authLoading || (!profile && user)) {
     return <div className="p-8 text-center flex items-center justify-center min-h-[50vh]">
          <div className="space-y-4">
              <Loader2 className="animate-spin h-8 w-8 text-primary mx-auto" />
              <p className="text-muted-foreground">Verifying user profile...</p>
          </div>
     </div>;
  }

  if (examLoading || questionsLoading || attemptsLoading || enrollmentsLoading) {
    return <div className="p-8 text-center flex items-center justify-center min-h-[50vh]">
        <div className="space-y-4">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
            <p className="text-muted-foreground">Loading exam...</p>
        </div>
    </div>;
  }

  // Access Control
  const hasAccess = (() => {
      if (!exam) return false;

      // If course_id is null, it's potentially public, BUT we must check if hidden from free view
      if (!exam.course_id) {
          // @ts-ignore
          if (exam.is_visible_on_free === false) {
             // Not public. Check if user has access via Archive/Shared
             // Fall through to enrollment checks
          } else {
             return true; // Strictly public/free
          }
      }

      if (!enrollments) return false;

      const enrolledIds = enrollments.map((e: any) => e.course_id);

      // Check Primary Enrollment
      if (exam.course_id && enrolledIds.includes(exam.course_id)) return true;

      // Check Shared Courses
      // @ts-ignore
      if (exam.shared_course_ids && Array.isArray(exam.shared_course_ids)) {
          // @ts-ignore
          if (exam.shared_course_ids.some((id: string) => enrolledIds.includes(id))) return true;
      }

      // Check Archive Courses
      // @ts-ignore
      if (exam.archive_course_ids && Array.isArray(exam.archive_course_ids)) {
          // @ts-ignore
          if (exam.archive_course_ids.some((id: string) => enrolledIds.includes(id))) return true;
      }

      // Check Readymade Linked Courses
      // @ts-ignore
      if (exam.is_readymade && exam.readymade_course_ids && Array.isArray(exam.readymade_course_ids)) {
          // @ts-ignore
          if (exam.readymade_course_ids.some((id: string) => enrolledIds.includes(id))) return true;
      }

      return false;
  })();

  if (!hasAccess) {
      return (
          <div className="p-8 text-center flex flex-col items-center justify-center min-h-[60vh] gap-4">
              <AlertTriangle className="h-12 w-12 text-destructive" />
              <h2 className="text-xl font-bold">Access Denied</h2>
              <p className="text-muted-foreground">You are not enrolled in the course required for this exam.</p>
              <Button onClick={() => navigate("/courses")}>View Courses</Button>
          </div>
      );
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
          <div className="p-8 text-center flex flex-col items-center justify-center min-h-[60vh] max-w-lg mx-auto">
              <div className="bg-primary/10 p-4 rounded-full mb-4">
                  <Clock className="h-10 w-10 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Exam Has Not Started Yet</h2>
              <p className="text-muted-foreground mb-6">This exam is scheduled to start on <span className="font-semibold text-foreground">{start.toLocaleString()}</span>.</p>
              <Button size="lg" onClick={() => navigate(-1)}>
                  <ChevronLeft className="h-4 w-4 mr-2" /> Go Back
              </Button>
          </div>
      );
  }

  // 1.5 Expired Only-Live
  if (isExpiredLive && exam.is_only_live) {
      return (
          <div className="p-8 text-center flex flex-col items-center justify-center min-h-[60vh] max-w-lg mx-auto">
              <div className="bg-red-100 dark:bg-red-900/20 p-4 rounded-full mb-4">
                  <Lock className="h-10 w-10 text-red-600 dark:text-red-500" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Exam Has Ended</h2>
              <p className="text-muted-foreground mb-6">This was a live-only exam and the time window has closed. It is no longer available for practice.</p>
              <Button size="lg" onClick={() => navigate(-1)}>
                  <ChevronLeft className="h-4 w-4 mr-2" /> Go Back
              </Button>
          </div>
      );
  }

  // Handle External Exam Redirects *after* ensuring the exam has started


  // 2. Check previous attempts logic (only if NOT retaking mistakes)
  if (!isExpiredLive && existingAttempts && existingAttempts.length > 0 && !retakeFromAttemptId) {
      if (isLive) {
            return (
              <div className="p-8 text-center flex flex-col items-center justify-center min-h-[60vh] max-w-lg mx-auto">
                  <div className="bg-green-100 dark:bg-green-900/20 p-4 rounded-full mb-4">
                      <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-500" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">You have already taken this exam</h2>
                  <p className="text-muted-foreground mb-6">
                      You can view your results or check the leaderboard. Practice mode will be available after the exam period ends.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
                      <Button size="lg" onClick={() => navigate(`/dashboard/exam-review/${existingAttempts[0].id}`)}>View Result</Button>
                      <Button size="lg" variant="outline" onClick={() => navigate(`/dashboard/leaderboard/${exam.id}`)}>Leaderboard</Button>
                  </div>
              </div>
          );
      }
  }

  if (!exam.external_exam_link && (!questions || questions.length === 0)) {
    return (
        <div className="p-8 text-center flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <div className="bg-muted p-4 rounded-full">
                <AlertTriangle className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
                <p className="text-xl font-semibold">No questions loaded</p>
                <p className="text-muted-foreground text-sm max-w-md mx-auto mt-2">
                    We verified your access, but could not load the exam content. This might be due to a server error or the questions haven't been published yet.
                </p>
            </div>
            <div className="flex gap-2">
                <Button variant="outline" onClick={() => window.location.reload()}>Retry</Button>
                <Button onClick={() => navigate(-1)}>Go Back</Button>
            </div>
        </div>
    );
  }

  if (!hasStarted) {
      return (
          <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 space-y-4">
              {/* Card 1: Header/Info */}
              <Card className="w-full max-w-2xl rounded-[30px] shadow-sm border">
                  <div className="p-6 md:p-8 space-y-6">
                      <div className="text-center space-y-2">
                          <h1 className="text-2xl font-bold tracking-tight">{exam.title}</h1>
                          <p className="text-muted-foreground text-sm">Please review the details below before starting.</p>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                          <div className="flex flex-col items-center justify-center p-4 bg-secondary/30 rounded-xl">
                              <span className="text-xl font-bold text-primary">{exam.duration_minutes}</span>
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Minutes</span>
                          </div>
                          <div className="flex flex-col items-center justify-center p-4 bg-secondary/30 rounded-xl">
                              <span className="text-xl font-bold text-primary">{exam.external_exam_link ? 'N/A' : questions?.length}</span>
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Questions</span>
                          </div>
                          <div className="flex flex-col items-center justify-center p-4 bg-secondary/30 rounded-xl">
                              <span className="text-xl font-bold text-red-500">{exam.negative_mark_per_question}</span>
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Negative</span>
                          </div>
                      </div>
                  </div>
              </Card>

              {/* Card 2: Instructions */}
              <Card className="w-full max-w-2xl rounded-[30px] shadow-sm border">
                  <div className="p-6 md:p-8 space-y-3">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                          Instructions
                      </h3>
                      <div className="text-sm text-muted-foreground leading-relaxed">
                          {exam.instructions ? (
                              <div className="prose prose-sm max-w-none dark:prose-invert">
                                  <MathText text={exam.instructions} />
                              </div>
                          ) : (
                              <ul className="list-disc pl-5 space-y-1">
                                  <li>Ensure you have a stable internet connection.</li>
                                  <li>Do not switch tabs or windows. Violations are recorded.</li>
                                  <li>The exam will auto-submit when the timer ends.</li>
                                  <li>Once started, the timer cannot be paused.</li>
                              </ul>
                          )}
                      </div>
                  </div>
              </Card>

              {/* Card 3: Actions */}
              <Card className="w-full max-w-2xl rounded-[30px] shadow-sm border">
                  <div className="p-6 md:p-8 space-y-4">
                      <div className="flex items-center space-x-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                          <Checkbox
                              id="terms"
                              checked={agreedToInstructions}
                              onCheckedChange={(c) => setAgreedToInstructions(!!c)}
                              className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                          />
                          <label
                              htmlFor="terms"
                              className="text-sm font-medium leading-none cursor-pointer flex-1"
                          >
                              I have read and understood the instructions.
                          </label>
                      </div>

                      <div className="flex gap-3">
                          <Button variant="outline" className="flex-1 h-11 rounded-xl" onClick={() => navigate(-1)}>
                              Cancel
                          </Button>
                          <Button
                              className="flex-[2] h-11 rounded-xl font-semibold shadow-md"
                              onClick={() => {
                                  if (exam.external_exam_link) {
                                      window.location.replace(exam.external_exam_link);
                                  } else {
                                      setHasStarted(true);
                                  }
                              }}
                              disabled={!agreedToInstructions}
                          >
                              Start Exam
                          </Button>
                      </div>
                  </div>
              </Card>
          </div>
      );
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
        </div>

        {/* OMR Scanner Section - only for OMR-enabled exams */}
        {exam.is_omr && displayQuestions && displayQuestions.length > 0 && (
            <OmrExamScanner
                questionIds={displayQuestions.map((q: any) => q.id)}
                answers={answers}
                onFillAnswers={(filledAnswers) => {
                    setAnswers(prev => ({ ...prev, ...filledAnswers }));
                }}
            />
        )}

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
                                    className={cn("flex items-center gap-4 group", isDisabled && "opacity-50 pointer-events-none")}
                                >
                                    <div
                                        onClick={() => {
                                            if (!isAnswered) {
                                                setAnswers((prev) => ({ ...prev, [q.id]: optionKey }));
                                            }
                                        }}
                                        className={cn(
                                        "flex-shrink-0 h-8 w-8 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all",
                                        isSelected
                                            ? "border-primary bg-primary text-primary-foreground scale-110"
                                            : "border-muted-foreground/30 text-muted-foreground",
                                        !isAnswered && !isSelected && "cursor-pointer group-hover:border-primary/50 group-hover:text-primary",
                                        isDisabled && "border-muted-foreground/20 text-muted-foreground/50 cursor-not-allowed"
                                    )}>
                                        {optionKey}
                                    </div>
                                    <div className={cn(
                                        "flex-1 text-base whitespace-normal min-w-0 flex items-center justify-between gap-3 p-3 rounded-lg transition-all",
                                        isSelected ? "text-primary font-medium bg-primary/10 border border-primary/50 shadow-sm" : "text-foreground hover:bg-muted/30"
                                    )}>
                                         <div className="flex-1 overflow-x-auto no-scrollbar scroll-smooth">
                                            <MathText text={optionText} className="prose dark:prose-invert max-w-none whitespace-normal min-w-0" />
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
                        if (confirm("Finish and submit exam?")) submitExamMutation.mutate();
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
                if (confirm("Are you sure you want to submit?")) submitExamMutation.mutate();
             }}
             disabled={submitExamMutation.isPending}
        >
            {submitExamMutation.isPending ? "Submitting..." : "Submit"}
        </Button>
      </div>

      {/* Floating Navigator Button - Right Middle */}
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
