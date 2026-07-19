import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BarChart3, ExternalLink } from "lucide-react";
import PublicHeader from "@/components/PublicHeader";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";

interface SyllabusItem {
  id: number;
  title: string;
  description: string | null;
  subject: string | null;
  link_url: string | null;
}

const SyllabusTracker = () => {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Syllabus Tracker — Atlas";
  }, []);

  const { data: items, isLoading } = useQuery({
    queryKey: ["public-syllabus-tracker"],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("syllabus_tracker_items")
        .select("id, title, description, subject, link_url")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) {
        if (error.code === "42P01") return [];
        throw error;
      }
      return (data || []) as SyllabusItem[];
    },
  });

  return (
    <div className="min-h-screen bg-background text-foreground pb-16">
      <PublicHeader />

      <div className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-card border-b">
        <button
          onClick={() => navigate("/")}
          className="h-9 w-9 rounded-full border flex items-center justify-center hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="flex-1 font-extrabold text-[17px]">Syllabus Tracker</h1>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6 flex flex-col gap-4">
        {isLoading && <p className="text-center text-sm text-muted-foreground py-10">লোড হচ্ছে...</p>}

        {!isLoading && (!items || items.length === 0) && (
          <div className="flex flex-col items-center text-center gap-4 pt-10">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-lg">
              <BarChart3 className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-lg font-bold">শীঘ্রই আসছে</h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              Syllabus Tracker কনটেন্ট খুব শীঘ্রই যুক্ত করা হবে।
            </p>
          </div>
        )}

        {items && items.length > 0 && (
          <div className="grid gap-3">
            {items.map((item) => (
              <Card key={item.id} className="p-4 space-y-1.5 hover:border-primary/40 transition-colors">
                {item.subject && (
                  <span className="inline-block text-[10px] font-bold text-sky-600 bg-sky-500/10 px-2 py-0.5 rounded-full">
                    {item.subject}
                  </span>
                )}
                <h3 className="font-bold text-sm">{item.title}</h3>
                {item.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                )}
                {item.link_url && (
                  <a
                    href={item.link_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary mt-1"
                  >
                    দেখুন <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SyllabusTracker;

