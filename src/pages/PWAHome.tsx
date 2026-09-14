import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEnrollments } from "@/hooks/useEnrollments";
import PublicHeader from "@/components/PublicHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  LayoutDashboard,
  LayoutGrid,
  Zap,
  Timer,
  Send,
  Flame,
  Infinity as InfinityIcon,
  GraduationCap,
  Gift,
  Clock3,
} from "lucide-react";

interface Shortcut {
  icon: typeof Zap;
  label: string;
  path: string;
  color: string;
  external?: boolean;
}

// Only free / always-usable features live on the PWA home. Anything under a
// course (Live Class, Live Exam, etc.) is reached via the course's own
// Dashboard button instead.
const FREE_SHORTCUTS: Shortcut[] = [
  { icon: Flame, label: "ফ্রি এক্সাম", path: "/free-exam", color: "hsl(24 95% 53%)" },
  { icon: InfinityIcon, label: "ফ্রি ক্লাস", path: "/free-class", color: "hsl(199 89% 48%)" },
  { icon: Zap, label: "আনলিমিটেড মক টেস্ট", path: "/quick-practice", color: "hsl(45 93% 55%)" },
  { icon: Timer, label: "ফোকাস টাইমার", path: "/focus-timer", color: "hsl(330 81% 60%)" },
  { icon: Clock3, label: "পোমোডোরো", path: "/focus-timer?mode=pomodoro", color: "hsl(160 84% 39%)" },
  { icon: Send, label: "টেলিগ্রাম চ্যানেল", path: "https://t.me/rafi_somc", color: "hsl(217 91% 60%)", external: true },
];

export default function PWAHome() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { data: enrollments, isLoading: enrollmentsLoading } = useEnrollments();

  useEffect(() => {
    document.title = "Atlas";
  }, []);

  const greetingName = profile?.full_name?.split(" ")[0];
  const directCourses = (enrollments || []).filter((e: any) => !e.is_extra);

  const openShortcut = (item: Shortcut) => {
    if (item.external) {
      window.open(item.path, "_blank", "noopener,noreferrer");
    } else {
      navigate(item.path);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicHeader />

      <div className="px-4 py-3">
        <p className="text-lg font-bold leading-tight">
          {user ? `হ্যালো, ${greetingName || "শিক্ষার্থী"}` : "এটলাসে স্বাগতম"}
        </p>
        <p className="text-xs text-muted-foreground">আজকের প্রস্তুতি শুরু করুন</p>
      </div>

      <main className="flex-1 px-4 pb-4 space-y-6">
        {/* Top row: আমার কোর্স + সকল কোর্স, side by side */}
        <section className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate(user ? "/dashboard/my-courses" : "/login")}
            className="flex flex-col items-center justify-center gap-2 rounded-2xl border bg-card py-5 shadow-sm active:scale-95 transition-transform"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <GraduationCap className="h-6 w-6" />
            </div>
            <span className="text-sm font-semibold text-center">আমার কোর্স</span>
          </button>
          <button
            onClick={() => navigate("/courses")}
            className="flex flex-col items-center justify-center gap-2 rounded-2xl border bg-card py-5 shadow-sm active:scale-95 transition-transform"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-500">
              <LayoutGrid className="h-6 w-6" />
            </div>
            <span className="text-sm font-semibold text-center">সকল কোর্স</span>
          </button>
        </section>

        {/* My enrolled courses — each card opens that course's full dashboard */}
        {user && (
          <section className="space-y-2">
            {enrollmentsLoading ? (
              <div className="text-sm text-muted-foreground py-4 text-center">লোড হচ্ছে...</div>
            ) : directCourses.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="pt-5 pb-5 flex flex-col items-center text-center gap-2">
                  <GraduationCap className="h-10 w-10 text-muted-foreground opacity-40" />
                  <p className="text-sm text-muted-foreground">আপনি কোনো কোর্সে ভর্তি নেই</p>
                  <Button size="sm" onClick={() => navigate("/courses")}>কোর্স কিনুন</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2.5">
                {directCourses.map((enrollment: any) => (
                  <Card key={enrollment.id} className="overflow-hidden">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="h-11 w-11 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden">
                        {enrollment.course?.image_url ? (
                          <img
                            src={enrollment.course.image_url}
                            alt={enrollment.course.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <GraduationCap className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm leading-tight line-clamp-1">
                          {enrollment.course?.name || "কোর্স"}
                        </p>
                        {enrollment.bonus_courses?.length > 0 && (
                          <p className="text-[11px] text-purple-600 dark:text-purple-300 flex items-center gap-1 mt-0.5">
                            <Gift className="h-3 w-3" /> +{enrollment.bonus_courses.length} বোনাস
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        className="gap-1.5 shrink-0"
                        onClick={() => navigate(`/dashboard/course/${enrollment.course_id}`)}
                      >
                        <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Free / always-usable features */}
        <section>
          <h2 className="mb-2 px-1 text-sm font-semibold text-muted-foreground">ফ্রি ফিচার</h2>
          <div className="grid grid-cols-2 gap-3">
            {FREE_SHORTCUTS.map((item) => (
              <button
                key={item.label}
                onClick={() => openShortcut(item)}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border bg-card py-4 shadow-sm active:scale-95 transition-transform"
              >
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: `${item.color}1a`, color: item.color }}
                >
                  <item.icon className="h-5 w-5" />
                </div>
                <span className="text-[11px] font-semibold text-center leading-tight px-1">
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </section>

        {!user && (
          <button
            onClick={() => navigate("/register")}
            className="w-full rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-sm active:scale-95 transition-transform"
          >
            ফ্রি রেজিস্ট্রেশন করুন
          </button>
        )}

        {/* Support */}
        <section className="flex gap-3 pt-1">
          <a
            href="https://wa.me/8801999681290"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border bg-[#25D366]/10 py-2.5 text-sm font-semibold text-[#25D366]"
          >
            <Send className="h-4 w-4" /> WhatsApp
          </a>
          <a
            href="https://t.me/rafi_somc"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border bg-[#0088cc]/10 py-2.5 text-sm font-semibold text-[#0088cc]"
          >
            <Send className="h-4 w-4" /> Telegram
          </a>
        </section>
      </main>
    </div>
  );
}
