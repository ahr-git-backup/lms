import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ArcCourse {
  id: string;
  name: string;
  image_url: string;
}

const MAX_COURSES = 7;

export default function CoursesArcBanner() {
  const navigate = useNavigate();
  const [trackWidth, setTrackWidth] = useState(320);

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
    const measure = () => setTrackWidth(el.clientWidth || 320);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { mainCourse, sideCourses } = useMemo(() => {
    if (!courses.length) return { mainCourse: null as ArcCourse | null, sideCourses: [] as ArcCourse[] };
    const mainIdx = Math.floor((courses.length - 1) / 2);
    return {
      mainCourse: courses[mainIdx],
      sideCourses: courses.filter((_, i) => i !== mainIdx),
    };
  }, [courses]);

  if (!courses.length) return null;

  const h = 148;
  const cx = trackWidth / 2;
  const cy = h + 34;
  const r = h - 6;
  const n = sideCourses.length;

  const goToCourse = (id: string) => navigate(`/courses/${id}`);

  return (
    <div className="relative mx-4 mt-3 mb-1 overflow-hidden rounded-[22px] border border-white/10 bg-[#0c0f1a] px-2.5 pb-5 pt-4 min-h-[190px]">
      <div
        className="pointer-events-none absolute inset-0 bg-center bg-no-repeat opacity-[0.28] blur-[7px]"
        style={{ backgroundImage: "url('/logo.png')", backgroundSize: "55%", backgroundPosition: "center 30%", transform: "scale(1.15)" }}
      />
      <div className="relative z-[2] text-center mb-1.5">
        <div className="text-[13.5px] font-extrabold text-white tracking-tight">আমাদের কোর্সসমূহ</div>
        <div className="text-[10px] text-white/55 mt-0.5">যেকোনো কোর্সে ট্যাপ করে বিস্তারিত দেখো</div>
      </div>
      <div id="arc-courses-track" className="relative z-[2] mt-1.5" style={{ height: h }}>
        <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${trackWidth} ${h}`} preserveAspectRatio="none">
          <path
            d={`M 4 ${h - 2} A ${r} ${r} 0 0 1 ${trackWidth - 4} ${h - 2}`}
            fill="none"
            stroke="rgba(255,255,255,.28)"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        </svg>

        {sideCourses.map((c, i) => {
          const t = n > 1 ? i / (n - 1) : 0.5;
          const angle = Math.PI - t * Math.PI;
          const x = cx - r * Math.cos(angle);
          const y = cy - r * Math.sin(angle);
          const delay = (i * 0.12).toFixed(2);
          return (
            <button
              key={c.id}
              onClick={() => goToCourse(c.id)}
              className="absolute top-0 left-0 h-[54px] w-[54px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0"
              style={{
                left: x,
                top: y - 34,
                animation: `arcItemPop .55s cubic-bezier(.34,1.56,.64,1) forwards`,
                animationDelay: `${delay}s`,
              }}
            >
              <div className="h-full w-full rounded-full p-[2.5px] shadow-[0_4px_14px_rgba(0,0,0,.45)]" style={{ background: "linear-gradient(135deg,#FFD65C,#FF7A45,#6C63FF)" }}>
                <img src={c.image_url} alt={c.name} loading="lazy" className="h-full w-full rounded-full object-cover bg-[#1a1f30]" />
              </div>
              <div className="absolute left-1/2 top-full mt-1 max-w-[68px] -translate-x-1/2 truncate text-center text-[8.5px] text-white/65">
                {c.name}
              </div>
            </button>
          );
        })}

        {mainCourse && (
          <button
            onClick={() => goToCourse(mainCourse.id)}
            className="absolute top-0 left-0 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0 z-[5]"
            style={{
              left: cx,
              top: cy - r - 6,
              animation: `arcItemPop .55s cubic-bezier(.34,1.56,.64,1) forwards`,
              animationDelay: `${(n * 0.12 + 0.1).toFixed(2)}s`,
            }}
          >
            <div className="h-full w-full animate-arc-main-glow rounded-full p-[3.5px] shadow-[0_6px_18px_rgba(0,0,0,.5)]" style={{ background: "linear-gradient(135deg,#FFD65C,#FF7A45,#6C63FF)" }}>
              <img src={mainCourse.image_url} alt={mainCourse.name} loading="lazy" className="h-full w-full rounded-full object-cover bg-[#1a1f30]" />
            </div>
            <div className="absolute left-1/2 top-full mt-1 max-w-[110px] -translate-x-1/2 truncate text-center text-[10px] font-bold text-white">
              {mainCourse.name}
            </div>
          </button>
        )}
      </div>

      <style>{`
        @keyframes arcItemPop {
          0% { transform: translate(-50%, -50%) scale(.001); opacity: 0; }
          60% { opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
        @keyframes arcMainGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,214,92,.55), 0 6px 18px rgba(0,0,0,.5); }
          50% { box-shadow: 0 0 0 8px rgba(255,214,92,0), 0 6px 18px rgba(0,0,0,.5); }
        }
        .animate-arc-main-glow { animation: arcMainGlow 2.4s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
