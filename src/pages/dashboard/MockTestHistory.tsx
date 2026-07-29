import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, History as HistoryIcon, FileText, Loader2, BookOpen, ChevronRight, Layers } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Attempt {
  id: string;
  subject: string | null;
  chapter: string | null;
  topic: string | null;
  title: string | null;
  session_id: string | null;
  score: number | null;
  total_marks: number | null;
  total_questions: number | null;
  answers: Record<string, string> | null;
  questions_snapshot: any[] | null;
  submitted_at: string | null;
}

type ViewLevel = "subjects" | "chapters" | "exams";

const MockTestHistory = () => {
  const navigate = useNavigate();
  const { user } = useAuth() as any;
  const [view, setView] = useState<ViewLevel>("subjects");
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [activeChapter, setActiveChapter] = useState<string | null>(null);

  const { data: attempts, isLoading } = useQuery({
    queryKey: ["mock-exam-attempts-history", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mock_exam_attempts")
        .select("*")
        .eq("user_id", user.id)
        .not("submitted_at", "is", null)
        .not("questions_snapshot", "is", null)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Attempt[];
    },
    enabled: !!user,
  });

  const grouped = useMemo(() => {
    const map = new Map<string, Map<string, Attempt[]>>();
    (attempts || []).forEach((a) => {
      const subj = a.subject || "সাধারণ";
      const chap = a.chapter || "সাধারণ অধ্যায়";
      if (!map.has(subj)) map.set(subj, new Map());
      const chapMap = map.get(subj)!;
      if (!chapMap.has(chap)) chapMap.set(chap, []);
      chapMap.get(chap)!.push(a);
    });
    return map;
  }, [attempts]);

  const subjectList = useMemo(() => Array.from(grouped.keys()), [grouped]);

  const chapterList = useMemo(() => {
    if (!activeSubject) return [];
    const chapMap = grouped.get(activeSubject);
    return chapMap ? Array.from(chapMap.keys()) : [];
  }, [grouped, activeSubject]);

  const examList = useMemo(() => {
    if (!activeSubject || !activeChapter) return [];
    return grouped.get(activeSubject)?.get(activeChapter) || [];
  }, [grouped, activeSubject, activeChapter]);

  const openResult = (a: Attempt) => {
    if (!a.session_id || !a.questions_snapshot) return;
    const prefix = `mock_attempt_${a.session_id}`;
    sessionStorage.setItem("unlimitedMockSessionId", a.session_id);
    sessionStorage.removeItem("unlimitedMockQuestions");
    localStorage.setItem(`${prefix}_questions_snapshot`, JSON.stringify(a.questions_snapshot));
    localStorage.setItem(`${prefix}_submitted`, "1");
    localStorage.setItem(`${prefix}_final_answers`, JSON.stringify(a.answers || {}));
    navigate("/mock-test/play");
  };

  const fmt = (iso: string | null) => {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleString("bn-BD", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const goBack = () => {
    if (view === "exams") {
      setView("chapters");
      setActiveChapter(null);
    } else if (view === "chapters") {
      setView("subjects");
      setActiveSubject(null);
    } else {
      navigate(-1);
    }
  };

  const openSubject = (s: string) => {
    setActiveSubject(s);
    setView("chapters");
  };

  const openChapter = (c: string) => {
    setActiveChapter(c);
    setView("exams");
  };

  const subjectCount = (s: string) => {
    let total = 0;
    grouped.get(s)?.forEach((arr) => (total += arr.length));
    return total;
  };

  const chapterCount = (c: string) => {
    if (!activeSubject) return 0;
    return grouped.get(activeSubject)?.get(c)?.length || 0;
  };

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={goBack}
          className="h-9 w-9 rounded-full border-2 border-border flex items-center justify-center shrink-0 hover:border-primary/40 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-fuchsia-500/10 flex items-center justify-center shrink-0">
          <HistoryIcon className="h-6 w-6 text-fuchsia-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold">মক টেস্ট হিস্টোরি</h1>
          <p className="text-sm text-muted-foreground">
            {view === "subjects" && "সাবজেক্ট বাছাই করুন"}
            {view === "chapters" && `${activeSubject} — অধ্যায় বাছাই করুন`}
            {view === "exams" && `${activeSubject} — ${activeChapter}`}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : subjectList.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">কোনো এক্সাম দেওয়া হয়নি</p>
      ) : view === "subjects" ? (
        <div className="grid grid-cols-2 gap-3">
          {subjectList.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => openSubject(s)}
              className="flex flex-col items-start gap-2 rounded-2xl border-2 border-border p-4 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors"
            >
              <div className="h-10 w-10 rounded-xl bg-fuchsia-500/10 flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-fuchsia-600" />
              </div>
              <p className="font-semibold text-sm leading-tight">{s}</p>
              <p className="text-xs text-muted-foreground">{subjectCount(s)}টি এক্সাম</p>
            </button>
          ))}
        </div>
      ) : view === "chapters" ? (
        <div className="space-y-2.5">
          {chapterList.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => openChapter(c)}
              className="w-full flex items-center justify-between gap-3 rounded-xl border-2 border-border p-3.5 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-fuchsia-500/10 flex items-center justify-center shrink-0">
                  <Layers className="h-4 w-4 text-fuchsia-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{c}</p>
                  <p className="text-xs text-muted-foreground">{chapterCount(c)}টি এক্সাম</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {examList.map((a) => (
            <Card key={a.id}>
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm">
                      {a.subject} {a.chapter ? `- ${a.chapter}` : ""}
                    </p>
                    {a.topic && <p className="text-xs text-muted-foreground">{a.topic}</p>}
                  </div>
                  <span className="text-xs font-semibold text-primary shrink-0">
                    {a.score != null ? a.score.toFixed(2) : "-"}/{a.total_marks ?? a.total_questions ?? "-"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{fmt(a.submitted_at)}</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full gap-1.5"
                  onClick={() => openResult(a)}
                  disabled={!a.questions_snapshot}
                >
                  <FileText className="h-3.5 w-3.5" />
                  Result Sheet
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default MockTestHistory;
