import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PublicHeader from "@/components/PublicHeader";
import { Card, CardContent } from "@/components/ui/card";
import {
  Star,
  Zap,
  Send,
  BarChart3,
  Timer,
  Clock,
  ClipboardCheck,
} from "lucide-react";

const TOOLS = [
  {
    group: "Study Tools",
    items: [
      { label: "Course Review", to: "/reviews", icon: Star, color: "yellow" },
      { label: "Quick Practice", to: "/quick-practice", icon: Zap, color: "violet" },
      { label: "Telegram Support", to: "/telegram-support", icon: Send, color: "sky" },
      { label: "Study Tracker", to: "/syllabus-tracker", icon: BarChart3, color: "blue" },
      { label: "Focus Timer", to: "/focus-timer", icon: Timer, color: "emerald" },
      { label: "Pomodoro Timer", to: "/pomodoro", icon: Clock, color: "rose" },
      { label: "Unlimited Mock Test", to: "/mock-test", icon: ClipboardCheck, color: "fuchsia" },
    ],
  },
] as const;

const COLOR_CLASSES: Record<string, string> = {
  blue: "border-blue-500/30 hover:border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 text-blue-500",
  sky: "border-sky-500/30 hover:border-sky-500 bg-sky-50/50 dark:bg-sky-950/20 text-sky-600",
  yellow: "border-yellow-500/30 hover:border-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/20 text-yellow-500",
  emerald: "border-emerald-500/30 hover:border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-500",
  rose: "border-rose-500/30 hover:border-rose-500 bg-rose-50/50 dark:bg-rose-950/20 text-rose-500",
  violet: "border-violet-500/30 hover:border-violet-500 bg-violet-50/50 dark:bg-violet-950/20 text-violet-500",
  fuchsia: "border-fuchsia-500/30 hover:border-fuchsia-500 bg-fuchsia-50/50 dark:bg-fuchsia-950/20 text-fuchsia-500",
};

/**
 * Public Study Aid hub — same 9 quick actions as the home page, minus
 * Free Class/Free Exam (now under the Free tab). Reachable without an
 * account; each card navigates to the real tool route, and login (if
 * required) is enforced only at that destination, never here.
 */
const StudyAid = () => {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Study Aid – Atlas";
  }, []);

  const go = (to: string) => {
    if (to === "/telegram-support") {
      window.location.href = to;
      return;
    }
    navigate(to);
  };

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
                  onClick={() => go(to)}
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
