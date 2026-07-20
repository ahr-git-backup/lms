import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, ChevronRight, CheckCircle2, Trophy, BarChart3 } from "lucide-react";
import PublicHeader from "@/components/PublicHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

type Mode = "hsc" | "medical";

interface Topic {
  id: number;
  name: string;
  weight: number;
}
interface Chapter {
  id: number;
  name: string;
  topics: Topic[];
}
interface Subject {
  id: number;
  name: string;
  short_name: string | null;
  chapters: Chapter[];
}

function progressKey(userId?: string | null) {
  return `st_progress_${userId || "guest"}`;
}

function loadProgress(userId?: string | null): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(progressKey(userId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveProgress(userId: string | null | undefined, progress: Record<string, boolean>) {
  try {
    localStorage.setItem(progressKey(userId), JSON.stringify(progress));
  } catch {
    /* ignore */
  }
}

function topicKey(mode: Mode, subjectId: number, chapterId: number, topicId: number) {
  return `${mode}|${subjectId}|${chapterId}|${topicId}`;
}

const SyllabusTracker = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [view, setView] = useState<"dashboard" | "leaderboard">("dashboard");
  const [mode, setMode] = useState<Mode>("hsc");
  const [openSubjectId, setOpenSubjectId] = useState<number | null>(null); // chapter drill-in
  const [openChapterId, setOpenChapterId] = useState<number | null>(null); // topic dropdown within chapter list
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [lbMode, setLbMode] = useState<Mode>("hsc");

  useEffect(() => {
    document.title = "Syllabus Tracker — Atlas";
    setProgress(loadProgress(user?.id));
  }, [user?.id]);

  const { data: subjects, isLoading } = useQuery({
    queryKey: ["public-st-subjects", mode],
    queryFn: async () => {
      const { data: subs, error: e1 } = await (supabase.from as any)("st_subjects")
        .select("id, name, short_name")
        .eq("mode", mode)
        .order("sort_order", { ascending: true });
      if (e1) throw e1;
      if (!subs?.length) return [] as Subject[];
      const subjIds = subs.map((s: any) => s.id);
      const { data: chaps, error: e2 } = await (supabase.from as any)("st_chapters")
        .select("id, name, subject_id")
        .in("subject_id", subjIds)
        .order("sort_order", { ascending: true });
      if (e2) throw e2;
      let topics: any[] = [];
      if (chaps?.length) {
        const chapIds = chaps.map((c: any) => c.id);
        const { data: tps, error: e3 } = await (supabase.from as any)("st_topics")
          .select("id, name, weight, chapter_id")
          .in("chapter_id", chapIds)
          .order("sort_order", { ascending: true });
        if (e3) throw e3;
        topics = tps || [];
      }
      const topicsByChap: Record<number, Topic[]> = {};
      for (const t of topics) (topicsByChap[t.chapter_id] ||= []).push(t);
      const chaptersBySubj: Record<number, Chapter[]> = {};
      for (const c of chaps || []) {
        (chaptersBySubj[c.subject_id] ||= []).push({ id: c.id, name: c.name, topics: topicsByChap[c.id] || [] });
      }
      return subs.map((s: any) => ({ ...s, chapters: chaptersBySubj[s.id] || [] })) as Subject[];
    },
  });

  const { data: leaderboard } = useQuery({
    queryKey: ["st-leaderboard", lbMode],
    enabled: view === "leaderboard",
    queryFn: async () => {
      const { data, error } = await supabase.rpc("st_leaderboard" as any, { p_mode: lbMode });
      if (error) throw error;
      return (data || []) as { user_id: string; full_name: string; hsc_batch: string; pct: number; done_topics: number; total_topics: number }[];
    },
  });

  const subjPct = (s: Subject): [number, number, number] => {
    let t = 0, d = 0;
    for (const c of s.chapters) for (const tp of c.topics) {
      t++;
      if (progress[topicKey(mode, s.id, c.id, tp.id)]) d++;
    }
    return [t ? Math.round((d / t) * 100) : 0, t, d];
  };

  const chapPct = (s: Subject, c: Chapter) => {
    let d = 0;
    for (const tp of c.topics) if (progress[topicKey(mode, s.id, c.id, tp.id)]) d++;
    return c.topics.length ? Math.round((d / c.topics.length) * 100) : 0;
  };

  const overall = useMemo(() => {
    if (!subjects) return { pct: 0, totalChaps: 0, t: 0, d: 0 };
    let totalChaps = 0, t = 0, d = 0;
    for (const s of subjects) {
      totalChaps += s.chapters.length;
      const [, st, sd] = subjPct(s);
      t += st; d += sd;
    }
    return { pct: t ? Math.round((d / t) * 100) : 0, totalChaps, t, d };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjects, progress, mode]);

  const syncProgress = async (nextProgress: Record<string, boolean>) => {
    if (!user) return;
    for (const m of ["hsc", "medical"] as Mode[]) {
      if (m !== mode) continue; // only need to resync the mode that changed; cheap + correct enough
      let t = 0, d = 0;
      for (const s of subjects || []) {
        for (const c of s.chapters) for (const tp of c.topics) {
          t++;
          if (nextProgress[topicKey(m, s.id, c.id, tp.id)]) d++;
        }
      }
      const pct = t ? Number(((d / t) * 100).toFixed(2)) : 0;
      try {
        await supabase.rpc("st_sync_progress" as any, { p_mode: m, p_pct: pct, p_done: d, p_total: t });
      } catch {
        /* ignore sync errors, local progress is source of truth */
      }
    }
  };

  const toggleTopic = (s: Subject, c: Chapter, tp: Topic) => {
    const key = topicKey(mode, s.id, c.id, tp.id);
    const next = { ...progress, [key]: !progress[key] };
    setProgress(next);
    saveProgress(user?.id, next);
    void syncProgress(next);
  };

  const openSubject = subjects?.find((s) => s.id === openSubjectId) || null;

  return (
    <div className="min-h-screen bg-background text-foreground pb-16">
      <PublicHeader />

      <div className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-card border-b">
        <button
          onClick={() => (openSubjectId ? setOpenSubjectId(null) : navigate("/"))}
          className="h-9 w-9 rounded-full border flex items-center justify-center hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="flex-1 font-extrabold text-[17px] truncate">
          {openSubject ? openSubject.name : "Syllabus Tracker"}
        </h1>
        {!openSubject && (
          <div className="flex gap-1.5">
            <button
              onClick={() => setView("dashboard")}
              className={cn(
                "text-[11px] font-bold px-2.5 py-1.5 rounded-full",
                view === "dashboard" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}
            >
              Dashboard
            </button>
            <button
              onClick={() => setView("leaderboard")}
              className={cn(
                "text-[11px] font-bold px-2.5 py-1.5 rounded-full flex items-center gap-1",
                view === "leaderboard" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}
            >
              <Trophy className="h-3 w-3" /> Leaderboard
            </button>
          </div>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-5 space-y-5">
        {/* ── CHAPTER DRILL-DOWN VIEW ── */}
        {openSubject && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border bg-card py-2.5 text-center">
                <div className="text-lg font-black">{openSubject.chapters.length}</div>
                <div className="text-[10px] text-muted-foreground font-bold">অধ্যায়</div>
              </div>
              <div className="rounded-xl border bg-card py-2.5 text-center">
                <div className="text-lg font-black">{subjPct(openSubject)[2]}</div>
                <div className="text-[10px] text-muted-foreground font-bold">সম্পন্ন</div>
              </div>
              <div className="rounded-xl border bg-card py-2.5 text-center">
                <div className="text-lg font-black text-primary">{subjPct(openSubject)[0]}%</div>
                <div className="text-[10px] text-muted-foreground font-bold">অগ্রগতি</div>
              </div>
            </div>

            <div className="space-y-2">
              {openSubject.chapters.map((c, i) => {
                const pct = chapPct(openSubject, c);
                const done = c.topics.filter((tp) => progress[topicKey(mode, openSubject.id, c.id, tp.id)]).length;
                const isOpen = openChapterId === c.id;
                return (
                  <div key={c.id} className="rounded-xl border bg-card overflow-hidden">
                    <button
                      onClick={() => setOpenChapterId(isOpen ? null : c.id)}
                      className="w-full flex items-center gap-3 p-3 text-left"
                    >
                      <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-xs flex-shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate">{c.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {done}/{c.topics.length} টপিক · <span className="text-primary font-bold">{pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted mt-1 overflow-hidden">
                          <div
                            className={cn("h-full rounded-full", pct === 100 ? "bg-emerald-500" : "bg-primary")}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <span
                        className={cn(
                          "text-[11px] font-black px-1.5 py-0.5 rounded-md flex-shrink-0",
                          pct === 100 ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"
                        )}
                      >
                        {pct}%
                      </span>
                      {isOpen ? <ChevronDown className="h-4 w-4 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 flex-shrink-0" />}
                    </button>
                    {isOpen && (
                      <div className="border-t divide-y">
                        {c.topics.map((tp) => {
                          const tDone = !!progress[topicKey(mode, openSubject.id, c.id, tp.id)];
                          return (
                            <button
                              key={tp.id}
                              onClick={() => toggleTopic(openSubject, c, tp)}
                              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-muted/40"
                            >
                              <div
                                className={cn(
                                  "h-5 w-5 rounded-md border-2 flex items-center justify-center flex-shrink-0",
                                  tDone ? "bg-emerald-500 border-emerald-500" : "border-border"
                                )}
                              >
                                {tDone && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                              </div>
                              <span className={cn("text-xs font-semibold", tDone && "line-through text-muted-foreground")}>
                                {tp.name}
                              </span>
                            </button>
                          );
                        })}
                        {c.topics.length === 0 && (
                          <p className="text-center text-xs text-muted-foreground py-3">কোনো টপিক নেই</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── DASHBOARD VIEW ── */}
        {!openSubject && view === "dashboard" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMode("hsc")}
                className={cn(
                  "py-2.5 rounded-xl text-sm font-bold border-2",
                  mode === "hsc" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"
                )}
              >
                HSC সিলেবাস
              </button>
              <button
                onClick={() => setMode("medical")}
                className={cn(
                  "py-2.5 rounded-xl text-sm font-bold border-2",
                  mode === "medical" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"
                )}
              >
                Medical Admission
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border bg-card py-2.5 text-center">
                <div className="text-lg font-black">{subjects?.length ?? "—"}</div>
                <div className="text-[10px] text-muted-foreground font-bold">বিষয়</div>
              </div>
              <div className="rounded-xl border bg-card py-2.5 text-center">
                <div className="text-lg font-black">{overall.totalChaps}</div>
                <div className="text-[10px] text-muted-foreground font-bold">অধ্যায়</div>
              </div>
              <div className="rounded-xl border bg-card py-2.5 text-center">
                <div className="text-lg font-black text-primary">{overall.pct}%</div>
                <div className="text-[10px] text-muted-foreground font-bold">সম্পন্ন</div>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-muted-foreground">
                <span>সামগ্রিক অগ্রগতি</span>
                <span>{overall.pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${overall.pct}%` }} />
              </div>
            </div>

            {isLoading && (
              <p className="text-center text-sm text-muted-foreground py-10">লোড হচ্ছে...</p>
            )}
            {!isLoading && (!subjects || subjects.length === 0) && (
              <div className="flex flex-col items-center text-center gap-3 pt-10">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-lg">
                  <BarChart3 className="h-7 w-7 text-white" />
                </div>
                <p className="text-sm text-muted-foreground max-w-xs">কোনো বিষয় পাওয়া যায়নি।</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              {subjects?.map((s) => {
                const [pct, t] = subjPct(s);
                const full = pct === 100;
                return (
                  <button
                    key={s.id}
                    onClick={() => setOpenSubjectId(s.id)}
                    className={cn(
                      "relative text-left rounded-xl border-2 p-3.5 transition-colors",
                      full ? "border-emerald-500/50 bg-emerald-500/5" : "border-border bg-card hover:border-primary/30"
                    )}
                  >
                    {full && (
                      <span className="absolute top-2 right-2 flex items-center gap-0.5 text-[9px] font-bold text-emerald-600 bg-emerald-500/15 px-1.5 py-0.5 rounded-full">
                        <CheckCircle2 className="h-2.5 w-2.5" /> সম্পন্ন
                      </span>
                    )}
                    <div className="text-sm font-bold pr-10">{s.name}</div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-sm font-black text-primary">{pct}%</span>
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1.5">
                      {s.chapters.length} অধ্যায় · {t} টপিক
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* ── LEADERBOARD VIEW ── */}
        {!openSubject && view === "leaderboard" && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <button
                onClick={() => setLbMode("hsc")}
                className={cn(
                  "flex-1 py-2 rounded-xl text-xs font-bold border-2",
                  lbMode === "hsc" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"
                )}
              >
                HSC
              </button>
              <button
                onClick={() => setLbMode("medical")}
                className={cn(
                  "flex-1 py-2 rounded-xl text-xs font-bold border-2",
                  lbMode === "medical" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"
                )}
              >
                Medical
              </button>
            </div>

            <div className="space-y-1.5">
              {(!leaderboard || leaderboard.length === 0) && (
                <p className="text-center text-xs text-muted-foreground py-8">
                  এখনো কেউ এই মোডে অগ্রগতি রেকর্ড করেনি।
                </p>
              )}
              {leaderboard?.map((row, i) => {
                const isMe = row.user_id === user?.id;
                const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
                return (
                  <div
                    key={row.user_id}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg border px-2.5 py-2 bg-card/50",
                      isMe && "border-primary/40 bg-primary/5"
                    )}
                  >
                    <span className="w-6 text-center font-black text-xs text-muted-foreground">
                      {medal || `#${i + 1}`}
                    </span>
                    <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-extrabold text-xs flex-shrink-0">
                      {(row.full_name || "S").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold truncate">
                        {row.full_name || "Student"}{isMe && " (তুমি)"}
                      </div>
                      {row.hsc_batch && <div className="text-[10px] text-muted-foreground">{row.hsc_batch}</div>}
                    </div>
                    <div className="text-xs font-black text-primary flex-shrink-0">
                      {Number(row.pct).toFixed(1)}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SyllabusTracker;
