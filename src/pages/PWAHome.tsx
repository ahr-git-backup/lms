import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import PublicHeader from "@/components/PublicHeader";
import { PWAQuickActionsGrid } from "@/components/home/PWAQuickActionsGrid";
import OwnerSectionPWA from "@/components/home/OwnerSectionPWA";
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
            className="relative rounded-2xl p-[1.5px] bg-gradient-to-br from-blue-500/60 to-indigo-600/60 active:scale-95 transition-transform shadow-sm hover:shadow-md"
          >
            <div className="flex flex-col items-center justify-center gap-2 rounded-[calc(1rem-1.5px)] bg-card py-5 h-full">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md ring-1 ring-white/20">
                <GraduationCap className="h-6 w-6 text-white" strokeWidth={2.25} />
              </div>
              <span className="text-sm font-semibold text-center text-foreground">আমার কোর্স</span>
            </div>
          </button>
          <button
            onClick={() => navigate("/courses")}
            className="relative rounded-2xl p-[1.5px] bg-gradient-to-br from-orange-400/60 to-red-500/60 active:scale-95 transition-transform shadow-sm hover:shadow-md"
          >
            <div className="flex flex-col items-center justify-center gap-2 rounded-[calc(1rem-1.5px)] bg-card py-5 h-full">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 shadow-md ring-1 ring-white/20">
                <LayoutGrid className="h-6 w-6 text-white" strokeWidth={2.25} />
              </div>
              <span className="text-sm font-semibold text-center text-foreground">সকল কোর্স</span>
            </div>
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

        {/* Owner/Founder */}
        <OwnerSectionPWA />

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
