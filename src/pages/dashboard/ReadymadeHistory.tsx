import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowLeft, Sparkles, LayoutTemplate, FileDown } from "lucide-react";

type HistoryTab = "custom" | "sp_final" | "model_test";

const MODE_LABELS: Record<string, string> = {
  medical_standard: "Medical Standard",
  standard_hard: "Standard+Hard",
  super_hard: "Super Hard",
};
const CATEGORY_LABELS: Record<string, string> = {
  subject_final: "Subject Final",
  paper_final: "Paper Final",
};

const formatDateTime = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.toLocaleDateString()} · ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
};

/** Standalone history page reachable from the Readymade page header's "Your
 *  History" button. Three tabs, one per exam-creation flow that doesn't
 *  already have its own history surface: Custom Exam (student-built via
 *  CustomExamBuilder), Subject/Paper Final, and Model Test (admission test).
 *  Cards follow the same visual language as the existing Exam & Class
 *  History tab's cards, minus the Leaderboard button (not meaningful for
 *  these three types since they're personal/random-pool attempts). */
const ReadymadeHistory = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState<HistoryTab>("custom");

  const { data: customAttempts, isLoading: customLoading } = useQuery({
    queryKey: ["history-custom-attempts", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("exam_attempts")
        .select("*, exam:exams(*)")
        .eq("profile_id", user.id)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return (data || []).filter(
        (a: any) => a.exam && a.exam.chapter === "Custom" && a.exam.exam_type === "practice" && a.exam.is_readymade === false
      );
    },
    enabled: !!user && tab === "custom",
  });

  const { data: spFinalAttempts, isLoading: spFinalLoading } = useQuery({
    queryKey: ["history-sp-final-attempts", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("sp_final_attempts" as any)
        .select("*")
        .eq("profile_id", user.id)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!user && tab === "sp_final",
  });

  const { data: modelTestAttempts, isLoading: modelTestLoading } = useQuery({
    queryKey: ["history-model-test-attempts", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("admission_test_attempts" as any)
        .select("*, admission_test:admission_tests(title)")
        .eq("profile_id", user.id)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!user && tab === "model_test",
  });

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/readymade")} className="pl-0 h-8">
        <ArrowLeft className="mr-2 h-4 w-4" /> Readymade Exam
      </Button>
      <h1 className="text-xl font-bold">Your History</h1>

      <div className="grid grid-cols-3 gap-2">
        <Button
          size="sm"
          variant={tab === "custom" ? "default" : "outline"}
          className="h-auto py-2 flex-col gap-1 text-[11px]"
          onClick={() => setTab("custom")}
        >
          <Sparkles className="h-4 w-4" /> Custom Exam
        </Button>
        <Button
          size="sm"
          variant={tab === "sp_final" ? "default" : "outline"}
          className="h-auto py-2 flex-col gap-1 text-[11px]"
          onClick={() => setTab("sp_final")}
        >
          <LayoutTemplate className="h-4 w-4" /> Subject/Paper Final
        </Button>
        <Button
          size="sm"
          variant={tab === "model_test" ? "default" : "outline"}
          className="h-auto py-2 flex-col gap-1 text-[11px]"
          onClick={() => setTab("model_test")}
        >
          <FileDown className="h-4 w-4" /> Model Test
        </Button>
      </div>

      {tab === "custom" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {customLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {customAttempts?.length === 0 && <p className="text-sm text-muted-foreground">এখনো কোনো Custom Exam attempt নেই।</p>}
          {customAttempts?.map((attempt: any) => {
            const percentage = attempt.exam.total_marks > 0 ? ((Number(attempt.score) / Number(attempt.exam.total_marks)) * 100).toFixed(1) : null;
            return (
              <Card key={attempt.id} className="border rounded-2xl shadow-sm hover:shadow-md transition-all">
                <CardHeader className="space-y-0.5 p-3 pb-2">
                  <CardTitle className="text-sm leading-tight">{attempt.exam.title}</CardTitle>
                  <CardDescription className="text-[11px] leading-snug">
                    <div>Score: <span className="font-bold text-foreground">{attempt.score}</span> / {attempt.exam.total_marks} {percentage && <span className="text-muted-foreground">({percentage}%)</span>}</div>
                    <div className="text-muted-foreground">{formatDateTime(attempt.submitted_at)}</div>
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <div className="grid grid-cols-3 gap-1.5">
                    <Button size="sm" className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white border-none text-[10px] h-8 px-1 leading-tight whitespace-pre-line" onClick={() => navigate(`/dashboard/exam-review/${attempt.id}`)}>
                      Result Detail
                    </Button>
                    <Button size="sm" className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white border-none text-[10px] h-8 px-1 leading-tight whitespace-pre-line" onClick={() => navigate(`/dashboard/take-exam/${attempt.exam.id}`)}>
                      Practice Again
                    </Button>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button size="sm" className="rounded-lg bg-amber-500 hover:bg-amber-600 text-white border-none text-[10px] h-8 px-1 leading-tight whitespace-pre-line">
                          Mistake Practice
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="center" className="w-56 p-1.5">
                        <button
                          onClick={() => navigate("/dashboard/take-mistakes", { state: { examIds: [attempt.exam.id], filterMode: "wrong" } })}
                          className="w-full text-left text-xs px-2.5 py-2 rounded-md hover:bg-muted"
                        >
                          Only Wrong
                        </button>
                        <button
                          onClick={() => navigate("/dashboard/take-mistakes", { state: { examIds: [attempt.exam.id], filterMode: "both" } })}
                          className="w-full text-left text-xs px-2.5 py-2 rounded-md hover:bg-muted"
                        >
                          Wrong + Skip
                        </button>
                      </PopoverContent>
                    </Popover>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {tab === "sp_final" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {spFinalLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {spFinalAttempts?.length === 0 && <p className="text-sm text-muted-foreground">এখনো কোনো Subject/Paper Final attempt নেই।</p>}
          {spFinalAttempts?.map((attempt: any) => {
            const percentage = attempt.total_questions > 0 ? ((attempt.correct_count / attempt.total_questions) * 100).toFixed(1) : null;
            return (
              <Card key={attempt.id} className="border rounded-2xl shadow-sm hover:shadow-md transition-all">
                <CardHeader className="space-y-0.5 p-3 pb-2">
                  <p className="text-[10px] font-mono uppercase text-muted-foreground truncate">
                    {CATEGORY_LABELS[attempt.category]} · {MODE_LABELS[attempt.mode]}
                  </p>
                  <CardTitle className="text-sm leading-tight">{attempt.item_name}</CardTitle>
                  <CardDescription className="text-[11px] leading-snug">
                    <div>Score: <span className="font-bold text-foreground">{attempt.correct_count}</span> / {attempt.total_questions} {percentage && <span className="text-muted-foreground">({percentage}%)</span>}</div>
                    <div className="text-muted-foreground">{formatDateTime(attempt.submitted_at)}</div>
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <Button
                    size="sm"
                    className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 text-white border-none text-[10px] h-8 px-1 leading-tight whitespace-pre-line"
                    onClick={() => navigate(`/dashboard/readymade/subject-paper-final/take?item=${attempt.item_id}&category=${attempt.category}&mode=${attempt.mode}&name=${encodeURIComponent(attempt.item_name)}`)}
                  >
                    Practice Again
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {tab === "model_test" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {modelTestLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {modelTestAttempts?.length === 0 && <p className="text-sm text-muted-foreground">এখনো কোনো Model Test attempt নেই।</p>}
          {modelTestAttempts?.map((attempt: any) => {
            const percentage = attempt.total_marks > 0 ? ((Number(attempt.score) / Number(attempt.total_marks)) * 100).toFixed(1) : null;
            return (
              <Card key={attempt.id} className="border rounded-2xl shadow-sm hover:shadow-md transition-all">
                <CardHeader className="space-y-0.5 p-3 pb-2">
                  <p className="text-[10px] font-mono uppercase text-muted-foreground truncate">{attempt.ref_name || attempt.mode}</p>
                  <CardTitle className="text-sm leading-tight">{attempt.admission_test?.title || "Model Test"}</CardTitle>
                  <CardDescription className="text-[11px] leading-snug">
                    <div>Score: <span className="font-bold text-foreground">{attempt.score}</span> / {attempt.total_marks} {percentage && <span className="text-muted-foreground">({percentage}%)</span>}</div>
                    <div className="text-muted-foreground">{formatDateTime(attempt.submitted_at)}</div>
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <Button
                    size="sm"
                    className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 text-white border-none text-[10px] h-8 px-1 leading-tight whitespace-pre-line"
                    onClick={() => navigate(`/dashboard/admission-test/play?testId=${attempt.admission_test_id}&mode=${attempt.mode}${attempt.ref_id ? `&refId=${attempt.ref_id}` : ""}`)}
                  >
                    Practice Again
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ReadymadeHistory;
