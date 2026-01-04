import { useEffect, useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import PublicHeader from "@/components/PublicHeader";
import { supabase } from "@/integrations/supabase/client";
import { DemoContentItem } from "@/types/admin";
import { FileText, PlayCircle, Lock } from "lucide-react";

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
        .select("id, name, full_description, short_description, price, image_url, what_you_get, demo_content, slug")
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

  const markdownContent = benefits.join("\n");
  const description = course?.full_description || course?.short_description ||
    "Deep-dive course with structured classes, exams, and resources to prepare you confidently.";

  const idOrSlug = course?.slug || course?.id || courseId;

  // Safe parsing of demo_content
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const demoContent: DemoContentItem[] = (course?.demo_content as any) || [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <main className="mx-auto flex max-w-4xl flex-col gap-8 px-4 pb-16 pt-10 sm:pt-14">

        {/* Hero Section */}
        <section className="grid gap-8 md:grid-cols-2 items-center">
            <div className="order-2 md:order-1 space-y-4">
                <Badge variant="secondary" className="mb-2">Course Details</Badge>
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                    {isLoading ? "Loading..." : course?.name ?? "Course not found"}
                </h1>
                {!isLoading && !isError && course && (
                    <p className="text-muted-foreground text-lg">{course.short_description || "Start your journey today."}</p>
                )}
                {isError && (
                    <p className="text-destructive">Failed to load course.</p>
                )}

                <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center">
                     <div className="text-2xl font-bold">
                        {course?.price != null
                            ? `৳${Number(course.price).toLocaleString("en-BD")}`
                            : <span className="text-lg font-normal text-muted-foreground">Free / Contact</span>}
                     </div>
                     <div className="flex gap-2 w-full sm:w-auto">
                        <Button asChild size="lg" className="flex-1 sm:flex-none" disabled={!course && !isLoading}>
                            <a href={idOrSlug ? `/courses/${idOrSlug}/buy` : "#"}>Enroll Now</a>
                        </Button>
                     </div>
                </div>
            </div>

            <div className="order-1 md:order-2">
                 {course?.image_url ? (
                    <div className="rounded-xl overflow-hidden border bg-muted shadow-sm">
                        <AspectRatio ratio={16 / 9}>
                        <img
                            src={course.image_url}
                            alt={`${course.name} cover`}
                            className="h-full w-full object-cover"
                        />
                        </AspectRatio>
                    </div>
                ) : (
                    <div className="rounded-xl border bg-muted h-64 flex items-center justify-center text-muted-foreground">
                        No Image Available
                    </div>
                )}
            </div>
        </section>

        {/* Content Tabs */}
        <Tabs defaultValue="overview" className="w-full">
            <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent gap-6">
                <TabsTrigger
                    value="overview"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none px-4 py-2"
                >
                    Overview
                </TabsTrigger>
                <TabsTrigger
                    value="preview"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none px-4 py-2"
                >
                    Preview Content
                </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="pt-6">
                <Card className="border-none shadow-none">
                    <CardHeader className="p-0 pb-4">
                        <CardTitle>About this course</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 space-y-6">
                         <div className="prose prose-stone dark:prose-invert max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                                {course?.full_description || ""}
                            </ReactMarkdown>
                         </div>

                         <div className="border rounded-xl p-6 bg-secondary/10">
                            <h3 className="font-semibold text-lg mb-4">What you will get</h3>
                             <div className="prose prose-sm dark:prose-invert max-w-none">
                                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                                    {markdownContent}
                                </ReactMarkdown>
                            </div>
                         </div>
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="preview" className="pt-6">
                 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {demoContent.length === 0 ? (
                        <div className="col-span-full py-12 text-center text-muted-foreground border rounded-xl border-dashed">
                            No preview content available for this course yet.
                        </div>
                    ) : (
                        demoContent.map((item, idx) => (
                            <Card key={idx} className="overflow-hidden hover:shadow-md transition-shadow">
                                <CardHeader className="p-4 pb-2">
                                    <div className="flex justify-between items-start">
                                        <Badge variant="outline" className="capitalize">{item.type}</Badge>
                                        {item.is_locked && <Lock className="w-4 h-4 text-muted-foreground" />}
                                    </div>
                                    <CardTitle className="text-base line-clamp-2 mt-2" title={item.title}>
                                        {item.title}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 pt-2">
                                    {item.type === 'video' ? (
                                        <div className="aspect-video bg-black rounded-md overflow-hidden relative group cursor-pointer mb-3">
                                            {/* We can use an iframe here if it's embeddable, or a thumbnail with play button */}
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                                                <PlayCircle className="w-10 h-10 text-white opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                                            </div>
                                             {/* If it's a youtube link, we could try to embed it, for now just a link wrapper */}
                                             <a href={item.url} target="_blank" rel="noopener noreferrer" className="absolute inset-0 z-10">
                                                <span className="sr-only">Watch Video</span>
                                             </a>
                                        </div>
                                    ) : (
                                        <div className="h-32 bg-muted rounded-md flex items-center justify-center mb-3">
                                            <FileText className="w-10 h-10 text-muted-foreground" />
                                        </div>
                                    )}

                                    <Button asChild variant="secondary" className="w-full">
                                        <a href={item.url} target="_blank" rel="noopener noreferrer">
                                            {item.type === 'video' ? 'Watch Now' : 'View Document'}
                                        </a>
                                    </Button>
                                </CardContent>
                            </Card>
                        ))
                    )}
                 </div>
            </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default CourseDetails;
