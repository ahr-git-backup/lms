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
const STEP_DELAY_MS = 180;
const ANIM_MS = 650;
const SWEEP_DEG = 55; // how far back (counter-clockwise) each item starts from its resting spot

export default function CoursesArcBanner() {
  const navigate = useNavigate();
  const [trackWidth, setTrackWidth] = useState(320);
  const [entered, setEntered] = useState(false); // flips true one tick after mount, triggers the CSS transition

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
  }, [courses.length]);

  const mainIndex = useMemo(() => Math.floor((courses.length - 1) / 2), [courses.length]);

  // Center piece animates first, then alternating outward to the edges.
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

  const trackH = 150;
  const cx = trackWidth / 2;
  const r = trackH - 10;
  const cy = trackH + 2;

  const items = useMemo(() => {
    const sweepRad = (SWEEP_DEG * Math.PI) / 180;
    return courses.map((c, i) => {
      const t = courses.length > 1 ? i / (courses.length - 1) : 0.5;
      const finalRad = Math.PI - t * Math.PI; // PI (left) -> 0 (right), standard math angle
      const finalX = cx - r * Math.cos(finalRad);
      const finalY = cy - r * Math.sin(finalRad);
      // Starting point: further clockwise-behind on the same arc (higher angle
      // = further left/up in this coordinate scheme), so it sweeps CLOCKWISE
      // into its resting spot as the angle decreases toward finalRad.
      const startRad = finalRad + sweepRad;
      const startX = cx - r * Math.cos(startRad);
      const startY = cy - r * Math.sin(startRad);
      return { course: c, finalX, finalY, startX, startY, isMain: i === mainIndex, delay: animOrder[i] * STEP_DELAY_MS };
    });
  }, [courses, cx, r, cy, mainIndex, animOrder]);

  // Flip to "entered" a frame after mount so the browser paints the start
  // position first, then transitions to the final position (classic FLIP-style
  // enter animation — relies only on a CSS transition on left/top/transform,
  // no CSS custom properties, so it can't silently no-op).
  useEffect(() => {
    if (!courses.length) return;
    setEntered(false);
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [courses.length, trackWidth]);

  if (!courses.length) return null;

  const goToCourse = (id: string) => navigate(`/courses/${id}`);

  return (
    <div className="relative mx-4 mt-3 mb-1 overflow-hidden rounded-[22px] border border-white/10 bg-[#0c0f1a] px-2.5 pb-7 pt-4 min-h-[190px]">
      <div
        className="pointer-events-none absolute inset-0 bg-center bg-no-repeat opacity-[0.28] blur-[7px]"
        style={{ backgroundImage: "url('/logo.png')", backgroundSize: "55%", backgroundPosition: "center 30%", transform: "scale(1.15)" }}
      />

      <div id="arc-courses-track" className="relative z-[2] mt-9" style={{ height: trackH }}>
        <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 ${trackWidth} ${trackH}`} preserveAspectRatio="none">
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none"
            stroke="rgba(255,255,255,.28)"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        </svg>

        {items.map(({ course: c, finalX, finalY, startX, startY, isMain, delay }) => {
          const size = isMain ? 92 : 54;
          const x = entered ? finalX : startX;
          const y = entered ? finalY : startY;
          const scale = entered ? 1 : 0.15;
          const opacity = entered ? 1 : 0;

          return (
            <button
              key={c.id}
              onClick={() => goToCourse(c.id)}
              className="absolute left-0 top-0 rounded-full"
              style={{
                left: x,
                top: y,
                width: size,
                height: size,
                zIndex: isMain ? 5 : 2,
                opacity,
                transform: `translate(-50%, -50%) scale(${scale})`,
                transition: `left ${ANIM_MS}ms cubic-bezier(.22,1.4,.36,1) ${delay}ms, top ${ANIM_MS}ms cubic-bezier(.22,1.4,.36,1) ${delay}ms, transform ${ANIM_MS}ms cubic-bezier(.22,1.4,.36,1) ${delay}ms, opacity ${Math.round(ANIM_MS * 0.6)}ms ease-out ${delay}ms`,
              }}
            >
              <div
                className={isMain ? "h-full w-full rounded-full p-[3.5px] shadow-[0_6px_18px_rgba(0,0,0,.5)] animate-arc-main-glow" : "h-full w-full rounded-full p-[2.5px] shadow-[0_4px_14px_rgba(0,0,0,.45)]"}
                style={{ background: "linear-gradient(135deg,#FFD65C,#FF7A45,#6C63FF)" }}
              >
                <img src={c.image_url} alt={c.name} loading="lazy" className="h-full w-full rounded-full object-cover bg-[#1a1f30]" />
              </div>
            </button>
          );
        })}
      </div>

      <style>{`
        @keyframes arcMainGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,214,92,.55), 0 6px 18px rgba(0,0,0,.5); }
          50% { box-shadow: 0 0 0 8px rgba(255,214,92,0), 0 6px 18px rgba(0,0,0,.5); }
        }
        .animate-arc-main-glow { animation: arcMainGlow 2.4s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
