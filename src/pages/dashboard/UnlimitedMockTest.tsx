import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Target, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
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

type Step = "subject" | "chapter" | "topic" | "setup";

const UnlimitedMockTest = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("subject");

  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [topic, setTopic] = useState("");
  const [paper, setPaper] = useState("");
  const [standard, setStandard] = useState("medical");
  const [count, setCount] = useState(50);
  const [customCount, setCustomCount] = useState("");
  const [customMinutes, setCustomMinutes] = useState("");
  const [starting, setStarting] = useState(false);

  const { data: subjects, isLoading: loadingSubjects } = useQuery({
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

  const { data: chapters, isLoading: loadingChapters } = useQuery({
    queryKey: ["mock-pool-chapters", subject],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mock_question_pool")
        .select("chapter")
        .eq("subject", subject);
      if (error) throw error;
      return [...new Set((data || []).map((d: any) => d.chapter))];
    },
    enabled: !!subject && step === "chapter",
  });

  const { data: topics, isLoading: loadingTopics } = useQuery({
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
    enabled: !!subject && !!chapter && step === "topic",
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
    enabled: !!subject && !!chapter && step === "setup",
  });

  const goBack = () => {
    if (step === "setup") {
      if ((topics || []).length > 0) setStep("topic");
      else setStep("chapter");
    } else if (step === "topic") setStep("chapter");
    else if (step === "chapter") setStep("subject");
  };

  const buildAndStart = async (finalCount: number, finalMinutes?: number) => {
    if (!subject || !chapter) {
      toast({ title: "সাবজেক্ট ও চ্যাপ্টার নির্বাচন করুন", variant: "destructive" });
      return;
    }
    setStarting(true);
    try {
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

      const time = finalMinutes || Math.ceil(finalCount / 1.5);
      const sessionId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      sessionStorage.setItem("unlimitedMockQuestions", JSON.stringify(picked));
      sessionStorage.setItem(
        "unlimitedMockTitle",
        `${subject} - ${chapter} (Mock Test)`
      );
      sessionStorage.setItem("unlimitedMockTime", String(time));
      sessionStorage.setItem("unlimitedMockSessionId", sessionId);

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
    const mins = parseInt(customMinutes) || undefined;
    buildAndStart(c, mins);
  };

  return (
    <div className="space-y-6 max-w-lg mx-auto">
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
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          {step !== "subject" && (
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={goBack}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground overflow-x-auto whitespace-nowrap flex-1">
            <span
              className={`cursor-pointer hover:text-foreground ${step === "subject" ? "text-foreground font-semibold" : ""}`}
              onClick={() => setStep("subject")}
            >
              সাবজেক্ট
            </span>
            {subject && (
              <>
                <ChevronRight className="h-3 w-3 shrink-0" />
                <span
                  className={`cursor-pointer hover:text-foreground ${step === "chapter" ? "text-foreground font-semibold" : ""}`}
                  onClick={() => setStep("chapter")}
                >
                  {subject}
                </span>
              </>
            )}
            {chapter && (
              <>
                <ChevronRight className="h-3 w-3 shrink-0" />
                <span
                  className={`cursor-pointer hover:text-foreground ${step === "topic" ? "text-foreground font-semibold" : ""}`}
                  onClick={() => setStep("topic")}
                >
                  {chapter}
                </span>
              </>
            )}
            {step === "setup" && topic && (
              <>
                <ChevronRight className="h-3 w-3 shrink-0" />
                <span className="text-foreground font-semibold">{topic}</span>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Step 1: Subject */}
          {step === "subject" && (
            <div>
              <Label className="mb-2 block">সাবজেক্ট বেছে নিন</Label>
              {loadingSubjects ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (subjects || []).length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">কোনো সাবজেক্ট পাওয়া যায়নি।</div>
              ) : (
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
                        setStep("chapter");
                      }}
                      className="rounded-xl border-2 px-2 py-3 text-xs font-semibold text-center transition-colors border-border text-muted-foreground hover:border-primary/40 hover:text-primary"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Chapter */}
          {step === "chapter" && (
            <div>
              <Label className="mb-2 block">চ্যাপ্টার বেছে নিন</Label>
              {loadingChapters ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (chapters || []).length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">এই সাবজেক্টে কোনো চ্যাপ্টার পাওয়া যায়নি।</div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {(chapters || []).map((c: string) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setChapter(c);
                        setTopic("");
                        setPaper("");
                        setStep("topic");
                      }}
                      className="rounded-xl border-2 px-2 py-3 text-xs font-semibold text-center transition-colors border-border text-muted-foreground hover:border-primary/40 hover:text-primary"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Topic (skip available if none / not needed) */}
          {step === "topic" && (
            <div>
              <Label className="mb-2 block">টপিক বেছে নিন</Label>
              {loadingTopics ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (topics || []).length === 0 ? (
                <div className="space-y-3">
                  <div className="text-center py-6 text-muted-foreground text-sm">এই চ্যাপ্টারে আলাদা টপিক নেই।</div>
                  <Button className="w-full" onClick={() => { setTopic(""); setStep("setup"); }}>
                    পরবর্তী ধাপে যান
                  </Button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {(topics || []).map((t: string) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          setTopic(t);
                          setStep("setup");
                        }}
                        className="rounded-xl border-2 px-2 py-3 text-xs font-semibold text-center transition-colors border-border text-muted-foreground hover:border-primary/40 hover:text-primary"
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    className="w-full mt-3"
                    onClick={() => {
                      setTopic("");
                      setStep("setup");
                    }}
                  >
                    সব টপিক (স্কিপ করুন)
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Step 4: Setup — paper, standard, count, custom, start */}
          {step === "setup" && (
            <>
              {!!(papers || []).length && (
                <div>
                  <Label className="mb-2 block">পেপার (ঐচ্ছিক)</Label>
                  <div className="flex gap-2 flex-wrap">
                    {(papers || []).map((p: string) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPaper(paper === p ? "" : p)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border-2 transition-colors ${
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
                <Label className="mb-2 block">প্রশ্ন সংখ্যা</Label>
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
                  <div className="flex gap-2 flex-wrap">
                    <Input
                      type="number"
                      min={5}
                      max={200}
                      placeholder="প্রশ্ন সংখ্যা"
                      value={customCount}
                      onChange={(e) => setCustomCount(e.target.value)}
                      className="flex-1 min-w-[120px]"
                    />
                    <Input
                      type="number"
                      min={1}
                      max={300}
                      placeholder="মিনিট (ফাঁকা=auto)"
                      value={customMinutes}
                      onChange={(e) => setCustomMinutes(e.target.value)}
                      className="flex-1 min-w-[120px]"
                    />
                    <Button onClick={handleCustomStart} disabled={starting}>
                      শুরু
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    মিনিট ফাঁকা রাখলে: প্রশ্ন÷1.5 = সময়
                  </p>
                </CardContent>
              </Card>

              <Button
                className="w-full"
                size="lg"
                onClick={() => buildAndStart(count)}
                disabled={starting}
              >
                {starting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                এক্সাম শুরু করুন
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UnlimitedMockTest;
