import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import PublicHeader from "@/components/PublicHeader";
import { PWAQuickActionsGrid } from "@/components/home/PWAQuickActionsGrid";
import { LayoutGrid, Send, GraduationCap } from "lucide-react";

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

        {/* Free / always-usable features (same icons/style as website Quick Actions) */}
        <section>
          <h2 className="mb-2 px-1 text-sm font-semibold text-muted-foreground">ফ্রি ফিচার</h2>
          <PWAQuickActionsGrid />
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
