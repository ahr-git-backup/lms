import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PublicHeader from "@/components/PublicHeader";
import { Card, CardContent } from "@/components/ui/card";
import {
  TrendingUp,
  BarChart3,
  Trophy,
  Timer,
  Clock,
} from "lucide-react";

const TOOLS = [
  {
    group: "Smart Tracking System",
    items: [
      { label: "My Progress & History", to: "/dashboard/my-progress", icon: TrendingUp, color: "blue" },
      { label: "Study Tracker", to: "/syllabus-tracker", icon: BarChart3, color: "sky" },
      { label: "Top Performer", to: "/dashboard/top-performer", icon: Trophy, color: "yellow" },
    ],
  },
  {
    group: "Focus & Time Management",
    items: [
      { label: "Focus Timer", to: "/focus-timer", icon: Timer, color: "emerald" },
      { label: "Pomodoro Timer", to: "/pomodoro", icon: Clock, color: "rose" },
    ],
  },
] as const;

const COLOR_CLASSES: Record<string, string> = {
  blue: "border-blue-500/30 hover:border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 text-blue-500",
  sky: "border-sky-500/30 hover:border-sky-500 bg-sky-50/50 dark:bg-sky-950/20 text-sky-600",
  yellow: "border-yellow-500/30 hover:border-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/20 text-yellow-500",
  emerald: "border-emerald-500/30 hover:border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-500",
  rose: "border-rose-500/30 hover:border-rose-500 bg-rose-50/50 dark:bg-rose-950/20 text-rose-500",
};

/**
 * Public Study Aid hub — every study tool from the old landing-page quick
 * actions, minus Free Class/Free Exam (now under the Free tab) and All
 * Courses (now under the Course tab). Reachable without an account; each
 * card navigates to the real tool route, and login (if required) is
 * enforced only at that destination, never here.
 */
const StudyAid = () => {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Study Aid – Atlas";
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 pb-16 pt-10 sm:pt-14 flex-1">
        <div className="text-center space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Study Aid</h1>
          <p className="text-sm text-muted-foreground">সব Study Tools এক জায়গায়</p>
        </div>

        {TOOLS.map(({ group, items }) => (
          <div key={group} className="border border-primary/30 rounded-lg px-3 sm:px-6 py-4 space-y-3">
            <h2 className="text-base font-semibold tracking-tight text-center">{group}</h2>
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              {items.map(({ label, to, icon: Icon, color }) => (
                <Card
                  key={label}
                  className={`cursor-pointer transition-all ${COLOR_CLASSES[color]}`}
                  onClick={() => navigate(to)}
                >
                  <CardContent className="p-2.5 sm:p-4 flex flex-col items-center text-center gap-1.5">
                    <Icon className="h-6 w-6 flex-shrink-0" />
                    <p className="font-semibold text-xs sm:text-sm leading-snug">{label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
};

export default StudyAid;
