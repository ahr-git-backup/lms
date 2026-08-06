import { useNavigate } from "react-router-dom";

const FloatingAtlasAiButton = () => {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate("/atlas-ai")}
      aria-label="Atlas Tutor"
      className="fixed top-16 right-3 sm:top-20 sm:right-6 z-50 flex flex-col items-center gap-1 print:hidden"
    >
      {/* Square avatar box */}
      <span className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 via-indigo-500 to-blue-600 shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all">
        <svg viewBox="0 0 64 64" className="h-9 w-9 sm:h-10 sm:w-10" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Arms */}
          <line x1="14" y1="42" x2="21" y2="34" stroke="white" strokeWidth="3" strokeLinecap="round" />
          <line x1="50" y1="42" x2="43" y2="34" stroke="white" strokeWidth="3" strokeLinecap="round" />
          {/* Legs */}
          <line x1="27" y1="48" x2="24" y2="58" stroke="white" strokeWidth="3" strokeLinecap="round" />
          <line x1="37" y1="48" x2="40" y2="58" stroke="white" strokeWidth="3" strokeLinecap="round" />
          {/* Body */}
          <rect x="24" y="34" width="16" height="16" rx="6" fill="white" />
          {/* Face */}
          <circle cx="32" cy="22" r="13" fill="white" />
          {/* Eyes */}
          <circle cx="27" cy="21" r="2.2" fill="#4338CA" />
          <circle cx="37" cy="21" r="2.2" fill="#4338CA" />
          {/* Smile */}
          <path d="M26 27c1.8 2 4 3 6 3s4.2-1 6-3" stroke="#4338CA" strokeWidth="2" strokeLinecap="round" fill="none" />
          {/* Graduation cap */}
          <path d="M32 4 L48 10 L32 16 L16 10 Z" fill="white" />
          <path d="M22 12v5c0 2 4.5 4 10 4s10-2 10-4v-5" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
      </span>

      <span className="text-[9px] sm:text-[10px] font-semibold text-muted-foreground leading-none">
        ATLAS AI
      </span>
    </button>
  );
};

export default FloatingAtlasAiButton;
