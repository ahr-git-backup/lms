import React, { useEffect, useRef, useState } from "react";
import { Star, Loader2, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PublicHeader from "@/components/PublicHeader";
import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

/** Same click-and-drag / touch-swipe scrolling used by the homepage
 *  Success Gallery marquee rows. */
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

const ReviewCard = ({ review }: { review: any }) => {
  const [expanded, setExpanded] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const isLong = review.review_text?.length > 150;
  const images: string[] = reviewImages(review);

  return (
    <div className="group rounded-xl border border-primary/10 bg-card/50 backdrop-blur-sm p-6 flex flex-col h-full transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/30">
      <div className="flex justify-between items-start mb-4 gap-4">
        <div className="flex gap-3 items-center min-w-0">
          {review.image_url ? (
            <img src={review.image_url} alt={review.student_name || "Student"} className="h-10 w-10 md:h-12 md:w-12 rounded-full object-cover shrink-0" />
          ) : (
            <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-secondary/80 flex items-center justify-center text-sm md:text-base font-bold shrink-0 text-foreground/70">
              {review.student_name?.charAt(0) || "?"}
            </div>
          )}
          <div className="truncate">
            {review.student_name && (
              <h4 className="font-bold text-sm md:text-base leading-tight truncate">{review.student_name}</h4>
            )}
            {review.college_name && (
              <p className="text-[10px] md:text-xs text-muted-foreground truncate">{review.college_name}</p>
            )}
          </div>
        </div>
        {!!review.rating && (
          <div className="flex bg-yellow-500/10 px-2 py-1 rounded-full shrink-0">
            {[...Array(review.rating)].map((_, i) => (
              <Star key={i} className="h-3 w-3 md:h-3.5 md:w-3.5 text-yellow-500 fill-yellow-500" />
            ))}
          </div>
        )}
      </div>

      <div className="mb-4 flex-1">
        <p className={`text-sm leading-relaxed text-foreground/80 italic ${!expanded && isLong ? "line-clamp-3" : ""}`}>
          "{review.review_text}"
        </p>
        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-primary font-medium mt-1 hover:underline focus:outline-none"
          >
            {expanded ? "Show less" : "Read more"}
          </button>
        )}
      </div>

      {images.length > 0 && (
        <div className={`grid gap-2 mb-2 ${images.length === 1 ? "grid-cols-1" : images.length === 2 ? "grid-cols-2" : "grid-cols-2 md:grid-cols-3"}`}>
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={() => setLightbox(idx)}
              className="overflow-hidden rounded-md border border-border/50 shadow-sm transition-transform duration-300 hover:scale-[1.03] active:scale-95"
            >
              <img src={img} alt={`Review graphic ${idx}`} className="w-full h-32 md:h-40 object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      <div className="text-[10px] md:text-xs text-muted-foreground/60 text-right mt-auto pt-2 border-t border-border/30">
        {review.created_at ? formatDistanceToNow(new Date(review.created_at), { addSuffix: true }) : ""}
      </div>

      {lightbox !== null && (
        <Lightbox images={images} index={lightbox} onClose={() => setLightbox(null)} onNav={setLightbox} />
      )}
    </div>
  );
};

const CATEGORIES = [
  { value: "classes", label: "ক্লাস" },
  { value: "exams", label: "এক্সাম" },
  { value: "chance", label: "চান্সপ্রাপ্ত" },
  { value: "mentoring", label: "মেন্টরিং" },
  { value: "website", label: "অন্যান্য" },
];

/** Success-Gallery-style animated, drag-scrollable image row built from
 *  this category's review images. Clicking an image opens the lightbox. */
const ReviewImageMarquee = ({ reviews }: { reviews: any[] }) => {
  const [lightbox, setLightbox] = useState<number | null>(null);
  const drag = useDragScroll();

  const items = reviews.flatMap((review) =>
    reviewImages(review).map((img) => ({ img, caption: review.student_name || "" }))
  );

  if (items.length === 0) return null;
  const allImages = items.map((i) => i.img);

  return (
    <div className="relative w-full overflow-hidden bg-black rounded-2xl py-6 mb-6">
      <div
        ref={drag.ref}
        className={`flex gap-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
          drag.dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        {...drag.handlers}
      >
        {items.map((item, idx) => (
          <button
            key={idx}
            onClick={() => setLightbox(idx)}
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

      {lightbox !== null && (
        <Lightbox images={allImages} index={lightbox} onClose={() => setLightbox(null)} onNav={setLightbox} />
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
                  <>
                    <ReviewImageMarquee reviews={grouped[c.value]} />
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 auto-rows-max gap-4 md:gap-6 items-start">
                      {grouped[c.value].map((review) => (
                        <ReviewCard key={`${c.value}-${review.id}`} review={review} />
                      ))}
                    </div>
                  </>
                )}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </main>
    </div>
  );
}
