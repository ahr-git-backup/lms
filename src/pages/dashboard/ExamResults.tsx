import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

    return (
    <Card className="border rounded-2xl shadow-md hover:shadow-lg transition-all flex flex-col h-full border-emerald-100 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900">
        <CardHeader className="space-y-0.5 p-3 pb-2">
            <div className="flex justify-between items-start gap-2">
                <p className="text-[10px] font-mono uppercase text-muted-foreground truncate">
                    {attempt.exam.course?.name || "Public Exam"}
                </p>
                {isLive && <span className="text-[9px] shrink-0 bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold">LIVE</span>}
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
                    variant="outline"
                    className="rounded-lg text-[10px] h-8 px-1 leading-tight whitespace-normal"
                    onClick={() => navigate(`/dashboard/take-exam/${attempt.exam.id}`)}
                >
                    Practice Again
                </Button>

                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={!hasMistakes}
                            className="rounded-lg text-[10px] h-8 px-1 leading-tight whitespace-normal disabled:opacity-40"
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
                    variant="outline"
                    onClick={() => navigate(`/dashboard/leaderboard/${attempt.exam.id}`)}
                    className="rounded-lg text-[10px] h-8 px-1 leading-tight whitespace-normal"
                >
                    Leaderboard
                </Button>
            </div>
        </CardContent>
    </Card>
    );
};

const ExamResults = () => {
  const [category, setCategory] = useState<"all" | "live" | "practice" | "readymade">("all");
  const [readymadeSubCategory, setReadymadeSubCategory] = useState<string | null>(null);
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const categorize = (attempt: any) => {
    const exam = attempt.exam;
    if (!exam) return "practice";
    if (exam.readymade_topic) return "readymade";
    const isExpiredLive = exam.exam_type === "live" && exam.time_window_end && new Date() > new Date(exam.time_window_end);
    if (isExpiredLive) return "practice";
    return exam.exam_type === "live" ? "live" : "practice";
  };

  const readymadeTopics = Array.from(new Set(
    (attempts || [])
      .filter(a => categorize(a) === "readymade" && a.exam?.readymade_topic)
      .map(a => a.exam.readymade_topic)
  ));

  const filteredAttempts = (attempts || []).filter(a => {
    const cat = categorize(a);
    if (category === "all") return true;
    if (category === "readymade") {
      if (cat !== "readymade") return false;
      if (readymadeSubCategory) return a.exam.readymade_topic === readymadeSubCategory;
      return true;
    }
    return cat === category;
  });

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

      {isLoading ? (
        <div className="text-sm text-muted-foreground px-1">Loading...</div>
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
