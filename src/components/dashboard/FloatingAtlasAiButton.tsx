import { GraduationCap, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

const FloatingAtlasAiButton = () => {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate("/atlas-ai")}
      aria-label="ATLAS AI Tutor"
      className="fixed top-16 right-3 sm:top-20 sm:right-6 z-50 group print:hidden"
    >
      {/* Pulsing glow ring */}
      <span className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 opacity-60 blur-md animate-pulse group-hover:opacity-90 transition-opacity" />

      {/* Main button */}
      <span className="relative flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 via-indigo-500 to-blue-600 shadow-lg hover:shadow-xl hover:scale-110 active:scale-95 transition-all">
        <GraduationCap className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
        <Sparkles className="absolute -top-1 -right-1 h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-300 animate-icon-float drop-shadow" />
      </span>

      {/* AI badge */}
      <span className="absolute -bottom-1 -right-1 rounded-full bg-white dark:bg-slate-900 border-2 border-violet-500 px-1 text-[9px] sm:text-[10px] font-extrabold leading-tight text-violet-600 dark:text-violet-300 shadow-sm">
        AI
      </span>
    </button>
  );
};

export default FloatingAtlasAiButton;
