import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import { Target, Loader2, ArrowLeft, History, ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { fetchCached } from "@/lib/cacheProxy";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { getGuestInfo, GuestExamInfo } from "@/lib/guestExamInfo";
import GuestExamInfoDialog from "@/components/exam/GuestExamInfoDialog";
import MockPoolPositionManagerDialog from "@/components/admin/MockPoolPositionManagerDialog";
import { usePWADisplayMode } from "@/pwa/usePWADisplayMode";

const DEFAULT_STANDARDS = [
  { value: "medical", label: "Medical" },
  { value: "varsity", label: "Varsity" },
  { value: "onushiloni", label: "Onushiloni" },
];
const COUNTS = [25, 35, 50, 75, 100];

type ChapterSel = { subject: string; chapter: string };
type TopicSel = { subject: string; chapter: string; topic: string };

const DAILY_FREE_EXAM_LIMIT_KEY = "daily_free_exam_limit";

const AdminDailyLimitControl = ({ currentLimit }: { currentLimit: number | undefined }) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [value, setValue] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!touched && currentLimit !== undefined) {
      setValue(String(currentLimit));
    }
  }, [currentLimit, touched]);

  const handleSave = async () => {
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast({ title: "ভুল মান", description: "শূন্য বা তার বেশি একটি সংখ্যা দিন (০ = আনলিমিটেড)।", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: DAILY_FREE_EXAM_LIMIT_KEY, value: parsed, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) {
      toast({ title: "সেভ করা যায়নি", description: error.message, variant: "destructive" });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["mock-exam-daily-status"] });
    toast({ title: "সেভ হয়েছে", description: "দৈনিক ফ্রি এক্সাম লিমিট আপডেট হয়েছে।" });
  };

  return (
    <Card className="border-primary/30">
      <CardContent className="py-3 flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="daily_free_exam_limit" className="text-xs">Daily Free Exam Limit (Admin)</Label>
          <Input
            id="daily_free_exam_limit"
            type="number"
            min={0}
            placeholder="0 = unlimited"
            value={value}
            onChange={(e) => {
              setTouched(true);
              setValue(e.target.value);
            }}
            className="w-32 h-9"
          />
        </div>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </CardContent>
    </Card>
  );
};

const UnlimitedMockTest = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const isStandalone = usePWADisplayMode();
  const [guestInfo, setGuestInfoState] = useState<GuestExamInfo | null>(() => getGuestInfo());
  const [guestDialogOpen, setGuestDialogOpen] = useState(false);
  const [pendingStart, setPendingStart] = useState<{ count: number; minutes?: number } | null>(null);
  const [positionManagerOpen, setPositionManagerOpen] = useState(false);

  const { data: dailyStatus } = useQuery({
    queryKey: ["mock-exam-daily-status", user?.id, guestInfo?.phone],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("mock_exam_daily_status" as any, {
        p_user_id: user?.id ?? null,
        p_guest_phone: user ? null : guestInfo?.phone ?? null,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return {
        dailyLimit: row?.daily_limit ?? 0,
        todaysMockCount: row?.todays_count ?? 0,
      };
    },
  });

  const dailyLimit = dailyStatus?.dailyLimit ?? 0;
  const todaysMockCount = dailyStatus?.todaysMockCount ?? 0;

  const limitActive = !!dailyLimit && dailyLimit > 0;
  const remaining = limitActive ? Math.max(0, dailyLimit - (todaysMockCount ?? 0)) : null;
  const limitReached = limitActive && (todaysMockCount ?? 0) >= (dailyLimit as number);

  const [standard, setStandard] = useState("medical");
  const [count, setCount] = useState(25);
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

  // Select/deselect every chapter under a subject at once (full-subject mock).
  const toggleSubject = (s: string, allChapters: string[]) => {
    setSelectedChapters((prev) => {
      const currentlySelected = prev.filter((x) => x.subject === s).length;
      const allSelected = allChapters.length > 0 && currentlySelected === allChapters.length;
      if (allSelected) {
        setSelectedTopics((t) => t.filter((x) => x.subject !== s));
        return prev.filter((x) => x.subject !== s);
      }
      const withoutSubject = prev.filter((x) => x.subject !== s);
      return [...withoutSubject, ...allChapters.map((c) => ({ subject: s, chapter: c }))];
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
      const rows = await fetchCached<{ subject: string }[]>("/mock-pool-subjects", async () => {
        const { data, error } = await supabase.from("mock_question_pool").select("subject");
        if (error) throw error;
        return (data || []) as { subject: string }[];
      });
      return [...new Set(rows.map((d) => d.subject))];
    },
  });

  const { data: subjectSortOrder } = useQuery({
    queryKey: ["mock-pool-sort-order", "subject", ""],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mock_pool_sort_order" as any)
        .select("item_key, sort_order")
        .eq("item_type", "subject")
        .eq("parent_key", "");
      if (error) throw error;
      return (data || []) as { item_key: string; sort_order: number }[];
    },
  });

  const applySortOrder = (names: string[], saved: { item_key: string; sort_order: number }[] | undefined) => {
    if (!saved || saved.length === 0) return names;
    const orderMap = new Map(saved.map((s) => [s.item_key, s.sort_order]));
    return [...names].sort((a, b) => {
      const oa = orderMap.has(a) ? (orderMap.get(a) as number) : Number.MAX_SAFE_INTEGER;
      const ob = orderMap.has(b) ? (orderMap.get(b) as number) : Number.MAX_SAFE_INTEGER;
      if (oa !== ob) return oa - ob;
      return a.localeCompare(b);
    });
  };

  const orderedSubjects = applySortOrder(subjects || [], subjectSortOrder);

  const { data: standardsFromPool } = useQuery({
    queryKey: ["mock-pool-standards"],
    queryFn: async () => {
      const { data, error } = await supabase.from("mock_question_pool").select("standard");
      if (error) throw error;
      return [...new Set((data || []).map((d: any) => d.standard).filter(Boolean))] as string[];
    },
  });

  const { data: standardMcqCounts } = useQuery({
    queryKey: ["mock-pool-standard-mcq-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("mock_question_pool").select("standard, questions_json");
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((row: any) => {
        if (!row.standard) return;
        const n = Array.isArray(row.questions_json) ? row.questions_json.length : 0;
        counts[row.standard] = (counts[row.standard] || 0) + n;
      });
      return counts;
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
      const rows = await fetchCached<{ subject: string; questions_json: any }[]>(
        "/mock-pool-subject-totals",
        async () => {
          const { data, error } = await supabase.from("mock_question_pool").select("subject, questions_json");
          if (error) throw error;
          return (data || []) as { subject: string; questions_json: any }[];
        }
      );
      const totals: Record<string, number> = {};
      rows.forEach((row) => {
        const qs = Array.isArray(row.questions_json) ? row.questions_json : [];
        totals[row.subject] = (totals[row.subject] || 0) + qs.length;
      });
      return totals;
    },
  });

  // Chapters + per-chapter totals + has-topic flag for every subject (fetched once per subject expansion).
  const chapterQueries = useQueries({
    queries: (subjects || []).map((s) => ({
      queryKey: ["mock-pool-chapters-totals", s],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("mock_question_pool")
          .select("chapter, topic, questions_json")
          .eq("subject", s);
        if (error) throw error;
        const totals: Record<string, number> = {};
        const hasTopic: Record<string, boolean> = {};
        (data || []).forEach((row: any) => {
          const qs = Array.isArray(row.questions_json) ? row.questions_json : [];
          totals[row.chapter] = (totals[row.chapter] || 0) + qs.length;
          if (row.topic) hasTopic[row.chapter] = true;
        });
        return { totals, hasTopic };
      },
      enabled: openSubject === s,
    })),
  });
  const chapterTotalsBySubject: Record<string, Record<string, number>> = {};
  const chapterHasTopicBySubject: Record<string, Record<string, boolean>> = {};
  (subjects || []).forEach((s, i) => {
    chapterTotalsBySubject[s] = chapterQueries[i]?.data?.totals || {};
    chapterHasTopicBySubject[s] = chapterQueries[i]?.data?.hasTopic || {};
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

  const { data: chapterSortOrder } = useQuery({
    queryKey: ["mock-pool-sort-order", "chapter", openSubject],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mock_pool_sort_order" as any)
        .select("item_key, sort_order")
        .eq("item_type", "chapter")
        .eq("parent_key", openSubject);
      if (error) throw error;
      return (data || []) as { item_key: string; sort_order: number }[];
    },
    enabled: !!openSubject,
  });

  const { data: topicSortOrder } = useQuery({
    queryKey: ["mock-pool-sort-order", "topic", openChapter?.subject, openChapter?.chapter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mock_pool_sort_order" as any)
        .select("item_key, sort_order")
        .eq("item_type", "topic")
        .eq("parent_key", `${openChapter!.subject}||${openChapter!.chapter}`);
      if (error) throw error;
      return (data || []) as { item_key: string; sort_order: number }[];
    },
    enabled: !!openChapter,
  });

  const { data: standardAvailableCounts } = useQuery({
    queryKey: ["mock-pool-standard-available-counts", selectedChapters, selectedTopics],
    queryFn: async () => {
      const counts: Record<string, number> = {};
      if (selectedChapters.length === 0) return counts;

      const subjectsInSel = Array.from(new Set(selectedChapters.map((s) => s.subject)));
      const chaptersInSel = Array.from(new Set(selectedChapters.map((s) => s.chapter)));

      // Single batched query instead of one round-trip per selected chapter —
      // matters a lot when "select full subject" pulls in 10-15+ chapters at once.
      let q = supabase
        .from("mock_question_pool")
        .select("subject, chapter, topic, standard, questions_json")
        .in("subject", subjectsInSel)
        .in("chapter", chaptersInSel);
      const { data, error } = await q;
      if (error) throw error;

      const selSet = new Set(selectedChapters.map((s) => `${s.subject}||${s.chapter}`));
      (data || []).forEach((row: any) => {
        if (!selSet.has(`${row.subject}||${row.chapter}`) || !row.standard) return;
        const topicsForSel = selectedTopics
          .filter((t) => t.subject === row.subject && t.chapter === row.chapter)
          .map((t) => t.topic);
        if (topicsForSel.length > 0 && !topicsForSel.includes(row.topic)) return;
        const n = Array.isArray(row.questions_json) ? row.questions_json.length : 0;
        counts[row.standard] = (counts[row.standard] || 0) + n;
      });
      return counts;
    },
    enabled: selectedChapters.length > 0,
  });

  useEffect(() => {
    if (selectedChapters.length === 0 || !standardAvailableCounts) return;
    if ((standardAvailableCounts[standard] ?? 0) > 0) return;
    const firstNonEmpty = STANDARDS.find((s) => (standardAvailableCounts[s.value] ?? 0) > 0);
    if (firstNonEmpty) setStandard(firstNonEmpty.value);
  }, [standardAvailableCounts, selectedChapters.length]);

  const { data: availablePool } = useQuery({
    queryKey: ["mock-pool-available-count", selectedChapters, selectedTopics, standard],
    queryFn: async () => {
      if (selectedChapters.length === 0) return 0;

      const subjectsInSel = Array.from(new Set(selectedChapters.map((s) => s.subject)));
      const chaptersInSel = Array.from(new Set(selectedChapters.map((s) => s.chapter)));

      // Single batched query instead of one round-trip per selected chapter.
      const { data, error } = await supabase
        .from("mock_question_pool")
        .select("subject, chapter, topic, questions_json")
        .in("subject", subjectsInSel)
        .in("chapter", chaptersInSel)
        .eq("standard", standard);
      if (error) throw error;

      const selSet = new Set(selectedChapters.map((s) => `${s.subject}||${s.chapter}`));
      let total = 0;
      (data || []).forEach((row: any) => {
        if (!selSet.has(`${row.subject}||${row.chapter}`)) return;
        const topicsForSel = selectedTopics
          .filter((t) => t.subject === row.subject && t.chapter === row.chapter)
          .map((t) => t.topic);
        if (topicsForSel.length > 0 && !topicsForSel.includes(row.topic)) return;
        const qs = Array.isArray(row.questions_json) ? row.questions_json : [];
        total += qs.length;
      });
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
    if (!user && !guestInfo) {
      setPendingStart({ count: finalCount, minutes: finalMinutes });
      setGuestDialogOpen(true);
      return;
    }
    if (limitReached) {
      toast({ title: "দৈনিক সীমা শেষ", description: `আজকের জন্য আপনার ${dailyLimit} টি ফ্রি এক্সাম শেষ হয়ে গেছে।`, variant: "destructive" });
      return;
    }
    setStarting(true);
    try {
      const subjectsInSel = Array.from(new Set(selectedChapters.map((s) => s.subject)));
      const chaptersInSel = Array.from(new Set(selectedChapters.map((s) => s.chapter)));
      const selSet = new Set(selectedChapters.map((s) => `${s.subject}||${s.chapter}`));

      let rows: any[] | null = null;
      try {
        const cacheUrl = new URL("https://atlas-ai-proxy.hamza818483.workers.dev/cache/mock-pool");
        subjectsInSel.forEach((s) => cacheUrl.searchParams.append("subject", s));
        chaptersInSel.forEach((c) => cacheUrl.searchParams.append("chapter", c));
        cacheUrl.searchParams.set("standard", standard);
        const res = await fetch(cacheUrl.toString());
        if (res.ok) rows = await res.json();
      } catch {
        rows = null;
      }

      if (!rows) {
        // Cache endpoint unavailable — fall back to a direct Supabase read
        // so the exam still starts even if the worker is down.
        const { data, error } = await supabase
          .from("mock_question_pool")
          .select("subject, chapter, topic, questions_json")
          .in("subject", subjectsInSel)
          .in("chapter", chaptersInSel)
          .eq("standard", standard);
        if (error) throw error;
        rows = data;
      }

      let data: any[] = (rows || []).filter((row: any) => {
        if (!selSet.has(`${row.subject}||${row.chapter}`)) return false;
        const topicsForSel = selectedTopics
          .filter((t) => t.subject === row.subject && t.chapter === row.chapter)
          .map((t) => t.topic);
        if (topicsForSel.length > 0 && !topicsForSel.includes(row.topic)) return false;
        return true;
      });

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

      if (standard === "medical") {
        const hasImageOrRoman = (qq: any) => {
          const fields = [
            qq.questions,
            qq.question_text,
            qq.option1,
            qq.option2,
            qq.option3,
            qq.option4,
            qq.option5,
            qq.option_a,
            qq.option_b,
            qq.option_c,
            qq.option_d,
            qq.option_e,
          ];
          const combined = fields.filter(Boolean).join(" ");
          if (/<img\b/i.test(combined)) return true;
          if (/\b(i{1,3}|iv|v)\s*[.,)।]|\b(i{1,3}|iv|v)\s+(ও|এবং|o)\b/i.test(combined)) return true;
          return false;
        };
        all = all.filter((qq) => !hasImageOrRoman(qq));
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
      if (!user && guestInfo) {
        sessionStorage.setItem("unlimitedMockGuestName", guestInfo.name);
        sessionStorage.setItem("unlimitedMockGuestHscBatch", guestInfo.hscBatch);
        sessionStorage.setItem("unlimitedMockGuestCollegeName", guestInfo.collegeName);
        sessionStorage.setItem("unlimitedMockGuestPhone", guestInfo.phone);
      }
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
      {isAdmin && (
        <div className="space-y-2">
          <AdminDailyLimitControl currentLimit={dailyLimit} />
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setPositionManagerOpen(true)}
          >
            Manage Position (সাবজেক্ট/চ্যাপ্টার/টপিক)
          </Button>
        </div>
      )}
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
                {(user || guestInfo) && limitActive && (
                  <p className="text-[11px] font-semibold mt-0.5 text-primary">
                    আজকের বাকি আছে: {remaining}/{dailyLimit}
                  </p>
                )}
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
        <CardContent className="space-y-4 pt-6">
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
              {(orderedSubjects || []).map((s: string) => {
                const chapterTotals = chapterTotalsBySubject[s] || {};
                const chapterNames = applySortOrder(Object.keys(chapterTotals), s === openSubject ? chapterSortOrder : undefined);
                const subjectSelectedCount = selectedChapters.filter((x) => x.subject === s).length;
                return (
                  <AccordionItem
                    key={s}
                    value={s}
                    className={cn(
                      "border-2 rounded-xl overflow-hidden transition-shadow duration-300",
                      s === openSubject || subjectSelectedCount > 0
                        ? "border-primary shadow-[0_0_10px_2px_rgba(34,197,235,0.55)]"
                        : "border-border shadow-[0_0_6px_1px_rgba(34,197,235,0.3)]"
                    )}
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
                        <div className="mb-2 flex items-center justify-between">
                          <Label className="text-xs">চ্যাপ্টার (একাধিক বাছাই করা যাবে)</Label>
                          <button
                            type="button"
                            onClick={() => toggleSubject(s, chapterNames)}
                            className={cn(
                              "text-[10px] font-bold px-2 py-1 rounded-full border-2 transition-all duration-300 shrink-0",
                              chapterNames.length > 0 && subjectSelectedCount === chapterNames.length
                                ? "border-primary bg-primary/10 text-primary shadow-[0_0_6px_1px_rgba(34,197,235,0.5)]"
                                : "border-border text-muted-foreground hover:border-primary/40"
                            )}
                          >
                            {chapterNames.length > 0 && subjectSelectedCount === chapterNames.length ? "সব বাদ দিন" : "All"}
                          </button>
                        </div>
                        <div className="grid grid-cols-1 gap-1.5">
                          {chapterNames.map((c) => {
                            const checked = selectedChapters.some((x) => x.subject === s && x.chapter === c);
                            const isOpenForTopics = openChapter?.subject === s && openChapter?.chapter === c;
                            return (
                              <div key={c} className="space-y-1.5">
                                <div
                                  className={`flex items-center gap-2 rounded-lg border-2 px-2.5 py-2 transition-all duration-300 ${
                                    checked
                                      ? "border-primary bg-primary/10 shadow-[0_0_8px_2px_rgba(34,197,235,0.5)]"
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
                                  {chapterHasTopicBySubject[s]?.[c] && (
                                    <button
                                      type="button"
                                      onClick={() => setOpenChapter(isOpenForTopics ? null : { subject: s, chapter: c })}
                                      className={`shrink-0 ${checked ? "text-primary" : "text-muted-foreground"}`}
                                      aria-label="টপিক দেখুন"
                                    >
                                      <ChevronDown
                                        className={`h-3.5 w-3.5 transition-transform duration-200 ${
                                          isOpenForTopics ? "rotate-180" : ""
                                        }`}
                                      />
                                    </button>
                                  )}
                                </div>

                                {isOpenForTopics && (
                                  <div className="pl-6 pr-1">
                                    <div className="grid grid-cols-2 gap-1">
                                      {applySortOrder(openChapterTopics || [], topicSortOrder).map((t: string) => {
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

      <div
        className="fixed left-0 right-0 z-40 bg-background/95 backdrop-blur border-t border-border p-3"
        style={{ bottom: isStandalone ? "calc(60px + env(safe-area-inset-bottom))" : 0 }}
      >
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
                {STANDARDS.map((s) => {
                  const scoped = selectedChapters.length > 0 ? standardAvailableCounts : undefined;
                  const mcqCount = scoped ? (scoped[s.value] ?? 0) : (standardMcqCounts?.[s.value] ?? 0);
                  const isEmpty = scoped !== undefined ? mcqCount === 0 : standardMcqCounts !== undefined && mcqCount === 0;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => {
                        if (isEmpty) {
                          toast({ title: "কোনো MCQ নেই", description: `${s.label} এ এখনো কোনো প্রশ্ন যোগ করা হয়নি।`, variant: "destructive" });
                          return;
                        }
                        setStandard(s.value);
                      }}
                      disabled={isEmpty}
                      aria-disabled={isEmpty}
                      className={`px-2 py-2 rounded-lg text-xs font-semibold border-2 transition-colors text-center ${
                        isEmpty
                          ? "border-border text-muted-foreground/40 cursor-not-allowed opacity-50"
                          : standard === s.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground dark:text-white hover:border-primary/40"
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
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

      <GuestExamInfoDialog
        open={guestDialogOpen}
        onOpenChange={setGuestDialogOpen}
        onConfirm={(info) => {
          setGuestInfoState(info);
          setGuestDialogOpen(false);
          if (pendingStart) {
            const { count: c, minutes: m } = pendingStart;
            setPendingStart(null);
            buildAndStart(c, m);
          }
        }}
      />

      {isAdmin && (
        <MockPoolPositionManagerDialog open={positionManagerOpen} onOpenChange={setPositionManagerOpen} />
      )}
    </div>
  );
};

export default UnlimitedMockTest;
