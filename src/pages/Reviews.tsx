import React, { useEffect, useRef, useState } from "react";
import { Loader2, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PublicHeader from "@/components/PublicHeader";
import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
        alt="Review"
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

const reviewImages = (review: any): string[] =>
  review.images && review.images.length > 0
    ? review.images
    : review.post_image_url
      ? [review.post_image_url]
      : [];

const CATEGORIES = [
  { value: "classes", label: "ক্লাস" },
  { value: "exams", label: "এক্সাম" },
  { value: "chance", label: "চান্সপ্রাপ্ত" },
  { value: "mentoring", label: "মেন্টরিং" },
  { value: "website", label: "অন্যান্য" },
];

/** A single auto-scrolling row: continuously slides via requestAnimationFrame,
 *  loops seamlessly by duplicating items, pauses on hover/drag/lightbox-open,
 *  and supports click-and-drag / touch-swipe scrolling. */
const MarqueeRow = ({
  items,
  direction,
  onOpenLightbox,
  lightboxOpen,
}: {
  items: { img: string; caption: string; globalIndex: number }[];
  direction: "left" | "right";
  onOpenLightbox: (globalIndex: number) => void;
  lightboxOpen: boolean;
}) => {
  const [paused, setPaused] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const posRef = useRef(0);
  const initializedRef = useRef(false);
  const draggingRef = useRef(false);
  const startX = useRef(0);
  const startPos = useRef(0);

  const loopItems = items.length > 0 ? [...items, ...items] : [];

  useEffect(() => {
    if (items.length === 0) return;
    let raf: number;
    const step = () => {
      const track = trackRef.current;
      if (track) {
        const halfWidth = track.scrollWidth / 2;
        if (!initializedRef.current && halfWidth > 0) {
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
  }, [paused, items.length, lightboxOpen, direction]);

  if (items.length === 0) return null;

  const onDown = (clientX: number) => {
    draggingRef.current = true;
    startX.current = clientX;
    startPos.current = posRef.current;
  };
  const onMove = (clientX: number) => {
    if (!draggingRef.current || !trackRef.current) return;
    posRef.current = startPos.current + (clientX - startX.current);
    trackRef.current.style.transform = `translateX(${posRef.current}px)`;
  };
  const onUp = () => { draggingRef.current = false; };

  return (
    <div
      className="relative w-full overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => { setPaused(false); onUp(); }}
    >
      <div
        ref={trackRef}
        className="flex gap-4 px-4 w-max cursor-grab active:cursor-grabbing"
        onMouseDown={(e) => onDown(e.clientX)}
        onMouseMove={(e) => onMove(e.clientX)}
        onMouseUp={onUp}
        onTouchStart={(e) => onDown(e.touches[0].clientX)}
        onTouchMove={(e) => onMove(e.touches[0].clientX)}
        onTouchEnd={onUp}
      >
        {loopItems.map((item, idx) => (
          <button
            key={idx}
            onClick={() => onOpenLightbox(item.globalIndex)}
            className="relative h-[180px] w-[280px] flex-none overflow-hidden rounded-2xl border border-white/10 sm:h-[220px] sm:w-[340px] transition-transform duration-300 hover:scale-[1.02] active:scale-95"
          >
            <img
              src={item.img}
              alt={item.caption || "Review"}
              className="h-full w-full select-none object-cover"
              draggable={false}
            />
            {item.caption && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
                <p className="truncate text-xs font-semibold text-white text-left">{item.caption}</p>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

/** Auto-scrolling animated image marquee (Success Gallery style), built
 *  from this category's review images, split into two rows scrolling in
 *  opposite directions. Pauses on hover/drag; clicking an image opens
 *  the lightbox. */
const ReviewImageMarquee = ({ reviews }: { reviews: any[] }) => {
  const [lightbox, setLightbox] = useState<number | null>(null);

  const items = reviews.flatMap((review) =>
    reviewImages(review).map((img) => ({ img, caption: review.student_name || "" }))
  );
  const allImages = items.map((i) => i.img);

  if (items.length === 0) return null;

  const indexed = items.map((item, globalIndex) => ({ ...item, globalIndex }));
  // Row 2 only appears when there are at least 3 images total; otherwise
  // it stays hidden instead of duplicating Row 1's content.
  const showRowTwo = indexed.length >= 3;
  const mid = showRowTwo ? Math.ceil(indexed.length / 2) : indexed.length;
  const rowOne = indexed.slice(0, mid);
  const rowTwo = showRowTwo ? indexed.slice(mid) : [];

  const closeLightbox = () => setLightbox(null);

  return (
    <div className="relative w-full overflow-hidden bg-black rounded-2xl py-5 mb-6 space-y-3">
      <MarqueeRow
        items={rowOne}
        direction="left"
        onOpenLightbox={setLightbox}
        lightboxOpen={lightbox !== null}
      />
      {rowTwo.length > 0 && (
        <>
          <div className="mx-4 h-px bg-white/10" />
          <MarqueeRow
            items={rowTwo}
            direction="right"
            onOpenLightbox={setLightbox}
            lightboxOpen={lightbox !== null}
          />
        </>
      )}

      {lightbox !== null && (
        <Lightbox images={allImages} index={lightbox} onClose={closeLightbox} onNav={setLightbox} />
      )}
    </div>
  );
};

export default function Reviews() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const { data: reviews, isLoading } = useQuery({
    queryKey: ["public-reviews"],
    queryFn: async () => {
      // @ts-ignore
      const { data, error } = await supabase.from("reviews").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const grouped = CATEGORIES.reduce<Record<string, any[]>>((acc, c) => {
    acc[c.value] = reviews?.filter((r) => r.category === c.value || (c.value === "classes" && !r.category)) || [];
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Helmet>
        <title>Student Reviews | Atlas</title>
        <meta name="description" content="Read what our students have to say about our classes, exams, and platform." />
      </Helmet>

      <PublicHeader />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-4 md:py-8 animate-in fade-in duration-500">
        <h1 className="text-lg md:text-2xl font-bold tracking-tight text-center mb-4">Student Review History</h1>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
            <p>Loading student stories...</p>
          </div>
        ) : (!reviews || reviews.length === 0) ? (
          <div className="text-center py-20 text-muted-foreground bg-secondary/20 rounded-xl border border-border/50">
            No reviews available at the moment.
          </div>
        ) : (
          <Tabs defaultValue="classes" className="w-full">
            <div className="flex justify-center mb-6">
              <TabsList className="bg-muted/50 p-1 md:p-1.5 rounded-xl w-full sm:w-auto flex-wrap h-auto justify-center border shadow-sm gap-1 md:gap-2">
                {CATEGORIES.map((c) => (
                  <TabsTrigger
                    key={c.value}
                    value={c.value}
                    className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg px-3 md:px-5 py-2 text-xs md:text-sm"
                  >
                    {c.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {CATEGORIES.map((c) => (
              <TabsContent key={c.value} value={c.value} className="mt-0 outline-none">
                {grouped[c.value].length === 0 ? (
                  <div className="text-center py-10 opacity-60">এই বিভাগে এখনো কোনো রিভিউ নেই।</div>
                ) : (
                  <ReviewImageMarquee reviews={grouped[c.value]} />
                )}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </main>
    </div>
  );
}
