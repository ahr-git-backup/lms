import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Badge } from "@/components/ui/badge";
import PublicHeader from "@/components/PublicHeader";
import { supabase } from "@/integrations/supabase/client";
import { DemoContentItem } from "@/types/admin";
import { PlayCircle, FileText, Lock } from "lucide-react";

const CourseDetails = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  const {
    data: course,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["public-course", courseId],
    queryFn: async () => {
      if (!courseId) return null;

      const { data, error } = await supabase
        .from("courses")
        .select("id, name, full_description, short_description, price, original_price, image_url, what_you_get, demo_content, slug")
        .or(`slug.eq.${courseId},id.eq.${courseId}`)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!courseId,
  });

  useEffect(() => {
    if (course?.name) {
      document.title = `${course.name} – Beshi Joss LMS`;
    } else {
      document.title = "Course – Beshi Joss LMS";
    }
  }, [course?.name]);

  const idOrSlug = course?.slug || course?.id || courseId;

  // Safe parsing of demo_content
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const demoContent: DemoContentItem[] = (course?.demo_content as any) || [];

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 md:pb-16">
      <PublicHeader />

      <main className="mx-auto max-w-4xl px-4 py-8 space-y-8">

          {/* 1. Course Image */}
          <div className="w-full max-w-2xl mx-auto rounded-xl overflow-hidden border bg-muted shadow-sm">
             <AspectRatio ratio={16 / 9}>
                  {course?.image_url ? (
                      <img
                          src={course.image_url}
                          alt={`${course.name} cover`}
                          className="h-full w-full object-cover"
                      />
                  ) : (
                      <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                          No Image Available
                      </div>
                  )}
             </AspectRatio>
          </div>

          {/* 2. Course Name */}
          <div className="text-center space-y-2">
               <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                   {isLoading ? "Loading..." : course?.name ?? "Course not found"}
               </h1>
               {!isLoading && !isError && course?.short_description && (
                   <p className="text-muted-foreground max-w-2xl mx-auto">{course.short_description}</p>
               )}
          </div>

          {/* 3. Description (Full Page) */}
          <div className="border-t pt-8">
              <h2 className="text-xl font-semibold mb-4">Course Description</h2>
              <div className="prose prose-stone dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {course?.full_description || "No description available."}
                  </ReactMarkdown>
              </div>
          </div>

          {/* 4. What You Get (Markdown Supported) */}
          {course?.what_you_get && Array.isArray(course.what_you_get) && course.what_you_get.length > 0 && (
              <div className="border-t pt-8">
                  <h2 className="text-xl font-semibold mb-4">What you will get</h2>
                  <div className="prose prose-stone dark:prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                          {course.what_you_get.join("\n")}
                      </ReactMarkdown>
                  </div>
              </div>
          )}

          {/* 5. Demo Classes (Minimized List) */}
          {demoContent.length > 0 && (
              <div className="border-t pt-8">
                  <h2 className="text-xl font-semibold mb-4">Demo Classes</h2>
                  <div className="space-y-2 max-w-2xl">
                      {demoContent.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-3 p-3 rounded-md border hover:bg-muted/50 transition-colors group"
                          >
                               <div className="bg-primary/10 p-2 rounded-full text-primary">
                                   <PlayCircle className="w-5 h-5" />
                               </div>
                               <div className="flex-1">
                                   <p className="font-medium text-sm">{item.title}</p>
                                   <div className="flex gap-2 text-xs text-muted-foreground">
                                       {item.video_url && <span className="flex items-center gap-1"><PlayCircle className="w-3 h-3" /> Video</span>}
                                       {item.note_url && <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> Note</span>}
                                   </div>
                               </div>
                               <div className="flex gap-2">
                                   {item.video_url && (
                                       <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => navigate(`/courses/${idOrSlug}/demo/${idx}?type=video`)}>
                                           Watch
                                       </Button>
                                   )}
                                   {item.note_url && (
                                       <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => navigate(`/courses/${idOrSlug}/demo/${idx}?type=note`)}>
                                           Note
                                       </Button>
                                   )}
                                   {item.is_locked && <Lock className="w-4 h-4 text-muted-foreground ml-2" />}
                               </div>
                          </div>
                      ))}
                  </div>
              </div>
          )}
      </main>

      {/* Sticky Bottom Bar for Mobile (Optional, currently keeping generic flow but can add if requested or needed) */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-lg border-t z-50 md:hidden flex items-center justify-between gap-4 shadow-[0_-5px_10px_rgba(0,0,0,0.05)]">
          <div className="flex flex-col">
              {course?.original_price && (
                  <span className="text-[10px] text-muted-foreground line-through">
                      ৳{Number(course.original_price).toLocaleString("en-BD")}
                  </span>
              )}
              <span className="text-xl font-bold text-primary">
                  {course?.price != null ? `৳${Number(course.price).toLocaleString("en-BD")}` : "Free"}
              </span>
          </div>
          <Button asChild size="lg" className="flex-1 shadow-md" disabled={!course && !isLoading}>
              <a href={idOrSlug ? `/courses/${idOrSlug}/buy` : "#"}>Enroll Now</a>
          </Button>
      </div>
    </div>
  );
};

export default CourseDetails;
