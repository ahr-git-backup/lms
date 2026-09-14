import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getEmbedUrl } from "@/lib/videoUtils";
import { PlayCircle } from "lucide-react";

const WatchTutorial = () => {
  const [activeVideo, setActiveVideo] = useState<{ caption: string; video_url: string } | null>(null);

  useEffect(() => {
    document.title = "Watch Tutorial – Atlas";
  }, []);

  const { data: videos, isLoading } = useQuery({
    queryKey: ["tutorial-videos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutorial_videos")
        .select("id, caption, video_url")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <div className="space-y-4">
      <header className="space-y-0.5">
        <h1 className="text-xl font-semibold tracking-tight">Watch Tutorial</h1>
        <p className="text-xs text-muted-foreground">Dashboard ব্যবহারের ভিডিও গাইড।</p>
      </header>

      <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900 p-3">
        <p className="text-sm text-emerald-800 dark:text-emerald-200">
          নিচের ভিডিওগুলো ক্রম অনুসারে (১, ২, ৩...) দেখুন, ভালোভাবে বুঝতে সুবিধা হবে।
        </p>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : !videos || videos.length === 0 ? (
        <Card className="border border-foreground/50">
          <CardContent className="pt-6 text-center text-sm text-muted-foreground">
            এখনো কোনো টিউটোরিয়াল ভিডিও যোগ করা হয়নি।
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {videos.map((v, idx) => (
            <Card
              key={v.id}
              className="border border-emerald-100 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900 rounded-2xl shadow-md hover:shadow-lg transition-all cursor-pointer"
              onClick={() => setActiveVideo(v)}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-9 w-9 shrink-0 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
                  {idx + 1}
                </div>
                <PlayCircle className="h-6 w-6 text-emerald-600 shrink-0" />
                <CardTitle className="text-sm leading-snug flex-1">{v.caption}</CardTitle>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!activeVideo} onOpenChange={(open) => !open && setActiveVideo(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{activeVideo?.caption}</DialogTitle>
          </DialogHeader>
          {activeVideo && (
            <div className="aspect-video w-full">
              <iframe
                src={getEmbedUrl(activeVideo.video_url)}
                className="w-full h-full rounded-lg"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={activeVideo.caption}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WatchTutorial;
