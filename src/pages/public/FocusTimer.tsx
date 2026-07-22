import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type Mood = "study" | "break" | "sleep";

const MOOD_META: Record<Mood, { label: string; icon: typeof BookOpen; color: string; bg: string }> = {
  study: { label: "Study", icon: BookOpen, color: "text-emerald-500", bg: "from-emerald-500 to-teal-500" },
  break: { label: "Break", icon: Coffee, color: "text-amber-500", bg: "from-amber-500 to-orange-500" },
  sleep: { label: "Sleep", icon: Moon, color: "text-indigo-400", bg: "from-indigo-500 to-violet-500" },
};

// AtlasApp-style always-on dark gradients per mood (inactive state), the vivid
// gradient + glow-pulse animation when active, and matching digital-timer box tint.
const MOOD_BTN_IDLE: Record<Mood, string> = {
  study: "bg-gradient-to-br from-[#0f4c2a] via-[#166534] to-[#15803d] border-emerald-500/40",
  break: "bg-gradient-to-br from-[#5c3a00] via-[#92400e] to-[#b45309] border-amber-500/30",
  sleep: "bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#3730a3] border-indigo-500/30",
};
const MOOD_BTN_ACTIVE: Record<Mood, string> = {
  study: "bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-700 border-emerald-500 shadow-[0_4px_16px_rgba(16,185,129,.4)] animate-mood-glow-study",
  break: "bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 border-amber-500 shadow-[0_4px_16px_rgba(245,158,11,.4)] animate-mood-glow-break",
  sleep: "bg-gradient-to-br from-indigo-500 via-indigo-600 to-indigo-700 border-indigo-500 shadow-[0_4px_16px_rgba(99,102,241,.4)] animate-mood-glow-sleep",
};
const MOOD_DIGIT_BOX: Record<Mood, string> = {
  study: "bg-gradient-to-br from-[#0d2a1a] to-[#0f3d22] border-emerald-500/30",
  break: "bg-gradient-to-br from-[#2a1800] to-[#3d2200] border-amber-500/30",
  sleep: "bg-gradient-to-br from-[#0e0d2a] to-[#17163d] border-indigo-500/30",
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
  const { user, profile } = useAuth();

  const [mood, setMood] = useState<Mood>("study");
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [leaderboardMood, setLeaderboardMood] = useState<Mood>("study");
  const [leaderboardDays, setLeaderboardDays] = useState(1);
  const [showLiveNow, setShowLiveNow] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<string>("all");
  const [breaksUsed, setBreaksUsed] = useState(0);
  const accumulatedBreakRef = useRef(0); // break seconds used before the current live break segment
  const accumulatedStudyRef = useRef(0); // study seconds accumulated before the current live study segment
  const pauseStartRef = useRef<number | null>(null);
  const autoSleepCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [stopStats, setStopStats] = useState<{ studySeconds: number; breaks: number; sleepSeconds: number } | null>(null);
  const sleepSecsRef = useRef(0); // accumulated sleep seconds across this run (for the stop summary)
  const [sessionNumber, setSessionNumber] = useState(1);
  const hasStoppedOnceRef = useRef(false);
  const [overlayMood, setOverlayMood] = useState<Mood | null>(null);
  const [compareTarget, setCompareTarget] = useState<{ userId: string; name: string; secs: number } | null>(null);
  const [cmpDays, setCmpDays] = useState(1);
  const [overlayDays, setOverlayDays] = useState(1);
  const [showIntro, setShowIntro] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);
  const pausedRef = useRef(false);
  const sessionIdRef = useRef<number | null>(null);
  const moodRef = useRef<Mood>("study");
  const resumedRef = useRef(false);

  useEffect(() => {
    document.title = "Focus Timer — Atlas";
    try {
      if (!localStorage.getItem("atlas_focus_intro_seen")) setShowIntro(true);
    } catch {
      /* ignore */
    }
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
    enabled: !!user,
  });

  const { data: overlayRanking } = useQuery({
    queryKey: ["focus-overlay-ranking", overlayMood, overlayDays],
    queryFn: async () => {
      if (!overlayMood) return [];
      const { data, error } = await supabase.rpc("focus_mood_leaderboard", {
        p_mood: overlayMood,
        p_days: overlayDays,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!overlayMood,
  });

  const { data: cmpDaily } = useQuery({
    queryKey: ["focus-compare-daily", compareTarget?.userId, cmpDays],
    queryFn: async () => {
      if (!compareTarget) return [];
      const { data, error } = await supabase.rpc("focus_compare_daily" as any, {
        p_other_user: compareTarget.userId,
        p_days: cmpDays,
      });
      if (error) throw error;
      return ((data as unknown) || []) as { user_id: string; day: string; total_seconds: number }[];
    },
    enabled: !!compareTarget && cmpDays > 1,
  });

  const { data: cmpBreaksToday } = useQuery({
    queryKey: ["focus-breaks-today", compareTarget?.userId, user?.id],
    queryFn: async () => {
      if (!compareTarget || !user) return { mine: 0, theirs: 0 };
      const [mine, theirs] = await Promise.all([
        supabase.rpc("focus_breaks_today" as any, { p_user_id: user.id }),
        supabase.rpc("focus_breaks_today" as any, { p_user_id: compareTarget.userId }),
      ]);
      return { mine: Number(mine.data || 0), theirs: Number(theirs.data || 0) };
    },
    enabled: !!compareTarget && !!user,
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
    const { data, error } = await supabase.rpc("focus_start_session", { p_mood: "study" });
    if (error || data == null) return;
    const id = data as number;
    elapsedRef.current = 0;
    pausedRef.current = false;
    sessionIdRef.current = id;
    moodRef.current = "study";
    setSessionId(id);
    setMood("study");
    setBreaksUsed(0);
    setSelectedBatch("all");
    setElapsed(0);
    setRunning(true);
    setPaused(false);
    startTicking();
    startHeartbeat();
    saveState({ sessionId: id, mood: "study", elapsed: 0, paused: false, userId: user.id, savedAt: Date.now() });
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
    pauseStartRef.current = Date.now(); // reset so further night-pauses keep converting to sleep, matching AtlasApp
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
    if (!running) {
      setToast("⚠️ আগে পড়াশোনা শুরু করো");
      setTimeout(() => setToast(null), 2500);
      return;
    }
    if (m === moodRef.current) return;
    void switchMood(m);
  };

  const closeOverlay = useCallback(() => {
    setOverlayMood(null);
    try {
      if (window.history.state?.focusOverlay) window.history.back();
    } catch {
      /* ignore */
    }
  }, []);

  // Back button closes the mood overlay instead of navigating away, matching AtlasApp.
  useEffect(() => {
    const onPopState = () => setOverlayMood(null);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const switchMood = async (m: Mood) => {
    if (!running) {
      setToast("⚠️ আগে পড়াশোনা শুরু করো");
      setTimeout(() => setToast(null), 2500);
      return;
    }
    if (m === moodRef.current) return;
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
    if (moodRef.current === "study") {
      accumulatedStudyRef.current += elapsedRef.current;
    }
    if (m === "break" && moodRef.current === "study") {
      setBreaksUsed((n) => n + 1);
    }
    setLeaderboardDays(1);
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
    const moodStartNames: Record<Mood, string> = { study: "📚 Study", break: "☕ বিরতি", sleep: "😴 ঘুম" };
    setToast(`${moodStartNames[m]} শুরু হলো`);
    setTimeout(() => setToast(null), 2500);
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
    setBreaksUsed((n) => n + 1);
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
    setToast("⏰ বিরতির সময় শেষ — Study Mood এ ফিরে এলে");
    setTimeout(() => setToast(null), 4000);
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
    if (moodRef.current === "study") {
      accumulatedStudyRef.current += elapsedRef.current;
    }
    clearState();
    setStopStats({ studySeconds: accumulatedStudyRef.current, breaks: breaksUsed, sleepSeconds: sleepSecsRef.current });
    hasStoppedOnceRef.current = true;
    sessionIdRef.current = null;
    setSessionId(null);
    setRunning(false);
    setPaused(false);
    setElapsed(0);
    accumulatedBreakRef.current = 0;
    accumulatedStudyRef.current = 0;
    sleepSecsRef.current = 0;
    setBreaksUsed(0);
    pauseStartRef.current = null;
    refetchLeaderboard();
    refetchLiveNow();
  };

  const dismissIntro = () => {
    setShowIntro(false);
    try {
      localStorage.setItem("atlas_focus_intro_seen", "1");
    } catch {
      /* ignore */
    }
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
        <button
          onClick={() => navigate("/focus-timer/history")}
          className="h-9 w-9 rounded-full border flex items-center justify-center hover:bg-muted flex-shrink-0"
          aria-label="Study History"
        >
          <Calendar className="h-4 w-4" />
        </button>
        {typeof myTotalToday === "number" && (
          <span className="text-xs font-bold text-emerald-500">
            আজ {formatHMS(myTotalToday).h}h {formatHMS(myTotalToday).m}m
          </span>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-5 space-y-6">
        {showIntro && (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm">ATLAS Focus Timer</h3>
                <p className="text-[11px] text-muted-foreground">মনোযোগী পড়াশোনার জন্য বাংলাদেশের সেরা টাইমার</p>
              </div>
              <button onClick={dismissIntro} className="text-xs font-bold text-muted-foreground hover:text-foreground">
                ✕
              </button>
            </div>

            <div className="rounded-xl border bg-card p-3 space-y-1.5">
              <div className="text-xs font-extrabold flex items-center gap-1">
                <Trophy className="h-3 w-3 text-primary" /> কেন ব্যবহার করবে?
              </div>
              <ul className="text-[11px] space-y-1 list-disc pl-4 text-muted-foreground">
                <li>পড়াশোনার সময় track করো এবং নিজেকে motivate রাখো</li>
                <li>Live দেখো কতজন student এই মুহূর্তে পড়ছে</li>
                <li>Top Focused Student হওয়ার সুযোগ পাও</li>
                <li>Study, Break ও Sleep Mood আলাদাভাবে track হবে</li>
              </ul>
            </div>

            <div className="space-y-2 text-xs">
              <div className="text-xs font-extrabold">কীভাবে ব্যবহার করবে?</div>
              <div className="flex items-start gap-2">
                <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground font-black text-[10px] flex items-center justify-center flex-shrink-0">১</span>
                <span>"পড়াশোনা শুরু করো" বাটনে চাপো — Study Mode timer শুরু হবে</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground font-black text-[10px] flex items-center justify-center flex-shrink-0">২</span>
                <span>ক্লান্ত হলে Break মোডে চাপো — Study pause হয়ে Break timer শুরু হবে</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground font-black text-[10px] flex items-center justify-center flex-shrink-0">৩</span>
                <span>Sleep Mode on থাকলে phone off করলেও timer চলতে থাকবে</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground font-black text-[10px] flex items-center justify-center flex-shrink-0">৪</span>
                <span>পড়া শেষে Stop — সময় সেভ হবে এবং rank update হবে</span>
              </div>
            </div>
            <button
              onClick={dismissIntro}
              className="w-full py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs"
            >
              পড়াশোনা শুরু করো
            </button>
          </div>
        )}
        {!user && (
          <div className="text-center text-sm text-muted-foreground bg-muted/40 rounded-xl p-4">
            টাইমার সেভ করতে লগইন করুন।
          </div>
        )}

        {/* User header — name/batch + Study Time History (matches AtlasApp position, above banner) */}
        <div className="flex items-center justify-between rounded-2xl border bg-card px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white font-black text-sm flex-shrink-0">
              {(profile?.full_name || "?").charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-xs font-extrabold">{profile?.full_name || "লোড হচ্ছে..."}</span>
              {profile?.hsc_batch && (
                <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full w-fit mt-0.5">
                  {profile.hsc_batch}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => document.getElementById("focus-leaderboard")?.scrollIntoView({ behavior: "smooth" })}
            className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground border rounded-lg px-2 py-1.5 hover:bg-muted"
          >
            <Trophy className="h-3 w-3" /> Study Time History
          </button>
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

        {/* Unified box — Mood row + Digital timer + Controls together, matching AtlasApp's timer-unified-box */}
        <div
          className={cn(
            "rounded-2xl p-4 flex flex-col items-center gap-4 border-2 shadow-sm",
            mood === "study" && "border-emerald-500/30 bg-emerald-500/5",
            mood === "break" && "border-amber-500/30 bg-amber-500/5",
            mood === "sleep" && "border-indigo-500/30 bg-indigo-500/5"
          )}
        >
          {/* Mood switcher (top row, inside unified box) */}
          <div className="grid grid-cols-3 gap-1.5 w-full">
            {(Object.keys(MOOD_META) as Mood[]).map((m) => {
              const md = MOOD_META[m];
              const MIcon = md.icon;
              const active = mood === m;
              return (
                <button
                  key={m}
                  onClick={() => requestSwitchMood(m)}
                  className={cn(
                    "relative overflow-hidden flex flex-col items-center gap-1 rounded-xl py-2 border-[1.5px] text-white transition-all duration-300",
                    active ? MOOD_BTN_ACTIVE[m] : MOOD_BTN_IDLE[m]
                  )}
                >
                  <MIcon className="h-4 w-4" />
                  <span className="text-[9px] font-extrabold tracking-wide">{md.label}</span>
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full transition-all",
                      active ? "bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]" : "bg-white/40"
                    )}
                  />
                </button>
              );
            })}
          </div>

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
                "flex flex-col items-center gap-1 rounded-xl px-3.5 py-2.5 border shadow-inner transition-colors duration-500",
                MOOD_DIGIT_BOX[mood]
              )}
            >
              <span className="font-mono text-3xl font-black tabular-nums tracking-wider text-white [text-shadow:0_0_12px_rgba(255,255,255,.25)]">{h}</span>
              <span className="text-[8px] font-bold text-white/60 tracking-widest">HRS</span>
            </div>
            <span className="pb-4 text-lg font-black text-muted-foreground animate-pulse">:</span>
            <div
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl px-3.5 py-2.5 border shadow-inner transition-colors duration-500",
                MOOD_DIGIT_BOX[mood]
              )}
            >
              <span className="font-mono text-3xl font-black tabular-nums tracking-wider text-white [text-shadow:0_0_12px_rgba(255,255,255,.25)]">{min}</span>
              <span className="text-[8px] font-bold text-white/60 tracking-widest">MIN</span>
            </div>
            <span className="pb-4 text-lg font-black text-muted-foreground animate-pulse">:</span>
            <div
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl px-3.5 py-2.5 border shadow-inner transition-colors duration-500",
                MOOD_DIGIT_BOX[mood]
              )}
            >
              <span className="font-mono text-3xl font-black tabular-nums tracking-wider text-white [text-shadow:0_0_12px_rgba(255,255,255,.25)]">{s}</span>
              <span className="text-[8px] font-bold text-white/60 tracking-widest">SEC</span>
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
            {running && mood === "study" && !paused && (
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
            {running && mood === "study" && paused && (
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
            {/* Break/Sleep mood: no Pause/Resume/Stop controls — switching mood (tabs above) is enough, matching AtlasApp exactly */}
          </div>
        </div>

        {/* Live count chips — tap Break/Sleep to see everyone in that mood right now (Atlas: live-stats-row, right after unified box) */}
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(MOOD_META) as Mood[]).map((m) => {
            const count = (liveNow || []).filter((r: any) => r.mood === m).length;
            const md = MOOD_META[m];
            return (
              <button
                key={m}
                onClick={() => {
                  setOverlayMood(m);
                  setOverlayDays(1);
                  try {
                    window.history.pushState({ focusOverlay: true }, "");
                  } catch {
                    /* ignore */
                  }
                }}
                className="flex flex-col items-center gap-0.5 rounded-xl border bg-card py-2 hover:bg-muted/50 transition-colors"
              >
                <span className={cn("text-lg font-black", md.color)}>{count}</span>
                <span className="text-[10px] font-bold text-muted-foreground">{md.label}</span>
              </button>
            );
          })}
        </div>

        {/* Live "studying now" toggle + list */}
        <div className="space-y-3">
          <button
            onClick={() => setShowLiveNow((v) => !v)}
            className="flex items-center gap-2 text-sm font-extrabold"
          >
            <Users className="h-4 w-4 text-sky-500" />
            {mood === "break" ? "☕ বিরতিতে আছে" : mood === "sleep" ? "😴 ঘুমাচ্ছে" : "এখন Live পড়ছে"}
            <span className="text-[10px] font-bold text-muted-foreground">
              {showLiveNow ? "লুকাও" : "দেখাও"}
            </span>
          </button>
          {showLiveNow && (
            <>
              {/* Batch filter chips — Atlas: batch-filter row, only shown when >1 batch present */}
              {(() => {
                const moodPool = mood === "study" ? (liveNow || []) : (liveNow || []).filter((r: any) => r.mood === mood);
                const batches = Array.from(
                  new Set(moodPool.map((r: any) => r.hsc_batch || "অন্যান্য"))
                );
                if (batches.length <= 1) return null;
                return (
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    <button
                      onClick={() => setSelectedBatch("all")}
                      className={cn(
                        "flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold border",
                        selectedBatch === "all"
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card border-border text-muted-foreground"
                      )}
                    >
                      সবাই ({moodPool.length})
                    </button>
                    {batches.map((b) => {
                      const cnt = moodPool.filter((r: any) => (r.hsc_batch || "অন্যান্য") === b).length;
                      return (
                        <button
                          key={b as string}
                          onClick={() => setSelectedBatch(b as string)}
                          className={cn(
                            "flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold border",
                            selectedBatch === b
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-card border-border text-muted-foreground"
                          )}
                        >
                          {b as string} ({cnt})
                        </button>
                      );
                    })}
                  </div>
                );
              })()}

              <div className="space-y-1.5">
                {(() => {
                  const moodPool = mood === "study" ? (liveNow || []) : (liveNow || []).filter((r: any) => r.mood === mood);
                  const filtered = moodPool.filter(
                    (r: any) => selectedBatch === "all" || (r.hsc_batch || "অন্যান্য") === selectedBatch
                  );
                  if (filtered.length === 0) {
                    const emptyMsg =
                      mood === "break"
                        ? "এই মুহূর্তে কেউ বিরতিতে নেই"
                        : mood === "sleep"
                        ? "এই মুহূর্তে কেউ ঘুমাচ্ছে না"
                        : "এই মুহূর্তে কেউ নেই";
                    return (
                      <p className="text-center text-xs text-muted-foreground py-4">
                        {emptyMsg}
                      </p>
                    );
                  }
                  return filtered.map((row: any) => {
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
                        <Avatar className="h-7 w-7 rounded-lg flex-shrink-0">
                          <AvatarImage src={row.avatar_url || undefined} alt={row.full_name || "Student"} />
                          <AvatarFallback className={cn("rounded-lg", md.color, "bg-current/10")}>
                            <MIcon className={cn("h-3.5 w-3.5", md.color)} />
                          </AvatarFallback>
                        </Avatar>
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
                  });
                })()}
              </div>
            </>
          )}
        </div>

        {/* Leaderboard — per mood */}
        <div id="focus-leaderboard" className="space-y-3">
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
            {/* Top 3 Podium — matches AtlasApp's Top Performers graph */}
            {leaderboard && leaderboard.length > 0 && (() => {
              const top3 = leaderboard.slice(0, 3);
              const maxSec = Math.max(1, ...top3.map((s: any) => Number(s.total_seconds)));
              const crowns = ["👑", "🥈", "🥉"];
              const rankLabels = ["১ম", "২য়", "৩য়"];
              const barColors = ["bg-amber-500", "bg-slate-400", "bg-amber-700"];
              const textColors = ["text-amber-500", "text-slate-400", "text-amber-700"];
              return (
                <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-primary/5 p-3 mb-2">
                  <div className="text-center text-[10px] font-black tracking-wider text-amber-500 mb-2.5 flex items-center justify-center gap-1">
                    <Trophy className="h-3 w-3" /> TOP PERFORMERS
                  </div>
                  <div className="flex items-end justify-center gap-2">
                    {top3.map((s: any, i: number) => {
                      const secs = Number(s.total_seconds);
                      const pct = Math.max(10, Math.round((secs / maxSec) * 72));
                      const t = formatHMS(secs);
                      return (
                        <div key={s.user_id} className="flex flex-col items-center gap-0.5 flex-1 min-w-0">
                          <div className="text-sm">{crowns[i]}</div>
                          <div className="w-full flex justify-center">
                            <div
                              className={cn("w-8 rounded-t", barColors[i])}
                              style={{ height: `${pct}px`, boxShadow: "0 0 8px rgba(0,0,0,0.15)" }}
                            />
                          </div>
                          <div className={cn("text-[10px] font-black", textColors[i])}>{rankLabels[i]}</div>
                          <div className="text-[10px] font-extrabold truncate max-w-[70px] text-center">
                            {s.full_name || "Student"}
                          </div>
                          <div className="text-[9px] text-muted-foreground">{t.h}h {t.m}m</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
            {leaderboard?.map((row: any, i: number) => {
              const isMe = row.user_id === user?.id;
              const t = formatHMS(Number(row.total_seconds));
              const md = MOOD_META[leaderboardMood];
              return (
                <button
                  key={row.user_id}
                  onClick={() => !isMe && (setCompareTarget({ userId: row.user_id, name: row.full_name || "Student", secs: Number(row.total_seconds) }), setCmpDays(1))}
                  className={cn(
                    "w-full flex items-center gap-2.5 rounded-lg border px-2.5 py-2 bg-card/50 text-left",
                    isMe && "border-primary/40 bg-primary/5",
                    !isMe && "hover:border-primary/30 transition-colors"
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
                </button>
              );
            })}
          </div>
        </div>
      </div>

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
            <div className="rounded-xl bg-primary/10 py-3">
              <div className="text-2xl font-black text-primary">
                {formatHMS(stopStats.studySeconds).h}h {formatHMS(stopStats.studySeconds).m}m
              </div>
              <div className="text-[11px] font-bold text-muted-foreground mt-0.5">পড়েছো</div>
            </div>
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
      {/* Full-screen mood overlay — everyone in Study/Break/Sleep, ranked by time, with period filter */}
      {overlayMood && (
        <div className="fixed inset-0 bg-background z-[70] flex flex-col">
          <div className="flex items-center gap-3 px-4 py-3 border-b">
            <button
              onClick={closeOverlay}
              className="h-9 w-9 rounded-full border flex items-center justify-center hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h2 className={cn("flex-1 font-extrabold text-base", MOOD_META[overlayMood].color)}>
              {MOOD_META[overlayMood].label} মোডে {overlayDays === 1 ? "এখন যারা আছে" : "যারা সময় দিয়েছে"}
            </h2>
          </div>
          <div className="flex gap-2 px-4 py-2.5 border-b overflow-x-auto">
            {[1, 3, 7, 15, 30].map((d) => (
              <button
                key={d}
                onClick={() => setOverlayDays(d)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-[11px] font-bold border flex-shrink-0",
                  overlayDays === d
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border text-muted-foreground"
                )}
              >
                {d === 1 ? "আজকে" : `${d} দিন`}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
            {overlayDays === 1 ? (
              <>
                {(liveNow || []).filter((r: any) => r.mood === overlayMood).length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-10">এখন কেউ এই মোডে নেই।</p>
                )}
                {(liveNow || [])
                  .filter((r: any) => r.mood === overlayMood)
                  .sort((a: any, b: any) => b.duration_seconds - a.duration_seconds)
                  .map((row: any, i: number) => {
                    const md = MOOD_META[overlayMood];
                    const MIcon = md.icon;
                    const t = formatHMS(row.duration_seconds);
                    const isMe = row.user_id === user?.id;
                    return (
                      <div
                        key={row.user_id}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 bg-card/50",
                          isMe && "border-primary/40 bg-primary/5"
                        )}
                      >
                        <div className="w-6 text-center font-black text-xs text-muted-foreground font-mono">
                          #{i + 1}
                        </div>
                        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0", md.color, "bg-current/10")}>
                          <MIcon className={cn("h-4 w-4", md.color)} />
                        </div>
                        <div className="flex-1 min-w-0 text-sm font-bold truncate">
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
              </>
            ) : (
              <>
                {(!overlayRanking || overlayRanking.length === 0) && (
                  <p className="text-center text-sm text-muted-foreground py-10">এই সময়ে কেউ এই মোডে সময় দেয়নি।</p>
                )}
                {overlayRanking?.map((row: any, i: number) => {
                  const md = MOOD_META[overlayMood];
                  const t = formatHMS(Number(row.total_seconds));
                  const isMe = row.user_id === user?.id;
                  return (
                    <div
                      key={row.user_id}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 bg-card/50",
                        isMe && "border-primary/40 bg-primary/5"
                      )}
                    >
                      <div className="w-6 text-center font-black text-xs text-muted-foreground font-mono">
                        #{i + 1}
                      </div>
                      <div className={cn("h-8 w-8 rounded-lg border flex items-center justify-center font-extrabold text-xs flex-shrink-0", md.color, "bg-current/10")}>
                        {(row.full_name || "S").charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0 text-sm font-bold truncate">
                        {row.full_name || "Student"}
                        {isMe && " (তুমি)"}
                      </div>
                      <div className={cn("text-xs font-black font-mono flex-shrink-0", md.color)}>
                        {t.h}h {t.m}m
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}
      {/* Compare modal — tap any leaderboard row to compare against yourself */}
      {compareTarget && (() => {
        const myRow = leaderboard?.find((r: any) => r.user_id === user?.id);
        const snapshotMySecs = myRow ? Number(myRow.total_seconds) : 0;

        let mySecs = snapshotMySecs;
        let theirSecs = compareTarget.secs;
        if (cmpDays > 1 && cmpDaily) {
          mySecs = cmpDaily.filter((r) => r.user_id === user?.id).reduce((a, r) => a + Number(r.total_seconds), 0);
          theirSecs = cmpDaily.filter((r) => r.user_id === compareTarget.userId).reduce((a, r) => a + Number(r.total_seconds), 0);
        }

        const maxSec = Math.max(mySecs, theirSecs, 1);
        const meW = Math.round((mySecs / maxSec) * 100);
        const thW = Math.round((theirSecs / maxSec) * 100);
        const ahead = mySecs >= theirSecs;
        const diff = Math.abs(mySecs - theirSecs);
        const diffFmt = formatHMS(diff);

        const dayKeys: string[] = [];
        if (cmpDays > 1) {
          for (let i = cmpDays - 1; i >= 0; i--) {
            dayKeys.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
          }
        }
        const myDailyMap = new Map((cmpDaily || []).filter((r) => r.user_id === user?.id).map((r) => [r.day, Number(r.total_seconds)]));
        const theirDailyMap = new Map((cmpDaily || []).filter((r) => r.user_id === compareTarget.userId).map((r) => [r.day, Number(r.total_seconds)]));
        const graphMax = Math.max(1, ...dayKeys.map((d) => Math.max(myDailyMap.get(d) || 0, theirDailyMap.get(d) || 0)));

        return (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-5">
            <div className="bg-card border rounded-2xl p-6 max-w-sm w-full space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-extrabold">তুলনা করো</h3>
                <button
                  onClick={() => setCompareTarget(null)}
                  className="h-8 w-8 rounded-full border flex items-center justify-center hover:bg-muted"
                >
                  ✕
                </button>
              </div>

              <div className="flex gap-1.5 overflow-x-auto">
                {[1, 3, 7, 15, 30].map((d) => (
                  <button
                    key={d}
                    onClick={() => setCmpDays(d)}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-bold border flex-shrink-0",
                      cmpDays === d ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground"
                    )}
                  >
                    {d === 1 ? "আজকে" : `${d} দিন`}
                  </button>
                ))}
              </div>

              <div className="space-y-2.5">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>তুমি</span>
                    <span className="text-primary">{formatHMS(mySecs).h}h {formatHMS(mySecs).m}m</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${meW}%` }} />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>{compareTarget.name}</span>
                    <span className="text-indigo-400">{formatHMS(theirSecs).h}h {formatHMS(theirSecs).m}m</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${thW}%` }} />
                  </div>
                </div>
              </div>

              {cmpDays === 1 && cmpBreaksToday && (
                <div className="rounded-lg border px-3 py-2 flex items-center justify-between text-xs font-bold bg-muted/30">
                  <span className="text-muted-foreground">বিরতি (আজ)</span>
                  <span>
                    তুমি: {cmpBreaksToday.mine}টি &nbsp;|&nbsp; {compareTarget.name}: {cmpBreaksToday.theirs}টি
                  </span>
                </div>
              )}

              {cmpDays > 1 && (
                <div className="border-t pt-2.5 space-y-1.5">
                  <div className="flex items-end gap-[3px] h-9">
                    {dayKeys.map((d) => {
                      const mv = myDailyMap.get(d) || 0;
                      const tv = theirDailyMap.get(d) || 0;
                      const mh = Math.max(2, Math.round((mv / graphMax) * 36));
                      const th = Math.max(2, Math.round((tv / graphMax) * 36));
                      return (
                        <div key={d} className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
                          <div className="flex items-end gap-[1.5px]" style={{ height: 36 }}>
                            <div className="w-[5px] rounded-t bg-primary" style={{ height: mh }} />
                            <div className="w-[5px] rounded-t bg-indigo-400" style={{ height: th }} />
                          </div>
                          <div className="text-[6.5px] text-muted-foreground whitespace-nowrap">{d.slice(5).replace("-", "/")}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-3 justify-center text-[8px] text-muted-foreground">
                    <span><span className="inline-block w-[7px] h-[7px] rounded-sm bg-primary mr-1 align-middle" />তুমি</span>
                    <span><span className="inline-block w-[7px] h-[7px] rounded-sm bg-indigo-400 mr-1 align-middle" />{compareTarget.name}</span>
                  </div>
                </div>
              )}

              <div
                className={cn(
                  "rounded-xl px-3 py-2.5 text-xs font-bold text-center",
                  ahead ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
                )}
              >
                {diff === 0
                  ? "সমান সমান! একটু বেশি পড়লেই এগিয়ে যাবে।"
                  : ahead
                  ? `তুমি ${diffFmt.h}h ${diffFmt.m}m এগিয়ে আছো! এই ধারা বজায় রাখো — বিরতি কম নিলে rank আরো ভালো হবে।`
                  : `${diffFmt.h}h ${diffFmt.m}m পিছিয়ে আছো। বিরতি কমাও এবং একটানা পড়ার session বাড়াও — তাহলে দ্রুত এগিয়ে যাবে।`}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default FocusTimer;
