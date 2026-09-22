import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ArcCourse {
  id: string;
  name: string;
  image_url: string;
}

const MAX_COURSES = 5; // shown on the arc at once
const LOOP_SECONDS = 16; // one full lap (left end -> right end) takes this long

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
  }, [courses.length]);

  const mainIndex = useMemo(() => Math.floor((courses.length - 1) / 2), [courses.length]);

  const trackH = 155;
  const cx = trackWidth / 2;
  const r = trackH - 8;
  const cy = trackH + 4;
  // Half-circle path from the arc's left end to its right end, matching the
  // visible guide line drawn below (same cx/cy/r). offset-path animates a
  // course circle continuously along this exact curve.
  const arcPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  // Every item shares one continuous-loop animation that walks 0% -> 100%
  // along the arc (left end to right end = clockwise across the top), then
  // jumps back to 0% to repeat. Items are phase-offset via a negative
  // animation-delay so they are spread evenly along the arc at any given
  // moment, each following the one after it — a continuous clockwise
  // conveyor rather than a single circle animating alone.
  const items = useMemo(() => {
    return courses.map((c, i) => {
      const distFromCenter = Math.abs(i - mainIndex);
      const size = distFromCenter === 0 ? 100 : distFromCenter === 1 ? 62 : 46;
      const isMain = distFromCenter === 0;
      const phase = courses.length > 1 ? i / courses.length : 0; // 0..1, evenly spread
      return { course: c, size, isMain, phase };
    });
  }, [courses, mainIndex]);

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
          <path d={arcPath} fill="none" stroke="rgba(255,255,255,.28)" strokeWidth={2.5} strokeLinecap="round" />
        </svg>

        {items.map(({ course: c, size, isMain, phase }) => (
          <button
            key={c.id}
            onClick={() => goToCourse(c.id)}
            className="absolute left-0 top-0 rounded-full arc-rotate-item"
            style={{
              width: size,
              height: size,
              marginLeft: -size / 2,
              marginTop: -size / 2,
              zIndex: isMain ? 5 : 4,
              offsetPath: `path('${arcPath}')`,
              offsetRotate: "0deg",
              animationDuration: `${LOOP_SECONDS}s`,
              animationDelay: `${-phase * LOOP_SECONDS}s`,
            }}
          >
            <div
              className={isMain ? "h-full w-full rounded-full p-[3.5px] shadow-[0_6px_18px_rgba(0,0,0,.5)] animate-arc-main-glow" : "h-full w-full rounded-full p-[2.5px] shadow-[0_4px_14px_rgba(0,0,0,.45)]"}
              style={{ background: "linear-gradient(135deg,#FFD65C,#FF7A45,#6C63FF)" }}
            >
              <img src={c.image_url} alt={c.name} loading="lazy" className="h-full w-full rounded-full object-cover bg-[#1a1f30]" />
            </div>
          </button>
        ))}
      </div>

      <style>{`
        /* offset-distance walks each item 0% -> 100% along its offset-path
           (the same half-circle arc drawn as the guide line): left end to
           right end across the top, i.e. clockwise. At 100% it jumps back
           to 0% and repeats, so items keep following one after another. */
        @keyframes arcOffsetLoop {
          0% { offset-distance: 0%; }
          100% { offset-distance: 100%; }
        }
        .arc-rotate-item {
          animation-name: arcOffsetLoop;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
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
