import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import {
  Video,
  FileQuestion,
  Zap,
  Timer,
  Clock,
  BarChart3,
  Star,
  ClipboardCheck,
  Send,
  Sparkles,
} from "lucide-react";

interface ActionCard {
  key: string;
  label: string;
  icon: typeof Star;
  from: string;
  to: string;
  ring: string;
  onClick: () => void;
}

// Same buttons as website's QuickActionsSection, minus "All Courses"
// (PWA home already has its own সকল কোর্স card). Every card shares one
// premium style: gradient icon badge + matching gradient ring border.
export const PWAQuickActionsGrid = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [showReady, setShowReady] = useState(false);

  useEffect(() => {
    if (user && sessionStorage.getItem("study_tracker_pending") === "1") {
      sessionStorage.removeItem("study_tracker_pending");
      setShowReady(true);
    }
  }, [user]);

  const handleStudyTrackerClick = () => {
    navigate("/syllabus-tracker");
  };

  const handleGoToRegister = () => {
    sessionStorage.setItem("study_tracker_pending", "1");
    setShowAuthGate(false);
    navigate("/register");
  };

  const cards: ActionCard[] = [
    { key: "review", label: "Course Review", icon: Star, from: "from-amber-400", to: "to-orange-500", ring: "from-amber-400/60 to-orange-500/60", onClick: () => navigate("/reviews") },
    { key: "class", label: "Free Class", icon: Video, from: "from-blue-500", to: "to-cyan-500", ring: "from-blue-500/60 to-cyan-500/60", onClick: () => navigate("/free-class") },
    { key: "exam", label: "Free Exam", icon: FileQuestion, from: "from-red-500", to: "to-rose-500", ring: "from-red-500/60 to-rose-500/60", onClick: () => navigate("/free-exam") },
    { key: "practice", label: "Rapid Practice Game", icon: Zap, from: "from-violet-500", to: "to-indigo-500", ring: "from-violet-500/60 to-indigo-500/60", onClick: () => navigate("/quick-practice") },
    { key: "focus", label: "Focus Timer", icon: Timer, from: "from-emerald-500", to: "to-teal-500", ring: "from-emerald-500/60 to-teal-500/60", onClick: () => navigate("/focus-timer") },
    { key: "telegram", label: "Telegram Support", icon: Send, from: "from-sky-500", to: "to-blue-500", ring: "from-sky-500/60 to-blue-500/60", onClick: () => { window.location.href = "/telegram-support"; } },
    { key: "pomodoro", label: "Pomodoro Timer", icon: Clock, from: "from-rose-500", to: "to-pink-500", ring: "from-rose-500/60 to-pink-500/60", onClick: () => navigate("/pomodoro") },
    { key: "tracker", label: "Study Tracker", icon: BarChart3, from: "from-sky-500", to: "to-blue-600", ring: "from-sky-500/60 to-blue-600/60", onClick: handleStudyTrackerClick },
    { key: "mock", label: "Unlimited Mock Test", icon: ClipboardCheck, from: "from-fuchsia-500", to: "to-pink-600", ring: "from-fuchsia-500/60 to-pink-600/60", onClick: () => navigate("/mock-test") },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((card) => (
        <button
          key={card.key}
          onClick={card.onClick}
          className={`relative rounded-2xl p-[1.5px] bg-gradient-to-br ${card.ring} active:scale-95 transition-transform shadow-sm hover:shadow-md`}
        >
          <div className="flex flex-col items-center justify-center gap-2 rounded-[calc(1rem-1.5px)] bg-card py-4 px-2 h-full">
            <div className={`h-11 w-11 rounded-2xl bg-gradient-to-br ${card.from} ${card.to} flex items-center justify-center shadow-md ring-1 ring-white/20`}>
              <card.icon className="h-5 w-5 text-white" strokeWidth={2.25} />
            </div>
            <span className="text-sm sm:text-base font-bold text-center leading-tight px-0.5 text-foreground">
              {card.label}
            </span>
          </div>
        </button>
      ))}

      <Dialog open={showAuthGate} onOpenChange={setShowAuthGate}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Study Tracker ব্যবহার করতে হলে</DialogTitle>
            <DialogDescription>
              Study Tracker ব্যবহার করতে হলে আগে একটি অ্যাকাউন্ট খুলতে হবে। অ্যাকাউন্ট খোলা সম্পূর্ণ ফ্রি এবং মাত্র কয়েক সেকেন্ড লাগবে।
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button onClick={handleGoToRegister} className="w-full font-bold">
              অ্যাকাউন্ট খুলুন
            </Button>
            <Button variant="outline" onClick={() => setShowAuthGate(false)} className="w-full">
              পরে করব
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showReady} onOpenChange={setShowReady}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">অ্যাকাউন্ট তৈরি সম্পন্ন! <Sparkles className="h-4 w-4 text-amber-500" /></DialogTitle>
            <DialogDescription>
              এখন আপনি Study Tracker ব্যবহার করতে পারবেন। নিচের বাটনে ক্লিক করে হোম পেজে গিয়ে Study Tracker চালু করুন।
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => {
                setShowReady(false);
                navigate("/syllabus-tracker");
              }}
              className="w-full font-bold"
            >
              হোম পেজে যান
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
