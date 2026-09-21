import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Trash2,
  Flame,
  PartyPopper,
  Lock,
  Unlock,
} from "lucide-react";
import PublicHeader from "@/components/PublicHeader";
import { cn } from "@/lib/utils";
import { useFocusLock } from "@/hooks/useFocusLock";
import { isStandaloneDisplay } from "@/pwa/usePWADisplayMode";

const CIRCUMFERENCE = 502.65; // 2 * pi * 80

interface PomoSession {
  task: string;
  duration: number;
  completedAt: string;
  success: boolean;
}

interface PersistedRun {
  currentTask: string;
  totalTime: number;
  running: boolean;
  // when running: endAt (ms epoch) is the source of truth for remaining time
  endAt: number | null;
  // when paused: remaining seconds frozen at pause time
  pausedTimeLeft: number | null;
}

interface DailyStat {
  total: number;
  completed: number;
}

interface PomoStats {
  streak: number;
  dailyStats: Record<string, DailyStat>;
}

function formatSeconds(sRaw: number) {
  const s = Math.max(0, Math.floor(sRaw));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function toBanglaDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleString("bn-BD", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return dateStr || "—";
  }
}

function storageKey(base: string, phone?: string | null) {
  return `${base}_${phone || "guest"}`;
}

function loadRun(phone?: string | null): PersistedRun | null {
  try {
    const raw = localStorage.getItem(storageKey("pomo_run", phone));
    return raw ? (JSON.parse(raw) as PersistedRun) : null;
  } catch {
    return null;
  }
}

function saveRun(phone: string | null | undefined, run: PersistedRun) {
  try {
    localStorage.setItem(storageKey("pomo_run", phone), JSON.stringify(run));
  } catch {
    /* ignore */
  }
}

function clearRun(phone?: string | null) {
  try {
    localStorage.removeItem(storageKey("pomo_run", phone));
  } catch {
    /* ignore */
  }
}

const PRESETS = [
  { label: "25 মিনিট", mins: 25 },
  { label: "45 মিনিট", mins: 45 },
  { label: "১ ঘণ্টা", mins: 60 },
  { label: "১.৫ ঘণ্টা", mins: 90 },
  { label: "২ ঘণ্টা", mins: 120 },
];

const Pomodoro = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const phone = profile?.phone;

  const [task, setTask] = useState("");
  const [hoursInput, setHoursInput] = useState("");
  const [minsInput, setMinsInput] = useState("");
  const [activePreset, setActivePreset] = useState<number | null>(null);

  const [totalTime, setTotalTime] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [running, setRunning] = useState(false);
  const [currentTask, setCurrentTask] = useState("");
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  const [sessions, setSessions] = useState<PomoSession[]>([]);
  const [stats, setStats] = useState<PomoStats>({ streak: 0, dailyStats: {} });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endAtRef = useRef<number>(0);

  // Focus Lock: while ON and the clock is running, block accidental exits (see useFocusLock for what a
  // website can and cannot do). Preference is remembered per device.
  const [focusLockOn, setFocusLockOn] = useState<boolean>(() => {
    try { return localStorage.getItem("pomo_focus_lock") === "1"; } catch { return false; }
  });
  const setLock = (next: boolean) => {
    setFocusLockOn(next);
    try { localStorage.setItem("pomo_focus_lock", next ? "1" : "0"); } catch { /* ignore */ }
    // Needed so the "come back to focus" notification can be shown while the app is in the background.
    if (next && typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  };
  const toggleFocusLock = () => setLock(!focusLockOn);
  const isPWA = isStandaloneDisplay();
  const [showPinGuide, setShowPinGuide] = useState(false);
  const lockActive = focusLockOn && running;
  const focus = useFocusLock(lockActive);
  // Hold-to-confirm for Pause / Reset while locked (3s), so a stray tap can't break focus.
  const [holdPct, setHoldPct] = useState(0);
  const holdRef = useRef<{ t: ReturnType<typeof setInterval> | null; start: number }>({ t: null, start: 0 });
  const HOLD_MS = 3000;
  const startHold = (action: () => void) => {
    if (!lockActive) { action(); return; }
    holdRef.current.start = Date.now();
    holdRef.current.t = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - holdRef.current.start) / HOLD_MS) * 100);
      setHoldPct(pct);
      if (pct >= 100) { cancelHold(); action(); }
    }, 50);
  };
  const cancelHold = () => {
    if (holdRef.current.t) clearInterval(holdRef.current.t);
    holdRef.current.t = null;
    setHoldPct(0);
  };
  useEffect(() => () => { if (holdRef.current.t) clearInterval(holdRef.current.t); }, []);
  useEffect(() => { if (!running) focus.resetStats(); }, [running]);

  useEffect(() => {
    document.title = "Pomodoro Clock — Atlas";
    try {
      const rawSessions = localStorage.getItem(storageKey("pomo_sessions", phone));
      if (rawSessions) setSessions(JSON.parse(rawSessions));
      const rawStats = localStorage.getItem(storageKey("pomo_stats", phone));
      if (rawStats) setStats(JSON.parse(rawStats));
    } catch {
      /* corrupt local data, start fresh */
    }

    // Restore an in-progress or paused clock so leaving/reloading the page
    // never resets it to zero — the clock keeps running in the background
    // based on the real endAt timestamp, exactly like leaving it physically running.
    const run = loadRun(phone);
    if (run && run.totalTime > 0) {
      setTotalTime(run.totalTime);
      setCurrentTask(run.currentTask);
      if (run.running && run.endAt) {
        const remaining = Math.round((run.endAt - Date.now()) / 1000);
        if (remaining <= 0) {
          setTimeLeft(0);
          setRunning(false);
          setShowCompletionModal(true);
          clearRun(phone);
        } else {
          setTimeLeft(remaining);
          setRunning(true);
          endAtRef.current = run.endAt;
          tickFrom(run.endAt);
        }
      } else if (run.pausedTimeLeft != null) {
        setTimeLeft(run.pausedTimeLeft);
        setRunning(false);
      }
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);

  const saveSessions = (next: PomoSession[]) => {
    setSessions(next);
    try {
      localStorage.setItem(storageKey("pomo_sessions", phone), JSON.stringify(next));
    } catch {
      /* storage full/unavailable, ignore */
    }
  };

  const saveStats = (next: PomoStats) => {
    setStats(next);
    try {
      localStorage.setItem(storageKey("pomo_stats", phone), JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const tickFrom = (endAt: number) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      const remaining = Math.round((endAt - Date.now()) / 1000);
      if (remaining <= 0) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setTimeLeft(0);
        setRunning(false);
        setShowCompletionModal(true);
        clearRun(phone);
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification("⏱️ ATLAS Pomodoro সম্পন্ন!", {
            body: `"${currentTask}" — টাইম শেষ! বিরতি নিন।`,
          });
        }
        return;
      }
      setTimeLeft(remaining);
    }, 1000);
  };

  const start = () => {
    const trimmedTask = task.trim();
    const activeTask = trimmedTask || currentTask || "টাস্ক";

    let secs = timeLeft;
    if (timeLeft <= 0 || timeLeft === totalTime) {
      const h = parseInt(hoursInput) || 0;
      const m = parseInt(minsInput) || 0;
      const custom = h * 3600 + m * 60;
      if (custom > 0) {
        secs = custom;
        setTotalTime(custom);
      } else if (totalTime > 0) {
        secs = totalTime;
      } else {
        alert("টাইম সেট করুন");
        return;
      }
    }

    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission();
    }

    setCurrentTask(activeTask);
    setTimeLeft(secs);
    setRunning(true);
    const endAt = Date.now() + secs * 1000;
    endAtRef.current = endAt;
    tickFrom(endAt);
    saveRun(phone, { currentTask: activeTask, totalTime: totalTime || secs, running: true, endAt, pausedTimeLeft: null });
  };

  const pause = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(false);
    saveRun(phone, { currentTask, totalTime, running: false, endAt: null, pausedTimeLeft: timeLeft });
  };

  const resume = () => {
    const endAt = Date.now() + timeLeft * 1000;
    endAtRef.current = endAt;
    setRunning(true);
    tickFrom(endAt);
    saveRun(phone, { currentTask, totalTime, running: true, endAt, pausedTimeLeft: null });
  };

  // One tap: Focus Lock ON + start/resume the clock. Fullscreen must be requested inside a user gesture, so it is
  // triggered right here as well (the hook re-requests it harmlessly if it is already fullscreen).
  const startFocus = () => {
    setLock(true);
    try {
      if (!document.fullscreenElement) void document.documentElement.requestFullscreen?.();
    } catch { /* unsupported */ }
    if (running) return;
    if (timeLeft > 0) resume();
    else start();
  };

  // Only Pause <-> Resume — no separate stop control, per design.
  const toggle = () => {
    if (running) pause();
    else if (timeLeft > 0) resume();
    else start();
  };

  // Reset: fully stops the current run and restarts fresh from the last set duration.
  const reset = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    clearRun(phone);
    setRunning(false);
    if (totalTime > 0) {
      setTimeLeft(totalTime);
      saveRun(phone, { currentTask, totalTime, running: false, endAt: null, pausedTimeLeft: totalTime });
    } else {
      setTimeLeft(0);
    }
  };

  const applyPreset = (mins: number, idx: number) => {
    if (running) {
      alert("আগে পজ করুন");
      return;
    }
    const secs = mins * 60;
    setTotalTime(secs);
    setTimeLeft(secs);
    setMinsInput(String(mins));
    setHoursInput("0");
    setActivePreset(idx);
    const activeTask = task.trim() || "Study Session";
    setCurrentTask(activeTask);
    setTimeout(() => {
      setCurrentTask((ct) => {
        const t = ct || activeTask;
        const endAt = Date.now() + secs * 1000;
        endAtRef.current = endAt;
        setRunning(true);
        tickFrom(endAt);
        saveRun(phone, { currentTask: t, totalTime: secs, running: true, endAt, pausedTimeLeft: null });
        return t;
      });
    }, 500);
  };

  const applySetup = () => {
    if (running) {
      alert("আগে পজ করুন");
      return;
    }
    const h = parseInt(hoursInput) || 0;
    const m = parseInt(minsInput) || 0;
    const total = h * 3600 + m * 60;
    if (total <= 0) {
      alert("সময় সেট করুন");
      return;
    }
    setTotalTime(total);
    setTimeLeft(total);
    setActivePreset(null);
    const activeTask = task.trim();
    if (activeTask) setCurrentTask(activeTask);
    setTimeout(() => {
      setCurrentTask((ct) => {
        const t = ct || activeTask || "Study Session";
        const endAt = Date.now() + total * 1000;
        endAtRef.current = endAt;
        setRunning(true);
        tickFrom(endAt);
        saveRun(phone, { currentTask: t, totalTime: total, running: true, endAt, pausedTimeLeft: null });
        return t;
      });
    }, 500);
  };

  const completeSession = (success: boolean) => {
    setShowCompletionModal(false);
    clearRun(phone);
    const session: PomoSession = {
      task: currentTask,
      duration: totalTime,
      completedAt: new Date().toISOString(),
      success,
    };
    saveSessions([session, ...sessions].slice(0, 20));

    const today = new Date().toISOString().split("T")[0];
    const next: PomoStats = { streak: stats.streak, dailyStats: { ...stats.dailyStats } };
    const dayStat = next.dailyStats[today] || { total: 0, completed: 0 };
    dayStat.total += 1;
    if (success) {
      dayStat.completed += 1;
      next.streak = (next.streak || 0) + 1;
    } else {
      next.streak = 0;
    }
    next.dailyStats[today] = dayStat;
    saveStats(next);
  };

  const deleteSession = (index: number) => {
    if (!confirm("এই সেশন মুছে ফেলবেন?")) return;
    const next = sessions.filter((_, i) => i !== index);
    saveSessions(next);
  };

  const last3Days = (() => {
    const today = new Date();
    const days: { key: string; rate: number; label: string }[] = [];
    for (let i = 2; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      const s = stats.dailyStats[key] || { total: 0, completed: 0 };
      const rate = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
      days.push({ key, rate, label: i === 0 ? "আজ" : i === 1 ? "গতকাল" : "২ দিন আগে" });
    }
    return days;
  })();
  const hasGraphData = last3Days.some((d) => d.rate > 0);

  // Clockwise fill toward completion: the ring fills up (not drains) as time
  // elapses, reaching 100% exactly when the countdown hits zero.
  const elapsedProgress = totalTime > 0 ? Math.min(1, Math.max(0, (totalTime - timeLeft) / totalTime)) : 0;
  const offset = CIRCUMFERENCE * (1 - elapsedProgress);
  const percentDone = Math.round(elapsedProgress * 100);
  const warning = timeLeft <= 60 && running;

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
        <h1 className="flex-1 font-extrabold text-[17px]">Pomodoro Clock</h1>
        <button
          onClick={toggleFocusLock}
          title="Focus Lock"
          className={cn(
            "flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-bold border",
            focusLockOn ? "bg-red-500 text-white border-red-500" : "bg-transparent text-muted-foreground border-border"
          )}
        >
          {focusLockOn ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
          Focus Lock {focusLockOn ? "ON" : "OFF"}
        </button>
        {stats.streak > 0 && (
          <span className="flex items-center gap-1 text-xs font-bold text-orange-500">
            <Flame className="h-3.5 w-3.5" /> {stats.streak}
          </span>
        )}
      </div>

      <div className="max-w-md mx-auto px-4 pt-6 flex flex-col gap-5">
        {focus.justReturned && lockActive && (
          <div className="rounded-xl border-2 border-red-500 bg-red-50 dark:bg-red-950 p-3 flex items-start gap-2">
            <span className="text-lg">⚠️</span>
            <div className="flex-1 text-sm">
              <p className="font-bold text-red-700 dark:text-red-300">ফোকাস ভেঙে গেছে!</p>
              <p className="text-xs text-red-700/80 dark:text-red-300/80">
                আপনি {focus.justReturned.secs} সেকেন্ড অ্যাপের বাইরে ছিলেন। টাইমার চলছে — মনোযোগ ফিরিয়ে আনুন।
              </p>
            </div>
            <button onClick={focus.dismissReturned} className="text-xs font-bold underline text-red-700 dark:text-red-300">ঠিক আছে</button>
          </div>
        )}
        {/* Watch card */}
        <div className="relative rounded-2xl border bg-gradient-to-br from-indigo-950 to-slate-900 p-5 flex flex-col items-center overflow-hidden">
          {/* Progress % badge — top right corner, fills to 100% exactly as time runs out */}
          {totalTime > 0 && (
            <div
              className={cn(
                "absolute top-3 right-3 px-2.5 py-1 rounded-full text-[11px] font-black font-mono tabular-nums border shadow-sm",
                warning
                  ? "bg-red-500/20 border-red-400/40 text-red-300"
                  : "bg-indigo-500/20 border-indigo-400/40 text-indigo-200"
              )}
            >
              {percentDone}%
            </div>
          )}

          <div className="text-[10px] tracking-[3px] uppercase text-indigo-300/70 font-semibold mb-2">
            ATLAS Pomodoro Watch
          </div>
          <div className="relative h-44 w-44 flex items-center justify-center">
            <svg viewBox="0 0 180 180" className="h-full w-full absolute inset-0 -rotate-90">
              {/* Watch-face tick marks — 12 major (hour) ticks, thin minute ticks between */}
              {Array.from({ length: 60 }).map((_, i) => {
                const isMajor = i % 5 === 0;
                const tickAngle = (i / 60) * 2 * Math.PI;
                const rOuter = 68;
                const rInner = isMajor ? 62 : 65;
                const x1 = 90 + rOuter * Math.cos(tickAngle);
                const y1 = 90 + rOuter * Math.sin(tickAngle);
                const x2 = 90 + rInner * Math.cos(tickAngle);
                const y2 = 90 + rInner * Math.sin(tickAngle);
                return (
                  <line
                    key={i}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={isMajor ? "rgba(165,180,252,0.45)" : "rgba(129,140,248,0.2)"}
                    strokeWidth={isMajor ? 1.6 : 0.8}
                    strokeLinecap="round"
                  />
                );
              })}
              <circle cx="90" cy="90" r="80" fill="none" stroke="rgba(99,102,241,0.15)" strokeWidth="4" />
              {/* Clockwise fill: ring grows from 0 to full circumference as time elapses */}
              <circle
                cx="90"
                cy="90"
                r="80"
                fill="none"
                stroke="url(#pomoGrad)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={offset}
                className={cn("transition-all duration-1000", warning && "drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]")}
              />
              <defs>
                <linearGradient id="pomoGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#6366F1" />
                  <stop offset="100%" stopColor="#818CF8" />
                </linearGradient>
              </defs>
              {/* Leading-edge flame: real flame-shaped icon, flickers, rides the progress arc, always points up */}
              {(() => {
                const angle = elapsedProgress * 2 * Math.PI;
                const dx = 90 + 80 * Math.cos(angle);
                const dy = 90 + 80 * Math.sin(angle);
                return (
                  <g transform={`translate(${dx} ${dy}) rotate(90) scale(0.28)`}>
                    <g className="animate-flame-flicker" style={{ transformBox: "fill-box", transformOrigin: "center" }}>
                      <path
                        d="M0 -14C-5 -8 -8 -2 -8 3C-8 9 -4.5 13 0 13C4.5 13 8 9 8 3C8 0 6.5 -2.5 5 -4.5C5.5 -1.5 4 1 2 1C-0.5 1 -1.5 -1.5 -1 -4C-0.5 -6.5 -1.5 -9 -2.5 -10.5C-2.5 -8 -3 -6 -4.5 -4.5C-5.5 -3.5 -6 -2 -6 -0.5C-6 2 -4 4 -1.5 4C0.8 4 2.5 2 2.5 -0.3C2.5 -1.3 2 -2 1.5 -2.8C2.8 -2 4 -0.3 4 2C4 5 1.5 7.5 -1.5 7.5C-4.8 7.5 -7 5 -7 1.5C-7 -3.5 -3 -7.5 -3 -12C-3 -13 -2 -14 0 -14Z"
                        fill="url(#flameGrad)"
                      />
                    </g>
                  </g>
                );
              })()}
              <defs>
                <radialGradient id="flameGrad" cx="50%" cy="65%" r="70%">
                  <stop offset="0%" stopColor="#FFF7ED" />
                  <stop offset="30%" stopColor="#FDE68A" />
                  <stop offset="60%" stopColor="#F97316" />
                  <stop offset="100%" stopColor="#B91C1C" />
                </radialGradient>
              </defs>
            </svg>
          </div>

          {/* Digit boxes — HRS / MIN / SEC, matching Focus Timer's style */}
          {(() => {
            const total = Math.max(0, Math.floor(timeLeft));
            const h = String(Math.floor(total / 3600)).padStart(2, "0");
            const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
            const s = String(total % 60).padStart(2, "0");
            const boxClass = cn(
              "flex flex-col items-center gap-1 rounded-xl px-3.5 py-2.5 border transition-colors duration-500 shadow-[0_2px_8px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.07)]",
              warning
                ? "bg-gradient-to-br from-[#2a0d0d] to-[#3d0f0f] border-red-500/30"
                : "bg-gradient-to-br from-[#0e0d2a] to-[#17163d] border-indigo-500/30"
            );
            return (
              <div className="flex items-center gap-1.5 mt-1">
                <div className={boxClass}>
                  <span className="font-mono text-3xl font-black tabular-nums tracking-wider text-white [text-shadow:0_0_4px_rgba(255,255,255,.18)]">{h}</span>
                  <span className="text-[9px] font-bold text-white/70 tracking-wide">HRS</span>
                </div>
                <span className="pb-4 text-lg font-black text-muted-foreground animate-colon-blink">:</span>
                <div className={boxClass}>
                  <span className="font-mono text-3xl font-black tabular-nums tracking-wider text-white [text-shadow:0_0_4px_rgba(255,255,255,.18)]">{m}</span>
                  <span className="text-[9px] font-bold text-white/70 tracking-wide">MIN</span>
                </div>
                <span className="pb-4 text-lg font-black text-muted-foreground animate-colon-blink">:</span>
                <div className={boxClass}>
                  <span className="font-mono text-3xl font-black tabular-nums tracking-wider text-white [text-shadow:0_0_4px_rgba(255,255,255,.18)]">{s}</span>
                  <span className="text-[9px] font-bold text-white/70 tracking-wide">SEC</span>
                </div>
              </div>
            );
          })()}

          {/* Pause <-> Resume control, plus a Reset button that restarts fresh */}
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={lockActive ? undefined : toggle}
              onPointerDown={lockActive ? () => startHold(toggle) : undefined}
              onPointerUp={lockActive ? cancelHold : undefined}
              onPointerLeave={lockActive ? cancelHold : undefined}
              onPointerCancel={lockActive ? cancelHold : undefined}
              className="relative h-12 w-12 rounded-full bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/40 hover:bg-indigo-400"
            >
              {running ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-current ml-0.5" />}
            </button>
            {totalTime > 0 && (
              <button
                onClick={lockActive ? undefined : reset}
                onPointerDown={lockActive ? () => startHold(reset) : undefined}
                onPointerUp={lockActive ? cancelHold : undefined}
                onPointerLeave={lockActive ? cancelHold : undefined}
                onPointerCancel={lockActive ? cancelHold : undefined}
                title="রিসেট করুন"
                className="h-10 w-10 rounded-full bg-white/10 border border-indigo-400/30 text-indigo-200 flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
          </div>

          {!lockActive && (
            <button
              onClick={startFocus}
              className="mt-3 w-full rounded-xl bg-red-500 hover:bg-red-600 text-white font-extrabold text-sm py-2.5 flex items-center justify-center gap-2 shadow-lg shadow-red-500/30"
            >
              <Lock className="h-4 w-4" /> Start Focus (ফোকাস মোড + টাইমার)
            </button>
          )}

          {lockActive && (
            <div className="mt-3 w-full text-center space-y-1.5">
              {holdPct > 0 ? (
                <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-red-400" style={{ width: `${holdPct}%` }} />
                </div>
              ) : (
                <p className="text-[10px] text-indigo-200/80">🔒 Focus Lock চালু — Pause/Reset করতে ৩ সেকেন্ড চেপে ধরুন</p>
              )}
              {focus.leaves > 0 && (
                <p className="text-[10px] font-bold text-red-300">
                  ⚠️ {focus.leaves} বার অ্যাপ ছেড়েছেন ({focus.awaySeconds}s)
                </p>
              )}
            </div>
          )}
        </div>

        {focusLockOn && (
          <div className="rounded-2xl border-2 border-red-500/60 bg-card p-4 space-y-2">
            <button onClick={() => setShowPinGuide((v) => !v)} className="w-full flex items-center justify-between text-left">
              <span className="font-bold text-sm">🔒 ফোন থেকে বের হওয়া সম্পূর্ণ আটকাতে (Screen Pin)</span>
              <span className="text-xs text-muted-foreground">{showPinGuide ? "লুকান" : "দেখুন"}</span>
            </button>
            {showPinGuide && (
              <div className="text-xs text-muted-foreground space-y-1.5 leading-relaxed">
                <p>ওয়েবসাইট ফোনের Home বাটন আটকাতে পারে না — এটা শুধু ফোনের নিজস্ব <b>Screen Pinning</b> দিয়ে সম্ভব:</p>
                <p><b>১.</b> Settings → Security (বা Biometrics &amp; security) → Advanced → <b>Pin windows / Screen pinning</b> চালু করুন।</p>
                <p><b>২.</b> এই অ্যাপ খুলে Recent apps (▢) চাপুন → অ্যাপের আইকনে চাপ দিন → <b>Pin this app</b>।</p>
                <p><b>৩.</b> বের হতে: Back ও Recent বাটন একসাথে ধরে রাখুন (বা Back + Home)।</p>
                {!isPWA && <p className="text-amber-600">💡 আরও ভালো অভিজ্ঞতার জন্য অ্যাপটি Install করে (Add to Home Screen) ব্যবহার করুন।</p>}
              </div>
            )}
          </div>
        )}

        {/* Setup card */}
        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <h3 className="font-bold text-sm">সেটআপ</h3>
          <div className="flex gap-1.5 flex-wrap">
            {PRESETS.map((p, i) => (
              <button
                key={p.label}
                onClick={() => applyPreset(p.mins, i)}
                className={cn(
                  "px-2.5 py-1.5 rounded-lg text-[11px] font-bold border",
                  activePreset === i
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-transparent border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[10px] text-muted-foreground mb-1">ঘণ্টা</div>
              <input
                type="number"
                min={0}
                max={23}
                value={hoursInput}
                onChange={(e) => setHoursInput(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
              />
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground mb-1">মিনিট</div>
              <input
                type="number"
                min={0}
                max={59}
                value={minsInput}
                onChange={(e) => setMinsInput(e.target.value)}
                placeholder="25"
                className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
              />
            </div>
          </div>
          <button
            onClick={applySetup}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-bold text-sm hover:opacity-90"
          >
            ⏱ Set করুন
          </button>
        </div>

        {/* Session history */}
        <div className="rounded-2xl border bg-card p-4 space-y-2">
          <h3 className="font-bold text-sm mb-1">সেশন ইতিহাস</h3>
          {sessions.length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-4">কোনো সেশন নেই।</p>
          )}
          {sessions.slice(0, 10).map((s, i) => (
            <div key={i} className="flex items-center gap-2.5 py-2 border-b last:border-b-0">
              {s.success ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
              )}
              <span className="flex-1 text-xs font-semibold truncate">{s.task || "টাস্ক"}</span>
              <div className="text-right">
                <div className="text-[11px] font-bold text-primary">{formatSeconds(s.duration)}</div>
                <div className="text-[10px] text-muted-foreground">{toBanglaDate(s.completedAt)}</div>
              </div>
              <button
                onClick={() => deleteSession(i)}
                className="h-7 w-7 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center flex-shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Completion modal */}
      {showCompletionModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-5">
          <div className="bg-card border rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-extrabold text-center mb-2 flex items-center justify-center gap-1.5"><PartyPopper className="h-5 w-5 text-amber-500" /> Pomodoro Complete!</h3>
            <p className="text-sm text-muted-foreground text-center mb-5">
              আপনি কি কাজটি সফলভাবে complete করেছেন?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => completeSession(true)}
                className="flex-1 py-3 rounded-xl bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="h-4 w-4" /> হ্যাঁ
              </button>
              <button
                onClick={() => completeSession(false)}
                className="flex-1 py-3 rounded-xl bg-destructive text-destructive-foreground font-bold text-sm flex items-center justify-center gap-1.5"
              >
                <XCircle className="h-4 w-4" /> না
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Pomodoro;
