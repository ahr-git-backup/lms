import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

/** Fullscreen image viewer with keyboard nav (Escape/Arrow keys) and
 *  click-to-close backdrop. Matches the Reviews page lightbox. */
const Lightbox = ({
  images,
  index,
  onClose,
  onNav,
}: {
  images: string[];
  index: number;
  onClose: () => void;
  onNav: (i: number) => void;
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onNav((index + 1) % images.length);
      if (e.key === "ArrowLeft") onNav((index - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, images.length, onClose, onNav]);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center animate-in fade-in duration-200"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
      >
        <X className="h-6 w-6" />
      </button>
      {images.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNav((index - 1 + images.length) % images.length); }}
          className="absolute left-2 md:left-6 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
        >
          <ChevronLeft className="h-7 w-7" />
        </button>
      )}
      <img
        src={images[index]}
        alt="Success"
        className="max-h-[85vh] max-w-[92vw] object-contain rounded-lg animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      />
      {images.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNav((index + 1) % images.length); }}
          className="absolute right-2 md:right-6 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
        >
          <ChevronRight className="h-7 w-7" />
        </button>
      )}
    </div>
  );
};

/** Auto-scrolling animated image marquee row (same mechanism as the
 *  Reviews page marquee): continuously slides left via requestAnimationFrame,
 *  loops seamlessly by duplicating items, pauses on hover/drag, and
 *  supports click-and-drag / touch-swipe scrolling while paused. */
const useMarqueeRow = (itemCount: number, direction: "left" | "right" = "left", lightboxOpen: boolean = false) => {
  const [paused, setPaused] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const posRef = useRef(0);
  const initializedRef = useRef(false);
  const draggingRef = useRef(false);
  const startX = useRef(0);
  const startPos = useRef(0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (itemCount === 0) return;
    let raf: number;
    const step = () => {
      const track = trackRef.current;
      if (track) {
        const halfWidth = track.scrollWidth / 2;
        if (!initializedRef.current && halfWidth > 0) {
          // Start a right-moving row already scrolled to the left half,
          // so it has room to travel rightward before looping.
          posRef.current = direction === "right" ? -halfWidth : 0;
          initializedRef.current = true;
        }
        if (!paused && !draggingRef.current && !lightboxOpen) {
          if (direction === "left") {
            posRef.current -= 0.5;
            if (Math.abs(posRef.current) >= halfWidth) posRef.current = 0;
          } else {
            posRef.current += 0.5;
            if (posRef.current >= 0) posRef.current = -halfWidth;
          }
          track.style.transform = `translateX(${posRef.current}px)`;
        }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [paused, itemCount, direction, lightboxOpen]);

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
  const [lightbox, setLightbox] = useState<number | null>(null);

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

  const lightboxOpen = lightbox !== null;
  const row1 = useMarqueeRow(photos?.length ?? 0, "left", lightboxOpen);
  const row2 = useMarqueeRow(photos?.length ?? 0, "right", lightboxOpen);

  if (!photos || photos.length === 0) return null;

  // Split into two rows for the marquee effect
  const indexed = photos.map((photo, globalIndex) => ({ ...photo, globalIndex }));
  const mid = Math.ceil(indexed.length / 2);
  const rowOne = indexed.slice(0, mid);
  const rowTwo = indexed.length > 3 ? indexed.slice(mid) : rowOne;
  const loopRowOne = [...rowOne, ...rowOne];
  const loopRowTwo = [...rowTwo, ...rowTwo];
  const allImages = indexed.map((p) => p.image_url);

  const closeLightbox = () => setLightbox(null);

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
            <button
              key={`${photo.id}-${idx}`}
              onClick={() => setLightbox(photo.globalIndex)}
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
            </button>
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
              <button
                key={`${photo.id}-${idx}`}
                onClick={() => setLightbox(photo.globalIndex)}
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
              </button>
            ))}
          </div>
        </div>
      )}

      {lightbox !== null && (
        <Lightbox images={allImages} index={lightbox} onClose={closeLightbox} onNav={setLightbox} />
      )}
    </section>
  );
};

export default SuccessGallerySection;
