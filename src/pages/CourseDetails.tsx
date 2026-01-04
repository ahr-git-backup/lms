import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import PublicHeader from "@/components/PublicHeader";
import { supabase } from "@/integrations/supabase/client";
import { DemoContentItem } from "@/types/admin";
import { FileText, PlayCircle, Lock, BookOpen, Clock, Video, Calendar } from "lucide-react";

const CourseDetails = () => {
  const { courseId } = useParams<{ courseId: string }>();

  const {
    data: course,
    isLoading: isCourseLoading,
    isError: isCourseError,
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

  // Fetch syllabus/classes
  const { data: classes, isLoading: isClassesLoading } = useQuery({
    queryKey: ["public-course-classes", course?.id],
    queryFn: async () => {
        if (!course?.id) return [];
        const { data, error } = await supabase
            .from("classes")
            .select("id, title, class_type, start_at, topic, subject")
            .eq("course_id", course.id)
            .order("start_at", { ascending: true });

        if (error) throw error;
        return data;
    },
    enabled: !!course?.id
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
  const idOrSlug = course?.slug || course?.id || courseId;

  // Safe parsing of demo_content
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const demoContent: DemoContentItem[] = (course?.demo_content as any) || [];

  // Group classes by Topic or just generic "Live Classes" if no topic
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const groupedClasses = classes?.reduce((acc: any, cls) => {
      const groupName = cls.topic || "General Classes";
      if (!acc[groupName]) acc[groupName] = [];
      acc[groupName].push(cls);
      return acc;
  }, {});

  const isLoading = isCourseLoading || (!!course?.id && isClassesLoading);
  const isError = isCourseError;

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 md:pb-16">
      <PublicHeader />

      {/* Hero Section with Blur Background Effect */}
      <div className="relative w-full overflow-hidden bg-slate-900 text-white">
          <div className="absolute inset-0 bg-black/50 z-10" />
          <div
            className="absolute inset-0 bg-cover bg-center blur-xl opacity-50 scale-110"
            style={{ backgroundImage: `url(${course?.image_url || '/placeholder.png'})` }}
          />

          <div className="relative z-20 mx-auto max-w-5xl px-4 py-12 md:py-20 flex flex-col md:flex-row gap-8 md:items-center">
              <div className="flex-1 space-y-4">
                  <Badge className="bg-primary/90 hover:bg-primary text-white border-none mb-2">
                      Course Details
                  </Badge>
                  <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl text-white">
                        {isLoading ? "Loading..." : course?.name ?? "Course not found"}
                  </h1>
                   {!isLoading && !isError && course && (
                        <p className="text-slate-200 text-lg md:text-xl max-w-2xl leading-relaxed">
                            {course.short_description || "Start your journey today with our comprehensive learning path."}
                        </p>
                    )}

                    {/* Desktop Price & Enroll */}
                    <div className="hidden md:flex flex-col gap-4 pt-4">
                         <div className="text-3xl font-bold">
                            {course?.price != null
                                ? `৳${Number(course.price).toLocaleString("en-BD")}`
                                : <span className="text-2xl font-normal text-slate-300">Free / Contact</span>}
                         </div>
                         <div className="flex gap-3">
                            <Button asChild size="lg" className="w-fit text-lg h-12 px-8 shadow-lg shadow-primary/25" disabled={!course && !isLoading}>
                                <a href={idOrSlug ? `/courses/${idOrSlug}/buy` : "#"}>Enroll Now</a>
                            </Button>
                         </div>
                    </div>
              </div>

              {/* Hero Image / Video Placeholder */}
              <div className="flex-1 max-w-md mx-auto md:max-w-none md:w-1/3">
                  {course?.image_url ? (
                    <div className="rounded-2xl overflow-hidden border-4 border-white/10 shadow-2xl bg-black/50 aspect-video md:aspect-[4/3] lg:aspect-video relative group">
                        <img
                            src={course.image_url}
                            alt={`${course.name} cover`}
                            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                             {demoContent.find(d => d.type === 'video') && (
                                <div className="bg-white/20 backdrop-blur-md rounded-full p-4 cursor-pointer">
                                    <PlayCircle className="w-12 h-12 text-white" />
                                </div>
                             )}
                        </div>
                    </div>
                ) : (
                    <div className="rounded-2xl border-4 border-white/10 bg-white/5 h-64 flex items-center justify-center text-white/50 backdrop-blur-sm">
                        No Image Available
                    </div>
                )}
              </div>
          </div>
      </div>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <Tabs defaultValue="overview" className="w-full">
            <ScrollArea className="w-full whitespace-nowrap border-b">
                <TabsList className="w-full justify-start h-auto p-0 bg-transparent gap-8 mb-1">
                    <TabsTrigger
                        value="overview"
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none px-2 py-3 text-base font-medium"
                    >
                        Overview
                    </TabsTrigger>
                    <TabsTrigger
                        value="curriculum"
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none px-2 py-3 text-base font-medium"
                    >
                        Syllabus <Badge variant="secondary" className="ml-2 text-xs">{classes?.length || 0}</Badge>
                    </TabsTrigger>
                    <TabsTrigger
                        value="preview"
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none px-2 py-3 text-base font-medium"
                    >
                        Preview Content
                    </TabsTrigger>
                </TabsList>
            </ScrollArea>

            <TabsContent value="overview" className="pt-8 grid gap-8 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-8">
                    <section>
                         <h2 className="text-2xl font-bold mb-4">About This Course</h2>
                         <div className="prose prose-stone dark:prose-invert max-w-none text-muted-foreground leading-7">
                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                                {course?.full_description || "No description available."}
                            </ReactMarkdown>
                         </div>
                    </section>

                    <section className="bg-muted/30 p-6 rounded-xl border">
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                             <BookOpen className="w-5 h-5 text-primary" /> What You Will Learn
                        </h2>
                        <div className="prose prose-sm dark:prose-invert max-w-none grid md:grid-cols-2 gap-x-8 gap-y-2">
                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                                {markdownContent}
                            </ReactMarkdown>
                        </div>
                    </section>
                </div>

                <div className="lg:col-span-1 space-y-6">
                     <Card>
                         <CardHeader>
                             <CardTitle className="text-lg">Course Features</CardTitle>
                         </CardHeader>
                         <CardContent className="space-y-4">
                             <div className="flex items-center gap-3 text-sm">
                                 <Video className="w-4 h-4 text-muted-foreground" />
                                 <span>{classes?.filter(c => c.class_type === 'live').length || 0} Live Classes</span>
                             </div>
                             <div className="flex items-center gap-3 text-sm">
                                 <PlayCircle className="w-4 h-4 text-muted-foreground" />
                                 <span>{classes?.filter(c => c.class_type === 'recorded').length || 0} Recorded Lessons</span>
                             </div>
                             <div className="flex items-center gap-3 text-sm">
                                 <Clock className="w-4 h-4 text-muted-foreground" />
                                 <span>Full Lifetime Access</span>
                             </div>
                             <div className="flex items-center gap-3 text-sm">
                                 <Calendar className="w-4 h-4 text-muted-foreground" />
                                 <span>Access on Mobile and PC</span>
                             </div>
                         </CardContent>
                     </Card>
                </div>
            </TabsContent>

            <TabsContent value="curriculum" className="pt-8">
                 <div className="max-w-3xl">
                     <div className="flex items-center justify-between mb-6">
                         <h2 className="text-2xl font-bold">Course Syllabus</h2>
                         <span className="text-muted-foreground text-sm">{classes?.length || 0} Lessons</span>
                     </div>

                     {isClassesLoading ? (
                         <div className="text-center py-8 text-muted-foreground">Loading syllabus...</div>
                     ) : !classes || classes.length === 0 ? (
                         <div className="text-center py-12 border border-dashed rounded-xl bg-muted/20">
                             <p className="text-muted-foreground">No syllabus details available yet.</p>
                         </div>
                     ) : (
                        <Accordion type="multiple" defaultValue={Object.keys(groupedClasses || {})} className="w-full space-y-4">
                            {Object.entries(groupedClasses || {}).map(([topic, topicClasses]: [string, any], idx) => (
                                <AccordionItem key={idx} value={topic} className="border rounded-lg px-4 bg-card">
                                    <AccordionTrigger className="hover:no-underline py-4">
                                        <div className="flex flex-col items-start text-left">
                                            <span className="font-semibold text-lg">{topic}</span>
                                            <span className="text-xs text-muted-foreground font-normal mt-1">{topicClasses.length} Lessons</span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="pb-4 pt-2 space-y-2">
                                        {topicClasses.map((cls: any) => (
                                            <div key={cls.id} className="flex items-start justify-between p-3 rounded-md hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
                                                <div className="flex items-center gap-3">
                                                    {cls.class_type === 'live' ? (
                                                        <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-full">
                                                            <Video className="w-4 h-4 text-red-600 dark:text-red-400" />
                                                        </div>
                                                    ) : (
                                                        <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-full">
                                                            <PlayCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="font-medium text-sm">{cls.title}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {new Date(cls.start_at).toLocaleDateString()}
                                                        </p>
                                                    </div>
                                                </div>
                                                {/* If locked/preview logic existed, lock icon would go here */}
                                                <Lock className="w-4 h-4 text-muted-foreground/30" />
                                            </div>
                                        ))}
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                     )}
                 </div>
            </TabsContent>

            <TabsContent value="preview" className="pt-8">
                 <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {demoContent.length === 0 ? (
                        <div className="col-span-full py-12 text-center text-muted-foreground border rounded-xl border-dashed">
                            No preview content available for this course yet.
                        </div>
                    ) : (
                        demoContent.map((item, idx) => (
                            <Card key={idx} className="overflow-hidden hover:shadow-lg transition-all group border-muted">
                                <CardHeader className="p-0">
                                    <div className="aspect-video bg-muted relative flex items-center justify-center overflow-hidden">
                                        {item.type === 'video' ? (
                                            <>
                                                <div className="absolute inset-0 bg-black/10 group-hover:bg-black/30 transition-colors z-10" />
                                                <PlayCircle className="w-12 h-12 text-primary z-20 scale-95 group-hover:scale-110 transition-transform" />
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                                <FileText className="w-12 h-12" />
                                                <span className="text-xs uppercase font-semibold">Document</span>
                                            </div>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent className="p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <Badge variant="outline" className="capitalize text-[10px]">{item.type}</Badge>
                                    </div>
                                    <CardTitle className="text-base line-clamp-2 mb-4" title={item.title}>
                                        {item.title}
                                    </CardTitle>
                                    <Button asChild variant="default" className="w-full">
                                        <a href={item.url} target="_blank" rel="noopener noreferrer">
                                            {item.type === 'video' ? 'Watch Demo' : 'View PDF'}
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

      {/* Sticky Bottom Bar for Mobile */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-lg border-t z-50 md:hidden flex items-center justify-between gap-4 shadow-[0_-5px_10px_rgba(0,0,0,0.05)]">
          <div className="flex flex-col">
              <span className="text-xs text-muted-foreground uppercase font-bold">Total Price</span>
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
