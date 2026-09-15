import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueries } from "@tanstack/react-query";
import { Target, Loader2, ArrowLeft, History, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const DEFAULT_STANDARDS = [
  { value: "medical", label: "Medical" },
  { value: "varsity", label: "Varsity" },
  { value: "onushiloni", label: "Onushiloni" },
];
const COUNTS = [25, 35, 50, 75, 100];

type ChapterSel = { subject: string; chapter: string };
type TopicSel = { subject: string; chapter: string; topic: string };

const UnlimitedMockTest = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [standard, setStandard] = useState("medical");
  const [count, setCount] = useState(50);
  const [customCount, setCustomCount] = useState("");
  const [starting, setStarting] = useState(false);
  const [openSubject, setOpenSubject] = useState(""); // which subject's accordion panel is expanded
  const [setupOpen, setSetupOpen] = useState(false); // popup for standard + count before starting

  // Unified checkbox-based selection: user can check any chapters across any
  // subjects, mixed freely. Checking a chapter also selects it as "whole
  // chapter"; optionally narrow further by checking specific topics under it.
  const [selectedChapters, setSelectedChapters] = useState<ChapterSel[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<TopicSel[]>([]);

  const toggleChapter = (s: string, c: string) => {
    setSelectedChapters((prev) => {
      const exists = prev.some((x) => x.subject === s && x.chapter === c);
      if (exists) {
        setSelectedTopics((t) => t.filter((x) => !(x.subject === s && x.chapter === c)));
        return prev.filter((x) => !(x.subject === s && x.chapter === c));
      }
      return [...prev, { subject: s, chapter: c }];
    });
  };

  const toggleTopic = (s: string, c: string, t: string) => {
    setSelectedTopics((prev) => {
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

  const { data: subjectTotals } = useQuery({
    queryKey: ["mock-pool-subject-totals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("mock_question_pool").select("subject, questions_json");
      if (error) throw error;
      const totals: Record<string, number> = {};
      (data || []).forEach((row: any) => {
        const qs = Array.isArray(row.questions_json) ? row.questions_json : [];
        totals[row.subject] = (totals[row.subject] || 0) + qs.length;
      });
      return totals;
    },
  });

  // Chapters + per-chapter totals for every subject (fetched once per subject expansion).
  const chapterQueries = useQueries({
    queries: (subjects || []).map((s) => ({
      queryKey: ["mock-pool-chapters-totals", s],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("mock_question_pool")
          .select("chapter, questions_json")
          .eq("subject", s);
        if (error) throw error;
        const totals: Record<string, number> = {};
        (data || []).forEach((row: any) => {
          const qs = Array.isArray(row.questions_json) ? row.questions_json : [];
          totals[row.chapter] = (totals[row.chapter] || 0) + qs.length;
        });
        return totals;
      },
      enabled: openSubject === s,
    })),
  });
  const chapterTotalsBySubject: Record<string, Record<string, number>> = {};
  (subjects || []).forEach((s, i) => {
    chapterTotalsBySubject[s] = chapterQueries[i]?.data || {};
  });

  // Topics for whichever chapter is currently expanded for topic-narrowing.
  const [openChapter, setOpenChapter] = useState<ChapterSel | null>(null);
  const { data: openChapterTopics } = useQuery({
    queryKey: ["mock-pool-topics", openChapter?.subject, openChapter?.chapter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mock_question_pool")
        .select("topic")
        .eq("subject", openChapter!.subject)
        .eq("chapter", openChapter!.chapter);
      if (error) throw error;
      return [...new Set((data || []).map((d: any) => d.topic).filter(Boolean))];
    },
    enabled: !!openChapter,
  });

  const { data: availablePool } = useQuery({
    queryKey: ["mock-pool-available-count", selectedChapters, selectedTopics, standard],
    queryFn: async () => {
      let total = 0;
      for (const sel of selectedChapters) {
        const topicsForSel = selectedTopics
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
    enabled: selectedChapters.length > 0,
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
    if (selectedChapters.length === 0) {
      toast({ title: "অন্তত একটি চ্যাপ্টার নির্বাচন করুন", variant: "destructive" });
      return;
    }
    setStarting(true);
    try {
      let data: any[] = [];

      for (const sel of selectedChapters) {
        const topicsForSel = selectedTopics
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

      const subjectNames = Array.from(new Set(selectedChapters.map((s) => s.subject)));
      const title =
        selectedChapters.length === 1
          ? `${selectedChapters[0].subject} - ${selectedChapters[0].chapter} (Mock Test)`
          : `${selectedChapters.length} চ্যাপ্টার (Mixed Mock Test)`;

      sessionStorage.setItem("unlimitedMockQuestions", JSON.stringify(picked));
      sessionStorage.setItem("unlimitedMockTitle", title);
      sessionStorage.setItem("unlimitedMockTime", String(time));
      sessionStorage.setItem("unlimitedMockSessionId", sessionId);
      sessionStorage.setItem("unlimitedMockSubject", subjectNames.join(", "));
      sessionStorage.setItem(
        "unlimitedMockChapter",
        selectedChapters.length === 1 ? selectedChapters[0].chapter : ""
      );
      sessionStorage.setItem(
        "unlimitedMockTopic",
        selectedChapters.length === 1
          ? selectedTopics
              .filter((t) => t.subject === selectedChapters[0].subject && t.chapter === selectedChapters[0].chapter)
              .map((t) => t.topic)
              .join(", ")
          : ""
      );

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
    <div className="space-y-2.5 max-w-lg mx-auto">
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => navigate(user ? "/dashboard" : "/")}
              className="h-9 w-9 rounded-full border-2 border-border flex items-center justify-center shrink-0 hover:border-primary/40 transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 min-w-0 flex-1 justify-center">
              <div className="h-10 w-10 rounded-2xl bg-fuchsia-500/10 flex items-center justify-center shrink-0">
                <Target className="h-5 w-5 text-fuchsia-600" />
              </div>
              <div className="min-w-0 text-left">
                <h1 className="text-base font-bold leading-tight truncate">আনলিমিটেড মক টেস্ট</h1>
                <p className="text-[11px] text-muted-foreground leading-tight line-clamp-2">
                  সাবজেক্ট, চ্যাপ্টার বেছে নিয়ে র‍্যান্ডম প্রশ্নের টেস্ট দিন — যতবার খুশি।
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="gap-1 shrink-0 px-2"
              onClick={() => navigate("/mock-test/history")}
            >
              <History className="h-4 w-4" />
              <span className="hidden xs:inline">History</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-3">
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
          <CardTitle className="text-base">টেস্ট সেটআপ</CardTitle>
          <p className="text-[11px] text-muted-foreground">
            চেকবক্স দিয়ে যেকোনো সাবজেক্ট/চ্যাপ্টার/টপিক বেছে নিন — একটি হোক বা একাধিক মিশিয়ে, ইচ্ছেমতো
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="mb-1 flex items-center justify-between">
              <span>সাবজেক্ট বেছে চ্যাপ্টার নির্বাচন করুন</span>
              {selectedChapters.length > 0 && (
                <span className="text-muted-foreground font-normal text-xs">
                  {selectedChapters.length}টি চ্যাপ্টার নির্বাচিত
                  {availablePool != null ? ` • মোট ${availablePool} MCQ` : ""}
                </span>
              )}
            </Label>
            <Accordion
              type="single"
              collapsible
              value={openSubject}
              onValueChange={(v) => setOpenSubject(v || "")}
              className="space-y-2"
            >
              {(subjects || []).map((s: string) => {
                const chapterTotals = chapterTotalsBySubject[s] || {};
                const chapterNames = Object.keys(chapterTotals);
                const subjectSelectedCount = selectedChapters.filter((x) => x.subject === s).length;
                return (
                  <AccordionItem
                    key={s}
                    value={s}
                    className="border-2 rounded-xl overflow-hidden border-border data-[state=open]:border-primary"
                  >
                    <AccordionTrigger className="px-3 py-2.5 hover:no-underline font-bold text-sm [&>svg]:hidden">
                      <div className="flex items-center justify-between w-full gap-2">
                        <span className="flex items-center gap-1.5">
                          {s}
                          {subjectSelectedCount > 0 && (
                            <span className="text-[10px] font-bold text-primary bg-primary/10 rounded-full px-1.5 py-0.5">
                              {subjectSelectedCount}
                            </span>
                          )}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] font-normal text-muted-foreground">
                            {subjectTotals?.[s] ?? "-"} MCQ
                          </span>
                          <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-3 pb-3 space-y-3">
                      <div>
                        <Label className="mb-2 block text-xs">চ্যাপ্টার (একাধিক বাছাই করা যাবে)</Label>
                        <div className="grid grid-cols-1 gap-1.5">
                          {chapterNames.map((c) => {
                            const checked = selectedChapters.some((x) => x.subject === s && x.chapter === c);
                            const isOpenForTopics = openChapter?.subject === s && openChapter?.chapter === c;
                            return (
                              <div key={c} className="space-y-1.5">
                                <div
                                  className={`flex items-center gap-2 rounded-lg border-2 px-2.5 py-2 transition-colors ${
                                    checked
                                      ? "border-primary bg-primary/10"
                                      : "border-border hover:border-primary/40"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleChapter(s, c)}
                                    className="h-4 w-4 rounded border-2 border-border accent-primary shrink-0"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => toggleChapter(s, c)}
                                    className={`flex-1 min-w-0 text-left text-xs font-semibold truncate ${
                                      checked ? "text-primary" : "text-muted-foreground dark:text-white"
                                    }`}
                                  >
                                    {c}
                                  </button>
                                  <span className="text-[9px] text-muted-foreground shrink-0">
                                    {chapterTotals[c] ?? "-"} MCQ
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setOpenChapter(isOpenForTopics ? null : { subject: s, chapter: c })}
                                    className={`text-[9px] font-semibold shrink-0 underline ${
                                      checked ? "text-primary" : "text-muted-foreground"
                                    }`}
                                  >
                                    টপিক
                                  </button>
                                </div>

                                {isOpenForTopics && (
                                  <div className="pl-6 pr-1">
                                    {(openChapterTopics || []).length > 0 ? (
                                      <div className="grid grid-cols-2 gap-1">
                                        {(openChapterTopics || []).map((t: string) => {
                                          const topicChecked = selectedTopics.some(
                                            (x) => x.subject === s && x.chapter === c && x.topic === t
                                          );
                                          return (
                                            <label
                                              key={t}
                                              className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-medium cursor-pointer ${
                                                topicChecked
                                                  ? "border-primary bg-primary/5 text-primary"
                                                  : "border-border text-muted-foreground"
                                              }`}
                                            >
                                              <input
                                                type="checkbox"
                                                checked={topicChecked}
                                                onChange={() => {
                                                  if (!checked) toggleChapter(s, c);
                                                  toggleTopic(s, c, t);
                                                }}
                                                className="h-3 w-3 rounded border accent-primary shrink-0"
                                              />
                                              <span className="truncate">{t}</span>
                                            </label>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <p className="text-[10px] text-muted-foreground py-1">
                                        এই চ্যাপ্টারে আলাদা টপিক নেই — পুরো চ্যাপ্টার থেকে প্রশ্ন আসবে
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {chapterNames.length === 0 && (
                            <p className="text-xs text-muted-foreground text-center py-2">লোড হচ্ছে...</p>
                          )}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        </CardContent>
      </Card>

      <div className="h-16" />

      <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur border-t border-border p-3">
        <div className="max-w-lg mx-auto">
          <Button
            className="w-full"
            size="lg"
            onClick={() => setSetupOpen(true)}
            disabled={selectedChapters.length === 0}
          >
            এক্সাম শুরু করুন
          </Button>
        </div>
      </div>

      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>টেস্ট সেটিং</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">স্ট্যান্ডার্ড</Label>
              <div className="grid grid-cols-3 gap-2">
                {STANDARDS.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setStandard(s.value)}
                    className={`px-2 py-2 rounded-lg text-xs font-semibold border-2 transition-colors text-center ${
                      standard === s.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground dark:text-white hover:border-primary/40"
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
                {availablePool != null && (
                  <span className="text-muted-foreground font-normal"> (available {availablePool})</span>
                )}
              </Label>
              <div className="flex gap-2 flex-wrap mb-2">
                {COUNTS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setCount(c);
                      setCustomCount("");
                    }}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border-2 transition-colors ${
                      count === c && !customCount
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground dark:text-white hover:border-primary/40"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Input
                  type="number"
                  min={5}
                  max={100}
                  placeholder="নিজে সংখ্যা লিখুন (সর্বোচ্চ ১০০)"
                  value={customCount}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCustomCount(v);
                    const n = parseInt(v);
                    if (n) setCount(Math.min(n, 100));
                  }}
                  className="dark:text-white"
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                প্রতি প্রশ্নে ৩০ সেকেন্ড করে সময় অটো ক্যালকুলেট হবে
              </p>
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={() => {
                setSetupOpen(false);
                buildAndStart(count);
              }}
              disabled={starting}
            >
              {starting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              এক্সাম শুরু করুন
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UnlimitedMockTest;
