import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, CheckCircle2, Loader2 } from "lucide-react";
import MathText from "@/components/MathText";
import { useToast } from "@/hooks/use-toast";

const TakeMockTest = () => {
  const { mockExamId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);

  const { data: mockExam, isLoading: loadingExam } = useQuery({
    queryKey: ["mock-exam", mockExamId],
    queryFn: async () => {
      const { data, error } = await supabase.from("mock_exams").select("*").eq("id", mockExamId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!mockExamId,
  });

  const { data: questions, isLoading: loadingQuestions } = useQuery({
    queryKey: ["mock-exam-questions", mockExamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mock_exam_questions")
        .select("*")
        .eq("mock_exam_id", mockExamId)
        .order("question_index", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!mockExamId && started,
  });

  useEffect(() => {
    if (mockExam?.duration_minutes) setSecondsLeft(mockExam.duration_minutes * 60);
  }, [mockExam?.duration_minutes]);

  useEffect(() => {
    if (!started || submitted) return;
    if (secondsLeft <= 0) {
      handleSubmit();
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [started, secondsLeft, submitted]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      let score = 0;
      let total = 0;
      (questions || []).forEach((q: any) => {
        total += Number(q.marks) || 1;
        const given = answers[q.id];
        if (given) {
          if (given === q.correct_option) score += Number(q.marks) || 1;
          else score -= Number(mockExam?.negative_mark_per_question) || 0;
        }
      });
      if (user) {
        await supabase.from("mock_exam_attempts").insert({
          mock_exam_id: mockExamId,
          user_id: user.id,
          score,
          total_marks: total,
          answers,
          submitted_at: new Date().toISOString(),
        });
      }
      return { score, total };
    },
    onSuccess: (r) => {
      setResult(r);
      setSubmitted(true);
    },
    onError: (e: any) => toast({ title: "Submit failed", description: e.message, variant: "destructive" }),
  });

  const handleSubmit = () => {
    if (submitted) return;
    submitMutation.mutate();
  };

  const q = useMemo(() => (questions || [])[current], [questions, current]);

  if (loadingExam) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (!mockExam) {
    return <p className="text-center py-20 text-muted-foreground">Mock Test পাওয়া যায়নি।</p>;
  }

  if (!started) {
    return (
      <div className="max-w-lg mx-auto py-10 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>{mockExam.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> সময়: {mockExam.duration_minutes} মিনিট</p>
            {mockExam.instructions && <p className="text-muted-foreground">{mockExam.instructions}</p>}
            <Button className="w-full" onClick={() => setStarted(true)}>শুরু করুন</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted && result) {
    return (
      <div className="max-w-lg mx-auto py-10 space-y-4 text-center">
        <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
        <h2 className="text-xl font-bold">পরীক্ষা শেষ!</h2>
        <p className="text-2xl font-bold text-primary">{result.score} / {result.total}</p>
        <Button onClick={() => navigate("/mock-test")}>Mock Test তালিকায় ফিরে যান</Button>
      </div>
    );
  }

  if (loadingQuestions) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (!questions || questions.length === 0) {
    return <p className="text-center py-20 text-muted-foreground">এই Mock Test-এ এখনো কোনো প্রশ্ন যোগ করা হয়নি।</p>;
  }

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  return (
    <div className="max-w-2xl mx-auto py-6 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">প্রশ্ন {current + 1} / {questions.length}</span>
        <span className="text-sm font-mono font-bold text-primary">{mins}:{secs.toString().padStart(2, "0")}</span>
      </div>
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
        <Button variant="outline" disabled={current === 0} onClick={() => setCurrent((c) => c - 1)}>Prev</Button>
        {current < questions.length - 1 ? (
          <Button onClick={() => setCurrent((c) => c + 1)}>Next</Button>
        ) : (
          <Button onClick={handleSubmit} disabled={submitMutation.isPending}>Submit</Button>
        )}
      </div>
    </div>
  );
};

export default TakeMockTest;
