import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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

  // Multi-select mood: allows picking multiple subject/chapter combos for one exam
  const [multiMode, setMultiMode] = useState(false);
  const [multiSelections, setMultiSelections] = useState<{ subject: string; chapter: string }[]>([]);

  const toggleMultiSelection = (s: string, c: string) => {
    setMultiSelections((prev) => {
      const exists = prev.some((x) => x.subject === s && x.chapter === c);
      if (exists) return prev.filter((x) => !(x.subject === s && x.chapter === c));
      return [...prev, { subject: s, chapter: c }];
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

  const { data: allSubjectChapterPairs } = useQuery({
    queryKey: ["mock-pool-all-pairs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mock_question_pool")
        .select("subject, chapter");
      if (error) throw error;
      const map = new Map<string, { subject: string; chapter: string }>();
      (data || []).forEach((d: any) => {
        const key = `${d.subject}||${d.chapter}`;
        if (!map.has(key)) map.set(key, { subject: d.subject, chapter: d.chapter });
      });
      return Array.from(map.values());
    },
    enabled: multiMode,
  });

  const { data: multiAvailablePool } = useQuery({
    queryKey: ["mock-pool-multi-available-count", multiSelections, standard],
    queryFn: async () => {
      let total = 0;
      for (const sel of multiSelections) {
        const { data, error } = await supabase
          .from("mock_question_pool")
          .select("questions_json")
          .eq("subject", sel.subject)
          .eq("chapter", sel.chapter)
          .eq("standard", standard);
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
          const { data: rows, error } = await supabase
            .from("mock_question_pool")
            .select("*")
            .eq("subject", sel.subject)
            .eq("chapter", sel.chapter)
            .eq("standard", standard);
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
              onClick={() => navigate(-1)}
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

      {(subject || chapter) && (
        <Card>
          <CardContent className="pt-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground mb-0.5">সাবজেক্ট</p>
                <p className="text-xs font-semibold truncate">{subject || "-"}</p>
              </div>
              <div className="min-w-0 border-x border-border px-1">
                <p className="text-[10px] text-muted-foreground mb-0.5">চ্যাপ্টার</p>
                <p className="text-xs font-semibold truncate">{chapter || "-"}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground mb-0.5">মোট MCQ</p>
                <p className="text-xs font-semibold">{availablePool ?? "-"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">টেস্ট সেটআপ</CardTitle>
            <button
              type="button"
              onClick={() => {
                setMultiMode((v) => !v);
                setMultiSelections([]);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-colors shrink-0 ${
                multiMode
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              <span
                className={`h-4 w-7 rounded-full relative transition-colors ${
                  multiMode ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${
                    multiMode ? "translate-x-3.5" : "translate-x-0.5"
                  }`}
                />
              </span>
              মাল্টি-সিলেক্ট
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {multiMode ? (
            <div>
              <Label className="mb-2 block">
                সাবজেক্ট/চ্যাপ্টার নির্বাচন করুন
                {multiSelections.length > 0 && (
                  <span className="text-muted-foreground font-normal">
                    {" "}({multiSelections.length}টি নির্বাচিত
                    {multiAvailablePool != null ? `, মোট MCQ ${multiAvailablePool}` : ""})
                  </span>
                )}
              </Label>
              <div className="space-y-1 max-h-80 overflow-y-auto rounded-xl border border-border p-2">
                {(allSubjectChapterPairs || []).map((pair) => {
                  const checked = multiSelections.some(
                    (x) => x.subject === pair.subject && x.chapter === pair.chapter
                  );
                  return (
                    <label
                      key={`${pair.subject}||${pair.chapter}`}
                      className={`flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer text-xs transition-colors ${
                        checked ? "bg-primary/10" : "hover:bg-muted/60"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMultiSelection(pair.subject, pair.chapter)}
                        className="h-4 w-4 rounded border-2 border-border accent-primary shrink-0"
                      />
                      <span className="font-semibold">{pair.subject}</span>
                      <span className="text-muted-foreground">— {pair.chapter}</span>
                    </label>
                  );
                })}
                {!(allSubjectChapterPairs || []).length && (
                  <p className="text-xs text-muted-foreground text-center py-3">লোড হচ্ছে...</p>
                )}
              </div>
            </div>
          ) : (
          <div>
            <Label className="mb-2 block">সাবজেক্ট</Label>
            <div className="grid grid-cols-3 gap-2">
              {(subjects || []).map((s: string) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setSubject(s);
                    setChapter("");
                    setTopic("");
                    setPaper("");
                  }}
                  className={`rounded-xl border-2 px-2 py-3 text-xs font-semibold text-center break-words transition-colors ${
                    subject === s
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
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
              <div className="grid grid-cols-3 gap-2">
                {(chapters || []).map((c: string) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setChapter(c);
                      setTopic("");
                      setPaper("");
                    }}
                    className={`rounded-xl border-2 px-2 py-3 text-xs font-semibold text-center break-words transition-colors ${
                      chapter === c
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    }`}
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
