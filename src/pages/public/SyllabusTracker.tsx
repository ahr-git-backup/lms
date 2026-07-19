import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BarChart3 } from "lucide-react";
import PublicHeader from "@/components/PublicHeader";

const SyllabusTracker = () => {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Syllabus Tracker — Atlas";
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground pb-16">
      <PublicHeader />

      <div className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-card border-b">
        <button
          onClick={() => navigate("/")}
          className="h-9 w-9 rounded-full border flex items-center justify-center hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="flex-1 font-extrabold text-[17px]">Syllabus Tracker</h1>
      </div>

      <div className="max-w-md mx-auto px-4 pt-10 flex flex-col items-center text-center gap-4">
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-lg">
          <BarChart3 className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-lg font-bold">শীঘ্রই আসছে</h2>
        <p className="text-sm text-muted-foreground">
          Syllabus Tracker ফিচারটি এখনো প্রস্তুত হচ্ছে। কনটেন্ট খুব শীঘ্রই যুক্ত করা হবে।
        </p>
      </div>
    </div>
  );
};

export default SyllabusTracker;
