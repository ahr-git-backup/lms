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
  // conveyor rather than a single circle animating alone. Size grows/shrinks
  // together with position: biggest exactly at the arc's centre (50%),
  // smallest at either end — driven by the same keyframe as the motion, so
  // whichever circle is currently centred is the big one, in real time.
  const MAIN_SIZE = 100;
  const EDGE_SIZE = 46;

  const items = useMemo(() => {
    return courses.map((c, i) => {
      const phase = courses.length > 1 ? i / courses.length : 0; // 0..1, evenly spread
      return { course: c, phase };
    });
  }, [courses]);

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

        {items.map(({ course: c, phase }) => (
          <button
            key={c.id}
            onClick={() => goToCourse(c.id)}
            className="absolute left-0 top-0 rounded-full arc-rotate-item"
            style={{
              offsetPath: `path('${arcPath}')`,
              offsetRotate: "0deg",
              animationDuration: `${LOOP_SECONDS}s`,
              animationDelay: `${-phase * LOOP_SECONDS}s`,
            }}
          >
            <div
              className="rounded-full arc-rotate-item-glow"
              style={{
                background: "linear-gradient(135deg,#FFD65C,#FF7A45,#6C63FF)",
                animationDuration: `${LOOP_SECONDS}s`,
                animationDelay: `${-phase * LOOP_SECONDS}s`,
              }}
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
           to 0% and repeats, so items keep following one after another.
           Size (width/height/margin) is driven by the same 0%/50%/100%
           keyframe stops as the position, so whichever circle currently
           sits at the arc's centre (50% offset-distance) is the big one,
           in real time — not tied to which item index it originally was. */
        @keyframes arcOffsetLoop {
          0%   { offset-distance: 0%;   width: ${EDGE_SIZE}px; height: ${EDGE_SIZE}px; margin-left: -${EDGE_SIZE / 2}px; margin-top: -${EDGE_SIZE / 2}px; z-index: 4; }
          50%  { offset-distance: 50%;  width: ${MAIN_SIZE}px; height: ${MAIN_SIZE}px; margin-left: -${MAIN_SIZE / 2}px; margin-top: -${MAIN_SIZE / 2}px; z-index: 5; }
          100% { offset-distance: 100%; width: ${EDGE_SIZE}px; height: ${EDGE_SIZE}px; margin-left: -${EDGE_SIZE / 2}px; margin-top: -${EDGE_SIZE / 2}px; z-index: 4; }
        }
        .arc-rotate-item {
          animation-name: arcOffsetLoop;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        @keyframes arcRotateInnerPad {
          0%   { padding: 2.5px; box-shadow: 0 4px 14px rgba(0,0,0,.45); }
          50%  { padding: 3.5px; box-shadow: 0 6px 18px rgba(0,0,0,.5), 0 0 0 6px rgba(255,214,92,.35); }
          100% { padding: 2.5px; box-shadow: 0 4px 14px rgba(0,0,0,.45); }
        }
        .arc-rotate-item-glow {
          width: 100%;
          height: 100%;
          animation-name: arcRotateInnerPad;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
      `}</style>
    </div>
  );
}
