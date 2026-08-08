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
        <svg viewBox="0 0 64 64" className="h-10 w-10 sm:h-11 sm:w-11" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Antenna */}
          <line x1="32" y1="6" x2="32" y2="11" stroke="white" strokeWidth="2" strokeLinecap="round" />
          <circle cx="32" cy="4.5" r="2" fill="white" />

          {/* Legs */}
          <rect x="26.5" y="53" width="3.4" height="7" rx="1.5" fill="white" />
          <rect x="34.1" y="53" width="3.4" height="7" rx="1.5" fill="white" />

          {/* Arms (robotic, jointed) */}
          <rect x="14.5" y="34" width="3.4" height="10" rx="1.5" fill="white" transform="rotate(-18 16.2 39)" />
          <circle cx="14.3" cy="43.5" r="2.1" fill="white" />
          <rect x="46" y="34" width="3.4" height="10" rx="1.5" fill="white" transform="rotate(18 47.7 39)" />
          <circle cx="49.6" cy="43.5" r="2.1" fill="white" />

          {/* Torso (robotic, segmented) */}
          <rect x="22" y="32" width="20" height="21" rx="6" fill="white" />
          <rect x="27" y="37" width="10" height="7" rx="2" fill="#166534" fillOpacity="0.9" />
          <circle cx="29.6" cy="40.5" r="1" fill="white" />
          <circle cx="32" cy="40.5" r="1" fill="white" />
          <circle cx="34.4" cy="40.5" r="1" fill="white" />
          <line x1="32" y1="32" x2="32" y2="28" stroke="white" strokeWidth="2.4" strokeLinecap="round" />

          {/* Head (robotic screen face) */}
          <rect x="21" y="15" width="22" height="16" rx="6" fill="white" />
          <rect x="25" y="19" width="14" height="8" rx="3" fill="#166534" />
          <circle cx="29" cy="23" r="1.5" fill="white" />
          <circle cx="35" cy="23" r="1.5" fill="white" />
          <path d="M29.5 25.3c1 .6 1.9.9 2.5.9s1.5-.3 2.5-.9" stroke="white" strokeWidth="1.1" strokeLinecap="round" fill="none" />
          <circle cx="18.5" cy="23" r="1.6" fill="white" />
          <circle cx="45.5" cy="23" r="1.6" fill="white" />

          {/* Graduation cap */}
          <path d="M32 3 L46 8.5 L32 14 L18 8.5 Z" fill="white" />
          <path d="M24 10.2v3.6c0 1.5 3.6 2.9 8 2.9s8-1.4 8-2.9v-3.6" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <line x1="46" y1="8.5" x2="46" y2="14.5" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
          <circle cx="46" cy="15.3" r="1.1" fill="white" />
        </svg>
      </span>

      <span className="text-[9px] sm:text-[10px] font-semibold text-muted-foreground leading-none">
        ATLAS AI
      </span>
    </button>
  );
};

export default FloatingAtlasAiButton;
