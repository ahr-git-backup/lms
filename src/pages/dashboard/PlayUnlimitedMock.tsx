import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import MathText from "@/components/MathText";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

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

const PlayUnlimitedMock = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

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

  const score = useMemo(() => {
    let s = 0;
    questions.forEach((q) => {
      if (answers[q.id] && answers[q.id] === q.correct_option) s += 1;
    });
    return s;
  }, [answers, questions, submitted]);

  const handleSubmit = async () => {
    if (submitted) return;
    setSubmitted(true);
    if (user) {
      try {
        await supabase.from("mock_exam_attempts").insert({
          mock_exam_id: null,
          user_id: user.id,
          score,
          total_marks: questions.length,
          answers,
          submitted_at: new Date().toISOString(),
        });
      } catch {
        // best-effort logging only
      }
    }
  };

  if (questions.length === 0) return null;

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto py-10 space-y-4 text-center">
        <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
        <h2 className="text-xl font-bold">পরীক্ষা শেষ!</h2>
        <p className="text-2xl font-bold text-primary">
          {score} / {questions.length}
        </p>
        <Button onClick={() => navigate("/dashboard/mock-test")}>আবার টেস্ট দিন</Button>
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
