import { useNavigate } from "react-router-dom";

const FloatingAtlasAiButton = () => {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate("/atlas-ai")}
      aria-label="Atlas Tutor"
      className="fixed top-16 right-3 sm:top-20 sm:right-6 z-50 group print:hidden"
    >
      {/* Soft pulsing glow */}
      <span className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 opacity-50 blur-md animate-pulse group-hover:opacity-80 transition-opacity" />

      {/* Avatar circle */}
      <span className="relative flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 via-indigo-500 to-blue-600 shadow-lg hover:shadow-xl hover:scale-110 active:scale-95 transition-all overflow-hidden">
        <svg viewBox="0 0 64 64" className="h-8 w-8 sm:h-9 sm:w-9" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Face */}
          <circle cx="32" cy="30" r="15" fill="white" />
          {/* Eyes */}
          <circle cx="26.5" cy="29" r="2.4" fill="#4338CA" />
          <circle cx="37.5" cy="29" r="2.4" fill="#4338CA" />
          {/* Smile */}
          <path d="M25 35c2 2.5 5 4 7 4s5-1.5 7-4" stroke="#4338CA" strokeWidth="2" strokeLinecap="round" fill="none" />
          {/* Graduation cap */}
          <path d="M32 10 L50 17 L32 24 L14 17 Z" fill="white" />
          <path d="M20 20v6c0 2.5 5.5 5 12 5s12-2.5 12-5v-6" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
      </span>
    </button>
  );
};

export default FloatingAtlasAiButton;
