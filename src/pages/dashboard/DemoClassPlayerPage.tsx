import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, FileText, Lock } from "lucide-react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import PublicHeader from "@/components/PublicHeader";
import { DemoContentItem } from "@/types/admin";

const DemoClassPlayerPage = () => {
  const { courseId, demoIndex } = useParams<{ courseId: string; demoIndex: string }>();
  const navigate = useNavigate();
  const index = parseInt(demoIndex || "0", 10);

  const { data: course, isLoading, isError } = useQuery({
    queryKey: ["public-course-demo", courseId],
    queryFn: async () => {
      if (!courseId) return null;
      const { data, error } = await supabase
        .from("courses")
        .select("id, name, demo_content")
        .or(`slug.eq.${courseId},id.eq.${courseId}`)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!courseId,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const demoContent: DemoContentItem[] = (course?.demo_content as any) || [];
  const currentItem = demoContent[index];

  useEffect(() => {
    if (currentItem?.title) {
      document.title = `${currentItem.title} - Demo - Beshi Joss LMS`;
    }
  }, [currentItem]);

  if (isLoading) {
      return <div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>;
  }

  if (isError || !currentItem) {
      return (
          <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
              <h1 className="text-xl font-bold">Content Not Found</h1>
              <Button onClick={() => navigate(-1)}>Go Back</Button>
          </div>
      );
  }

  const isVideo = currentItem.type === 'video';
  const isPDF = currentItem.type === 'pdf' || currentItem.type === 'note';

  // Helper to extract YouTube ID if possible for embedding, else fallback to generic iframe/link
  const getEmbedUrl = (url: string) => {
      // Basic youtube ID extraction
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
      const match = url.match(regExp);
      if (match && match[2].length === 11) {
          return `https://www.youtube.com/embed/${match[2]}?autoplay=1`;
      }
      return url;
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicHeader />

      <main className="flex-1 max-w-5xl mx-auto w-full p-4 md:p-6 space-y-6">
          <div className="flex items-center gap-2 mb-4">
              <Button variant="ghost" size="sm" onClick={() => navigate(`/courses/${courseId}`)}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Back to Course
              </Button>
              <h1 className="text-lg font-semibold truncate flex-1">{course?.name}</h1>
          </div>

          <div className="space-y-4">
              <div className="flex items-start justify-between">
                  <div>
                      <h2 className="text-2xl font-bold">{currentItem.title}</h2>
                      <p className="text-muted-foreground capitalize text-sm">{currentItem.type} Preview</p>
                  </div>
              </div>

              <Card className="overflow-hidden border-2 border-primary/10">
                  <CardContent className="p-0">
                      {isVideo ? (
                           <div className="aspect-video bg-black w-full">
                               <iframe
                                  src={getEmbedUrl(currentItem.url)}
                                  title={currentItem.title}
                                  className="w-full h-full"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                               />
                           </div>
                      ) : isPDF ? (
                          <div className="h-[80vh] w-full bg-muted flex flex-col items-center justify-center gap-4">
                              {currentItem.url.endsWith('.pdf') ? (
                                   <iframe src={currentItem.url} className="w-full h-full" title="PDF Viewer" />
                              ) : (
                                  <div className="text-center p-8">
                                      <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                                      <h3 className="text-lg font-semibold mb-2">External Document</h3>
                                      <Button asChild>
                                          <a href={currentItem.url} target="_blank" rel="noopener noreferrer">
                                              Open Document
                                          </a>
                                      </Button>
                                  </div>
                              )}
                          </div>
                      ) : (
                          <div className="p-12 text-center text-muted-foreground">
                              Unsupported content type.
                              <br/>
                              <a href={currentItem.url} target="_blank" rel="noreferrer" className="text-primary underline">Open Link</a>
                          </div>
                      )}
                  </CardContent>
              </Card>
          </div>
      </main>
    </div>
  );
};

export default DemoClassPlayerPage;
