import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css"; // Import KaTeX styles

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import PublicHeader from "@/components/PublicHeader";
import { supabase } from "@/integrations/supabase/client";

const CourseDetails = () => {
  const { courseId } = useParams<{ courseId: string }>();

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
        .select("id, name, full_description, short_description, price, image_url, what_you_get, slug")
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

  const benefits = Array.isArray(course?.what_you_get) && course.what_you_get.length > 0
    ? course.what_you_get
    : [
        "Live & recorded classes",
        "Weekly or topic-wise exams",
        "Detailed solution sheets",
        "Class notes & resources",
      ];

  // Combine all items into one string (newline separated) to handle both legacy arrays and new single-string markdown blocks
  const markdownContent = benefits.join("\n");

  const description = course?.full_description || course?.short_description ||
    "Deep-dive course with structured classes, exams, and resources to prepare you confidently.";

  const idOrSlug = course?.slug || course?.id || courseId;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 pb-16 pt-10 sm:pt-14">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">Course details</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {isLoading ? "Loading course..." : course?.name ?? "Course not found"}
          </h1>
          {!isLoading && !isError && course && (
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{description}</p>
          )}
          {isError && (
            <p className="mt-3 max-w-2xl text-sm text-destructive">Failed to load course. Please try again.</p>
          )}
        </div>

        {course?.image_url && (
          <Card className="border-[3px] border-foreground">
            <AspectRatio ratio={16 / 9}>
              <img
                src={course.image_url}
                alt={`${course.name} cover`}
                className="h-full w-full rounded-[22px] object-cover"
              />
            </AspectRatio>
          </Card>
        )}

        <Card className="border-[3px] border-foreground">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">What you get</CardTitle>
            <CardDescription className="text-xs">
              Clear list of everything included with this course.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="prose prose-sm dark:prose-invert max-w-none text-foreground prose-table:border prose-th:border prose-td:border prose-th:p-2 prose-td:p-2 prose-img:rounded-xl">
               <ReactMarkdown
                 remarkPlugins={[remarkGfm, remarkMath]}
                 rehypePlugins={[rehypeKatex]}
               >
                 {markdownContent}
               </ReactMarkdown>
            </div>

            <div className="flex flex-col items-start justify-between gap-4 border-t pt-4 text-sm sm:flex-row sm:items-center mt-4">
              <div>
                <span className="text-xs uppercase text-muted-foreground">Course fee</span>
                <div className="text-lg font-semibold">
                  {course?.price != null
                    ? `৳${Number(course.price).toLocaleString("en-BD")}`
                    : "Contact for fee"}
                </div>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Button asChild className="flex-1 sm:flex-none" disabled={!course && !isLoading}>
                  <a href={idOrSlug ? `/courses/${idOrSlug}/buy` : "#"}>Buy Instructions</a>
                </Button>
                <Button asChild variant="outline" className="flex-1 sm:flex-none">
                  <a href="/login">Student Login</a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default CourseDetails;
