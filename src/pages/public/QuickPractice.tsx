import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronDown,
  Sparkles,
  Trophy,
  ChevronRight,
  Play,
  Check,
} from "lucide-react";
import PublicHeader from "@/components/PublicHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface QpSubject {
  id: number;
  name: string;
  sort_order: number;
}
interface QpChapter {
  id: number;
  subject_id: number;
  name: string;
  mcqCount?: number;
}

const QuickPractice = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [openSubjectId, setOpenSubjectId] = useState<number | null>(null);
  const [chaptersBySubject, setChaptersBySubject] = useState<Record<number, QpChapter[]>>({});
  const [selectedChapters, setSelectedChapters] = useState<Set<number>>(new Set());
  const [allSubjectsMode, setAllSubjectsMode] = useState(false);
  const [chapAllMode, setChapAllMode] = useState<Record<number, boolean>>({});
  const [loadingChapters, setLoadingChapters] = useState<number | null>(null);

  useEffect(() => {
    document.title = "Quick Practice — Atlas";
  }, []);

  const { data: subjects, isLoading: subjectsLoading } = useQuery({
    queryKey: ["qp-subjects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qp_subjects")
        .select("id, name, sort_order")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as QpSubject[];
    },
  });

  const { data: totalMcqCount } = useQuery({
    queryKey: ["qp-total-mcq-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("qp_mcqs")
        .select("id", { count: "exact", head: true });
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: pointsData } = useQuery({
    queryKey: ["qp-points", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qp_user_points")
        .select("total_points")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data?.total_points ?? 0;
    },
  });

  const fetchChaptersWithCounts = async (subjectId: number): Promise<QpChapter[]> => {
    const { data: chapters, error } = await supabase
      .from("qp_chapters")
      .select("id, subject_id, name")
      .eq("subject_id", subjectId)
      .order("sort_order", { ascending: true });
    if (error || !chapters) return [];

    const withCounts: QpChapter[] = await Promise.all(
      chapters.map(async (ch) => {
        const { count } = await supabase
          .from("qp_mcqs")
          .select("id", { count: "exact", head: true })
          .eq("chapter_id", ch.id);
        return { ...ch, mcqCount: count || 0 };
      })
    );
    return withCounts;
  };

  const toggleSubject = async (subjId: number) => {
    if (openSubjectId === subjId) {
      setOpenSubjectId(null);
      return;
    }
    setOpenSubjectId(subjId);
    if (!chaptersBySubject[subjId]) {
      setLoadingChapters(subjId);
      const chapters = await fetchChaptersWithCounts(subjId);
      setChaptersBySubject((prev) => ({ ...prev, [subjId]: chapters }));
      setLoadingChapters(null);
    }
  };

  const toggleChapter = (subjId: number, chapId: number, mcqCount: number) => {
    if (mcqCount === 0) return;
    setSelectedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(chapId)) next.delete(chapId);
      else next.add(chapId);
      return next;
    });
    setChapAllMode((prev) => ({ ...prev, [subjId]: false }));
    setAllSubjectsMode(false);
  };

  const toggleAllChaptersInSubject = (subjId: number) => {
    const chapters = (chaptersBySubject[subjId] || []).filter((c) => (c.mcqCount || 0) > 0);
    const turningOn = !chapAllMode[subjId];
    setChapAllMode((prev) => ({ ...prev, [subjId]: turningOn }));
    setSelectedChapters((prev) => {
      const next = new Set(prev);
      chapters.forEach((ch) => {
        if (turningOn) next.add(ch.id);
        else next.delete(ch.id);
      });
      return next;
    });
  };

  const toggleAllSubjects = async () => {
    const turningOn = !allSubjectsMode;
    setAllSubjectsMode(turningOn);
    if (!turningOn) {
      setSelectedChapters(new Set());
      return;
    }
    setSelectedChapters(new Set());
    const updated = { ...chaptersBySubject };
    const allIds = new Set<number>();
    for (const s of subjects || []) {
      if (!updated[s.id]) {
        updated[s.id] = await fetchChaptersWithCounts(s.id);
      }
      updated[s.id].forEach((ch) => {
        if ((ch.mcqCount || 0) > 0) allIds.add(ch.id);
      });
    }
    setChaptersBySubject(updated);
    setSelectedChapters(allIds);
  };

  const startRandomPractice = () => {
    sessionStorage.setItem("qp_practice_mode", JSON.stringify({ type: "random" }));
    navigate("/quick-practice/play");
  };

  const startSelectedPractice = () => {
    if (!selectedChapters.size) return;
    sessionStorage.setItem(
      "qp_practice_mode",
      JSON.stringify({ type: "selected", chapterIds: Array.from(selectedChapters) })
    );
    navigate("/quick-practice/play");
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-28">
      <PublicHeader />

      {/* Sub-header */}
      <div className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-card border-b">
        <button
          onClick={() => navigate("/")}
          className="h-9 w-9 rounded-full border flex items-center justify-center hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="flex-1 font-extrabold text-[17px] flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-primary" /> Quick Practice
        </h1>
        <div className="flex items-center gap-1.5 bg-gradient-to-r from-amber-400 to-amber-500 text-amber-950 font-extrabold text-xs px-3 py-1.5 rounded-full shadow-sm">
          <Trophy className="h-3.5 w-3.5" /> {pointsData ?? 0}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-2.5">
        {/* Random Practice */}
        <button
          onClick={startRandomPractice}
          className="w-full relative overflow-hidden rounded-xl px-4 py-2.5 flex items-center gap-3 text-left bg-gradient-to-r from-primary via-primary/90 to-primary/70 shadow-md hover:shadow-lg transition-all"
        >
          <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div className="text-white">
            <div className="font-extrabold text-[13px]">Random Practice</div>
            <div className="text-[10.5px] opacity-90 mt-0.5">সব বিষয়/অধ্যায় থেকে random MCQ</div>
            {typeof totalMcqCount === "number" && (
              <div className="text-[10px] opacity-80 mt-0.5 font-semibold">
                মোট <b>{totalMcqCount}</b>টি MCQ
              </div>
            )}
          </div>
        </button>

        {/* Leaderboard */}
        <button
          onClick={() => navigate("/quick-practice/leaderboard")}
          className="w-full relative overflow-hidden rounded-xl px-4 py-2.5 flex items-center gap-3 text-left bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 shadow-sm hover:shadow-md transition-all"
        >
          <div className="h-8 w-8 rounded-lg bg-black/10 flex items-center justify-center flex-shrink-0">
            <Trophy className="h-4 w-4 text-amber-950" />
          </div>
          <div className="flex-1 text-amber-950">
            <div className="font-extrabold text-[13px]">Leaderboard</div>
            <div className="text-[10.5px] opacity-75 mt-0.5">Top players দেখো, নিজের rank চেক করো</div>
          </div>
          <ChevronRight className="h-4 w-4 text-amber-950/70" />
        </button>

        <div className="flex justify-end">
          <button
            onClick={toggleAllSubjects}
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-bold border transition-colors",
              allSubjectsMode
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-primary/40 text-primary hover:bg-primary/5"
            )}
          >
            All
          </button>
        </div>

        {/* Subjects list */}
        <div className="space-y-2.5">
          {subjectsLoading && (
            <div className="text-center text-sm text-muted-foreground py-6">লোড হচ্ছে...</div>
          )}
          {!subjectsLoading && (!subjects || subjects.length === 0) && (
            <div className="text-center text-sm text-muted-foreground py-6">কোনো বিষয় যোগ করা হয়নি।</div>
          )}
          {subjects?.map((s) => {
            const isOpen = openSubjectId === s.id;
            const chapters = chaptersBySubject[s.id];
            return (
              <div key={s.id} className="rounded-2xl border bg-card overflow-hidden">
                <button
                  onClick={() => toggleSubject(s.id)}
                  className="w-full flex items-center gap-3 p-3.5 text-left hover:bg-muted/40 transition-colors"
                >
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <span className="flex-1 font-bold text-sm">{s.name}</span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform",
                      isOpen && "rotate-180"
                    )}
                  />
                </button>

                {isOpen && (
                  <div className="border-t bg-muted/20 px-3.5 py-3 space-y-2">
                    {loadingChapters === s.id && (
                      <div className="text-center text-xs text-muted-foreground py-3">লোড হচ্ছে...</div>
                    )}
                    {loadingChapters !== s.id && chapters && chapters.length === 0 && (
                      <div className="text-center text-xs text-muted-foreground py-3">Coming soon</div>
                    )}
                    {loadingChapters !== s.id && chapters && chapters.length > 0 && (
                      <>
                        <div className="flex justify-end">
                          <button
                            onClick={() => toggleAllChaptersInSubject(s.id)}
                            className={cn(
                              "px-3 py-1 rounded-full text-[11px] font-bold border",
                              chapAllMode[s.id]
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-card border-border text-muted-foreground"
                            )}
                          >
                            All Chapter
                          </button>
                        </div>
                        {chapters.map((ch) => {
                          const checked = selectedChapters.has(ch.id);
                          const empty = (ch.mcqCount || 0) === 0;
                          return (
                            <div
                              key={ch.id}
                              className={cn(
                                "flex items-center gap-2.5 py-2 border-b last:border-b-0",
                                empty && "opacity-50 pointer-events-none"
                              )}
                            >
                              <div
                                onClick={() => toggleChapter(s.id, ch.id, ch.mcqCount || 0)}
                                className={cn(
                                  "h-5 w-5 rounded-md border-2 flex items-center justify-center cursor-pointer flex-shrink-0",
                                  checked ? "bg-primary border-primary" : "border-border"
                                )}
                              >
                                {checked && <Check className="h-3 w-3 text-primary-foreground" />}
                              </div>
                              <span className="flex-1 text-[13px]">{ch.name}</span>
                              <span
                                className={cn(
                                  "text-[11px]",
                                  empty ? "text-destructive italic" : "text-muted-foreground"
                                )}
                              >
                                {empty ? "Coming soon" : `${ch.mcqCount}টি MCQ`}
                              </span>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating start button */}
      {selectedChapters.size > 0 && (
        <button
          onClick={startSelectedPractice}
          className="fixed right-5 bottom-6 z-40 flex items-center gap-2 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-extrabold text-sm px-5 py-3.5 rounded-full shadow-xl hover:shadow-2xl transition-all animate-in fade-in slide-in-from-bottom-4"
        >
          <Play className="h-4 w-4 fill-current" /> শুরু করো
        </button>
      )}
    </div>
  );
};

export default QuickPractice;
