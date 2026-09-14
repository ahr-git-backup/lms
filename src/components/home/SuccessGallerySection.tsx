import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRef, useState } from "react";

/** Enables click-and-drag / touch-swipe scrolling on a marquee row while
 *  the CSS auto-scroll animation is paused during interaction. */
const useDragScroll = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startScroll = useRef(0);

  const onDown = (clientX: number) => {
    if (!ref.current) return;
    setDragging(true);
    startX.current = clientX;
    startScroll.current = ref.current.scrollLeft;
  };
  const onMove = (clientX: number) => {
    if (!dragging || !ref.current) return;
    ref.current.scrollLeft = startScroll.current - (clientX - startX.current);
  };
  const onUp = () => setDragging(false);

  return {
    ref,
    dragging,
    handlers: {
      onMouseDown: (e: React.MouseEvent) => onDown(e.clientX),
      onMouseMove: (e: React.MouseEvent) => onMove(e.clientX),
      onMouseUp: onUp,
      onMouseLeave: onUp,
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

  const row1 = useDragScroll();
  const row2 = useDragScroll();

  if (!photos || photos.length === 0) return null;

  // Split into two rows for the marquee effect
  const mid = Math.ceil(photos.length / 2);
  const rowOne = photos.slice(0, mid);
  const rowTwo = photos.length > 3 ? photos.slice(mid) : rowOne;

  return (
    <section className="relative w-full overflow-hidden bg-black py-[52px] pb-[60px] isolate">
      {/* Heading */}
      <div className="flex w-full items-center justify-center gap-[22px] px-5 pb-9 text-center">
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
      <div
        ref={row1.ref}
        className={`flex gap-4 overflow-x-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
          row1.dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        {...row1.handlers}
      >
        {rowOne.map((photo) => (
          <div
            key={photo.id}
            className="relative h-[180px] w-[280px] flex-none overflow-hidden rounded-2xl border border-white/10 sm:h-[220px] sm:w-[340px]"
          >
            <img
              src={photo.image_url}
              alt={photo.caption || "Success"}
              className="h-full w-full select-none object-cover"
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

      {/* Row 2 */}
      {rowTwo.length > 0 && (
        <div
          ref={row2.ref}
          className={`mt-4 flex gap-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
            row2.dragging ? "cursor-grabbing" : "cursor-grab"
          }`}
          {...row2.handlers}
        >
          {rowTwo.map((photo) => (
            <div
              key={photo.id}
              className="relative h-[180px] w-[280px] flex-none overflow-hidden rounded-2xl border border-white/10 sm:h-[220px] sm:w-[340px]"
            >
              <img
                src={photo.image_url}
                alt={photo.caption || "Success"}
                className="h-full w-full select-none object-cover"
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
      )}
    </section>
  );
};

export default SuccessGallerySection;
