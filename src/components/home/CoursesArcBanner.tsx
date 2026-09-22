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
const STEP_DELAY = 0.18;

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

  // Center course = main focus (biggest, dead-center apex of the arc, animates in FIRST)
  const mainIndex = useMemo(() => Math.floor((courses.length - 1) / 2), [courses.length]);

  // Animation order: center piece first (delay 0), then alternating outward
  // from the center towards the edges.
  const animOrder = useMemo(() => {
    const order: Record<number, number> = {};
    let step = 0;
    order[mainIndex] = step++;
    let left = mainIndex - 1;
    let right = mainIndex + 1;
    while (left >= 0 || right < courses.length) {
      if (right < courses.length) order[right++] = step++;
      if (left >= 0) order[left--] = step++;
    }
    return order;
  }, [mainIndex, courses.length]);

  // Geometry: track box is exactly h tall, arc radius r, center (cx, cy).
  // Every circle (including the main one) is centered exactly on this arc.
  const trackH = 150;
  const cx = trackWidth / 2;
  const r = trackH - 10;
  const cy = trackH + 2; // circle centers sit ON the arc line, arc bulges up into the track box

  const positions = useMemo(() => {
    return courses.map((c, i) => {
      const t = courses.length > 1 ? i / (courses.length - 1) : 0.5;
      const angle = Math.PI - t * Math.PI; // PI (left) -> 0 (right), apex at t=0.5
      const x = cx - r * Math.cos(angle);
      const y = cy - r * Math.sin(angle);
      return { x, y, angleDeg: (angle * 180) / Math.PI };
    });
  }, [courses, cx, r, cy]);

  if (!courses.length) return null;

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

      <div id="arc-courses-track" className="relative z-[2] mt-1.5" style={{ height: trackH }}>
        <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 ${trackWidth} ${trackH}`} preserveAspectRatio="none">
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none"
            stroke="rgba(255,255,255,.28)"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        </svg>

        {courses.map((c, i) => {
          const { x, y } = positions[i];
          const isMain = i === mainIndex;
          const size = isMain ? 92 : 54;
          const delay = (animOrder[i] * STEP_DELAY).toFixed(2);
          // Rotate in clockwise around the arc's center into its resting spot:
          // start ~55° back (counter-clockwise) from final position, same radius,
          // then sweep clockwise while fading/scaling in.
          const finalRad = Math.atan2(cy - y, x - cx); // angle of this item's resting point
          const startRad = finalRad - (55 * Math.PI) / 180;
          const startX = cx + r * Math.cos(startRad);
          const startY = cy - r * Math.sin(startRad);

          return (
            <button
              key={c.id}
              onClick={() => goToCourse(c.id)}
              className="absolute left-0 top-0 rounded-full opacity-0"
              style={
                {
                  left: x,
                  top: y,
                  width: size,
                  height: size,
                  zIndex: isMain ? 5 : 2,
                  animation: "arcItemRotateIn .6s cubic-bezier(.34,1.2,.4,1) forwards",
                  animationDelay: `${delay}s`,
                  "--arc-dx": `${startX - x}px`,
                  "--arc-dy": `${startY - y}px`,
                } as React.CSSProperties
              }
            >
              <div
                className={
                  isMain
                    ? "h-full w-full rounded-full p-[3.5px] shadow-[0_6px_18px_rgba(0,0,0,.5)] animate-arc-main-glow"
                    : "h-full w-full rounded-full p-[2.5px] shadow-[0_4px_14px_rgba(0,0,0,.45)]"
                }
                style={{ background: "linear-gradient(135deg,#FFD65C,#FF7A45,#6C63FF)" }}
              >
                <img src={c.image_url} alt={c.name} loading="lazy" className="h-full w-full rounded-full object-cover bg-[#1a1f30]" />
              </div>
              <div
                className={
                  isMain
                    ? "absolute left-1/2 top-full mt-1 max-w-[110px] -translate-x-1/2 truncate text-center text-[10px] font-bold text-white"
                    : "absolute left-1/2 top-full mt-1 max-w-[68px] -translate-x-1/2 truncate text-center text-[8.5px] text-white/65"
                }
              >
                {c.name}
              </div>
            </button>
          );
        })}
      </div>

      <style>{`
        @keyframes arcItemRotateIn {
          0% {
            transform: translate(calc(-50% + var(--arc-dx)), calc(-50% + var(--arc-dy))) scale(.2);
            opacity: 0;
          }
          55% { opacity: 1; }
          100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
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
