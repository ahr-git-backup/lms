import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueries } from "@tanstack/react-query";
import { Target, Loader2, ArrowLeft, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const DEFAULT_STANDARDS = [
  { value: "medical", label: "Medical" },
  { value: "varsity", label: "Varsity" },
  { value: "onushiloni", label: "Onushiloni" },
];
const COUNTS = [25, 35, 50, 75, 100];

const UnlimitedMockTest = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [topic, setTopic] = useState("");
  const [paper, setPaper] = useState("");
  const [standard, setStandard] = useState("medical");
  const [count, setCount] = useState(50);
  const [customCount, setCustomCount] = useState("");
  const [starting, setStarting] = useState(false);

  // Custom mood: drill-down multi-select (subject -> chapter -> topic), multi-pick at each level
  const [multiMode, setMultiMode] = useState(false);
  const [multiSubjects, setMultiSubjects] = useState<string[]>([]);
  const [multiDrillSubject, setMultiDrillSubject] = useState(""); // which subject's chapters are shown
  const [multiChapters, setMultiChapters] = useState<{ subject: string; chapter: string }[]>([]);
  const [multiDrillChapter, setMultiDrillChapter] = useState<{ subject: string; chapter: string } | null>(null);
  const [multiTopics, setMultiTopics] = useState<{ subject: string; chapter: string; topic: string }[]>([]);

  // Final selections used for building the exam = chapters chosen (topics further narrow within a chapter)
  const multiSelections = multiChapters;

  const toggleMultiSubject = (s: string) => {
    setMultiSubjects((prev) => {
      const exists = prev.includes(s);
      if (exists) {
        setMultiChapters((c) => c.filter((x) => x.subject !== s));
        setMultiTopics((t) => t.filter((x) => x.subject !== s));
        if (multiDrillSubject === s) setMultiDrillSubject("");
        return prev.filter((x) => x !== s);
      }
      return [...prev, s];
    });
  };

  const toggleMultiChapter = (s: string, c: string) => {
    setMultiChapters((prev) => {
      const exists = prev.some((x) => x.subject === s && x.chapter === c);
      if (exists) {
        setMultiTopics((t) => t.filter((x) => !(x.subject === s && x.chapter === c)));
        return prev.filter((x) => !(x.subject === s && x.chapter === c));
      }
      return [...prev, { subject: s, chapter: c }];
    });
  };

  const toggleMultiTopic = (s: string, c: string, t: string) => {
    setMultiTopics((prev) => {
      const exists = prev.some((x) => x.subject === s && x.chapter === c && x.topic === t);
      if (exists) return prev.filter((x) => !(x.subject === s && x.chapter === c && x.topic === t));
      return [...prev, { subject: s, chapter: c, topic: t }];
    });
  };

  const { data: subjects } = useQuery({
    queryKey: ["mock-pool-subjects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("mock_question_pool").select("subject");
      if (error) throw error;
      return [...new Set((data || []).map((d: any) => d.subject))];
    },
  });

  const { data: standardsFromPool } = useQuery({
    queryKey: ["mock-pool-standards"],
    queryFn: async () => {
      const { data, error } = await supabase.from("mock_question_pool").select("standard");
      if (error) throw error;
      return [...new Set((data || []).map((d: any) => d.standard).filter(Boolean))] as string[];
    },
  });

  const STANDARDS = (() => {
    const map = new Map<string, { value: string; label: string }>();
    DEFAULT_STANDARDS.forEach((s) => map.set(s.value, s));
    (standardsFromPool || []).forEach((v) => {
      if (!map.has(v)) map.set(v, { value: v, label: v });
    });
    return Array.from(map.values());
  })();

  const { data: chapters } = useQuery({
    queryKey: ["mock-pool-chapters", subject],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mock_question_pool")
        .select("chapter")
        .eq("subject", subject);
      if (error) throw error;
      return [...new Set((data || []).map((d: any) => d.chapter))];
    },
    enabled: !!subject,
  });

  const { data: topics } = useQuery({
    queryKey: ["mock-pool-topics", subject, chapter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mock_question_pool")
        .select("topic")
        .eq("subject", subject)
        .eq("chapter", chapter);
      if (error) throw error;
      return [...new Set((data || []).map((d: any) => d.topic).filter(Boolean))];
    },
    enabled: !!subject && !!chapter,
  });

  const { data: papers } = useQuery({
    queryKey: ["mock-pool-papers", subject, chapter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mock_question_pool")
        .select("paper")
        .eq("subject", subject)
        .eq("chapter", chapter);
      if (error) throw error;
      return [...new Set((data || []).map((d: any) => d.paper).filter(Boolean))];
    },
    enabled: !!subject && !!chapter,
  });

  const multiSubjectChapterQueries = useQueries({
    queries: (multiSubjects || []).map((s) => ({
      queryKey: ["mock-pool-multi-drill-chapters", s],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("mock_question_pool")
          .select("chapter")
          .eq("subject", s);
        if (error) throw error;
        return [...new Set((data || []).map((d: any) => d.chapter))];
      },
      enabled: multiMode,
    })),
  });
  const multiSubjectChapters: Record<string, string[]> = {};
  multiSubjects.forEach((s, i) => {
    multiSubjectChapters[s] = multiSubjectChapterQueries[i]?.data || [];
  });

  const { data: multiDrillChapters } = useQuery({
    queryKey: ["mock-pool-multi-drill-chapters", multiDrillSubject],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mock_question_pool")
        .select("chapter")
        .eq("subject", multiDrillSubject);
      if (error) throw error;
      return [...new Set((data || []).map((d: any) => d.chapter))];
    },
    enabled: multiMode && !!multiDrillSubject,
  });

  const { data: multiDrillTopics } = useQuery({
    queryKey: ["mock-pool-multi-drill-topics", multiDrillChapter?.subject, multiDrillChapter?.chapter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mock_question_pool")
        .select("topic")
        .eq("subject", multiDrillChapter!.subject)
        .eq("chapter", multiDrillChapter!.chapter);
      if (error) throw error;
      return [...new Set((data || []).map((d: any) => d.topic).filter(Boolean))];
    },
    enabled: multiMode && !!multiDrillChapter,
  });

  const { data: multiAvailablePool } = useQuery({
    queryKey: ["mock-pool-multi-available-count", multiSelections, multiTopics, standard],
    queryFn: async () => {
      let total = 0;
      for (const sel of multiSelections) {
        const topicsForSel = multiTopics
          .filter((t) => t.subject === sel.subject && t.chapter === sel.chapter)
          .map((t) => t.topic);
        let q = supabase
          .from("mock_question_pool")
          .select("questions_json")
          .eq("subject", sel.subject)
          .eq("chapter", sel.chapter)
          .eq("standard", standard);
        if (topicsForSel.length > 0) q = q.in("topic", topicsForSel);
        const { data, error } = await q;
        if (error) throw error;
        (data || []).forEach((row: any) => {
          const qs = Array.isArray(row.questions_json) ? row.questions_json : [];
          total += qs.length;
        });
      }
      return total;
    },
    enabled: multiMode && multiSelections.length > 0,
  });

  const { data: availablePool } = useQuery({
    queryKey: ["mock-pool-available-count", subject, chapter, topic, paper, standard],
    queryFn: async () => {
      let q = supabase
        .from("mock_question_pool")
        .select("questions_json")
        .eq("subject", subject)
        .eq("chapter", chapter)
        .eq("standard", standard);
      if (topic) q = q.eq("topic", topic);
      if (paper) q = q.eq("paper", paper);
      const { data, error } = await q;
      if (error) throw error;
      let total = 0;
      (data || []).forEach((row: any) => {
        const qs = Array.isArray(row.questions_json) ? row.questions_json : [];
        total += qs.length;
      });
      return total;
    },
    enabled: !!subject && !!chapter,
  });

  const { data: globalTotals } = useQuery({
    queryKey: ["mock-pool-global-totals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mock_question_pool")
        .select("subject, chapter, questions_json");
      if (error) throw error;
      const subjectsSet = new Set<string>();
      const chaptersSet = new Set<string>();
      let totalMcq = 0;
      (data || []).forEach((row: any) => {
        subjectsSet.add(row.subject);
        chaptersSet.add(`${row.subject}__${row.chapter}`);
        const qs = Array.isArray(row.questions_json) ? row.questions_json : [];
        totalMcq += qs.length;
      });
      return { subjects: subjectsSet.size, chapters: chaptersSet.size, mcq: totalMcq };
    },
  });

  const buildAndStart = async (finalCount: number, finalMinutes?: number) => {
    if (multiMode) {
      if (multiSelections.length === 0) {
        toast({ title: "অন্তত একটি সাবজেক্ট/চ্যাপ্টার নির্বাচন করুন", variant: "destructive" });
        return;
      }
    } else if (!subject || !chapter) {
      toast({ title: "সাবজেক্ট ও চ্যাপ্টার নির্বাচন করুন", variant: "destructive" });
      return;
    }
    setStarting(true);
    try {
      let data: any[] = [];

      if (multiMode) {
        for (const sel of multiSelections) {
          const topicsForSel = multiTopics
            .filter((t) => t.subject === sel.subject && t.chapter === sel.chapter)
            .map((t) => t.topic);
          let q = supabase
            .from("mock_question_pool")
            .select("*")
            .eq("subject", sel.subject)
            .eq("chapter", sel.chapter)
            .eq("standard", standard);
          if (topicsForSel.length > 0) q = q.in("topic", topicsForSel);
          const { data: rows, error } = await q;
          if (error) throw error;
          if (rows) data = data.concat(rows);
        }
      } else {
        let q = supabase
          .from("mock_question_pool")
          .select("*")
          .eq("subject", subject)
          .eq("chapter", chapter)
          .eq("standard", standard);
        if (topic) q = q.eq("topic", topic);
        if (paper) q = q.eq("paper", paper);

        const { data: rows, error } = await q;
        if (error) throw error;
        data = rows || [];
      }

      if (!data || data.length === 0) {
        toast({ title: "প্রশ্ন পাওয়া যায়নি", variant: "destructive" });
        setStarting(false);
        return;
      }

      let all: any[] = [];
      data.forEach((row: any) => {
        const qs = Array.isArray(row.questions_json) ? row.questions_json : [];
        all = all.concat(qs);
      });

      if (all.length === 0) {
        toast({ title: "প্রশ্ন পাওয়া যায়নি", variant: "destructive" });
        setStarting(false);
        return;
      }

      all.sort(() => Math.random() - 0.5);
      const picked = all.slice(0, finalCount).map((qq: any, i: number) => ({
        id: qq.id ? String(qq.id) : `mock_${i}_${Date.now()}`,
        question_text: qq.question_text || qq.questions || "",
        option_a: qq.option_a || qq.option1 || "",
        option_b: qq.option_b || qq.option2 || "",
        option_c: qq.option_c || qq.option3 || "",
        option_d: qq.option_d || qq.option4 || "",
        option_e: qq.option_e || qq.option5 || "",
        correct_option:
          qq.correct_option ||
          (["A", "B", "C", "D", "E"][(Number(qq.answer) || 1) - 1] ?? "A"),
        explanation: qq.explanation || "",
      }));

      const time = finalMinutes || Math.ceil((finalCount * 30) / 60);
      const sessionId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const title = multiMode
        ? `${multiSelections.length} সাব-চ্যাপ্টার (Mixed Mock Test)`
        : `${subject} - ${chapter} (Mock Test)`;

      sessionStorage.setItem("unlimitedMockQuestions", JSON.stringify(picked));
      sessionStorage.setItem("unlimitedMockTitle", title);
      sessionStorage.setItem("unlimitedMockTime", String(time));
      sessionStorage.setItem("unlimitedMockSessionId", sessionId);
      sessionStorage.setItem("unlimitedMockSubject", multiMode ? "" : subject);
      sessionStorage.setItem("unlimitedMockChapter", multiMode ? "" : chapter);
      sessionStorage.setItem("unlimitedMockTopic", multiMode ? "" : (topic || ""));

      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      navigate("/mock-test/play");
    } catch (e: any) {
      toast({ title: "লোড করতে সমস্যা", description: e.message, variant: "destructive" });
    } finally {
      setStarting(false);
    }
  };

  const handleCustomStart = () => {
    const c = parseInt(customCount);
    if (!c || c < 1) {
      toast({ title: "প্রশ্ন সংখ্যা দিন", variant: "destructive" });
      return;
    }
    buildAndStart(c);
  };

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="h-9 w-9 rounded-full border-2 border-border flex items-center justify-center shrink-0 hover:border-primary/40 transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => navigate("/mock-test/history")}
            >
              <History className="h-4 w-4" />
              History
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-fuchsia-500/10 flex items-center justify-center shrink-0">
              <Target className="h-6 w-6 text-fuchsia-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold">আনলিমিটেড মক টেস্ট</h1>
              <p className="text-sm text-muted-foreground">
                সাবজেক্ট, চ্যাপ্টার বেছে নিয়ে র‍্যান্ডম প্রশ্নের টেস্ট দিন — যতবার খুশি।
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground mb-0.5">সাবজেক্ট</p>
              <p className="text-xs font-semibold truncate">{globalTotals?.subjects ?? "-"}</p>
            </div>
            <div className="min-w-0 border-x border-border px-1">
              <p className="text-[10px] text-muted-foreground mb-0.5">চ্যাপ্টার</p>
              <p className="text-xs font-semibold truncate">{globalTotals?.chapters ?? "-"}</p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground mb-0.5">মোট MCQ</p>
              <p className="text-xs font-semibold">{globalTotals?.mcq ?? "-"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">টেস্ট সেটআপ</CardTitle>
            <button
              type="button"
              onClick={() => {
                setMultiMode((v) => !v);
                setMultiSubjects([]);
                setMultiChapters([]);
                setMultiTopics([]);
                setMultiDrillSubject("");
                setMultiDrillChapter(null);
              }}
              className="flex items-center gap-2 shrink-0 text-xs font-semibold text-muted-foreground"
            >
              কাস্টম মুড
              <span
                className={`h-5 w-9 rounded-full relative transition-colors shrink-0 ${
                  multiMode ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    multiMode ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </span>
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {multiMode ? (
            <div className="space-y-4">
              <div>
                <Label className="mb-2 block">
                  সাবজেক্ট নির্বাচন করুন
                  {multiSelections.length > 0 && (
                    <span className="text-muted-foreground font-normal">
                      {" "}({multiSelections.length}টি চ্যাপ্টার নির্বাচিত
                      {multiAvailablePool != null ? `, মোট MCQ ${multiAvailablePool}` : ""})
                    </span>
                  )}
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {(subjects || []).map((s: string) => {
                    const checked = multiSubjects.includes(s);
                    return (
                      <div key={s} className="relative">
                        <button
                          type="button"
                          onClick={() => {
                            toggleMultiSubject(s);
                          }}
                          className={`w-full h-12 flex items-center justify-center rounded-lg border-2 px-2 text-xs font-semibold text-center truncate transition-all duration-150 active:scale-95 ${
                            checked
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:border-primary/40"
                          }`}
                        >
                          {s}
                        </button>
                        <input
                          type="checkbox"
                          checked={checked}
                          readOnly
                          className="absolute top-1 right-1 h-3.5 w-3.5 rounded border-2 border-border accent-primary pointer-events-none"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {multiSubjects.map((subj) => (
                <div key={subj}>
                  <Label className="mb-2 block">চ্যাপ্টার — {subj}</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(multiSubjectChapters[subj] || []).map((c: string) => {
                      const checked = multiChapters.some(
                        (x) => x.subject === subj && x.chapter === c
                      );
                      return (
                        <div key={c} className="relative">
                          <button
                            type="button"
                            onClick={() => {
                              toggleMultiChapter(subj, c);
                              setMultiDrillChapter(checked ? null : { subject: subj, chapter: c });
                            }}
                            className={`w-full h-12 flex items-center justify-center rounded-lg border-2 px-2 text-xs font-semibold text-center truncate transition-all duration-150 active:scale-95 ${
                              checked
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:border-primary/40"
                            }`}
                          >
                            {c}
                          </button>
                          <input
                            type="checkbox"
                            checked={checked}
                            readOnly
                            className="absolute top-1 right-1 h-3.5 w-3.5 rounded border-2 border-border accent-primary pointer-events-none"
                          />
                        </div>
                      );
                    })}
                    {!(multiSubjectChapters[subj] || []).length && (
                      <p className="col-span-3 text-xs text-muted-foreground text-center py-3">লোড হচ্ছে...</p>
                    )}
                  </div>
                </div>
              ))}

              {multiDrillChapter && (
                <div>
                  <Label className="mb-2 block">টপিক — {multiDrillChapter.chapter}</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(multiDrillTopics || []).map((t: string) => {
                      const checked = multiTopics.some(
                        (x) =>
                          x.subject === multiDrillChapter.subject &&
                          x.chapter === multiDrillChapter.chapter &&
                          x.topic === t
                      );
                      return (
                        <div key={t} className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              toggleMultiTopic(multiDrillChapter.subject, multiDrillChapter.chapter, t)
                            }
                            className={`w-full h-12 flex items-center justify-center rounded-lg border-2 px-2 text-xs font-semibold text-center truncate transition-all duration-150 active:scale-95 ${
                              checked
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:border-primary/40"
                            }`}
                          >
                            {t}
                          </button>
                          <input
                            type="checkbox"
                            checked={checked}
                            readOnly
                            className="absolute top-1 right-1 h-3.5 w-3.5 rounded border-2 border-border accent-primary pointer-events-none"
                          />
                        </div>
                      );
                    })}
                    {!(multiDrillTopics || []).length && (
                      <p className="col-span-3 text-xs text-muted-foreground text-center py-3">
                        এই চ্যাপ্টারে কোনো টপিক নেই — পুরো চ্যাপ্টার থেকে প্রশ্ন আসবে
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
          <div>
            <Label className="mb-2 block">সাবজেক্ট</Label>
            <div className="grid grid-cols-2 gap-2">
              {(subjects || []).map((s: string) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    if (subject === s) {
                      setSubject("");
                    } else {
                      setSubject(s);
                    }
                    setChapter("");
                    setTopic("");
                    setPaper("");
                  }}
                  className={`w-full rounded-xl border-2 px-1.5 py-1.5 text-lg font-bold text-center whitespace-nowrap overflow-hidden transition-colors ${
                    subject === s
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                  style={{ fontSize: "clamp(0.75rem, 5.5vw, 1.25rem)" }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          )}

          {!multiMode && subject && (
            <div>
              <Label className="mb-2 block">চ্যাপ্টার</Label>
              <div className="grid grid-cols-2 gap-2">
                {(chapters || []).map((c: string) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      if (chapter === c) {
                        setChapter("");
                      } else {
                        setChapter(c);
                      }
                      setTopic("");
                      setPaper("");
                    }}
                    className={`w-full rounded-xl border-2 px-1.5 py-1.5 text-lg font-bold text-center whitespace-nowrap overflow-hidden transition-colors ${
                      chapter === c
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    }`}
                    style={{ fontSize: "clamp(0.75rem, 5.5vw, 1.25rem)" }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!multiMode && subject && chapter && !!(topics || []).length && (
            <div>
              <Label className="mb-2 block">টপিক (ঐচ্ছিক)</Label>
              <div className="grid grid-cols-3 gap-2">
                {(topics || []).map((t: string) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTopic(topic === t ? "" : t)}
                    className={`rounded-xl border-2 px-2 py-3 text-xs font-semibold text-center break-words transition-colors ${
                      topic === t
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!multiMode && subject && chapter && !!(papers || []).length && (
            <div>
              <Label className="mb-2 block">পেপার (ঐচ্ছিক)</Label>
              <div className="grid grid-cols-3 gap-2">
                {(papers || []).map((p: string) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPaper(paper === p ? "" : p)}
                    className={`rounded-xl border-2 px-2 py-3 text-xs font-semibold text-center break-words transition-colors ${
                      paper === p
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label className="mb-2 block">স্ট্যান্ডার্ড</Label>
            <div className="flex gap-2 flex-wrap">
              {STANDARDS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStandard(s.value)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border-2 transition-colors ${
                    standard === s.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-2 block">
              প্রশ্ন সংখ্যা
              {!multiMode && subject && chapter && availablePool != null && (
                <span className="text-muted-foreground font-normal"> (available {availablePool})</span>
              )}
              {multiMode && multiAvailablePool != null && (
                <span className="text-muted-foreground font-normal"> (available {multiAvailablePool})</span>
              )}
            </Label>
            <div className="flex gap-2 flex-wrap">
              {COUNTS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCount(c)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border-2 transition-colors ${
                    count === c
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <Card className="bg-muted/40">
            <CardContent className="pt-4 space-y-2">
              <Label className="text-xs text-primary font-semibold">কাস্টম সেটিং</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={5}
                  max={200}
                  placeholder="প্রশ্ন সংখ্যা"
                  value={customCount}
                  onChange={(e) => setCustomCount(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleCustomStart} disabled={starting}>
                  Start
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                প্রতি প্রশ্নে ৩০ সেকেন্ড করে সময় অটো ক্যালকুলেট হবে
              </p>
            </CardContent>
          </Card>

          <Button
            className="w-full"
            size="lg"
            onClick={() => buildAndStart(count)}
            disabled={starting || (multiMode && multiSelections.length === 0)}
          >
            {starting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            এক্সাম শুরু করুন
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default UnlimitedMockTest;
