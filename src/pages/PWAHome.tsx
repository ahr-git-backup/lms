import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import PublicHeader from "@/components/PublicHeader";
import {
  LayoutGrid,
  Timer,
  Send,
  Flame,
  Infinity as InfinityIcon,
  GraduationCap,
  Clock3,
  Star,
} from "lucide-react";

interface Shortcut {
  icon: typeof Timer;
  label: string;
  path: string;
  color: string;
  external?: boolean;
}

// Only free / always-usable features live on the PWA home. Anything under a
// course (Live Class, Live Exam, Quick Practice, etc.) is reached via the
// course's own Dashboard button instead. More study tools live under the
// Study Aid tab.
const FREE_SHORTCUTS: Shortcut[] = [
  { icon: Flame, label: "ফ্রি এক্সাম", path: "/free-exam", color: "hsl(24 95% 53%)" },
  { icon: InfinityIcon, label: "ফ্রি ক্লাস", path: "/free-class", color: "hsl(199 89% 48%)" },
  { icon: Timer, label: "ফোকাস টাইমার", path: "/focus-timer", color: "hsl(330 81% 60%)" },
  { icon: Clock3, label: "পোমোডোরো", path: "/pomodoro", color: "hsl(160 84% 39%)" },
  { icon: Star, label: "কোর্স রিভিউ", path: "/reviews", color: "hsl(38 92% 50%)" },
  { icon: Send, label: "টেলিগ্রাম সাপোর্ট", path: "https://t.me/rafi_somc", color: "hsl(217 91% 60%)", external: true },
];

export default function PWAHome() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  useEffect(() => {
    document.title = "Atlas";
  }, []);

  const greetingName = profile?.full_name?.split(" ")[0];

  const openShortcut = (item: Shortcut) => {
    if (item.external) {
      // window.open(url, "_blank") renders a blank/black window inside an
      // installed standalone PWA (no browser chrome to fall back to).
      // Navigating the current window lets the OS hand off to the
      // Telegram app or system browser correctly instead.
      window.location.href = item.path;
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
            onClick={() => navigate("/my-courses")}
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
