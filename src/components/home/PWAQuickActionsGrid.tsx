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
} from "lucide-react";

// Same buttons as website's QuickActionsSection, minus "All Courses"
// (PWA home already has its own সকল কোর্স card). 2 per row for mobile.
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
    if (!user) {
      setShowAuthGate(true);
      return;
    }
    navigate("/syllabus-tracker");
  };

  const handleGoToRegister = () => {
    sessionStorage.setItem("study_tracker_pending", "1");
    setShowAuthGate(false);
    navigate("/register");
  };

  const handleTelegramSupport = () => {
    window.location.href = "/telegram-support";
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => navigate("/reviews")}
          className="group flex flex-col items-center justify-center gap-1 rounded-xl py-2.5 border-2 border-primary/30 hover:border-primary hover:bg-primary/5 transition-all"
        >
          <Star className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Course Review</span>
        </button>
        <button
          onClick={() => navigate("/free-class")}
          className="group flex flex-col items-center justify-center gap-1 rounded-xl py-2.5 border-2 border-primary/30 hover:border-primary hover:bg-primary/5 transition-all"
        >
          <Video className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Free Class</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => navigate("/free-exam")}
          className="group flex flex-col items-center justify-center gap-1 rounded-xl py-2.5 border-2 border-primary/30 hover:border-primary hover:bg-primary/5 transition-all"
        >
          <FileQuestion className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Free Exam</span>
        </button>
        <button
          onClick={() => navigate("/quick-practice")}
          className="group flex flex-col items-center justify-center gap-1.5 rounded-xl py-2.5 bg-gradient-to-br from-violet-500/10 to-indigo-500/10 border border-violet-500/20 hover:border-violet-500/50 hover:shadow-md transition-all"
        >
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center shadow-sm">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <span className="text-xs sm:text-sm font-bold text-center leading-tight px-0.5">Quick Practice</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => navigate("/focus-timer")}
          className="group flex flex-col items-center justify-center gap-1.5 rounded-xl py-2.5 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 hover:border-emerald-500/50 hover:shadow-md transition-all"
        >
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-sm">
            <Timer className="h-4 w-4 text-white" />
          </div>
          <span className="text-xs sm:text-sm font-bold text-center leading-tight px-0.5">Focus Timer</span>
        </button>
        <button
          onClick={handleTelegramSupport}
          className="group flex flex-col items-center justify-center gap-1.5 rounded-xl py-2.5 bg-gradient-to-br from-sky-500/10 to-blue-500/10 border border-sky-500/20 hover:border-sky-500/50 hover:shadow-md transition-all"
        >
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-sky-500 to-blue-500 flex items-center justify-center shadow-sm">
            <Send className="h-4 w-4 text-white" />
          </div>
          <span className="text-xs sm:text-sm font-bold text-center leading-tight px-0.5">Telegram Support</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => navigate("/pomodoro")}
          className="group flex flex-col items-center justify-center gap-1.5 rounded-xl py-2.5 bg-gradient-to-br from-rose-500/10 to-pink-500/10 border border-rose-500/20 hover:border-rose-500/50 hover:shadow-md transition-all"
        >
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center shadow-sm">
            <Clock className="h-4 w-4 text-white" />
          </div>
          <span className="text-xs sm:text-sm font-bold text-center leading-tight px-0.5">Pomodoro Timer</span>
        </button>
        <button
          onClick={handleStudyTrackerClick}
          className="group flex flex-col items-center justify-center gap-1.5 rounded-xl py-2.5 bg-gradient-to-br from-sky-500/10 to-blue-600/10 border border-sky-500/20 hover:border-sky-500/50 hover:shadow-md transition-all"
        >
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-sm">
            <BarChart3 className="h-4 w-4 text-white" />
          </div>
          <span className="text-xs sm:text-sm font-bold text-center leading-tight px-0.5">Study Tracker</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => navigate("/mock-test")}
          className="group flex flex-col items-center justify-center gap-1.5 rounded-xl py-2.5 bg-gradient-to-br from-fuchsia-500/10 to-pink-600/10 border border-fuchsia-500/20 hover:border-fuchsia-500/50 hover:shadow-md transition-all"
        >
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-fuchsia-500 to-pink-600 flex items-center justify-center shadow-sm">
            <ClipboardCheck className="h-4 w-4 text-white" />
          </div>
          <span className="text-xs sm:text-sm font-bold text-center leading-tight px-0.5">Unlimited Mock Test</span>
        </button>
        <div />
      </div>

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
            <DialogTitle>অ্যাকাউন্ট তৈরি সম্পন্ন! 🎉</DialogTitle>
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
