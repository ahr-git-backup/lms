import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useRef, useState } from "react";

/** Auto-scrolling animated image marquee row (same mechanism as the
 *  Reviews page marquee): continuously slides left via requestAnimationFrame,
 *  loops seamlessly by duplicating items, pauses on hover/drag, and
 *  supports click-and-drag / touch-swipe scrolling while paused. */
const useMarqueeRow = (itemCount: number) => {
  const [paused, setPaused] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const posRef = useRef(0);
  const draggingRef = useRef(false);
  const startX = useRef(0);
  const startPos = useRef(0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (itemCount === 0) return;
    let raf: number;
    const step = () => {
      const track = trackRef.current;
      if (track && !paused && !draggingRef.current) {
        posRef.current -= 0.5;
        const halfWidth = track.scrollWidth / 2;
        if (Math.abs(posRef.current) >= halfWidth) posRef.current = 0;
        track.style.transform = `translateX(${posRef.current}px)`;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [paused, itemCount]);

  const onDown = (clientX: number) => {
    draggingRef.current = true;
    setDragging(true);
    startX.current = clientX;
    startPos.current = posRef.current;
  };
  const onMove = (clientX: number) => {
    if (!draggingRef.current || !trackRef.current) return;
    posRef.current = startPos.current + (clientX - startX.current);
    trackRef.current.style.transform = `translateX(${posRef.current}px)`;
  };
  const onUp = () => {
    draggingRef.current = false;
    setDragging(false);
  };

  return {
    trackRef,
    dragging,
    containerHandlers: {
      onMouseEnter: () => setPaused(true),
      onMouseLeave: () => { setPaused(false); onUp(); },
    },
    trackHandlers: {
      onMouseDown: (e: React.MouseEvent) => onDown(e.clientX),
      onMouseMove: (e: React.MouseEvent) => onMove(e.clientX),
      onMouseUp: onUp,
      onTouchStart: (e: React.TouchEvent) => onDown(e.touches[0].clientX),
      onTouchMove: (e: React.TouchEvent) => onMove(e.touches[0].clientX),
      onTouchEnd: onUp,
    },
  };
};

export const SuccessGallerySection = () => {
  const { data: photos } = useQuery({
    queryKey: ["success-gallery-public"],
    queryFn: async () => {
      const { data } = await supabase
        .from("success_gallery")
        .select("*")
        .order("display_order", { ascending: true });
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: settings } = useQuery({
    queryKey: ["success-gallery-settings-public"],
    queryFn: async () => {
      const { data } = await supabase
        .from("success_gallery_settings")
        .select("title, subtitle")
        .eq("id", 1)
        .maybeSingle();
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const row1 = useMarqueeRow(photos?.length ?? 0);
  const row2 = useMarqueeRow(photos?.length ?? 0);

  if (!photos || photos.length === 0) return null;

  // Split into two rows for the marquee effect
  const mid = Math.ceil(photos.length / 2);
  const rowOne = photos.slice(0, mid);
  const rowTwo = photos.length > 3 ? photos.slice(mid) : rowOne;
  const loopRowOne = [...rowOne, ...rowOne];
  const loopRowTwo = [...rowTwo, ...rowTwo];

  return (
    <section className="relative w-full overflow-hidden bg-black py-8 isolate">
      {/* Heading */}
      <div className="flex w-full items-center justify-center gap-[22px] px-5 pb-6 text-center">
        <div className="hidden h-px w-[70px] flex-none bg-gradient-to-r from-transparent to-[#ff4081] sm:block" />
        <div className="max-w-[850px]">
          <h2 className="m-0 text-[clamp(24px,4vw,40px)] font-extrabold leading-[1.35] tracking-[-0.4px] text-white">
            {settings?.title ? (
              settings.title
            ) : (
              <>
                Atlas-এর হাত ধরে{" "}
                <span className="bg-gradient-to-r from-[#ff5a91] via-[#ef55d7] to-[#6978ff] bg-clip-text text-transparent">
                  সাফল্যের পথে এগিয়ে চলেছে
                </span>
              </>
            )}
          </h2>
          {settings?.subtitle && (
            <p className="mt-2 text-sm leading-relaxed text-white/58">
              {settings.subtitle}
            </p>
          )}
        </div>
        <div className="hidden h-px w-[70px] flex-none bg-gradient-to-l from-transparent to-[#6877ff] sm:block" />
      </div>

      {/* Row 1 */}
      <div className="overflow-hidden" {...row1.containerHandlers}>
        <div
          ref={row1.trackRef}
          className={`flex gap-4 px-4 pb-4 w-max ${row1.dragging ? "cursor-grabbing" : "cursor-grab"}`}
          {...row1.trackHandlers}
        >
          {loopRowOne.map((photo, idx) => (
            <div
              key={`${photo.id}-${idx}`}
              className="relative h-[180px] w-[280px] flex-none overflow-hidden rounded-2xl border border-white/10 sm:h-[220px] sm:w-[340px]"
            >
              <img
                src={photo.image_url}
                alt={photo.caption || "Success"}
                className="h-full w-full select-none object-cover hover:scale-105 transition-transform duration-500"
                draggable={false}
              />
              {photo.caption && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
                  <p className="truncate text-xs font-semibold text-white">{photo.caption}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Row 2 */}
      {rowTwo.length > 0 && (
        <div className="overflow-hidden mt-4" {...row2.containerHandlers}>
          <div
            ref={row2.trackRef}
            className={`flex gap-4 px-4 w-max ${row2.dragging ? "cursor-grabbing" : "cursor-grab"}`}
            {...row2.trackHandlers}
          >
            {loopRowTwo.map((photo, idx) => (
              <div
                key={`${photo.id}-${idx}`}
                className="relative h-[180px] w-[280px] flex-none overflow-hidden rounded-2xl border border-white/10 sm:h-[220px] sm:w-[340px]"
              >
                <img
                  src={photo.image_url}
                  alt={photo.caption || "Success"}
                  className="h-full w-full select-none object-cover hover:scale-105 transition-transform duration-500"
                  draggable={false}
                />
                {photo.caption && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
                    <p className="truncate text-xs font-semibold text-white">{photo.caption}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default SuccessGallerySection;
