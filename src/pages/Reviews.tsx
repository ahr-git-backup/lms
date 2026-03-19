import React, { useEffect, useState } from "react";
import { Star, MessageSquare, MonitorPlay, FileText, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PublicHeader from "@/components/PublicHeader";
import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

const ReviewCard = ({ review }: { review: any }) => {
  const [expanded, setExpanded] = useState(false);
  const isLong = review.review_text?.length > 150;

  return (
    <Card className="hover:shadow-lg transition-all duration-300 border-primary/10 flex flex-col h-full bg-card/50 backdrop-blur-sm">
      <CardContent className="p-6 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-4 gap-4">
          <div className="flex gap-3 items-center min-w-0">
             {review.image_url ? (
                <img src={review.image_url} alt={review.student_name} className="h-10 w-10 md:h-12 md:w-12 rounded-full object-cover shrink-0" />
             ) : (
                <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-secondary/80 flex items-center justify-center text-sm md:text-base font-bold shrink-0 text-foreground/70">
                    {review.student_name?.charAt(0) || '?'}
                </div>
             )}
            <div className="truncate">
              <h4 className="font-bold text-sm md:text-base leading-tight truncate">{review.student_name}</h4>
              <p className="text-[10px] md:text-xs text-muted-foreground truncate">{review.college_name}</p>
            </div>
          </div>
          <div className="flex bg-yellow-500/10 px-2 py-1 rounded-full shrink-0">
            {[...Array(review.rating || 5)].map((_, i) => (
              <Star key={i} className="h-3 w-3 md:h-3.5 md:w-3.5 text-yellow-500 fill-yellow-500" />
            ))}
          </div>
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

        {/* Album Gallery */}
        {(review.images && review.images.length > 0) ? (
            <div className={`grid gap-2 mb-4 ${review.images.length === 1 ? 'grid-cols-1' : review.images.length === 2 ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3'}`}>
                {review.images.map((img: string, idx: number) => (
                    <img key={idx} src={img} alt={`Review graphic ${idx}`} className="w-full h-32 md:h-40 object-cover rounded-md border border-border/50 shadow-sm" loading="lazy" />
                ))}
            </div>
        ) : review.post_image_url ? (
             <img src={review.post_image_url} alt="Review graphic" className="w-full h-auto max-h-56 md:max-h-64 object-contain rounded-md border border-border/50 mb-4 bg-muted/20 shadow-sm" loading="lazy" />
        ) : null}

        <div className="text-[10px] md:text-xs text-muted-foreground/60 text-right mt-auto pt-2 border-t border-border/30">
            {review.created_at ? formatDistanceToNow(new Date(review.created_at), { addSuffix: true }) : ''}
        </div>
      </CardContent>
    </Card>
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
    }
  });

  const classReviews = reviews?.filter(r => r.category === 'classes' || !r.category) || [];
  const websiteReviews = reviews?.filter(r => r.category === 'website') || [];
  const examReviews = reviews?.filter(r => r.category === 'exams') || [];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Helmet>
        <title>Student Reviews | Atlas</title>
        <meta name="description" content="Read what our students have to say about our classes, exams, and platform." />
      </Helmet>
      
      <PublicHeader />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-12 md:py-20 animate-in fade-in duration-700">
        <div className="text-center space-y-4 mb-12 md:mb-16">
          <div className="inline-flex items-center justify-center p-3 md:p-4 bg-yellow-500/10 rounded-full mb-2 md:mb-4">
            <Star className="h-6 w-6 md:h-8 md:w-8 text-yellow-500 fill-yellow-500" />
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">Student Success Stories</h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto px-4">
            Discover why thousands of students trust Atlas for their academic success.
            Read authentic reviews across different categories.
          </p>
        </div>

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
            <div className="flex justify-center mb-8 md:mb-10">
                <TabsList className="bg-muted/50 p-1 md:p-1.5 rounded-xl w-full sm:w-auto flex-wrap h-auto justify-center border shadow-sm gap-1 md:gap-2">
                <TabsTrigger value="classes" className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg px-4 md:px-6 py-2 md:py-2.5 text-xs md:text-sm">
                    <MonitorPlay className="h-3 w-3 md:h-4 md:w-4 mr-1.5 md:mr-2" /> Classes
                </TabsTrigger>
                <TabsTrigger value="website" className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg px-4 md:px-6 py-2 md:py-2.5 text-xs md:text-sm">
                    <MessageSquare className="h-3 w-3 md:h-4 md:w-4 mr-1.5 md:mr-2" /> Platform
                </TabsTrigger>
                <TabsTrigger value="exams" className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg px-4 md:px-6 py-2 md:py-2.5 text-xs md:text-sm">
                    <FileText className="h-3 w-3 md:h-4 md:w-4 mr-1.5 md:mr-2" /> Exams
                </TabsTrigger>
                </TabsList>
            </div>

            <TabsContent value="classes" className="mt-0 outline-none">
                {classReviews.length === 0 ? (
                    <div className="text-center py-10 opacity-60">No class reviews found.</div>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 auto-rows-max gap-4 md:gap-6 items-start">
                    {classReviews.map((review) => (
                        <ReviewCard key={`class-${review.id}`} review={review} />
                    ))}
                    </div>
                )}
            </TabsContent>

            <TabsContent value="website" className="mt-0 outline-none">
                {websiteReviews.length === 0 ? (
                    <div className="text-center py-10 opacity-60">No platform reviews found.</div>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 auto-rows-max gap-4 md:gap-6 items-start">
                    {websiteReviews.map((review) => (
                        <ReviewCard key={`web-${review.id}`} review={review} />
                    ))}
                    </div>
                )}
            </TabsContent>

            <TabsContent value="exams" className="mt-0 outline-none">
                {examReviews.length === 0 ? (
                    <div className="text-center py-10 opacity-60">No exam reviews found.</div>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 auto-rows-max gap-4 md:gap-6 items-start">
                    {examReviews.map((review) => (
                        <ReviewCard key={`exam-${review.id}`} review={review} />
                    ))}
                    </div>
                )}
            </TabsContent>
            </Tabs>
        )}
      </main>
    </div>
  );
}
