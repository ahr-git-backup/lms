import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  LayoutGrid,
  Video,
  FileQuestion,
  Zap,
  Timer,
  Sparkles,
  Clock,
  BarChart3,
} from "lucide-react";

const scrollToId = (id: string) => {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
};

export const QuickActionsSection = () => {
  const navigate = useNavigate();

  return (
    <section className="space-y-3">
      {/* Row 1: All Courses */}
      <Button
        onClick={() => scrollToId("courses")}
        className="w-full h-12 text-base font-bold rounded-2xl bg-gradient-to-r from-primary to-primary/80 hover:opacity-90 shadow-md hover:shadow-lg transition-all"
      >
        <LayoutGrid className="mr-2 h-5 w-5" /> All Courses
      </Button>

      {/* Row 2: Free Class / Free Exam — opens the actual content directly, not a scroll */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          onClick={() => navigate("/free-class")}
          className="h-11 rounded-2xl border-2 border-primary/30 hover:border-primary hover:bg-primary/5 font-semibold"
        >
          <Video className="mr-2 h-4 w-4 text-primary" /> Free Class
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate("/free-exam")}
          className="h-11 rounded-2xl border-2 border-primary/30 hover:border-primary hover:bg-primary/5 font-semibold"
        >
          <FileQuestion className="mr-2 h-4 w-4 text-primary" /> Free Exam
        </Button>
      </div>

      {/* Row 3: Quick Practice / Focus Timer */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => navigate("/quick-practice")}
          className="group flex items-center gap-3 rounded-2xl p-4 bg-gradient-to-br from-violet-500/10 to-indigo-500/10 border border-violet-500/20 hover:border-violet-500/50 hover:shadow-lg transition-all"
        >
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center shadow-sm">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <span className="text-sm font-bold text-left">Quick Practice</span>
        </button>
        <button
          onClick={() => navigate("/focus-timer")}
          className="group flex items-center gap-3 rounded-2xl p-4 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 hover:border-emerald-500/50 hover:shadow-lg transition-all"
        >
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-sm">
            <Timer className="h-5 w-5 text-white" />
          </div>
          <span className="text-sm font-bold text-left">Focus Timer</span>
        </button>
      </div>

      {/* Row 4: ATLAS AI / Pomodoro Timer */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => navigate("/atlas-ai")}
          className="group flex items-center gap-3 rounded-2xl p-4 bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 hover:border-amber-500/50 hover:shadow-lg transition-all"
        >
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-sm">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="text-sm font-bold text-left">ATLAS AI</span>
        </button>
        <button
          onClick={() => navigate("/pomodoro")}
          className="group flex items-center gap-3 rounded-2xl p-4 bg-gradient-to-br from-rose-500/10 to-pink-500/10 border border-rose-500/20 hover:border-rose-500/50 hover:shadow-lg transition-all"
        >
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center shadow-sm">
            <Clock className="h-5 w-5 text-white" />
          </div>
          <span className="text-sm font-bold text-left">Pomodoro Timer</span>
        </button>
      </div>

      {/* Row 5: Syllabus Tracker */}
      <Button
        onClick={() => navigate("/syllabus-tracker")}
        className="w-full h-12 text-base font-bold rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:opacity-90 shadow-md hover:shadow-lg transition-all"
      >
        <BarChart3 className="mr-2 h-5 w-5" /> Syllabus Tracker
      </Button>
    </section>
  );
};
