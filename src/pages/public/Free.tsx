import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PublicHeader from "@/components/PublicHeader";
import { Video, FileQuestion } from "lucide-react";

const Free = () => {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Free – Atlas";
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicHeader />
      <div className="px-4 py-3">
        <p className="text-lg font-bold leading-tight">ফ্রি রিসোর্স</p>
        <p className="text-xs text-muted-foreground">যেটা দরকার সেটাতে ক্লিক করুন</p>
      </div>
      <main className="flex-1 px-4 pb-6 grid grid-cols-2 gap-3 content-start">
        <button
          onClick={() => navigate("/free-class")}
          className="relative aspect-square rounded-2xl p-[1.5px] bg-gradient-to-br from-blue-500/60 to-cyan-500/60 active:scale-95 transition-transform shadow-sm hover:shadow-md"
        >
          <div className="flex flex-col items-center justify-center gap-3 rounded-[calc(1rem-1.5px)] bg-card h-full">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-md ring-1 ring-white/20">
              <Video className="h-7 w-7 text-white" strokeWidth={2.25} />
            </div>
            <span className="text-sm font-bold text-center text-foreground">Free Class</span>
          </div>
        </button>
        <button
          onClick={() => navigate("/free-exam")}
          className="relative aspect-square rounded-2xl p-[1.5px] bg-gradient-to-br from-red-500/60 to-rose-500/60 active:scale-95 transition-transform shadow-sm hover:shadow-md"
        >
          <div className="flex flex-col items-center justify-center gap-3 rounded-[calc(1rem-1.5px)] bg-card h-full">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-rose-500 shadow-md ring-1 ring-white/20">
              <FileQuestion className="h-7 w-7 text-white" strokeWidth={2.25} />
            </div>
            <span className="text-sm font-bold text-center text-foreground">Free Exam</span>
          </div>
        </button>
      </main>
    </div>
  );
};

export default Free;
