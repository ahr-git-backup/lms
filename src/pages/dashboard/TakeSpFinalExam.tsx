import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Circle } from "lucide-react";

interface SpQuestion {
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_e: string | null;
  correct_option: string;
  explanation: string | null;
}

const MODE_LABELS: Record<string, string> = {
  medical_standard: "Medical Standard",
  standard_hard: "Standard+Hard",
};

/** Runs a single Subject/Paper Final attempt: fetches the randomly-assembled
 *  100-question pool once (via get_sp_final_exam_questions), lets the student
 *  answer, then shows a scored review. This exam type isn't tied to the
 *  `exams`/`exam_questions` tables so it doesn't create an attempt row --
 *  it's a self-contained practice run, matching how Quick Practice works. */
const TakeSpFinalExam = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const itemId = searchParams.get("item") || "";
  const category = (searchParams.get("category") as "subject_final" | "paper_final") || "subject_final";
  const mode = searchParams.get("mode") || "medical_standard";
  const itemName = searchParams.get("name") || "";

  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const { data: questions, isLoading, error } = useQuery({
    queryKey: ["sp-final-exam-questions", itemId, mode],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_sp_final_exam_questions", {
        p_item_id: itemId,
        p_mode: mode,
      });
      if (error) throw error;
      return (data || []) as SpQuestion[];
    },
    enabled: !!itemId,
  });

  useEffect(() => {
    document.title = `${itemName} — ${MODE_LABELS[mode] || mode}`;
  }, [itemName, mode]);

  const score = useMemo(() => {
    if (!questions) return { correct: 0, total: 0 };
    let correct = 0;
    questions.forEach((q, i) => {
      if (answers[i] === q.correct_option) correct += 1;
    });
    return { correct, total: questions.length };
  }, [questions, answers]);

  const answeredCount = Object.keys(answers).length;

  const handleSubmit = async () => {
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast({ title: "পরীক্ষা শেষ", description: `আপনি ${score.correct}/${score.total} পেয়েছেন।` });

    if (user && questions) {
      const skipped = questions.length - answeredCount;
      const wrong = answeredCount - score.correct;
      try {
        await supabase.from("sp_final_attempts" as any).insert({
          profile_id: user.id,
          item_id: itemId,
          item_name: itemName,
          category,
          mode,
          questions_snapshot: questions,
          answers,
          correct_count: score.correct,
          wrong_count: wrong,
          skipped_count: skipped,
          total_questions: questions.length,
        });
      } catch {
        // Non-blocking -- the student still sees their result either way.
      }
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[50vh] text-muted-foreground">প্রশ্ন লোড হচ্ছে...</div>;
  }

  if (error || !questions || questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-center px-4">
        <p className="text-muted-foreground">প্রশ্ন লোড করা যায়নি। এই মোডটি এখনো প্রস্তুত নাও হতে পারে।</p>
        <Button variant="outline" onClick={() => navigate(-1)}>ফিরে যান</Button>
      </div>
    );
  }

  const options = (q: SpQuestion) => {
    const opts: { key: string; text: string }[] = [
      { key: "A", text: q.option_a },
      { key: "B", text: q.option_b },
      { key: "C", text: q.option_c },
      { key: "D", text: q.option_d },
    ];
    if (q.option_e) opts.push({ key: "E", text: q.option_e });
    return opts;
  };

  if (submitted) {
    return (
      <div className="space-y-4 pb-10">
        <Card className="border-2 border-primary/30">
          <CardContent className="p-4 text-center space-y-1">
            <p className="text-sm text-muted-foreground">{itemName} — {MODE_LABELS[mode] || mode}</p>
            <p className="text-3xl font-bold text-primary">{score.correct}/{score.total}</p>
            <p className="text-sm text-muted-foreground">সঠিক উত্তর</p>
          </CardContent>
        </Card>

        {questions.map((q, i) => {
          const userAnswer = answers[i];
          const isCorrect = userAnswer === q.correct_option;
          return (
            <Card key={i} className={isCorrect ? "border-green-500/40" : userAnswer ? "border-red-500/40" : ""}>
              <CardContent className="p-4 space-y-2">
                <p className="font-medium text-sm">{i + 1}. {q.question_text}</p>
                <div className="space-y-1">
                  {options(q).map((opt) => (
                    <div
                      key={opt.key}
                      className={`text-sm px-3 py-1.5 rounded-lg border ${
                        opt.key === q.correct_option
                          ? "border-green-500 bg-green-500/10"
                          : opt.key === userAnswer
                            ? "border-red-500 bg-red-500/10"
                            : "border-border"
                      }`}
                    >
                      {opt.key}. {opt.text}
                    </div>
                  ))}
                </div>
                {q.explanation && (
                  <p className="text-xs text-muted-foreground pt-1 border-t">ব্যাখ্যা: {q.explanation}</p>
                )}
              </CardContent>
            </Card>
          );
        })}

        <Button className="w-full" onClick={() => navigate("/dashboard/readymade/subject-paper-final")}>
          আরেকটি পরীক্ষা দিন
        </Button>
      </div>
    );
  }

  const q = questions[currentIndex];

  return (
    <div className="space-y-3 pb-24">
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur pb-2 pt-1 space-y-1.5 border-b">
        <p className="text-sm font-semibold truncate">{itemName} — {MODE_LABELS[mode] || mode}</p>
        <p className="text-xs text-muted-foreground">উত্তর দেওয়া হয়েছে: {answeredCount}/{questions.length}</p>
        <Progress value={(answeredCount / questions.length) * 100} className="h-1.5" />
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="font-medium">{currentIndex + 1}. {q.question_text}</p>
          <div className="space-y-2">
            {options(q).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setAnswers((prev) => ({ ...prev, [currentIndex]: opt.key }))}
                className={`w-full text-left text-sm px-3 py-2.5 rounded-lg border flex items-center gap-2 transition-colors ${
                  answers[currentIndex] === opt.key
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/40"
                }`}
              >
                {answers[currentIndex] === opt.key ? (
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <span>{opt.key}. {opt.text}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          disabled={currentIndex === 0}
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
        >
          আগের প্রশ্ন
        </Button>
        {currentIndex < questions.length - 1 ? (
          <Button className="flex-1" onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}>
            পরের প্রশ্ন
          </Button>
        ) : (
          <Button className="flex-1" onClick={handleSubmit}>
            জমা দিন
          </Button>
        )}
      </div>

      <div className="grid grid-cols-8 sm:grid-cols-10 gap-1.5 pt-2">
        {questions.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setCurrentIndex(i)}
            className={`h-8 rounded-md text-xs font-medium border ${
              i === currentIndex
                ? "border-primary bg-primary text-primary-foreground"
                : answers[i]
                  ? "border-green-500/50 bg-green-500/10"
                  : "border-border"
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TakeSpFinalExam;
