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
} from "lucide-react";
import PublicHeader from "@/components/PublicHeader";
import { cn } from "@/lib/utils";

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
        {stats.streak > 0 && (
          <span className="flex items-center gap-1 text-xs font-bold text-orange-500">
            <Flame className="h-3.5 w-3.5" /> {stats.streak}
          </span>
        )}
      </div>

      <div className="max-w-md mx-auto px-4 pt-6 flex flex-col gap-5">
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
              <circle cx="90" cy="90" r="80" fill="none" stroke="rgba(99,102,241,0.15)" strokeWidth="8" />
              {/* Clockwise fill: ring grows from 0 to full circumference as time elapses */}
              <circle
                cx="90"
                cy="90"
                r="80"
                fill="none"
                stroke="url(#pomoGrad)"
                strokeWidth="8"
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
              {/* Leading-edge glowing dot, like a clock hand tip, riding the progress arc */}
              {(() => {
                const angle = elapsedProgress * 2 * Math.PI;
                const dx = 90 + 80 * Math.cos(angle);
                const dy = 90 + 80 * Math.sin(angle);
                return (
                  <circle
                    cx={dx}
                    cy={dy}
                    r="6"
                    fill="#818CF8"
                    className={cn(
                      "transition-all duration-1000 animate-pulse",
                      warning && "fill-red-400"
                    )}
                    style={{ filter: "drop-shadow(0 0 6px rgba(129,140,248,0.9))" }}
                  />
                );
              })()}
            </svg>
            <div className="absolute flex flex-col items-center px-3">
              <span
                className={cn(
                  "font-mono font-bold tracking-wider",
                  formatSeconds(timeLeft).length > 5 ? "text-xl" : "text-3xl",
                  warning ? "text-red-400" : "text-indigo-100"
                )}
              >
                {formatSeconds(timeLeft)}
              </span>
            </div>
          </div>

          {/* Pause <-> Resume control, plus a Reset button that restarts fresh */}
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={toggle}
              className="h-12 w-12 rounded-full bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/40 hover:bg-indigo-400"
            >
              {running ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-current ml-0.5" />}
            </button>
            {totalTime > 0 && (
              <button
                onClick={reset}
                title="রিসেট করুন"
                className="h-10 w-10 rounded-full bg-white/10 border border-indigo-400/30 text-indigo-200 flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

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

        {/* Success graph */}
        {hasGraphData && (
          <div className="rounded-2xl border bg-card p-4 space-y-3">
            <h3 className="font-bold text-sm">সাফল্যের হার (গত ৩ দিন)</h3>
            <div className="flex items-end gap-3 h-24">
              {last3Days.map((d) => (
                <div key={d.key} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="flex-1 w-full flex items-end">
                    <div
                      className={cn(
                        "w-full rounded-t-md",
                        d.rate >= 80 ? "bg-emerald-500" : d.rate >= 50 ? "bg-amber-500" : "bg-destructive"
                      )}
                      style={{ height: `${Math.max(d.rate, 4)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{d.label}</span>
                  <span className="text-[10px] font-bold">{d.rate}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

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
            <h3 className="text-lg font-extrabold text-center mb-2">🎉 Pomodoro Complete!</h3>
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
