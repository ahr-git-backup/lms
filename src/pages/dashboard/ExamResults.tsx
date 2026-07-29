import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { openSolvePdf } from "@/lib/solvePdf";
import { useToast } from "@/hooks/use-toast";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ResultCard = ({ attempt, isLive, navigate, profile }: { attempt: any, isLive: boolean, navigate: any, profile: any }) => {
    let gpaScore = 0;
    if (profile?.ssc_gpa && profile?.hsc_gpa) {
        gpaScore = (Number(profile.ssc_gpa) * 8) + (Number(profile.hsc_gpa) * 12);
    }
    const totalScoreWithGpa = Number(attempt.score) + gpaScore;
    const percentage = attempt.exam.total_marks > 0 ? ((Number(attempt.score) / Number(attempt.exam.total_marks)) * 100).toFixed(1) : null;

    const { data: mistakeCounts } = useQuery({
        queryKey: ["exam-mistake-counts", attempt.id],
        queryFn: async () => {
            const { data: reviewData } = await supabase.rpc("get_student_exam_review", {
                p_attempt_id: attempt.id
            });
            if (!reviewData) return { wrong: 0, skip: 0 };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const userAnswers = (attempt.answers as any[]) || [];
            let wrong = 0, skip = 0;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            reviewData.forEach((q: any) => {
                const ua = userAnswers.find((a: any) => a.question_id === q.question_id);
                const selected = ua?.selected_option;
                if (!selected) skip++;
                else if (selected !== q.correct_option) wrong++;
            });
            return { wrong, skip };
        },
        staleTime: Infinity,
    });

    const wrongCount = mistakeCounts?.wrong ?? 0;
    const skipCount = mistakeCounts?.skip ?? 0;
    const hasMistakes = wrongCount > 0 || skipCount > 0;

    const { toast } = useToast();
    const [pdfLoading, setPdfLoading] = useState(false);

    const handleSheetPdf = async () => {
        setPdfLoading(true);
        try {
            const { data, error } = await supabase
                .from("exam_questions")
                .select("question_text, option_a, option_b, option_c, option_d, option_e, correct_option, explanation")
                .eq("exam_id", attempt.exam.id)
                .order("question_index", { ascending: true });
            if (error) throw error;
            if (!data || data.length === 0) {
                toast({ title: "কোনো প্রশ্ন পাওয়া যায়নি", variant: "destructive" });
                return;
            }
            const userAnswers = (attempt.answers as any[]) || [];
            openSolvePdf({
                examName: attempt.exam.title,
                questions: data.map((q: any, idx: number) => ({
                    question_text: q.question_text,
                    option_a: q.option_a,
                    option_b: q.option_b,
                    option_c: q.option_c,
                    option_d: q.option_d,
                    option_e: q.option_e,
                    correct_option: q.correct_option,
                    user_answer: userAnswers[idx]?.selected_option || null,
                    explanation: q.explanation,
                })),
                totalMarks: data.length,
                style: "style2",
            });
        } catch (e: any) {
            toast({ title: "PDF তৈরি করা যায়নি", description: e.message, variant: "destructive" });
        } finally {
            setPdfLoading(false);
        }
    };

    return (
    <Card className="border rounded-2xl shadow-md hover:shadow-lg transition-all flex flex-col h-full border-emerald-100 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900">
        <CardHeader className="space-y-0.5 p-3 pb-2">
            <div className="flex justify-between items-start gap-2">
                <p className="text-[10px] font-mono uppercase text-muted-foreground truncate">
                    {attempt.exam.course?.name || "Public Exam"}
                </p>
                <div className="flex items-center gap-1 shrink-0">
                    {isLive && <span className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold">LIVE</span>}
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-1.5 text-[9px] bg-blue-500 hover:bg-blue-600 text-white hover:text-white border-none"
                        disabled={pdfLoading}
                        onClick={handleSheetPdf}
                    >
                        {pdfLoading ? "..." : "Practice Sheet"}
                    </Button>
                </div>
            </div>
            <CardTitle className="text-sm leading-tight">{attempt.exam.title}</CardTitle>
            <CardDescription className="text-[11px] leading-snug">
                <div>Score: <span className="font-bold text-foreground">{attempt.score}</span> / {attempt.exam.total_marks} {percentage && <span className="text-muted-foreground">({percentage}%)</span>}</div>
                {gpaScore > 0 && <div>With GPA: <span className="font-bold text-primary">{totalScoreWithGpa.toFixed(2)}</span></div>}
                <div className="text-muted-foreground">{attempt.submitted_at && new Date(attempt.submitted_at).toLocaleDateString()}</div>
            </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col flex-1 p-3 pt-0">
            <div className="grid grid-cols-4 gap-1.5 mt-auto">
                <Button
                    size="sm"
                    className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white border-none text-[10px] h-8 px-1 leading-tight whitespace-normal"
                    onClick={() => navigate(`/dashboard/exam-review/${attempt.id}`)}
                >
                    Your Result
                </Button>
                <Button
                    size="sm"
                    className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white border-none text-[10px] h-8 px-1 leading-tight whitespace-normal"
                    onClick={() => navigate(`/dashboard/take-exam/${attempt.exam.id}`)}
                >
                    Practice Again
                </Button>

                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            size="sm"
                            disabled={!hasMistakes}
                            className="rounded-lg bg-amber-500 hover:bg-amber-600 text-white border-none text-[10px] h-8 px-1 leading-tight whitespace-normal disabled:opacity-40"
                        >
                            Mistake Practice
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent align="center" className="w-56 p-1.5">
                        <button
                            disabled={wrongCount === 0}
                            onClick={() => navigate("/dashboard/take-mistakes", { state: { examIds: [attempt.exam.id], filterMode: "wrong" } })}
                            className="w-full text-left text-xs px-2.5 py-2 rounded-md hover:bg-muted disabled:opacity-40 disabled:pointer-events-none"
                        >
                            Only Wrong ({wrongCount})
                        </button>
                        <button
                            disabled={wrongCount === 0 && skipCount === 0}
                            onClick={() => navigate("/dashboard/take-mistakes", { state: { examIds: [attempt.exam.id], filterMode: "both" } })}
                            className="w-full text-left text-xs px-2.5 py-2 rounded-md hover:bg-muted disabled:opacity-40 disabled:pointer-events-none"
                        >
                            Wrong + Skip ({wrongCount + skipCount})
                        </button>
                    </PopoverContent>
                </Popover>

                <Button
                    size="sm"
                    onClick={() => navigate(`/dashboard/leaderboard/${attempt.exam.id}`)}
                    className="rounded-lg bg-purple-600 hover:bg-purple-700 text-white border-none text-[10px] h-8 px-1 leading-tight whitespace-normal"
                >
                    Leaderboard
                </Button>
            </div>
        </CardContent>
    </Card>
    );
};

const ExamResults = () => {
  const [category, setCategory] = useState<"all" | "live" | "practice" | "readymade" | "mock" | "quick">("all");
  const [readymadeSubCategory, setReadymadeSubCategory] = useState<string | null>(null);
  const [subjectSubCategory, setSubjectSubCategory] = useState<string | null>(null);
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Exam History – Atlas";
  }, []);

  const { data: attempts, isLoading } = useQuery({
    queryKey: ["exam-results", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("exam_attempts")
        .select("*, exam:exams(*, course:courses(*))")
        .eq("profile_id", user.id)
        .order("submitted_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: mockAttempts, isLoading: mockLoading } = useQuery({
    queryKey: ["mock-exam-attempts-history-for-results", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("mock_exam_attempts")
        .select("*")
        .eq("user_id", user.id)
        .not("submitted_at", "is", null)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: qpAttemptsRaw, isLoading: qpLoading } = useQuery({
    queryKey: ["qp-attempts-history-for-results", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("qp_attempts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Resolve subject names for qp_attempts via their chapter_ids -> qp_chapters -> qp_subjects.
  const { data: qpChapterSubjectMap } = useQuery({
    queryKey: ["qp-chapter-subject-map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qp_chapters")
        .select("id, subject_id, qp_subjects(name)");
      if (error) throw error;
      const map: Record<number, string> = {};
      (data || []).forEach((row: any) => {
        map[row.id] = row.qp_subjects?.name || "সাধারণ";
      });
      return map;
    },
    enabled: !!user,
  });

  const qpAttempts = (qpAttemptsRaw || []).map((a: any) => {
    const firstChapterId = Array.isArray(a.chapter_ids) ? a.chapter_ids[0] : null;
    const subject = (firstChapterId && qpChapterSubjectMap?.[firstChapterId]) || "সাধারণ";
    return { ...a, subject };
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const categorize = (attempt: any) => {
    const exam = attempt.exam;
    if (!exam) return "practice";
    if (exam.is_readymade || exam.readymade_topic) return "readymade";
    // If the student actually attempted this live exam, it stays "Live" in
    // their history regardless of whether the window has since expired —
    // "Practice" is only for live exams they never attended (missed).
    if (exam.exam_type === "live") return "live";
    return "practice";
  };

  const readymadeTopics = Array.from(new Set(
    (attempts || [])
      .filter(a => categorize(a) === "readymade" && a.exam?.readymade_topic)
      .map(a => a.exam.readymade_topic)
  ));

  const mockSubjects = Array.from(new Set((mockAttempts || []).map((a: any) => a.subject || "সাধারণ")));
  const qpSubjects = Array.from(new Set(qpAttempts.map((a: any) => a.subject)));

  const filteredAttempts = (attempts || []).filter(a => {
    const cat = categorize(a);
    if (category === "all") return true;
    if (category === "readymade") {
      if (cat !== "readymade") return false;
      if (readymadeSubCategory) return a.exam.readymade_topic === readymadeSubCategory;
      return true;
    }
    if (category === "mock" || category === "quick") return false;
    return cat === category;
  });

  const filteredMockAttempts = category === "mock"
    ? (mockAttempts || []).filter((a: any) => !subjectSubCategory || (a.subject || "সাধারণ") === subjectSubCategory)
    : [];

  const filteredQpAttempts = category === "quick"
    ? qpAttempts.filter((a: any) => !subjectSubCategory || a.subject === subjectSubCategory)
    : [];

  const isLoadingAny = isLoading || mockLoading || qpLoading;

  return (
    <div className="w-full px-0.5 py-3 space-y-3">
      <header className="space-y-0.5 px-1">
        <h1 className="text-lg font-bold leading-tight">Exam History</h1>
        <p className="text-xs text-muted-foreground">Review your scores and answer scripts.</p>
      </header>

      {/* Category Row */}
      <div className="flex flex-nowrap gap-1.5 px-1 overflow-x-auto no-scrollbar">
        {([
          { key: "all", label: "All" },
          { key: "live", label: "Live Exam" },
          { key: "practice", label: "Practice Exam" },
          { key: "readymade", label: "Readymade Exam" },
        ] as const).map(c => (
          <Button
            key={c.key}
            size="sm"
            variant={category === c.key ? "default" : "outline"}
            className="h-7 px-2.5 text-xs shrink-0"
            onClick={() => {
              setCategory(category === c.key ? "all" : c.key);
              setReadymadeSubCategory(null);
              setSubjectSubCategory(null);
            }}
          >
            {c.label}
          </Button>
        ))}
      </div>

      {/* Category Row 2 */}
      <div className="flex flex-nowrap gap-1.5 px-1 overflow-x-auto no-scrollbar">
        {([
          { key: "mock", label: "Mock Test" },
          { key: "quick", label: "Quick Practice" },
        ] as const).map(c => (
          <Button
            key={c.key}
            size="sm"
            variant={category === c.key ? "default" : "outline"}
            className="h-7 px-2.5 text-xs shrink-0"
            onClick={() => {
              setCategory(category === c.key ? "all" : c.key);
              setReadymadeSubCategory(null);
              setSubjectSubCategory(null);
            }}
          >
            {c.label}
          </Button>
        ))}
      </div>

      {/* Readymade Sub-category Row */}
      {category === "readymade" && readymadeTopics.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-1 pl-2.5">
          {readymadeTopics.map((topic: string) => (
            <Button
              key={topic}
              size="sm"
              variant={readymadeSubCategory === topic ? "secondary" : "ghost"}
              className="h-6 px-2 text-[11px]"
              onClick={() => setReadymadeSubCategory(readymadeSubCategory === topic ? null : topic)}
            >
              {topic}
            </Button>
          ))}
        </div>
      )}

      {/* Mock Test Sub-category (Subject) Row */}
      {category === "mock" && mockSubjects.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-1 pl-2.5">
          {mockSubjects.map((subj: string) => (
            <Button
              key={subj}
              size="sm"
              variant={subjectSubCategory === subj ? "secondary" : "ghost"}
              className="h-6 px-2 text-[11px]"
              onClick={() => setSubjectSubCategory(subjectSubCategory === subj ? null : subj)}
            >
              {subj}
            </Button>
          ))}
        </div>
      )}

      {/* Quick Practice Sub-category (Subject) Row */}
      {category === "quick" && qpSubjects.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-1 pl-2.5">
          {qpSubjects.map((subj: string) => (
            <Button
              key={subj}
              size="sm"
              variant={subjectSubCategory === subj ? "secondary" : "ghost"}
              className="h-6 px-2 text-[11px]"
              onClick={() => setSubjectSubCategory(subjectSubCategory === subj ? null : subj)}
            >
              {subj}
            </Button>
          ))}
        </div>
      )}

      {isLoadingAny ? (
        <div className="text-sm text-muted-foreground px-1">Loading...</div>
      ) : category === "mock" ? (
        filteredMockAttempts.length === 0 ? (
          <Card className="border border-foreground/50 mx-1">
            <CardContent className="pt-6 text-center text-sm text-muted-foreground">
              No mock test results found.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 px-0.5">
            {filteredMockAttempts.map((a: any) => {
              const snapshot = (a.questions_snapshot as any[]) || [];
              const answers = (a.answers as Record<string, string>) || {};
              let wrongCount = 0, skipCount = 0;
              snapshot.forEach((q: any) => {
                const ua = answers[q.id];
                if (!ua) skipCount++;
                else if (ua !== q.correct_option) wrongCount++;
              });
              const hasMistakes = wrongCount > 0 || skipCount > 0;

              const startMockMistakePractice = () => {
                const wrongQs = snapshot.filter((q: any) => answers[q.id] && answers[q.id] !== q.correct_option);
                const skippedQs = snapshot.filter((q: any) => !answers[q.id]);
                const target = [...wrongQs, ...skippedQs];
                if (target.length === 0) return;
                const newSessionId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                sessionStorage.setItem("unlimitedMockQuestions", JSON.stringify(target));
                sessionStorage.setItem("unlimitedMockTitle", `${a.subject || "সাধারণ"}${a.chapter ? ` - ${a.chapter}` : ""} — Mistake Practice`);
                sessionStorage.setItem("unlimitedMockTime", String(Math.ceil(target.length / 1.5)));
                sessionStorage.setItem("unlimitedMockSessionId", newSessionId);
                navigate("/mock-test/play");
              };

              const handleMockPdf = () => {
                if (!snapshot.length) return;
                openSolvePdf({
                  examName: `${a.subject || "সাধারণ"}${a.chapter ? ` - ${a.chapter}` : ""}`,
                  questions: snapshot.map((q: any) => ({
                    question_text: q.question_text,
                    option_a: q.option_a,
                    option_b: q.option_b,
                    option_c: q.option_c,
                    option_d: q.option_d,
                    option_e: q.option_e,
                    correct_option: q.correct_option,
                    user_answer: answers[q.id] || null,
                    explanation: q.explanation,
                  })),
                  totalMarks: snapshot.length,
                  style: "style1",
                });
              };

              return (
              <Card key={a.id} className="border rounded-2xl shadow-sm flex flex-col h-full">
                <CardContent className="p-3 space-y-1.5 flex flex-col flex-1">
                  <p className="text-sm font-semibold">{a.subject || "সাধারণ"} {a.chapter ? `- ${a.chapter}` : ""}</p>
                  <p className="text-xs text-muted-foreground">
                    Score: <span className="font-bold text-foreground">{a.score ?? "-"}</span> / {a.total_marks ?? a.total_questions ?? "-"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{a.submitted_at && new Date(a.submitted_at).toLocaleDateString()}</p>
                  <div className="grid grid-cols-3 gap-1.5 mt-auto pt-1.5">
                    <Button
                      size="sm"
                      className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white border-none text-[10px] h-8 px-1 leading-tight whitespace-normal"
                      onClick={() => navigate("/mock-test")}
                    >
                      Practice Again
                    </Button>
                    <Button
                      size="sm"
                      disabled={!hasMistakes}
                      className="rounded-lg bg-amber-500 hover:bg-amber-600 text-white border-none text-[10px] h-8 px-1 leading-tight whitespace-normal disabled:opacity-40"
                      onClick={startMockMistakePractice}
                    >
                      Mistake Practice
                    </Button>
                    <Button
                      size="sm"
                      disabled={!snapshot.length}
                      className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white border-none text-[10px] h-8 px-1 leading-tight whitespace-normal disabled:opacity-40"
                      onClick={handleMockPdf}
                    >
                      Solve PDF
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );})}
          </div>
        )
      ) : category === "quick" ? (
        filteredQpAttempts.length === 0 ? (
          <Card className="border border-foreground/50 mx-1">
            <CardContent className="pt-6 text-center text-sm text-muted-foreground">
              No quick practice results found.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 px-0.5">
            {filteredQpAttempts.map((a: any) => (
              <Card key={a.id} className="border rounded-2xl shadow-sm">
                <CardContent className="p-3 space-y-1.5">
                  <p className="text-sm font-semibold">{a.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    Correct: <span className="font-bold text-foreground">{a.correct_count}</span> / {a.total_questions} · Points: {a.points_earned}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{a.created_at && new Date(a.created_at).toLocaleDateString()}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : filteredAttempts.length === 0 ? (
        <Card className="border border-foreground/50 mx-1">
          <CardContent className="pt-6 text-center text-sm text-muted-foreground">
            No exam results found.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 px-0.5">
          {filteredAttempts.map((attempt) => (
            <ResultCard
              key={attempt.id}
              attempt={attempt}
              isLive={categorize(attempt) === "live"}
              navigate={navigate}
              profile={profile}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ExamResults;
