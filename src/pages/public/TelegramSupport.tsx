import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Send, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const TelegramSupportPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Telegram Support – Atlas";
  }, []);

  const { data: cards, isLoading } = useQuery({
    queryKey: ["telegram-support-cards-public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("telegram_support_cards")
        .select("*, topics:telegram_support_topics(*)")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data || []).map((c: any) => ({
        ...c,
        topics: (c.topics || []).sort((a: any, b: any) => a.sort_order - b.sort_order),
      }));
    },
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Button>

      <div className="rounded-lg border p-4">
        <h1 className="text-lg font-semibold tracking-tight text-center">Telegram Support</h1>
        <hr className="mt-3 border-border" />
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-sm text-muted-foreground">Loading...</div>
      ) : !cards || cards.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">No support groups available yet.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {cards.map((card: any) => (
            <div
              key={card.id}
              className="flex flex-col gap-2 rounded-xl border border-sky-500/20 bg-gradient-to-br from-sky-500/10 to-blue-600/10 p-4"
            >
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-sm shrink-0">
                  <Send className="h-4 w-4 text-white" />
                </div>
                <p className="font-semibold text-sm leading-tight">{card.title}</p>
              </div>
              {card.description && (
                <p className="text-xs text-muted-foreground leading-snug">{card.description}</p>
              )}
              {card.topics && card.topics.length > 0 && (
                <div className="flex flex-col gap-1.5 mt-1">
                  {card.topics.map((topic: any) => (
                    <a
                      key={topic.id}
                      href={topic.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline bg-background/60 rounded-md px-2 py-1.5 border border-sky-500/10"
                    >
                      {topic.title}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TelegramSupportPage;
