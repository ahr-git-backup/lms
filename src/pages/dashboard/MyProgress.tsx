import { useEffect } from "react";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { History, Video, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSearchParams } from "react-router-dom";
import ExamAnalytics from "./ExamAnalytics";
import ClassReport from "./ClassReport";
import WeaknessAnalysis from "./WeaknessAnalysis";

type TabKey = "exam" | "class" | "weak";

const TABS: { key: TabKey; label: string; icon: typeof History }[] = [
  { key: "exam", label: "Exam Report", icon: History },
  { key: "class", label: "Class Report", icon: Video },
  { key: "weak", label: "My Weak Topic and Analysis", icon: Target },
];

const isValidTab = (v: string | null): v is TabKey => v === "exam" || v === "class" || v === "weak";

const MyProgress = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: TabKey = isValidTab(tabParam) ? tabParam : "exam";

  const setActiveTab = (key: TabKey) => {
    setSearchParams({ tab: key }, { replace: true });
  };

  useEffect(() => {
    document.title = "My Progress & History – Atlas";
  }, []);

  // Surface RPC failures: the tabs only render an empty state on error, so a failing report
  // looked like "no data". Show the real reason here.
  const queryClient = useQueryClient();
  useIsFetching(); // re-render while queries settle
  const failed = queryClient
    .getQueryCache()
    .getAll()
    .filter((q) => q.state.status === "error" && /analytics|class-report|weakness|activity|my-class|readymade-exam/i.test(JSON.stringify(q.queryKey)));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const firstError: any = failed[0]?.state.error;

  return (
    <div className="space-y-4 pb-20">
      <header className="space-y-0.5">
        <h1 className="text-xl font-semibold tracking-tight">My Progress & History</h1>
        <p className="text-xs text-muted-foreground">
          Track your exam attempts, class activity, and areas to improve.
        </p>
      </header>

      {/* 3 categories in one row */}
      <div className="grid grid-cols-3 gap-2">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 h-16 rounded-lg border-2 px-2 text-xs font-semibold text-center transition-colors",
              activeTab === key
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/40"
            )}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span className="leading-tight">{label}</span>
          </button>
        ))}
      </div>

      {firstError && (
        <div className="rounded-lg border-2 border-red-500 bg-red-50 dark:bg-red-950 p-3 text-xs text-red-700 dark:text-red-300 space-y-1">
          <p className="font-semibold">রিপোর্ট লোড করতে সমস্যা হয়েছে</p>
          <p className="break-words">{firstError?.message || String(firstError)}</p>
          <button
            type="button"
            className="underline font-semibold"
            onClick={() => { failed.forEach((q) => queryClient.resetQueries({ queryKey: q.queryKey })); }}
          >
            আবার চেষ্টা করুন
          </button>
        </div>
      )}

      {activeTab === "exam" ? (
        <ExamAnalytics />
      ) : activeTab === "class" ? (
        <ClassReport />
      ) : (
        <WeaknessAnalysis />
      )}
    </div>
  );
};

export default MyProgress;
