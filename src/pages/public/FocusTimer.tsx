import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Coffee,
  Moon,
  Pause,
  Play,
  Square,
  Trophy,
  Users,
} from "lucide-react";
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

const STATE_KEY = "atlas_focus_state_v1";
const MAX_BREAK_SEC = 3600; // 1 hour break cap, auto-ends and returns to Study

interface PersistedState {
  sessionId: number;
  mood: Mood;
  elapsed: number;
  paused: boolean;
  userId: string;
  savedAt: number;
}

function formatHMS(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return { h: String(h).padStart(2, "0"), m: String(m).padStart(2, "0"), s: String(s).padStart(2, "0") };
}

function loadState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    return raw ? (JSON.parse(raw) as PersistedState) : null;
  } catch {
    return null;
  }
}

function saveState(state: PersistedState) {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable, session just won't resume after refresh */
  }
}

function clearState() {
  try {
    localStorage.removeItem(STATE_KEY);
  } catch {
    /* ignore */
  }
}

function sessionNumberKey(userId: string) {
  return `atlas_focus_session_num_${userId}`;
}

function loadSessionNumber(userId: string): number {
  try {
    const raw = localStorage.getItem(sessionNumberKey(userId));
    if (!raw) return 1;
    const d = JSON.parse(raw) as { date: string; n: number };
    const today = new Date().toISOString().split("T")[0];
    return d.date === today ? d.n : 1;
  } catch {
    return 1;
  }
}

function saveSessionNumber(userId: string, n: number) {
  try {
    const today = new Date().toISOString().split("T")[0];
    localStorage.setItem(sessionNumberKey(userId), JSON.stringify({ date: today, n }));
  } catch {
    /* ignore */
  }
}

const FocusTimer = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [mood, setMood] = useState<Mood>("study");
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [leaderboardMood, setLeaderboardMood] = useState<Mood>("study");
  const [leaderboardDays, setLeaderboardDays] = useState(1);
  const [showLiveNow, setShowLiveNow] = useState(false);
  const [breaksUsed, setBreaksUsed] = useState(0);
  const accumulatedBreakRef = useRef(0); // break seconds used before the current live break segment
  const [pendingMood, setPendingMood] = useState<Mood | null>(null);
  const pauseStartRef = useRef<number | null>(null);
  const autoSleepCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [stopStats, setStopStats] = useState<{ breaks: number; sleepSeconds: number } | null>(null);
  const sleepSecsRef = useRef(0); // accumulated sleep seconds across this run (for the stop summary)
  const [sessionNumber, setSessionNumber] = useState(1);
  const hasStoppedOnceRef = useRef(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);
  const pausedRef = useRef(false);
  const sessionIdRef = useRef<number | null>(null);
  const moodRef = useRef<Mood>("study");
  const resumedRef = useRef(false);

  useEffect(() => {
    document.title = "Focus Timer — Atlas";
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, []);

  useEffect(() => {
    if (user) setSessionNumber(loadSessionNumber(user.id));
  }, [user]);

  // Attempt resume from a previous page load (survives refresh/navigation).
  useEffect(() => {
    if (!user || resumedRef.current) return;
    resumedRef.current = true;
    const saved = loadState();
    if (!saved || saved.userId !== user.id) return;

    (async () => {
      const { data, error } = await supabase.rpc("focus_start_session", {
        p_mood: saved.mood,
        p_resume_id: saved.sessionId,
      });
      if (error || !data) {
        clearState();
        return;
      }
      const id = data as number;
      setSessionId(id);
      setMood(saved.mood);
      setElapsed(saved.elapsed);
      setPaused(saved.paused);
      setRunning(true);
      sessionIdRef.current = id;
      moodRef.current = saved.mood;
      elapsedRef.current = saved.elapsed;
      pausedRef.current = saved.paused;
      if (!saved.paused) startTicking();
      startHeartbeat();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const { data: leaderboard, refetch: refetchLeaderboard } = useQuery({
    queryKey: ["focus-leaderboard", leaderboardMood, leaderboardDays],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("focus_mood_leaderboard", {
        p_mood: leaderboardMood,
        p_days: leaderboardDays,
      });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 15000,
  });

  const { data: liveNow, refetch: refetchLiveNow } = useQuery({
    queryKey: ["focus-live-now"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("focus_live_now");
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 8000,
    enabled: showLiveNow,
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

  const startTicking = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
      if (moodRef.current === "break" && accumulatedBreakRef.current + elapsedRef.current >= MAX_BREAK_SEC) {
        void autoEndBreak();
      }
    }, 1000);
  };

  const startHeartbeat = () => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = setInterval(() => {
      if (sessionIdRef.current == null) return;
      void supabase.rpc("focus_update_session", {
        p_id: sessionIdRef.current,
        p_duration_seconds: elapsedRef.current,
        p_is_paused: pausedRef.current,
      });
      saveState({
        sessionId: sessionIdRef.current,
        mood: moodRef.current,
        elapsed: elapsedRef.current,
        paused: pausedRef.current,
        userId: user!.id,
        savedAt: Date.now(),
      });
    }, 5000);
  };

  const start = async () => {
    if (!user) return;
    const { data, error } = await supabase.rpc("focus_start_session", { p_mood: mood });
    if (error || data == null) return;
    const id = data as number;
    elapsedRef.current = 0;
    pausedRef.current = false;
    sessionIdRef.current = id;
    moodRef.current = mood;
    setSessionId(id);
    setElapsed(0);
    setRunning(true);
    setPaused(false);
    startTicking();
    startHeartbeat();
    saveState({ sessionId: id, mood, elapsed: 0, paused: false, userId: user.id, savedAt: Date.now() });
    if (hasStoppedOnceRef.current) {
      const next = sessionNumber + 1;
      setSessionNumber(next);
      saveSessionNumber(user.id, next);
    }
  };

  const pause = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    pausedRef.current = true;
    setPaused(true);
    pauseStartRef.current = Date.now();
    if (sessionIdRef.current != null) {
      void supabase.rpc("focus_update_session", {
        p_id: sessionIdRef.current,
        p_duration_seconds: elapsedRef.current,
        p_is_paused: true,
      });
    }
  };

  const resume = () => {
    pausedRef.current = false;
    setPaused(false);
    pauseStartRef.current = null;
    startTicking();
    if (sessionIdRef.current != null) {
      void supabase.rpc("focus_update_session", {
        p_id: sessionIdRef.current,
        p_duration_seconds: elapsedRef.current,
        p_is_paused: false,
      });
    }
  };

  // রাত ১২টা থেকে সকাল ৮টার মধ্যে Study Mood paused অবস্থায় ১.৫ ঘণ্টা পার হলে
  // স্বয়ংক্রিয়ভাবে Sleep Mode চালু হয়ে যায়।
  const checkAutoSleepFromPause = async () => {
    if (!pauseStartRef.current || moodRef.current !== "study" || !pausedRef.current) return;
    const hr = new Date().getHours();
    const inNightWindow = hr >= 0 && hr < 8;
    if (!inNightWindow) return;
    const pausedSecs = Math.floor((Date.now() - pauseStartRef.current) / 1000);
    if (pausedSecs < 5400) return; // 1.5 hours

    if (intervalRef.current) clearInterval(intervalRef.current);
    if (sessionIdRef.current != null) {
      await supabase.rpc("focus_end_session", {
        p_id: sessionIdRef.current,
        p_duration_seconds: elapsedRef.current,
      });
    }
    const { data, error } = await supabase.rpc("focus_start_session", { p_mood: "sleep" });
    if (error || data == null) return;
    const id = data as number;
    elapsedRef.current = pausedSecs;
    pausedRef.current = false;
    pauseStartRef.current = null;
    sessionIdRef.current = id;
    moodRef.current = "sleep";
    setSessionId(id);
    setMood("sleep");
    setElapsed(pausedSecs);
    setPaused(false);
    startTicking();
    saveState({ sessionId: id, mood: "sleep", elapsed: pausedSecs, paused: false, userId: user!.id, savedAt: Date.now() });
    refetchLeaderboard();
    setToast("🌙 রাতে দীর্ঘ বিরতি দেখে Sleep Mode চালু হলো");
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    autoSleepCheckRef.current = setInterval(() => {
      void checkAutoSleepFromPause();
    }, 30000);
    return () => {
      if (autoSleepCheckRef.current) clearInterval(autoSleepCheckRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Tapping a mood button: if Study is actively running, confirm before switching away.
  const requestSwitchMood = (m: Mood) => {
    if (m === moodRef.current) return;
    if (running && moodRef.current === "study" && !pausedRef.current) {
      setPendingMood(m);
      return;
    }
    void switchMood(m);
  };

  const confirmMoodSwitch = () => {
    if (pendingMood) void switchMood(pendingMood);
    setPendingMood(null);
  };

  const closeMoodPopup = () => setPendingMood(null);

  const switchMood = async (m: Mood) => {
    if (!running) {
      setMood(m);
      moodRef.current = m;
      return;
    }
    // end current live segment, start a fresh one under the new mood
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (sessionIdRef.current != null) {
      await supabase.rpc("focus_end_session", {
        p_id: sessionIdRef.current,
        p_duration_seconds: elapsedRef.current,
      });
    }
    if (moodRef.current === "break") {
      accumulatedBreakRef.current += elapsedRef.current;
    }
    if (moodRef.current === "sleep") {
      sleepSecsRef.current += elapsedRef.current;
    }
    if (m === "break" && moodRef.current !== "break") {
      setBreaksUsed((n) => n + 1);
    }
    const { data, error } = await supabase.rpc("focus_start_session", { p_mood: m });
    if (error || data == null) return;
    const id = data as number;
    elapsedRef.current = 0;
    pausedRef.current = false;
    sessionIdRef.current = id;
    moodRef.current = m;
    setSessionId(id);
    setMood(m);
    setElapsed(0);
    setPaused(false);
    startTicking();
    saveState({ sessionId: id, mood: m, elapsed: 0, paused: false, userId: user!.id, savedAt: Date.now() });
    refetchLeaderboard();
  };

  // Break time limit reached — auto-return to Study mood.
  const autoEndBreak = async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (sessionIdRef.current != null) {
      await supabase.rpc("focus_end_session", {
        p_id: sessionIdRef.current,
        p_duration_seconds: elapsedRef.current,
      });
    }
    accumulatedBreakRef.current += elapsedRef.current;
    const { data, error } = await supabase.rpc("focus_start_session", { p_mood: "study" });
    if (error || data == null) return;
    const id = data as number;
    elapsedRef.current = 0;
    pausedRef.current = false;
    sessionIdRef.current = id;
    moodRef.current = "study";
    setSessionId(id);
    setMood("study");
    setElapsed(0);
    setPaused(false);
    startTicking();
    saveState({ sessionId: id, mood: "study", elapsed: 0, paused: false, userId: user!.id, savedAt: Date.now() });
    refetchLeaderboard();
  };

  const stop = async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    if (sessionIdRef.current != null) {
      await supabase.rpc("focus_end_session", {
        p_id: sessionIdRef.current,
        p_duration_seconds: elapsedRef.current,
      });
    }
    if (moodRef.current === "sleep") {
      sleepSecsRef.current += elapsedRef.current;
    }
    clearState();
    setStopStats({ breaks: breaksUsed, sleepSeconds: sleepSecsRef.current });
    hasStoppedOnceRef.current = true;
    sessionIdRef.current = null;
    setSessionId(null);
    setRunning(false);
    setPaused(false);
    setElapsed(0);
    accumulatedBreakRef.current = 0;
    sleepSecsRef.current = 0;
    setBreaksUsed(0);
    pauseStartRef.current = null;
    refetchLeaderboard();
    refetchLiveNow();
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
                onClick={() => requestSwitchMood(m)}
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

        {/* Premium ATLAS Focus Timer banner */}
        <div className="flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2">
          <Icon className={cn("h-4 w-4", meta.color)} />
          <span className="text-sm font-black tracking-wide bg-gradient-to-r from-primary via-primary/70 to-primary bg-clip-text text-transparent">
            ATLAS Focus Timer
          </span>
          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-gradient-to-r from-primary to-primary/70 text-primary-foreground tracking-wide">
            PREMIUM
          </span>
        </div>

        {/* Digital timer */}
        <div
          className={cn(
            "rounded-2xl p-6 flex flex-col items-center gap-4 border-2 shadow-sm",
            mood === "study" && "border-emerald-500/30 bg-emerald-500/5",
            mood === "break" && "border-amber-500/30 bg-amber-500/5",
            mood === "sleep" && "border-indigo-500/30 bg-indigo-500/5"
          )}
        >
          <div className="flex items-center gap-2 text-sm font-bold">
            <Icon className={cn("h-4 w-4", meta.color)} />
            <span className={meta.color}>
              {meta.label} Mode{mood === "study" && sessionNumber > 1 ? ` (Session ${sessionNumber})` : ""}
            </span>
            {running && paused && (
              <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                Paused
              </span>
            )}
          </div>
          {mood === "break" && running && MAX_BREAK_SEC - (accumulatedBreakRef.current + elapsed) <= 300 && (
            <div className="w-full text-center text-[11px] font-bold text-amber-600 bg-amber-500/10 border border-amber-500/30 rounded-lg py-1.5 px-3 animate-pulse">
              ⚠️ বিরতি শেষ হতে {formatHMS(Math.max(0, MAX_BREAK_SEC - (accumulatedBreakRef.current + elapsed))).m}m{" "}
              {formatHMS(Math.max(0, MAX_BREAK_SEC - (accumulatedBreakRef.current + elapsed))).s}s বাকি
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <div
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl px-3.5 py-2.5 border shadow-inner",
                "bg-card/80",
                mood === "study" && "border-emerald-500/25",
                mood === "break" && "border-amber-500/25",
                mood === "sleep" && "border-indigo-500/25"
              )}
            >
              <span className="font-mono text-3xl font-black tabular-nums tracking-wider">{h}</span>
              <span className="text-[8px] font-bold text-muted-foreground tracking-widest">HRS</span>
            </div>
            <span className="pb-4 text-lg font-black text-muted-foreground animate-pulse">:</span>
            <div
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl px-3.5 py-2.5 border shadow-inner",
                "bg-card/80",
                mood === "study" && "border-emerald-500/25",
                mood === "break" && "border-amber-500/25",
                mood === "sleep" && "border-indigo-500/25"
              )}
            >
              <span className="font-mono text-3xl font-black tabular-nums tracking-wider">{min}</span>
              <span className="text-[8px] font-bold text-muted-foreground tracking-widest">MIN</span>
            </div>
            <span className="pb-4 text-lg font-black text-muted-foreground animate-pulse">:</span>
            <div
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl px-3.5 py-2.5 border shadow-inner",
                "bg-card/80",
                mood === "study" && "border-emerald-500/25",
                mood === "break" && "border-amber-500/25",
                mood === "sleep" && "border-indigo-500/25"
              )}
            >
              <span className="font-mono text-3xl font-black tabular-nums tracking-wider">{s}</span>
              <span className="text-[8px] font-bold text-muted-foreground tracking-widest">SEC</span>
            </div>
          </div>

          <div className="flex gap-2 w-full">
            {!running && (
              <button
                onClick={() => void start()}
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
                  onClick={() => void stop()}
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
                  onClick={() => void stop()}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-destructive text-destructive-foreground font-bold text-sm"
                >
                  <Square className="h-4 w-4" /> Stop
                </button>
              </>
            )}
          </div>
        </div>

        {/* Live "studying now" toggle + list */}
        <div className="space-y-3">
          <button
            onClick={() => setShowLiveNow((v) => !v)}
            className="flex items-center gap-2 text-sm font-extrabold"
          >
            <Users className="h-4 w-4 text-sky-500" />
            এখন যারা অনলাইনে আছে
            <span className="text-[10px] font-bold text-muted-foreground">
              {showLiveNow ? "লুকাও" : "দেখাও"}
            </span>
          </button>
          {showLiveNow && (
            <div className="space-y-1.5">
              {(!liveNow || liveNow.length === 0) && (
                <p className="text-center text-xs text-muted-foreground py-4">
                  এখন কেউ সেশনে নেই।
                </p>
              )}
              {liveNow?.map((row: any) => {
                const md = MOOD_META[row.mood as Mood] || MOOD_META.study;
                const MIcon = md.icon;
                const t = formatHMS(row.duration_seconds);
                const isMe = row.user_id === user?.id;
                return (
                  <div
                    key={row.user_id}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg border px-2.5 py-2 bg-card/50",
                      isMe && "border-primary/40 bg-primary/5"
                    )}
                  >
                    <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0", md.color, "bg-current/10")}>
                      <MIcon className={cn("h-3.5 w-3.5", md.color)} />
                    </div>
                    <div className="flex-1 min-w-0 text-xs font-bold truncate">
                      {row.full_name || "Student"}
                      {isMe && " (তুমি)"}
                      {row.is_paused && <span className="text-muted-foreground font-normal"> · paused</span>}
                    </div>
                    <div className={cn("text-xs font-black font-mono flex-shrink-0", md.color)}>
                      {t.h}h {t.m}m
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Leaderboard — per mood */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            <h2 className="font-extrabold text-sm">Focus Leaderboard</h2>
          </div>

          <div className="flex gap-2">
            {(Object.keys(MOOD_META) as Mood[]).map((m) => {
              const md = MOOD_META[m];
              return (
                <button
                  key={m}
                  onClick={() => setLeaderboardMood(m)}
                  className={cn(
                    "flex-1 px-2 py-1.5 rounded-full text-[11px] font-bold border",
                    leaderboardMood === m
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border text-muted-foreground"
                  )}
                >
                  {md.label}
                </button>
              );
            })}
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
                এখনো কেউ এই মোডে সময় রেকর্ড করেনি।
              </p>
            )}
            {leaderboard?.map((row: any, i: number) => {
              const isMe = row.user_id === user?.id;
              const t = formatHMS(Number(row.total_seconds));
              const md = MOOD_META[leaderboardMood];
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
                  <div className={cn("h-8 w-8 rounded-lg border flex items-center justify-center font-extrabold text-xs flex-shrink-0", md.color, "bg-current/10")}>
                    {(row.full_name || "S").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0 text-xs font-bold truncate">
                    {row.full_name || "Student"}
                    {isMe && " (তুমি)"}
                  </div>
                  <div className={cn("text-xs font-black font-mono flex-shrink-0", md.color)}>
                    {t.h}h {t.m}m
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mood switch confirmation — shown when Study is running and user taps Break/Sleep */}
      {pendingMood && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-5">
          <div className="bg-card border rounded-2xl p-6 max-w-sm w-full space-y-4">
            <h3 className="text-base font-extrabold">⚠️ মোড পরিবর্তন</h3>
            <p className="text-sm text-muted-foreground">
              Study Timer চলছে। Break / Sleep Mode on করতে হলে আগে বন্ধ করো। এই সময়গুলো Top Focused rank এ count হয়।
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirmMoodSwitch}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm"
              >
                এই Mood বন্ধ করো
              </button>
              <button
                onClick={closeMoodPopup}
                className="flex-1 py-2.5 rounded-xl border font-bold text-sm hover:bg-muted"
              >
                বাতিল
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[60] bg-card border shadow-lg rounded-xl px-4 py-2.5 text-sm font-bold max-w-[90vw] text-center">
          {toast}
        </div>
      )}

      {/* Session summary — shown after Stop */}
      {stopStats && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-5">
          <div className="bg-card border rounded-2xl p-6 max-w-sm w-full space-y-4 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
            <h3 className="text-base font-extrabold">সেশন শেষ হয়েছে 🎉</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-muted/50 py-3">
                <div className="text-xl font-black">{stopStats.breaks}</div>
                <div className="text-[10px] font-bold text-muted-foreground flex items-center justify-center gap-1 mt-0.5">
                  <Coffee className="h-3 w-3" /> বিরতি
                </div>
              </div>
              <div className="rounded-xl bg-muted/50 py-3">
                <div className="text-xl font-black">
                  {formatHMS(stopStats.sleepSeconds).h}:{formatHMS(stopStats.sleepSeconds).m}
                </div>
                <div className="text-[10px] font-bold text-muted-foreground flex items-center justify-center gap-1 mt-0.5">
                  <Moon className="h-3 w-3" /> ঘুম
                </div>
              </div>
            </div>
            <button
              onClick={() => setStopStats(null)}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm"
            >
              ঠিক আছে
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FocusTimer;
