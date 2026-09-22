import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ArcCourse {
  id: string;
  name: string;
  image_url: string;
}

const MAX_COURSES = 6;
const STEP_DELAY = 0.35; // seconds between each course popping in, in order

export default function CoursesArcBanner() {
  const navigate = useNavigate();
  const [trackWidth, setTrackWidth] = useState(340);

  const { data: courses = [] } = useQuery({
    queryKey: ["pwa-arc-courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, name, image_url")
        .eq("is_active", true)
        .eq("is_public", true)
        .eq("is_hidden", false)
        .not("image_url", "is", null)
        .order("priority", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(MAX_COURSES);
      if (error) throw error;
      return (data || []) as ArcCourse[];
    },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    const el = document.getElementById("arc-courses-track");
    if (!el) return;
    const measure = () => setTrackWidth(el.clientWidth || 340);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Center course = focus piece (biggest, in the middle of the arc)
  const mainIndex = useMemo(() => Math.floor((courses.length - 1) / 2), [courses.length]);

  if (!courses.length) return null;

  const h = 118;
  const cx = trackWidth / 2;
  const cy = h + 4;
  const r = h - 8;

  const goToCourse = (id: string) => navigate(`/courses/${id}`);

  return (
    <div className="relative mx-4 mt-3 mb-1 overflow-hidden rounded-[26px] px-3 pb-8 pt-5 shadow-[0_8px_24px_rgba(245,158,11,.28)]" style={{ background: "linear-gradient(160deg,#FFC93C 0%,#FFA53C 55%,#FF8A3C 100%)" }}>
      {/* faint decorative food-app-style ring */}
      <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full border-[3px] border-white/25" />
      <div className="pointer-events-none absolute -left-8 bottom-6 h-20 w-20 rounded-full border-[3px] border-white/15" />

      <div className="relative z-[2] mb-3 flex items-center justify-between gap-2 px-1">
        <div>
          <div className="text-[15px] font-extrabold leading-tight text-white drop-shadow-sm">আমাদের সেরা কোর্সসমূহ</div>
          <div className="text-[10.5px] font-medium text-white/85">অসাধারণ মানের প্রস্তুতি, সীমাহীন সুবিধা</div>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 backdrop-blur-sm">
          <span className="text-[11px]">🎓</span>
          <span className="text-[10.5px] font-bold text-white">Premium</span>
        </div>
      </div>

      <div id="arc-courses-track" className="relative z-[2]" style={{ height: h + 40 }}>
        <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${trackWidth} ${h + 10}`} preserveAspectRatio="none">
          <path
            d={`M 6 ${h - 4} A ${r} ${r} 0 0 1 ${trackWidth - 6} ${h - 4}`}
            fill="none"
            stroke="rgba(255,255,255,.55)"
            strokeWidth={3}
            strokeLinecap="round"
          />
        </svg>

        {courses.map((c, i) => {
          const t = courses.length > 1 ? i / (courses.length - 1) : 0.5;
          const angle = Math.PI - t * Math.PI;
          const x = cx - r * Math.cos(angle);
          const y = cy - r * Math.sin(angle);
          const isMain = i === mainIndex;
          const size = isMain ? 92 : 54;
          const delay = (i * STEP_DELAY).toFixed(2);

          return (
            <button
              key={c.id}
              onClick={() => goToCourse(c.id)}
              className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0"
              style={{
                left: x,
                top: isMain ? y - 14 : y,
                width: size,
                height: size,
                zIndex: isMain ? 5 : 2,
                animation: "arcItemPop .5s cubic-bezier(.34,1.56,.64,1) forwards",
                animationDelay: `${delay}s`,
              }}
            >
              <div
                className={isMain ? "h-full w-full rounded-full bg-white p-[4px] shadow-[0_10px_26px_rgba(0,0,0,.35)] animate-arc-main-glow" : "h-full w-full rounded-full bg-white/90 p-[2.5px] shadow-[0_4px_12px_rgba(0,0,0,.25)]"}
              >
                <img src={c.image_url} alt={c.name} loading="lazy" className="h-full w-full rounded-full object-cover bg-[#fff3d9]" />
              </div>
              {isMain && (
                <div className="absolute left-1/2 top-full mt-1.5 max-w-[130px] -translate-x-1/2 truncate text-center text-[10.5px] font-bold text-white drop-shadow-sm">
                  {c.name}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <style>{`
        @keyframes arcItemPop {
          0% { transform: translate(-50%, -50%) scale(.05); opacity: 0; }
          65% { opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
        @keyframes arcMainGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,.6), 0 10px 26px rgba(0,0,0,.35); }
          50% { box-shadow: 0 0 0 7px rgba(255,255,255,0), 0 10px 26px rgba(0,0,0,.35); }
        }
        .animate-arc-main-glow { animation: arcMainGlow 2.2s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
