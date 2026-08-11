import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Clock, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import MathText from "@/components/MathText";

type Mode = "subject_final" | "paper_final" | "full_model";

interface Q {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_e?: string | null;
  correct_option: string;
  marks: number;
  explanation?: string | null;
  _sliceLabel?: string;
}

export default function AdmissionTestPlay() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const mode = params.get("mode") as Mode;
  const refId = params.get("refId");
  const testId = params.get("testId")!;

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const { data: test } = useQuery({
    queryKey: ["admission-test-single", testId],
    queryFn: async () => {
      const { data, error } = await supabase.from("admission_tests" as any).select("*").eq("id", testId).single();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: questions, isLoading } = useQuery({
    queryKey: ["admission-test-questions", mode, refId, testId],
    queryFn: async () => {
      if (mode === "subject_final") {
        const { data, error } = await supabase.rpc("get_admission_subject_questions" as any, { p_subject_id: refId });
        if (error) throw error;
        return (data || []) as Q[];
      }
      if (mode === "paper_final") {
        const { data, error } = await supabase.rpc("get_admission_paper_questions" as any, { p_paper_id: refId });
        if (error) throw error;
        return (data || []) as Q[];
      }
      // full_model
      const { data, error } = await supabase.rpc("get_admission_full_model_questions" as any, { p_admission_test_id: testId });
      if (error) throw error;
      return ((data || []) as any[]).map((row) => ({ ...row.question, _sliceLabel: row.slice_subject_name })) as Q[];
    },
    enabled: !!testId && (mode === "full_model" || !!refId),
  });

  useEffect(() => {
    if (test?.duration_minutes && secondsLeft === null) {
      setSecondsLeft(test.duration_minutes * 60);
    }
  }, [test, secondsLeft]);

  useEffect(() => {
    if (submitted || secondsLeft === null) return;
    if (secondsLeft <= 0) { handleSubmit(); return; }
    const t = setTimeout(() => setSecondsLeft((s) => (s !== null ? s - 1 : s)), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, submitted]);

  const results = useMemo(() => {
    if (!questions) return null;
    let correct = 0, wrong = 0, skipped = 0, score = 0;
    const negPerQ = Number(test?.negative_mark_per_question || 0);
    for (const q of questions) {
      const sel = answers[q.id];
      const perQMark = Number(q.marks) || 1;
      if (!sel) { skipped++; continue; }
      if (sel.toUpperCase() === String(q.correct_option).toUpperCase()) { correct++; score += perQMark; }
      else { wrong++; score -= negPerQ; }
    }
    return { correct, wrong, skipped, score, total: questions.length };
  }, [questions, answers, test]);

  const handleSubmit = async () => {
    if (submitted) return;
    setSubmitted(true);
    if (user && questions) {
      await supabase.from("admission_test_attempts" as any).insert({
        admission_test_id: testId,
        profile_id: user.id,
        mode,
        ref_id: refId || null,
        ref_name: mode === "full_model" ? "Full Model Test" : (questions[0] as any)?._sliceLabel || null,
        question_ids: questions.map((q) => q.id),
        answers,
        score: results?.score ?? 0,
        total_marks: questions.reduce((s, q) => s + (Number(q.marks) || 1), 0),
        correct_count: results?.correct ?? 0,
        wrong_count: results?.wrong ?? 0,
        skipped_count: results?.skipped ?? 0,
        submitted_at: new Date().toISOString(),
      });
    }
  };

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!questions || questions.length === 0) {
    return (
      <div className="text-center py-20 space-y-3">
        <p className="text-muted-foreground">কোনো প্রশ্ন পাওয়া যায়নি। Admin কে source সেট করতে বলুন।</p>
        <Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
      </div>
    );
  }

  if (submitted && results) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/admission-test")}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-lg font-semibold">Result</h1>
        </div>
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="text-center">
              <p className="text-3xl font-extrabold text-primary">{results.score.toFixed(2)} / {questions.reduce((s, q) => s + (Number(q.marks) || 1), 0)}</p>
              <p className="text-xs text-muted-foreground uppercase font-bold mt-1">Marks Obtained</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-emerald-500/10 rounded-lg p-2"><p className="text-emerald-600 font-bold">{results.correct}</p><p className="text-[10px] text-muted-foreground">Correct</p></div>
              <div className="bg-red-500/10 rounded-lg p-2"><p className="text-red-500 font-bold">{results.wrong}</p><p className="text-[10px] text-muted-foreground">Wrong</p></div>
              <div className="bg-muted rounded-lg p-2"><p className="font-bold">{results.skipped}</p><p className="text-[10px] text-muted-foreground">Skipped</p></div>
            </div>
          </CardContent>
        </Card>
        <div className="space-y-3">
          {questions.map((q, i) => {
            const sel = answers[q.id];
            const isCorrect = sel && sel.toUpperCase() === String(q.correct_option).toUpperCase();
            return (
              <Card key={q.id}>
                <CardContent className="p-3 space-y-2">
                  <p className="text-sm font-medium flex gap-2"><span className="text-muted-foreground">{i + 1}.</span><MathText text={q.question_text} /></p>
                  <div className="flex items-center gap-2 text-xs">
                    {sel ? (isCorrect ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-red-500" />) : <Badge variant="secondary">Skipped</Badge>}
                    <span>আপনার উত্তর: {sel || "—"} | সঠিক: {q.correct_option}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  const q = questions[current];
  const opts = [
    { key: "A", text: q.option_a }, { key: "B", text: q.option_b },
    { key: "C", text: q.option_c }, { key: "D", text: q.option_d },
    ...(q.option_e ? [{ key: "E", text: q.option_e }] : []),
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        {secondsLeft !== null && (
          <Badge variant={secondsLeft < 60 ? "destructive" : "secondary"} className="gap-1">
            <Clock className="h-3.5 w-3.5" />{Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
          </Badge>
        )}
        <span className="text-xs text-muted-foreground">{current + 1}/{questions.length}</span>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          {q._sliceLabel && <Badge variant="outline">{q._sliceLabel}</Badge>}
          <p className="font-medium text-[15px] leading-relaxed"><MathText text={q.question_text} /></p>
          <div className="space-y-2">
            {opts.map((o) => (
              <button
                key={o.key}
                onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.key }))}
                className={`w-full text-left p-3 rounded-lg border text-sm transition-colors ${answers[q.id] === o.key ? "border-primary bg-primary/10" : "border-border hover:bg-accent"}`}
              >
                <span className="font-semibold mr-2">{o.key}.</span><MathText text={o.text} />
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button variant="outline" disabled={current === 0} onClick={() => setCurrent((c) => c - 1)} className="flex-1">আগের</Button>
        {current < questions.length - 1 ? (
          <Button onClick={() => setCurrent((c) => c + 1)} className="flex-1">পরের</Button>
        ) : (
          <Button onClick={handleSubmit} className="flex-1">Submit</Button>
        )}
      </div>

      <div className="grid grid-cols-8 gap-1.5">
        {questions.map((qq, i) => (
          <button
            key={qq.id}
            onClick={() => setCurrent(i)}
            className={`h-8 rounded text-xs font-medium ${i === current ? "bg-primary text-primary-foreground" : answers[qq.id] ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
