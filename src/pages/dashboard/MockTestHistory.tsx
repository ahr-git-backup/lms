import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, History as HistoryIcon, FileText, Loader2 } from "lucide-react";
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

const MockTestHistory = () => {
  const navigate = useNavigate();
  const { user } = useAuth() as any;
  const [activeSubject, setActiveSubject] = useState<string | null>(null);

  const { data: attempts, isLoading } = useQuery({
    queryKey: ["mock-exam-attempts-history", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mock_exam_attempts")
        .select("*")
        .eq("user_id", user.id)
        .not("submitted_at", "is", null)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Attempt[];
    },
    enabled: !!user,
  });

  const subjects = useMemo(() => {
    const set = new Set<string>();
    (attempts || []).forEach((a) => a.subject && set.add(a.subject));
    return Array.from(set);
  }, [attempts]);

  const filtered = useMemo(() => {
    if (!activeSubject) return attempts || [];
    return (attempts || []).filter((a) => a.subject === activeSubject);
  }, [attempts, activeSubject]);

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

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
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
          <p className="text-sm text-muted-foreground">সাবজেক্ট অনুযায়ী দেওয়া এক্সামগুলো দেখুন</p>
        </div>
      </div>

      {subjects.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveSubject(null)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border-2 transition-colors ${
              activeSubject === null
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/40"
            }`}
          >
            সব
          </button>
          {subjects.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setActiveSubject(s)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border-2 transition-colors ${
                activeSubject === s
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">কোনো এক্সাম দেওয়া হয়নি</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => (
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
