import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import PublicHeader from "@/components/PublicHeader";
import {
  LayoutGrid,
  Video,
  FileQuestion,
  Zap,
  Timer,
  BarChart3,
  Bookmark,
  Trophy,
  Bell,
  BookOpen,
  Send,
  Flame,
  Infinity as InfinityIcon,
} from "lucide-react";

interface Shortcut {
  icon: typeof LayoutGrid;
  label: string;
  path: string;
  color: string;
}

const PRIMARY_SHORTCUTS: Shortcut[] = [
  { icon: LayoutGrid, label: "আমার কোর্স", path: "/dashboard/my-courses", color: "hsl(217 91% 60%)" },
  { icon: Video, label: "লাইভ ক্লাস", path: "/dashboard/live-class", color: "hsl(0 84% 60%)" },
  { icon: FileQuestion, label: "লাইভ এক্সাম", path: "/dashboard/live-exam", color: "hsl(271 81% 60%)" },
  { icon: Zap, label: "কুইক প্র্যাকটিস", path: "/quick-practice", color: "hsl(45 93% 55%)" },
];

const SECONDARY_SHORTCUTS: Shortcut[] = [
  { icon: BookOpen, label: "রেডিমেড এক্সাম", path: "/dashboard/readymade", color: "hsl(160 84% 39%)" },
  { icon: Flame, label: "ফ্রি এক্সাম", path: "/free-exam", color: "hsl(24 95% 53%)" },
  { icon: InfinityIcon, label: "ফ্রি ক্লাস", path: "/free-class", color: "hsl(199 89% 48%)" },
  { icon: Timer, label: "ফোকাস টাইমার", path: "/focus-timer", color: "hsl(330 81% 60%)" },
  { icon: BarChart3, label: "ফলাফল", path: "/dashboard/results", color: "hsl(217 91% 60%)" },
  { icon: Bookmark, label: "বুকমার্ক", path: "/dashboard/bookmarks", color: "hsl(0 84% 60%)" },
  { icon: Trophy, label: "লিডারবোর্ড", path: "/dashboard/top-performer", color: "hsl(45 93% 55%)" },
  { icon: Bell, label: "নোটিশ", path: "/dashboard/announcements", color: "hsl(271 81% 60%)" },
];

export default function PWAHome() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  useEffect(() => {
    document.title = "Atlas";
  }, []);

  const greetingName = profile?.full_name?.split(" ")[0];

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
        {/* Primary shortcuts — big tiles, native app-icon feel */}
        <section className="grid grid-cols-2 gap-3">
          {PRIMARY_SHORTCUTS.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center justify-center gap-2 rounded-2xl border bg-card py-5 shadow-sm active:scale-95 transition-transform"
            >
              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl"
                style={{ backgroundColor: `${item.color}1a`, color: item.color }}
              >
                <item.icon className="h-6 w-6" />
              </div>
              <span className="text-sm font-semibold text-center">{item.label}</span>
            </button>
          ))}
        </section>

        {/* Secondary shortcuts — compact icon grid */}
        <section>
          <h2 className="mb-2 px-1 text-sm font-semibold text-muted-foreground">সব ফিচার</h2>
          <div className="grid grid-cols-4 gap-3">
            {SECONDARY_SHORTCUTS.map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="flex flex-col items-center gap-1.5 rounded-xl py-2 active:scale-95 transition-transform"
              >
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: `${item.color}1a`, color: item.color }}
                >
                  <item.icon className="h-5 w-5" />
                </div>
                <span className="text-[11px] leading-tight text-center">{item.label}</span>
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
