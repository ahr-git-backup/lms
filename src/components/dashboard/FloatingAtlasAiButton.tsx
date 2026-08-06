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
          <line x1="18" y1="44" x2="23" y2="38" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="46" y1="44" x2="41" y2="38" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
          {/* Legs */}
          <line x1="29" y1="52" x2="27" y2="60" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="35" y1="52" x2="37" y2="60" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
          {/* Body */}
          <rect x="27" y="37" width="10" height="16" rx="5" fill="white" />
          {/* Neck gap keeps head separate/small */}
          {/* Face */}
          <circle cx="32" cy="26" r="9" fill="white" />
          {/* Eyes */}
          <circle cx="28.8" cy="25.3" r="1.4" fill="#166534" />
          <circle cx="35.2" cy="25.3" r="1.4" fill="#166534" />
          {/* Smile */}
          <path d="M28.5 29.5c1.2 1.2 2.4 1.8 3.5 1.8s2.3-.6 3.5-1.8" stroke="#166534" strokeWidth="1.4" strokeLinecap="round" fill="none" />
          {/* Graduation cap */}
          <path d="M32 11 L45 16 L32 21 L19 16 Z" fill="white" />
          <path d="M25 17.5v3.5c0 1.4 3 2.7 7 2.7s7-1.3 7-2.7v-3.5" stroke="white" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        </svg>
      </span>

      <span className="text-[9px] sm:text-[10px] font-semibold text-muted-foreground leading-none">
        ATLAS AI
      </span>
    </button>
  );
};

export default FloatingAtlasAiButton;
