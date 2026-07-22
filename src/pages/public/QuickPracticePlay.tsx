import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, X, Trophy, Volume2, Volume1, VolumeX, Volume } from "lucide-react";
import PublicHeader from "@/components/PublicHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { RIGHT_PACKS, WRONG_PACKS, playSound } from "@/lib/quizSounds";

interface Mcq {
  id: number;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
  chapter_id: number;
  subjectName?: string;
  chapterName?: string;
}

type Answered = { selectedIdx: number; correct: boolean } | null;

const LETTERS = ["A", "B", "C", "D", "E"];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const QuickPracticePlay = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [mcqs, setMcqs] = useState<Mcq[]>([]);
  const [current, setCurrent] = useState(0);
  const [answered, setAnswered] = useState<Answered[]>([]);
  const [finished, setFinished] = useState(false);
  const [saved, setSaved] = useState(false);
  const [soundVol, setSoundVol] = useState(() => parseFloat(localStorage.getItem("atlas-sound-vol") || "1"));
  const [rightPack, setRightPack] = useState(() => localStorage.getItem("qpp-right-pack") || "kahoot");
  const [wrongPack, setWrongPack] = useState(() => localStorage.getItem("qpp-wrong-pack") || "ayhay");
  const [volMenuOpen, setVolMenuOpen] = useState(false);

  const sessionCorrect = useMemo(() => answered.filter((a) => a?.correct).length, [answered]);
  const sessionWrong = useMemo(
    () => answered.filter((a) => a && !a.correct).length,
    [answered]
  );

  useEffect(() => {
    document.title = "Quick Practice — Atlas";
    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const init = async () => {
    const modeRaw = sessionStorage.getItem("qp_practice_mode");
    if (!modeRaw) {
      navigate("/quick-practice");
      return;
    }
    let mode: { type: "random" } | { type: "selected"; chapterIds: number[] };
    try {
      mode = JSON.parse(modeRaw) as
        | { type: "random" }
        | { type: "selected"; chapterIds: number[] };
    } catch {
      sessionStorage.removeItem("qp_practice_mode");
      navigate("/quick-practice");
      return;
    }

    // resume saved progress within this tab session
    const savedRaw = sessionStorage.getItem("qp_practice_state");
    if (savedRaw) {
      try {
        const state = JSON.parse(savedRaw);
        if (state.modeKey === JSON.stringify(mode)) {
          setMcqs(state.mcqs);
          setCurrent(state.current);
          setAnswered(state.answered);
          setLoading(false);
          return;
        }
      } catch {
        /* ignore corrupt state */
      }
    }

    let query = supabase
      .from("qp_mcqs")
      .select("id, question, options, correct_index, explanation, chapter_id");

    if (mode.type === "selected") {
      query = query.in("chapter_id", mode.chapterIds);
    }

    const { data: rows, error } = await query;
    if (error || !rows || rows.length === 0) {
      setEmpty(true);
      setLoading(false);
      return;
    }

    const chapterIds = [...new Set(rows.map((r: any) => r.chapter_id))];
    const { data: chapters } = await supabase
      .from("qp_chapters")
      .select("id, name, subject_id")
      .in("id", chapterIds);

    const subjectIds = [...new Set((chapters || []).map((c: any) => c.subject_id))];
    const { data: subjects } = await supabase
      .from("qp_subjects")
      .select("id, name")
      .in("id", subjectIds);

    const subjMap = Object.fromEntries((subjects || []).map((s: any) => [s.id, s.name]));
    const chapMap = Object.fromEntries(
      (chapters || []).map((c: any) => [c.id, { name: c.name, subjectId: c.subject_id }])
    );

    const enriched: Mcq[] = shuffle(rows as any[]).map((r) => {
      const chap = chapMap[r.chapter_id];
      return {
        ...r,
        options: Array.isArray(r.options) ? r.options : [],
        chapterName: chap?.name || "",
        subjectName: chap ? subjMap[chap.subjectId] || "" : "",
      };
    });

    setMcqs(enriched);
    setAnswered(new Array(enriched.length).fill(null));
    setCurrent(0);
    setLoading(false);
    saveState(mode, enriched, 0, new Array(enriched.length).fill(null));
  };

  const saveState = (mode: any, mcqsArg: Mcq[], currentArg: number, answeredArg: Answered[]) => {
    try {
      sessionStorage.setItem(
        "qp_practice_state",
        JSON.stringify({ modeKey: JSON.stringify(mode), mcqs: mcqsArg, current: currentArg, answered: answeredArg })
      );
    } catch {
      /* storage full or unavailable, ignore */
    }
  };

  const getMode = () => {
    const raw = sessionStorage.getItem("qp_practice_mode");
    if (!raw) return { type: "random" };
    try {
      return JSON.parse(raw);
    } catch {
      return { type: "random" };
    }
  };

  const selectOption = (idx: number) => {
    if (answered[current]) return;
    const q = mcqs[current];
    const correct = idx === q.correct_index;
    const next = [...answered];
    next[current] = { selectedIdx: idx, correct };
    setAnswered(next);
    playSound(correct, soundVol, rightPack, wrongPack);
    saveState(getMode(), mcqs, current, next);
  };

  const goPrev = () => {
    if (current > 0) {
      const c = current - 1;
      setCurrent(c);
      saveState(getMode(), mcqs, c, answered);
    }
  };

  const goNext = () => {
    if (!answered[current]) {
      toast({ title: "প্রথমে একটি অপশন সিলেক্ট করুন", variant: "destructive" });
      return;
    }
    if (current < mcqs.length - 1) {
      const c = current + 1;
      setCurrent(c);
      saveState(getMode(), mcqs, c, answered);
    } else {
      void finish();
    }
  };

  const finish = async () => {
    setFinished(true);
    sessionStorage.removeItem("qp_practice_state");
    sessionStorage.removeItem("qp_practice_mode");

    const attempted = sessionCorrect + sessionWrong;
    if (user && attempted > 0) {
      try {
        await supabase.rpc("qp_add_points", { p_user_id: user.id, p_points: sessionCorrect });
        const mode = getMode();
        await supabase.from("qp_attempts").insert({
          user_id: user.id,
          mode: mode.type,
          chapter_ids: mode.type === "selected" ? mode.chapterIds : null,
          total_questions: attempted,
          correct_count: sessionCorrect,
          points_earned: sessionCorrect,
        });
      } catch {
        /* points sync failed, user keeps local result view */
      } finally {
        setSaved(true);
      }
    } else {
      setSaved(true);
    }
  };

  const changeVol = (v: number) => {
    setSoundVol(v);
    localStorage.setItem("atlas-sound-vol", String(v));
  };

  const chooseSound = (type: "right" | "wrong", key: string) => {
    const v = 0.6 * (soundVol || 1);
    try {
      const ctx = getCtx();
      if (type === "right") {
        setRightPack(key);
        localStorage.setItem("qpp-right-pack", key);
        playPack(RIGHT_PACKS, key, v);
      } else {
        setWrongPack(key);
        localStorage.setItem("qpp-wrong-pack", key);
        playPack(WRONG_PACKS, key, v);
      }
    } catch {
      /* ignore */
    }
  };

  const exitConfirm = () => {
    if (sessionCorrect + sessionWrong > 0) {
      if (!confirm("কুইজ থেকে বের হতে চান? অগ্রগতি হারিয়ে যাবে।")) return;
    }
    sessionStorage.removeItem("qp_practice_state");
    sessionStorage.removeItem("qp_practice_mode");
    navigate("/quick-practice");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        লোড হচ্ছে...
      </div>
    );
  }

  if (empty) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <PublicHeader />
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
          <p className="text-muted-foreground">এই সিলেকশনে কোনো MCQ পাওয়া যায়নি।</p>
          <button
            onClick={() => navigate("/quick-practice")}
            className="text-primary font-semibold text-sm"
          >
            ফিরে যান
          </button>
        </div>
      </div>
    );
  }

  if (finished) {
    const attempted = sessionCorrect + sessionWrong;
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center gap-6">
        <div className="h-20 w-20 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center shadow-lg">
          <Trophy className="h-9 w-9 text-amber-950" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold">কুইজ শেষ! 🎉</h1>
          <p className="text-sm text-muted-foreground mt-1">
            মোট {attempted}টি প্রশ্ন খেলেছেন {!saved && "· সেভ হচ্ছে..."}
          </p>
        </div>
        <div className="flex gap-3">
          <div className="rounded-xl border bg-card px-5 py-3 min-w-[80px]">
            <div className="text-xl font-extrabold text-emerald-500">{sessionCorrect}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">সঠিক</div>
          </div>
          <div className="rounded-xl border bg-card px-5 py-3 min-w-[80px]">
            <div className="text-xl font-extrabold text-destructive">{sessionWrong}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">ভুল</div>
          </div>
          <div className="rounded-xl border bg-card px-5 py-3 min-w-[80px]">
            <div className="text-xl font-extrabold text-amber-500">+{sessionCorrect}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">পয়েন্ট</div>
          </div>
        </div>
        <button
          onClick={() => navigate("/quick-practice")}
          className="px-8 py-3 rounded-full bg-primary text-primary-foreground font-bold text-sm shadow-md hover:opacity-90"
        >
          হোমে ফিরুন
        </button>
      </div>
    );
  }

  const q = mcqs[current];
  const total = mcqs.length;
  const ans = answered[current];

  return (
    <div className="bg-background flex flex-col overflow-hidden" style={{ height: "100dvh" }}>
      <div className="flex items-center gap-3 px-4 py-3 bg-card border-b sticky top-0 z-30">
        <button
          onClick={exitConfirm}
          className="h-9 w-9 rounded-full border flex items-center justify-center hover:bg-muted flex-shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <div className="text-[11px] text-muted-foreground mb-1">
            প্রশ্ন {current + 1}/{total}
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all"
              style={{ width: `${((current + 1) / total) * 100}%` }}
            />
          </div>
        </div>

        <div className="relative flex-shrink-0">
          <button
            onClick={() => setVolMenuOpen((v) => !v)}
            className="h-9 w-9 rounded-full border flex items-center justify-center hover:bg-muted"
          >
            {soundVol <= 0 ? <VolumeX className="h-4 w-4" /> : soundVol < 1 ? <Volume1 className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          {volMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setVolMenuOpen(false)} />
              <div className="absolute top-11 right-0 z-50 w-[230px] bg-card border rounded-xl p-2.5 shadow-xl flex flex-col gap-2">
                <div className="flex gap-1 justify-between pb-2 border-b">
                  {[0, 0.5, 1, 1.6].map((v) => (
                    <button
                      key={v}
                      onClick={() => changeVol(v)}
                      className={cn(
                        "flex-1 text-center py-1.5 rounded-lg text-xs",
                        soundVol === v ? "bg-primary/15 text-primary" : "hover:bg-muted"
                      )}
                    >
                      {v === 0 ? <VolumeX className="h-4 w-4 mx-auto" /> : v < 1 ? <Volume1 className="h-4 w-4 mx-auto" /> : v === 1 ? <Volume2 className="h-4 w-4 mx-auto" /> : <Volume className="h-4 w-4 mx-auto text-amber-500" />}
                    </button>
                  ))}
                </div>
                <div className="flex gap-0">
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-extrabold text-muted-foreground mb-1">Right</div>
                    {Object.entries(RIGHT_PACKS).map(([k, p]) => (
                      <div
                        key={k}
                        onClick={() => chooseSound("right", k)}
                        className={cn(
                          "px-1.5 py-1.5 rounded-md text-[11px] cursor-pointer truncate",
                          k === rightPack ? "bg-primary/15 text-primary font-bold" : "hover:bg-muted"
                        )}
                      >
                        {p.label}
                      </div>
                    ))}
                  </div>
                  <div className="w-px bg-border mx-1.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-extrabold text-muted-foreground mb-1">Wrong</div>
                    {Object.entries(WRONG_PACKS).map(([k, p]) => (
                      <div
                        key={k}
                        onClick={() => chooseSound("wrong", k)}
                        className={cn(
                          "px-1.5 py-1.5 rounded-md text-[11px] cursor-pointer truncate",
                          k === wrongPack ? "bg-primary/15 text-primary font-bold" : "hover:bg-muted"
                        )}
                      >
                        {p.label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <button
          onClick={() => void finish()}
          className="px-3.5 py-2 rounded-full bg-destructive text-destructive-foreground font-bold text-xs flex-shrink-0 whitespace-nowrap"
        >
          শেষ করো
        </button>
      </div>

      <div className="flex-1 max-w-2xl w-full mx-auto px-4 py-5 flex flex-col overflow-y-auto pb-24">
        <span className="inline-flex self-start items-center gap-1.5 bg-primary/10 text-primary text-[11px] font-bold px-3 py-1.5 rounded-full mb-4">
          📘 {q.subjectName} · {q.chapterName}
        </span>
        <p className="text-[16px] font-bold leading-relaxed mb-5">{q.question}</p>

        <div className="flex flex-col gap-2.5">
          {q.options.map((opt, i) => {
            let cls = "border-border bg-card hover:border-primary/40";
            if (ans) {
              if (i === q.correct_index) cls = "border-emerald-500 bg-emerald-500/10";
              else if (i === ans.selectedIdx) cls = "border-destructive bg-destructive/10";
              else cls = "border-border bg-card opacity-50";
            }
            return (
              <button
                key={i}
                onClick={() => selectOption(i)}
                disabled={!!ans}
                className={cn(
                  "flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 text-sm text-left transition-all active:scale-[0.98]",
                  cls
                )}
              >
                <span
                  className={cn(
                    "h-7 w-7 rounded-lg flex items-center justify-center font-extrabold text-xs flex-shrink-0",
                    ans && i === q.correct_index
                      ? "bg-emerald-500 text-white"
                      : ans && i === ans.selectedIdx
                      ? "bg-destructive text-white"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {ans && i === q.correct_index ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : ans && i === ans.selectedIdx ? (
                    <X className="h-3.5 w-3.5" />
                  ) : (
                    LETTERS[i]
                  )}
                </span>
                <span>{opt}</span>
              </button>
            );
          })}
        </div>

        {ans && q.explanation && (
          <div className="mt-4 p-4 rounded-xl bg-muted/50 border-l-4 border-primary text-sm leading-relaxed animate-in fade-in slide-in-from-top-2">
            <div className="text-[11px] font-extrabold text-primary mb-1">ব্যাখ্যা</div>
            {q.explanation}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 bg-background border-t px-4 py-3">
        <div className="max-w-2xl mx-auto flex gap-3">
          <button
            onClick={goPrev}
            disabled={current === 0}
            className="flex-1 py-3 rounded-xl border font-bold text-sm disabled:opacity-40 hover:bg-muted transition-colors bg-card"
          >
            আগের
          </button>
          <button
            onClick={goNext}
            className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity"
          >
            {current === total - 1 ? "শেষ করো" : "পরবর্তী →"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuickPracticePlay;
