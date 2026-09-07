import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  LayoutGrid,
  Video,
  FileQuestion,
  Zap,
  Timer,
  Clock,
  BarChart3,
  Star,
  ClipboardCheck,
  Send,
  Gift,
} from "lucide-react";

const scrollToId = (id: string) => {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
};

type ResourceItem = {
  label: string;
  icon: typeof LayoutGrid;
  onClick: (navigate: ReturnType<typeof useNavigate>) => void;
  color: string;
};

const RESOURCES: ResourceItem[] = [
  { label: "All Courses", icon: LayoutGrid, onClick: () => scrollToId("courses"), color: "from-primary to-primary/80" },
  { label: "Course Review", icon: Star, onClick: (nav) => nav("/reviews"), color: "from-amber-500 to-yellow-500" },
  { label: "Free Class", icon: Video, onClick: (nav) => nav("/free-class"), color: "from-blue-500 to-indigo-500" },
  { label: "Free Exam", icon: FileQuestion, onClick: (nav) => nav("/free-exam"), color: "from-red-500 to-rose-500" },
  { label: "Quick Practice", icon: Zap, onClick: (nav) => nav("/quick-practice"), color: "from-violet-500 to-indigo-500" },
  { label: "Focus Timer", icon: Timer, onClick: (nav) => nav("/focus-timer"), color: "from-emerald-500 to-teal-500" },
  { label: "Telegram Support", icon: Send, onClick: (nav) => nav("/telegram-support"), color: "from-sky-500 to-blue-500" },
  { label: "Pomodoro Timer", icon: Clock, onClick: (nav) => nav("/pomodoro"), color: "from-rose-500 to-pink-500" },
  { label: "Study Tracker", icon: BarChart3, onClick: (nav) => nav("/syllabus-tracker"), color: "from-sky-500 to-blue-600" },
  { label: "Unlimited Mock Test", icon: ClipboardCheck, onClick: (nav) => nav("/mock-test"), color: "from-fuchsia-500 to-pink-600" },
];

const ResourceButton = ({ item, navigate }: { item: ResourceItem; navigate: ReturnType<typeof useNavigate> }) => {
  const Icon = item.icon;
  return (
    <button
      onClick={() => item.onClick(navigate)}
      className="group flex w-full items-center gap-3 rounded-xl border border-border/60 bg-background px-3 py-2.5 text-left transition-all hover:border-primary/50 hover:shadow-md"
    >
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${item.color} shadow-sm`}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <span className="text-sm font-semibold leading-tight">{item.label}</span>
    </button>
  );
};

/** Desktop: sticky side panel. Mobile: floating button + slide-in drawer. */
export const FreeResourcesSidebar = () => {
  const navigate = useNavigate();

  return (
    <>
      {/* Desktop sticky sidebar */}
      <aside className="hidden lg:block w-64 shrink-0">
        <div className="sticky top-20 space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-3">
          <div className="flex items-center gap-2 px-1">
            <Gift className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold">ফ্রি রিসোর্স সমূহ</h3>
          </div>
          <div className="space-y-2">
            {RESOURCES.map((item) => (
              <ResourceButton key={item.label} item={item} navigate={navigate} />
            ))}
          </div>
        </div>
      </aside>

      {/* Mobile floating button + drawer */}
      <div className="lg:hidden fixed bottom-5 right-4 z-40">
        <Sheet>
          <SheetTrigger asChild>
            <Button className="h-12 w-12 rounded-full shadow-lg p-0" aria-label="ফ্রি রিসোর্স সমূহ">
              <Gift className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[280px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>ফ্রি রিসোর্স সমূহ</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-2">
              {RESOURCES.map((item) => (
                <ResourceButton key={item.label} item={item} navigate={navigate} />
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
};

export default FreeResourcesSidebar;
