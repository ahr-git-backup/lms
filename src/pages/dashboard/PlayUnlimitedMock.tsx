import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, CheckCircle2, XCircle, SkipForward, RotateCcw, BookOpen, Bookmark } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import MathText from "@/components/MathText";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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

const PlayUnlimitedMock = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
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

  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [secondsLeft, setSecondsLeft] = useState(minutes * 60);
  const [submitted, setSubmitted] = useState(false);
  const [filter, setFilter] = useState<"all" | "correct" | "wrong" | "skipped">("all");
  const [bookmarked, setBookmarked] = useState<Record<string, boolean>>({});

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

  useEffect(() => {
    if (questions.length === 0) {
      navigate("/dashboard/mock-test");
    }
  }, [questions, navigate]);

  useEffect(() => {
    if (submitted) return;
    if (secondsLeft <= 0) {
      handleSubmit();
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, submitted]);

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
    return { correct, wrong, skipped, negMark, finalScore };
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

  const retakeExam = () => {
    setAnswers({});
    setCurrent(0);
    setSecondsLeft(minutes * 60);
    setSubmitted(false);
    setFilter("all");
  };

  const mistakePractice = () => {
    const wrongQs = questions.filter((q) => answers[q.id] && answers[q.id] !== q.correct_option);
    if (wrongQs.length === 0) return;
    sessionStorage.setItem("unlimitedMockQuestions", JSON.stringify(wrongQs));
    sessionStorage.setItem("unlimitedMockTitle", `${title} — Mistake Practice`);
    sessionStorage.setItem("unlimitedMockTime", String(Math.ceil(wrongQs.length / 1.5)));
    window.location.reload();
  };

  if (questions.length === 0) return null;

  if (submitted) {
    const scoreClass =
      stats.finalScore > 0 ? "text-green-500" : stats.finalScore < 0 ? "text-red-500" : "text-muted-foreground";

    const visibleQuestions = questions.filter((q) => {
      if (filter === "all") return true;
      const ua = answers[q.id];
      const status = !ua ? "skipped" : ua === q.correct_option ? "correct" : "wrong";
      return status === filter;
    });

    return (
      <div className="max-w-2xl mx-auto py-6 space-y-5">
        <Card>
          <CardContent className="pt-6 text-center space-y-1">
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className={`text-4xl font-extrabold ${scoreClass}`}>
              {stats.finalScore.toFixed(2)}
              <span className="text-lg text-muted-foreground font-medium"> / {questions.length}</span>
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <p className="text-lg font-bold text-green-500">{stats.correct}</p>
            <p className="text-[10px] text-muted-foreground">সঠিক</p>
          </div>
          <div>
            <p className="text-lg font-bold text-red-500">{stats.wrong}</p>
            <p className="text-[10px] text-muted-foreground">ভুল</p>
          </div>
          <div>
            <p className="text-lg font-bold text-amber-500">{stats.skipped}</p>
            <p className="text-[10px] text-muted-foreground">স্কিপ</p>
          </div>
          <div>
            <p className="text-lg font-bold text-red-400">-{stats.negMark.toFixed(2)}</p>
            <p className="text-[10px] text-muted-foreground">নেগেটিভ</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={retakeExam}>
            <RotateCcw className="h-4 w-4 mr-1" /> Practice Again
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={mistakePractice}
            disabled={stats.wrong === 0}
          >
            <XCircle className="h-4 w-4 mr-1" /> Mistake Practice
          </Button>
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {(["all", "correct", "wrong", "skipped"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border-2 ${
                filter === f
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              {f === "all" ? "সব" : f === "correct" ? "সঠিক" : f === "wrong" ? "ভুল" : "স্কিপ"}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {visibleQuestions.map((q, i) => {
            const ua = answers[q.id];
            const status = !ua ? "skipped" : ua === q.correct_option ? "correct" : "wrong";
            return (
              <Card key={q.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">
                      প্রশ্ন {questions.indexOf(q) + 1}/{questions.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleBookmark(q)}
                        className={bookmarked[q.id] ? "text-amber-500" : "text-muted-foreground"}
                        title="বুকমার্ক"
                      >
                        <Bookmark className="h-4 w-4" fill={bookmarked[q.id] ? "currentColor" : "none"} />
                      </button>
                      {status === "correct" && (
                        <span className="text-xs font-semibold text-green-500 flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> সঠিক
                        </span>
                      )}
                      {status === "wrong" && (
                        <span className="text-xs font-semibold text-red-500 flex items-center gap-1">
                          <XCircle className="h-3.5 w-3.5" /> ভুল
                        </span>
                      )}
                      {status === "skipped" && (
                        <span className="text-xs font-semibold text-amber-500 flex items-center gap-1">
                          <SkipForward className="h-3.5 w-3.5" /> স্কিপ
                        </span>
                      )}
                    </div>
                  </div>
                  <MathText text={q.question_text} />
                  <div className="space-y-1.5">
                    {(["A", "B", "C", "D"] as const).map((opt) => {
                      const text = q[`option_${opt.toLowerCase()}` as "option_a"];
                      if (!text) return null;
                      const isCorrect = opt === q.correct_option;
                      const isUserWrong = opt === ua && ua !== q.correct_option;
                      return (
                        <div
                          key={opt}
                          className={`px-3 py-1.5 rounded-md text-sm border ${
                            isCorrect
                              ? "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400 font-medium"
                              : isUserWrong
                              ? "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400 line-through"
                              : "border-border"
                          }`}
                        >
                          <span className="font-semibold mr-1.5">{opt}.</span>
                          <MathText text={text} />
                        </div>
                      );
                    })}
                  </div>
                  {q.explanation && (
                    <div className="bg-muted/50 border-l-2 border-primary rounded-r-md px-3 py-2 text-xs">
                      <p className="font-semibold text-primary mb-1 flex items-center gap-1">
                        <BookOpen className="h-3 w-3" /> ব্যাখ্যা
                      </p>
                      <p className="text-muted-foreground">{q.explanation}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Button className="w-full" variant="outline" onClick={() => navigate("/dashboard/mock-test")}>
          এক্সাম লিস্টে যান
        </Button>
      </div>
    );
  }

  const q = questions[current];
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  return (
    <div className="max-w-2xl mx-auto py-6 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">
          প্রশ্ন {current + 1} / {questions.length}
        </span>
        <span className="text-sm font-mono font-bold text-primary flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" /> {mins}:{secs.toString().padStart(2, "0")}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{title}</p>
      <Card>
        <CardContent className="p-5 space-y-4">
          <MathText text={q?.question_text || ""} />
          <div className="space-y-2">
            {(["A", "B", "C", "D"] as const).map((opt) => {
              const text = q?.[`option_${opt.toLowerCase()}` as "option_a"];
              if (!text) return null;
              const selected = answers[q.id] === opt;
              return (
                <button
                  key={opt}
                  onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                  className={`w-full text-left px-4 py-2.5 rounded-lg border-2 transition-colors ${
                    selected ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                  }`}
                >
                  <span className="font-semibold mr-2">{opt}.</span>
                  <MathText text={text} />
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-between gap-2">
        <Button variant="outline" disabled={current === 0} onClick={() => setCurrent((c) => c - 1)}>
          Prev
        </Button>
        {current < questions.length - 1 ? (
          <Button onClick={() => setCurrent((c) => c + 1)}>Next</Button>
        ) : (
          <Button onClick={handleSubmit}>Submit</Button>
        )}
      </div>
    </div>
  );
};

export default PlayUnlimitedMock;

