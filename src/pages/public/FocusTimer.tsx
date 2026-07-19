import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Coffee, Moon, Pause, Play, Square, Trophy } from "lucide-react";
import PublicHeader from "@/components/PublicHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

type Mood = "study" | "break" | "sleep";

const MOOD_META: Record<Mood, { label: string; icon: typeof BookOpen; color: string; bg: string }> = {
  study: { label: "Study", icon: BookOpen, color: "text-emerald-500", bg: "from-emerald-500 to-teal-500" },
  break: { label: "Break", icon: Coffee, color: "text-amber-500", bg: "from-amber-500 to-orange-500" },
  sleep: { label: "Sleep", icon: Moon, color: "text-indigo-400", bg: "from-indigo-500 to-violet-500" },
};

function formatHMS(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return { h: String(h).padStart(2, "0"), m: String(m).padStart(2, "0"), s: String(s).padStart(2, "0") };
}

const FocusTimer = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [mood, setMood] = useState<Mood>("study");
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [leaderboardDays, setLeaderboardDays] = useState(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStartRef = useRef<Date | null>(null);

  useEffect(() => {
    document.title = "Focus Timer — Atlas";
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const { data: leaderboard, refetch: refetchLeaderboard } = useQuery({
    queryKey: ["focus-leaderboard", leaderboardDays],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("focus_leaderboard", { p_days: leaderboardDays });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: myTotalToday } = useQuery({
    queryKey: ["focus-my-today", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("focus_sessions")
        .select("duration_seconds")
        .eq("user_id", user!.id)
        .eq("mood", "study")
        .gte("created_at", startOfDay.toISOString());
      if (error) throw error;
      return (data || []).reduce((sum, r) => sum + (r.duration_seconds || 0), 0);
    },
  });

  const tick = () => {
    setElapsed((e) => e + 1);
  };

  const start = () => {
    sessionStartRef.current = new Date();
    setElapsed(0);
    setRunning(true);
    setPaused(false);
    intervalRef.current = setInterval(tick, 1000);
  };

  const pause = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setPaused(true);
  };

  const resume = () => {
    intervalRef.current = setInterval(tick, 1000);
    setPaused(false);
  };

  const switchMood = (m: Mood) => {
    if (!running) {
      setMood(m);
      return;
    }
    // switching mood mid-session: save current segment, start a new one under new mood
    void saveSegment(mood, elapsed);
    setMood(m);
    setElapsed(0);
    sessionStartRef.current = new Date();
  };

  const saveSegment = async (segMood: Mood, seconds: number) => {
    if (!user || seconds < 1) return;
    try {
      await supabase.from("focus_sessions").insert({
        user_id: user.id,
        mood: segMood,
        duration_seconds: seconds,
        started_at: sessionStartRef.current?.toISOString() || new Date().toISOString(),
        ended_at: new Date().toISOString(),
      });
    } catch {
      /* best-effort save, ignore network failure */
    }
  };

  const stop = async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    await saveSegment(mood, elapsed);
    setRunning(false);
    setPaused(false);
    setElapsed(0);
    refetchLeaderboard();
  };

  const { h, m: min, s } = formatHMS(elapsed);
  const meta = MOOD_META[mood];
  const Icon = meta.icon;

  return (
    <div className="min-h-screen bg-background text-foreground pb-16">
      <PublicHeader />

      <div className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-card border-b">
        <button
          onClick={() => navigate("/")}
          className="h-9 w-9 rounded-full border flex items-center justify-center hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="flex-1 font-extrabold text-[17px]">Focus Timer</h1>
        {typeof myTotalToday === "number" && (
          <span className="text-xs font-bold text-emerald-500">
            আজ {formatHMS(myTotalToday).h}h {formatHMS(myTotalToday).m}m
          </span>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-5 space-y-6">
        {!user && (
          <div className="text-center text-sm text-muted-foreground bg-muted/40 rounded-xl p-4">
            টাইমার সেভ করতে লগইন করুন।
          </div>
        )}

        {/* Mood switcher */}
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(MOOD_META) as Mood[]).map((m) => {
            const md = MOOD_META[m];
            const MIcon = md.icon;
            const active = mood === m;
            return (
              <button
                key={m}
                onClick={() => switchMood(m)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl py-3 border-2 transition-all",
                  active
                    ? `bg-gradient-to-br ${md.bg} border-transparent text-white shadow-md`
                    : "border-border bg-card text-muted-foreground hover:border-primary/30"
                )}
              >
                <MIcon className="h-5 w-5" />
                <span className="text-xs font-bold">{md.label}</span>
              </button>
            );
          })}
        </div>

        {/* Digital timer */}
        <div
          className={cn(
            "rounded-2xl p-6 flex flex-col items-center gap-4 border-2",
            mood === "study" && "border-emerald-500/30 bg-emerald-500/5",
            mood === "break" && "border-amber-500/30 bg-amber-500/5",
            mood === "sleep" && "border-indigo-500/30 bg-indigo-500/5"
          )}
        >
          <div className="flex items-center gap-2 text-sm font-bold">
            <Icon className={cn("h-4 w-4", meta.color)} />
            <span className={meta.color}>{meta.label} Mode</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-4xl font-black tabular-nums">
            <div className="flex flex-col items-center">
              <span>{h}</span>
              <span className="text-[9px] font-sans text-muted-foreground mt-0.5">HRS</span>
            </div>
            <span className="pb-4">:</span>
            <div className="flex flex-col items-center">
              <span>{min}</span>
              <span className="text-[9px] font-sans text-muted-foreground mt-0.5">MIN</span>
            </div>
            <span className="pb-4">:</span>
            <div className="flex flex-col items-center">
              <span>{s}</span>
              <span className="text-[9px] font-sans text-muted-foreground mt-0.5">SEC</span>
            </div>
          </div>

          <div className="flex gap-2 w-full">
            {!running && (
              <button
                onClick={start}
                disabled={!user}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-40"
              >
                <Play className="h-4 w-4 fill-current" /> পড়াশোনা শুরু করো
              </button>
            )}
            {running && !paused && (
              <>
                <button
                  onClick={pause}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border font-bold text-sm hover:bg-muted"
                >
                  <Pause className="h-4 w-4" /> Pause
                </button>
                <button
                  onClick={stop}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-destructive text-destructive-foreground font-bold text-sm"
                >
                  <Square className="h-4 w-4" /> Stop
                </button>
              </>
            )}
            {running && paused && (
              <>
                <button
                  onClick={resume}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm"
                >
                  <Play className="h-4 w-4 fill-current" /> Resume
                </button>
                <button
                  onClick={stop}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-destructive text-destructive-foreground font-bold text-sm"
                >
                  <Square className="h-4 w-4" /> Stop
                </button>
              </>
            )}
          </div>
        </div>

        {/* Leaderboard */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            <h2 className="font-extrabold text-sm">Focus Leaderboard</h2>
          </div>
          <div className="flex gap-2">
            {[1, 3, 7, 15, 30].map((d) => (
              <button
                key={d}
                onClick={() => setLeaderboardDays(d)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-[11px] font-bold border",
                  leaderboardDays === d
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border text-muted-foreground"
                )}
              >
                {d === 1 ? "আজকে" : `${d} দিন`}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            {(!leaderboard || leaderboard.length === 0) && (
              <p className="text-center text-xs text-muted-foreground py-6">
                এখনো কেউ পড়াশোনার সময় রেকর্ড করেনি।
              </p>
            )}
            {leaderboard?.map((row: any, i: number) => {
              const isMe = row.user_id === user?.id;
              const t = formatHMS(Number(row.total_seconds));
              return (
                <div
                  key={row.user_id}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg border px-2.5 py-2 bg-card/50",
                    isMe && "border-primary/40 bg-primary/5"
                  )}
                >
                  <div className="w-7 text-center font-black text-xs text-muted-foreground font-mono">
                    #{i + 1}
                  </div>
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center font-extrabold text-emerald-600 text-xs flex-shrink-0">
                    {(row.full_name || "S").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0 text-xs font-bold truncate">
                    {row.full_name || "Student"}
                    {isMe && " (তুমি)"}
                  </div>
                  <div className="text-xs font-black text-emerald-500 font-mono flex-shrink-0">
                    {t.h}h {t.m}m
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FocusTimer;
