import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Target, Loader2, ArrowLeft, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const DEFAULT_STANDARDS = [
  { value: "medical", label: "Medical" },
  { value: "varsity", label: "Varsity" },
  { value: "onushiloni", label: "Onushiloni" },
];

const SEC_PER_MCQ = 30;

const UnlimitedMockTest = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // multi-select mode toggle
  const [multiMode, setMultiMode] = useState(false);

  // single-select (legacy) state
  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [topic, setTopic] = useState("");
  const [paper, setPaper] = useState("");

  // multi-select state: map of subject -> Set(chapter) ; "" chapter key means whole subject
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(new Set());
  const [selectedChapters, setSelectedChapters] = useState<Set<string>>(new Set()); // stored as "subject::chapter"

  const [standard, setStandard] = useState("medical");
  const [customCount, setCustomCount] = useState("");
  const [starting, setStarting] = useState(false);

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

  // chapters for single-select mode
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
    enabled: !!subject && !multiMode,
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
    enabled: !!subject && !!chapter && !multiMode,
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
    enabled: !!subject && !!chapter && !multiMode,
  });

  // all chapters for all subjects, for multi-select mode
  const { data: allChaptersMap } = useQuery({
    queryKey: ["mock-pool-all-chapters"],
    queryFn: async () => {
      const { data, error } = await supabase.from("mock_question_pool").select("subject, chapter");
      if (error) throw error;
      const map: Record<string, Set<string>> = {};
      (data || []).forEach((d: any) => {
        if (!map[d.subject]) map[d.subject] = new Set();
        map[d.subject].add(d.chapter);
      });
      const out: Record<string, string[]> = {};
      Object.keys(map).forEach((k) => (out[k] = Array.from(map[k])));
      return out;
    },
    enabled: multiMode,
  });

  const toggleSubjectExpand = (s: string) => {
    setSelectedSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const toggleChapterSel = (subj: string, chap: string) => {
    const key = `${subj}::${chap}`;
    setSelectedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const buildAndStart = async (finalCount: number) => {
    setStarting(true);
    try {
      let all: any[] = [];
      let titleParts: string[] = [];

      if (multiMode) {
        if (selectedChapters.size === 0) {
          toast({ title: "কমপক্ষে একটি চ্যাপ্টার নির্বাচন করুন", variant: "destructive" });
          setStarting(false);
          return;
        }
        const bySubject: Record<string, string[]> = {};
        selectedChapters.forEach((key) => {
          const [subj, chap] = key.split("::");
          if (!bySubject[subj]) bySubject[subj] = [];
          bySubject[subj].push(chap);
        });

        for (const subj of Object.keys(bySubject)) {
          const { data, error } = await supabase
            .from("mock_question_pool")
            .select("*")
            .eq("subject", subj)
            .eq("standard", standard)
            .in("chapter", bySubject[subj]);
          if (error) throw error;
          (data || []).forEach((row: any) => {
            const qs = Array.isArray(row.questions_json) ? row.questions_json : [];
            all = all.concat(qs);
          });
          titleParts.push(subj);
        }
      } else {
        if (!subject || !chapter) {
          toast({ title: "সাবজেক্ট ও চ্যাপ্টার নির্বাচন করুন", variant: "destructive" });
          setStarting(false);
          return;
        }
        let q = supabase
          .from("mock_question_pool")
          .select("*")
          .eq("subject", subject)
          .eq("chapter", chapter)
          .eq("standard", standard);
        if (topic) q = q.eq("topic", topic);
        if (paper) q = q.eq("paper", paper);

        const { data, error } = await q;
        if (error) throw error;
        (data || []).forEach((row: any) => {
          const qs = Array.isArray(row.questions_json) ? row.questions_json : [];
          all = all.concat(qs);
        });
        titleParts.push(`${subject} - ${chapter}`);
      }

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

      const time = Math.ceil((picked.length * SEC_PER_MCQ) / 60);
      const sessionId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      sessionStorage.setItem("unlimitedMockQuestions", JSON.stringify(picked));
      sessionStorage.setItem("unlimitedMockTitle", `${titleParts.join(", ")} (Mock Test)`);
      sessionStorage.setItem("unlimitedMockTime", String(time));
      sessionStorage.setItem("unlimitedMockSessionId", sessionId);
      sessionStorage.setItem("unlimitedMockSubject", multiMode ? titleParts.join(", ") : subject);
      sessionStorage.setItem("unlimitedMockChapter", multiMode ? "" : chapter);
      sessionStorage.setItem("unlimitedMockTopic", multiMode ? "" : topic || "");

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

      <Card>
        <CardContent className="pt-4 flex items-center justify-between">
          <div>
            <Label className="font-semibold">কাস্টম মোড (একাধিক সাব/চ্যাপ্টার)</Label>
            <p className="text-[11px] text-muted-foreground">
              চালু করলে চেকবক্স দিয়ে একাধিক সাবজেক্ট/চ্যাপ্টার বেছে এক্সাম দেওয়া যাবে
            </p>
          </div>
          <Switch checked={multiMode} onCheckedChange={setMultiMode} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">টেস্ট সেটআপ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!multiMode && (
            <>
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
                      className={`rounded-xl border-2 px-2 py-3 text-xs font-semibold text-center whitespace-nowrap overflow-hidden text-ellipsis transition-colors ${
                        subject === s
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/40"
                      }`}
                      title={s}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {subject && (
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
                        className={`rounded-xl border-2 px-2 py-3 text-xs font-semibold text-center whitespace-nowrap overflow-hidden text-ellipsis transition-colors ${
                          chapter === c
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/40"
                        }`}
                        title={c}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {subject && chapter && !!(topics || []).length && (
                <div>
                  <Label className="mb-2 block">টপিক (ঐচ্ছিক)</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(topics || []).map((t: string) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTopic(topic === t ? "" : t)}
                        className={`rounded-xl border-2 px-2 py-3 text-xs font-semibold text-center whitespace-nowrap overflow-hidden text-ellipsis transition-colors ${
                          topic === t
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/40"
                        }`}
                        title={t}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {subject && chapter && !!(papers || []).length && (
                <div>
                  <Label className="mb-2 block">পেপার (ঐচ্ছিক)</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(papers || []).map((p: string) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPaper(paper === p ? "" : p)}
                        className={`rounded-xl border-2 px-2 py-3 text-xs font-semibold text-center whitespace-nowrap overflow-hidden text-ellipsis transition-colors ${
                          paper === p
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/40"
                        }`}
                        title={p}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {multiMode && (
            <div>
              <Label className="mb-2 block">সাবজেক্ট / চ্যাপ্টার নির্বাচন করুন</Label>
              <div className="space-y-2">
                {(subjects || []).map((s: string) => (
                  <div key={s} className="border-2 border-border rounded-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleSubjectExpand(s)}
                      className="w-full px-3 py-2 text-left text-sm font-semibold bg-muted/40 flex items-center justify-between"
                    >
                      <span className="whitespace-nowrap overflow-hidden text-ellipsis">{s}</span>
                      <span className="text-xs text-muted-foreground">
                        {selectedSubjects.has(s) ? "−" : "+"}
                      </span>
                    </button>
                    {selectedSubjects.has(s) && (
                      <div className="p-2 grid grid-cols-3 gap-2">
                        {(allChaptersMap?.[s] || []).map((c: string) => {
                          const key = `${s}::${c}`;
                          return (
                            <label
                              key={c}
                              className="flex items-center gap-1.5 rounded-lg border px-2 py-2 text-xs cursor-pointer"
                            >
                              <Checkbox
                                checked={selectedChapters.has(key)}
                                onCheckedChange={() => toggleChapterSel(s, c)}
                              />
                              <span
                                className="whitespace-nowrap overflow-hidden text-ellipsis"
                                title={c}
                              >
                                {c}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
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

          <Card className="bg-muted/40">
            <CardContent className="pt-4 space-y-2">
              <Label className="text-xs text-primary font-semibold">প্রশ্ন সংখ্যা দিন</Label>
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
                  {starting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Start
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                প্রতি প্রশ্নে {SEC_PER_MCQ} সেকেন্ড করে সময় (অটো ক্যালকুলেটেড)
              </p>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
};

export default UnlimitedMockTest;
