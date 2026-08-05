import { Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

const FloatingAtlasAiButton = () => {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate("/atlas-ai")}
      aria-label="ATLAS AI"
      className="fixed top-16 right-3 sm:top-20 sm:right-6 z-50 h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg hover:shadow-xl hover:scale-110 active:scale-95 transition-all flex items-center justify-center print:hidden"
    >
      <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-white animate-icon-float" />
    </button>
  );
};

export default FloatingAtlasAiButton;
