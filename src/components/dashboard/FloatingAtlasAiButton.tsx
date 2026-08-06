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
      <span className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-700 shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all">
        <svg viewBox="0 0 64 64" className="h-9 w-9 sm:h-10 sm:w-10" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Arms */}
          <line x1="16" y1="40" x2="22" y2="33" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="48" y1="40" x2="42" y2="33" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          {/* Legs */}
          <line x1="28" y1="47" x2="26" y2="58" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="36" y1="47" x2="38" y2="58" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          {/* Slim body */}
          <rect x="26" y="33" width="12" height="15" rx="5" fill="white" />
          {/* Face */}
          <circle cx="32" cy="22" r="12.5" fill="white" />
          {/* Eyes */}
          <circle cx="27.5" cy="21" r="2" fill="#166534" />
          <circle cx="36.5" cy="21" r="2" fill="#166534" />
          {/* Smile */}
          <path d="M27 27c1.6 1.7 3.6 2.6 5 2.6s3.4-.9 5-2.6" stroke="#166534" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          {/* Graduation cap */}
          <path d="M32 4 L47 10 L32 16 L17 10 Z" fill="white" />
          <path d="M23 12v4.5c0 1.8 4 3.5 9 3.5s9-1.7 9-3.5V12" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </svg>
      </span>

      <span className="text-[9px] sm:text-[10px] font-semibold text-muted-foreground leading-none">
        ATLAS AI
      </span>
    </button>
  );
};

export default FloatingAtlasAiButton;
