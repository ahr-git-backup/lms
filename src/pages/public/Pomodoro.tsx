import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Pause, Play, RotateCcw, Settings2, Coffee, BookOpen } from "lucide-react";
import PublicHeader from "@/components/PublicHeader";
import { cn } from "@/lib/utils";

type Phase = "focus" | "shortBreak" | "longBreak";

const DEFAULTS = {
  focus: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
  cyclesBeforeLongBreak: 4,
};

const PHASE_META: Record<Phase, { label: string; color: string; ring: string }> = {
  focus: { label: "Focus", color: "text-emerald-500", ring: "stroke-emerald-500" },
  shortBreak: { label: "Short Break", color: "text-amber-500", ring: "stroke-amber-500" },
  longBreak: { label: "Long Break", color: "text-indigo-400", ring: "stroke-indigo-400" },
};

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function playChime() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    [880, 1108, 1318].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.connect(gain);
      gain.connect(ctx.destination);
      const start = ctx.currentTime + i * 0.15;
      osc.frequency.setValueAtTime(f, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
      osc.start(start);
      osc.stop(start + 0.45);
    });
  } catch {
    /* audio unavailable, ignore */
  }
}

const Pomodoro = () => {
  const navigate = useNavigate();
  const [durations, setDurations] = useState(DEFAULTS);
  const [phase, setPhase] = useState<Phase>("focus");
  const [secondsLeft, setSecondsLeft] = useState(DEFAULTS.focus);
  const [running, setRunning] = useState(false);
  const [completedFocusCycles, setCompletedFocusCycles] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    document.title = "Pomodoro Timer — Atlas";
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          handlePhaseComplete();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, phase]);

  const handlePhaseComplete = () => {
    playChime();
    if (phase === "focus") {
      const nextCount = completedFocusCycles + 1;
      setCompletedFocusCycles(nextCount);
      const goLong = nextCount % durations.cyclesBeforeLongBreak === 0;
      const nextPhase: Phase = goLong ? "longBreak" : "shortBreak";
      setPhase(nextPhase);
      setSecondsLeft(durations[nextPhase]);
    } else {
      setPhase("focus");
      setSecondsLeft(durations.focus);
    }
  };

  const toggleRunning = () => setRunning((r) => !r);

  const reset = () => {
    setRunning(false);
    setSecondsLeft(durations[phase]);
  };

  const skipPhase = () => {
    setRunning(false);
    handlePhaseComplete();
  };

  const applySettings = (mins: { focus: number; shortBreak: number; longBreak: number }) => {
    const next = { ...durations, focus: mins.focus * 60, shortBreak: mins.shortBreak * 60, longBreak: mins.longBreak * 60 };
    setDurations(next);
    setRunning(false);
    setPhase("focus");
    setSecondsLeft(next.focus);
    setShowSettings(false);
  };

  const total = durations[phase];
  const progress = total > 0 ? (total - secondsLeft) / total : 0;
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const meta = PHASE_META[phase];

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
        <h1 className="flex-1 font-extrabold text-[17px]">Pomodoro Timer</h1>
        <button
          onClick={() => setShowSettings((s) => !s)}
          className="h-9 w-9 rounded-full border flex items-center justify-center hover:bg-muted"
        >
          <Settings2 className="h-4 w-4" />
        </button>
      </div>

      <div className="max-w-md mx-auto px-4 pt-8 flex flex-col items-center gap-6">
        {/* Phase tabs */}
        <div className="flex gap-2">
          {(["focus", "shortBreak", "longBreak"] as Phase[]).map((p) => (
            <button
              key={p}
              onClick={() => {
                setRunning(false);
                setPhase(p);
                setSecondsLeft(durations[p]);
              }}
              className={cn(
                "px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors",
                phase === p
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border text-muted-foreground"
              )}
            >
              {PHASE_META[p].label}
            </button>
          ))}
        </div>

        {/* Circular progress */}
        <div className="relative h-56 w-56 flex items-center justify-center">
          <svg className="h-56 w-56 -rotate-90" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r={radius} strokeWidth="10" className="stroke-muted fill-none" />
            <circle
              cx="100"
              cy="100"
              r={radius}
              strokeWidth="10"
              strokeLinecap="round"
              className={cn("fill-none transition-all duration-1000", meta.ring)}
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
            />
          </svg>
          <div className="absolute flex flex-col items-center gap-1">
            {phase === "focus" ? (
              <BookOpen className={cn("h-5 w-5", meta.color)} />
            ) : (
              <Coffee className={cn("h-5 w-5", meta.color)} />
            )}
            <span className="text-4xl font-black font-mono tabular-nums">{fmt(secondsLeft)}</span>
            <span className={cn("text-xs font-bold", meta.color)}>{meta.label}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-3 w-full">
          <button
            onClick={toggleRunning}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-md hover:opacity-90"
          >
            {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
            {running ? "Pause" : "Start"}
          </button>
          <button
            onClick={reset}
            className="px-4 py-3.5 rounded-xl border font-bold text-sm hover:bg-muted"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            onClick={skipPhase}
            className="px-4 py-3.5 rounded-xl border font-bold text-sm hover:bg-muted text-muted-foreground"
          >
            Skip
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          সম্পন্ন Focus সেশন: <b className="text-foreground">{completedFocusCycles}</b> · প্রতি{" "}
          {durations.cyclesBeforeLongBreak}টি সেশনের পর Long Break
        </p>

        {showSettings && (
          <SettingsPanel
            initial={{
              focus: durations.focus / 60,
              shortBreak: durations.shortBreak / 60,
              longBreak: durations.longBreak / 60,
            }}
            onApply={applySettings}
            onClose={() => setShowSettings(false)}
          />
        )}
      </div>
    </div>
  );
};

const SettingsPanel = ({
  initial,
  onApply,
  onClose,
}: {
  initial: { focus: number; shortBreak: number; longBreak: number };
  onApply: (v: { focus: number; shortBreak: number; longBreak: number }) => void;
  onClose: () => void;
}) => {
  const [focus, setFocus] = useState(initial.focus);
  const [shortBreak, setShortBreak] = useState(initial.shortBreak);
  const [longBreak, setLongBreak] = useState(initial.longBreak);

  return (
    <div className="w-full rounded-2xl border bg-card p-4 space-y-3">
      <h3 className="font-bold text-sm">সময় কাস্টমাইজ করুন (মিনিট)</h3>
      {[
        { label: "Focus", value: focus, set: setFocus },
        { label: "Short Break", value: shortBreak, set: setShortBreak },
        { label: "Long Break", value: longBreak, set: setLongBreak },
      ].map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-muted-foreground">{row.label}</span>
          <input
            type="number"
            min={1}
            max={120}
            value={row.value}
            onChange={(e) => row.set(Number(e.target.value) || 1)}
            className="w-16 text-center border rounded-lg px-2 py-1 text-sm bg-background"
          />
        </div>
      ))}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onApply({ focus, shortBreak, longBreak })}
          className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground font-bold text-xs"
        >
          Apply
        </button>
        <button onClick={onClose} className="px-4 py-2 rounded-lg border text-xs font-bold">
          বাতিল
        </button>
      </div>
    </div>
  );
};

export default Pomodoro;
