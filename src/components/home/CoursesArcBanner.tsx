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
const STEP_DELAY = 180; // ms between each item's rotate-in start
const ANIM_DURATION = 650; // ms per item

export default function CoursesArcBanner() {
  const navigate = useNavigate();
  const [trackWidth, setTrackWidth] = useState(320);
  const [progress, setProgress] = useState(0); // 0..1, driven by rAF

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

  const mainIndex = useMemo(() => Math.floor((courses.length - 1) / 2), [courses.length]);

  // Animation order: center piece first, then alternating outward to the edges.
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

  const positions = useMemo(() => {
    return courses.map((c, i) => {
      const t = courses.length > 1 ? i / (courses.length - 1) : 0.5;
      const angle = Math.PI - t * Math.PI; // PI (left) -> 0 (right)
      const x = cx - r * Math.cos(angle);
      const y = cy - r * Math.sin(angle);
      const rad = Math.atan2(cy - y, x - cx); // this point's angle on the circle
      return { x, y, rad };
    });
  }, [courses, cx, r, cy]);

  // Drive the whole sequence with one rAF loop so every item's clockwise
  // sweep is guaranteed to actually animate (no reliance on CSS custom
  // properties inside transforms, which some mobile webviews mishandle).
  useEffect(() => {
    if (!courses.length) return;
    setProgress(0);
    let raf = 0;
    const start = performance.now();
    const totalDuration = STEP_DELAY * (courses.length - 1) + ANIM_DURATION;
    const tick = (now: number) => {
      const elapsed = now - start;
      setProgress(Math.min(1, elapsed / totalDuration));
      if (elapsed < totalDuration) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [courses.length, trackWidth]);

  if (!courses.length) return null;

  const goToCourse = (id: string) => navigate(`/courses/${id}`);
  const totalDuration = STEP_DELAY * (courses.length - 1) + ANIM_DURATION;
  const elapsedMs = progress * totalDuration;

  const easeOutBack = (p: number) => {
    const c1 = 1.4;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
  };

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

        {courses.map((c, i) => {
          const { x, y, rad } = positions[i];
          const isMain = i === mainIndex;
          const size = isMain ? 92 : 54;

          const itemStart = animOrder[i] * STEP_DELAY;
          const itemElapsed = elapsedMs - itemStart;
          const rawP = Math.max(0, Math.min(1, itemElapsed / ANIM_DURATION));
          const eased = easeOutBack(rawP);

          // Sweep clockwise: start 55° counter-clockwise of final angle on the
          // same arc, animate the angle itself down to the final angle.
          const sweepRad = (55 * Math.PI) / 180;
          const currentRad = rawP <= 0 ? rad - sweepRad : rad - sweepRad * (1 - eased);
          const curX = cx + r * Math.cos(currentRad);
          const curY = cy - r * Math.sin(currentRad);
          const scale = rawP <= 0 ? 0.15 : Math.min(1, 0.15 + 0.85 * eased);
          const opacity = rawP <= 0 ? 0 : Math.min(1, rawP / 0.5);

          return (
            <button
              key={c.id}
              onClick={() => goToCourse(c.id)}
              className="absolute left-0 top-0 rounded-full"
              style={{
                left: curX,
                top: curY,
                width: size,
                height: size,
                zIndex: isMain ? 5 : 2,
                opacity,
                transform: `translate(-50%, -50%) scale(${scale})`,
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
