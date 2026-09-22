import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ArcCourse {
  id: string;
  name: string;
  image_url: string;
}

const MAX_COURSES = 5; // number of fixed slots on the arc
const SHIFT_MS = 3200; // how often courses shift one slot clockwise
const TRANSITION_MS = 900; // how long a single shift's move/resize takes

export default function CoursesArcBanner() {
  const navigate = useNavigate();
  const [trackWidth, setTrackWidth] = useState(320);
  const [shift, setShift] = useState(0); // how many slots everything has rotated by

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

  // Every SHIFT_MS, each course moves one slot clockwise (left -> next
  // slot to the right); the course in the rightmost slot wraps around to
  // the leftmost slot. The slots themselves (position + size on the arc)
  // never move — only which course sits in which slot changes, so the
  // motion reads as courses rotating past fixed stopping points rather
  // than the points themselves sliding.
  useEffect(() => {
    if (courses.length < 2) return;
    const id = setInterval(() => setShift((s) => s + 1), SHIFT_MS);
    return () => clearInterval(id);
  }, [courses.length]);

  const trackH = 155;
  const cx = trackWidth / 2;
  const r = trackH - 8;
  const cy = trackH + 24;
  const arcPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  const mainSlot = Math.floor((courses.length - 1) / 2);

  // Fixed slot geometry: position along the half-circle (t: 0 = left end,
  // 1 = right end) and size (biggest at the centre slot, smaller further
  // out) never change — only which course occupies which slot does.
  const slots = useMemo(() => {
    const n = courses.length;
    return Array.from({ length: n }, (_, slot) => {
      const t = n > 1 ? slot / (n - 1) : 0.5;
      const rad = Math.PI - t * Math.PI; // left (PI) -> right (0)
      const x = cx - r * Math.cos(rad);
      const y = cy - r * Math.sin(rad);
      const distFromCenter = Math.abs(slot - mainSlot);
      const size = distFromCenter === 0 ? 100 : distFromCenter === 1 ? 62 : 46;
      const zIndex = distFromCenter === 0 ? 5 : 4 - distFromCenter;
      return { x, y, size, zIndex, isMain: distFromCenter === 0 };
    });
  }, [courses.length, cx, cy, r, mainSlot]);

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

        {courses.map((c, courseIdx) => {
          // Which fixed slot this course currently occupies: it advances
          // one slot clockwise every `shift`, wrapping at the array end.
          const slotIdx = (courseIdx + shift) % courses.length;
          const slot = slots[slotIdx];
          return (
            <button
              key={c.id}
              onClick={() => goToCourse(c.id)}
              className="absolute left-0 top-0 rounded-full"
              style={{
                width: slot.size,
                height: slot.size,
                transform: `translate(${slot.x - slot.size / 2}px, ${slot.y - slot.size / 2}px)`,
                zIndex: slot.zIndex,
                transition: `transform ${TRANSITION_MS}ms cubic-bezier(.4,0,.2,1), width ${TRANSITION_MS}ms cubic-bezier(.4,0,.2,1), height ${TRANSITION_MS}ms cubic-bezier(.4,0,.2,1)`,
              }}
            >
              <div
                className={slot.isMain ? "h-full w-full rounded-full p-[3.5px] shadow-[0_6px_18px_rgba(0,0,0,.5)] animate-arc-main-glow" : "h-full w-full rounded-full p-[2.5px] shadow-[0_4px_14px_rgba(0,0,0,.45)]"}
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
