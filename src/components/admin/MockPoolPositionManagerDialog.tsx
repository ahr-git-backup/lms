import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronUp, ChevronDown, Loader2 } from "lucide-react";

type ItemType = "subject" | "chapter" | "topic";

interface MockPoolPositionManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Fetch raw (subject, chapter, topic) rows once and derive distinct lists
// client-side — mock_question_pool has no separate metadata table for these.
function useRawPoolRows() {
  return useQuery({
    queryKey: ["mock-pool-raw-rows-for-position"],
    queryFn: async () => {
      const { data, error } = await supabase.from("mock_question_pool").select("subject, chapter, topic");
      if (error) throw error;
      return (data || []) as { subject: string; chapter: string; topic: string | null }[];
    },
  });
}

function useSortOrder(itemType: ItemType, parentKey: string, enabled: boolean) {
  return useQuery({
    queryKey: ["mock-pool-sort-order", itemType, parentKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mock_pool_sort_order" as any)
        .select("item_key, sort_order")
        .eq("item_type", itemType)
        .eq("parent_key", parentKey)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as { item_key: string; sort_order: number }[];
    },
    enabled,
  });
}

function orderItems(names: string[], saved: { item_key: string; sort_order: number }[] | undefined): string[] {
  if (!saved || saved.length === 0) return names;
  const orderMap = new Map(saved.map((s) => [s.item_key, s.sort_order]));
  return [...names].sort((a, b) => {
    const oa = orderMap.has(a) ? (orderMap.get(a) as number) : Number.MAX_SAFE_INTEGER;
    const ob = orderMap.has(b) ? (orderMap.get(b) as number) : Number.MAX_SAFE_INTEGER;
    if (oa !== ob) return oa - ob;
    return a.localeCompare(b);
  });
}

function ReorderList({
  itemType,
  parentKey,
  items,
  savedOrder,
  onOpenChild,
}: {
  itemType: ItemType;
  parentKey: string;
  items: string[];
  savedOrder: { item_key: string; sort_order: number }[] | undefined;
  onOpenChild?: (name: string) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [order, setOrder] = useState<string[]>(() => orderItems(items, savedOrder));
  const [saving, setSaving] = useState(false);

  // Keep local order in sync if items/savedOrder change (e.g. after a save+refetch)
  const key = items.join("|") + "::" + (savedOrder || []).map((s) => `${s.item_key}:${s.sort_order}`).join("|");
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setOrder(orderItems(items, savedOrder));
  }

  const move = (index: number, dir: -1 | 1) => {
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= order.length) return;
    const next = [...order];
    [next[index], next[newIndex]] = [next[newIndex], next[index]];
    setOrder(next);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const rows = order.map((item_key, idx) => ({
        item_type: itemType,
        parent_key: parentKey,
        item_key,
        sort_order: idx,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from("mock_pool_sort_order" as any).upsert(rows, {
        onConflict: "item_type,parent_key,item_key",
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["mock-pool-sort-order", itemType, parentKey] });
      queryClient.invalidateQueries({ queryKey: ["mock-pool-subjects"] });
      queryClient.invalidateQueries({ queryKey: ["mock-pool-chapters-totals"] });
      toast({ title: "সেভ হয়েছে", description: "অর্ডার আপডেট হয়েছে।" });
    } catch (e: any) {
      toast({ title: "সেভ করা যায়নি", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (order.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">কিছু পাওয়া যায়নি।</p>;
  }

  return (
    <div className="space-y-2">
      {order.map((name, idx) => (
        <div
          key={name}
          className="flex items-center gap-2 rounded-lg border-2 border-border px-2.5 py-2"
        >
          <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
            {idx + 1}
          </span>
          <button
            type="button"
            className="flex-1 min-w-0 text-left text-sm font-semibold truncate"
            onClick={() => onOpenChild?.(name)}
            disabled={!onOpenChild}
          >
            {name}
          </button>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={idx === 0}
              onClick={() => move(idx, -1)}
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={idx === order.length - 1}
              onClick={() => move(idx, 1)}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
            {onOpenChild && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => onOpenChild(name)}
              >
                টপিক
              </Button>
            )}
          </div>
        </div>
      ))}
      <Button className="w-full mt-2" onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
        অর্ডার সেভ করুন
      </Button>
    </div>
  );
}

export default function MockPoolPositionManagerDialog({ open, onOpenChange }: MockPoolPositionManagerDialogProps) {
  const [level, setLevel] = useState<"subject" | "chapter" | "topic">("subject");
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [activeChapter, setActiveChapter] = useState<string | null>(null);

  const { data: rows, isLoading } = useRawPoolRows();

  const subjects = [...new Set((rows || []).map((r) => r.subject))];
  const chapters = activeSubject
    ? [...new Set((rows || []).filter((r) => r.subject === activeSubject).map((r) => r.chapter))]
    : [];
  const topics = activeSubject && activeChapter
    ? [...new Set((rows || []).filter((r) => r.subject === activeSubject && r.chapter === activeChapter && r.topic).map((r) => r.topic as string))]
    : [];

  const subjectOrderQuery = useSortOrder("subject", "", level === "subject");
  const chapterOrderQuery = useSortOrder("chapter", activeSubject || "", level === "chapter" && !!activeSubject);
  const topicOrderQuery = useSortOrder(
    "topic",
    activeSubject && activeChapter ? `${activeSubject}||${activeChapter}` : "",
    level === "topic" && !!activeSubject && !!activeChapter
  );

  const reset = () => {
    setLevel("subject");
    setActiveSubject(null);
    setActiveChapter(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {level !== "subject" && (
              <button
                type="button"
                onClick={() => {
                  if (level === "topic") {
                    setLevel("chapter");
                    setActiveChapter(null);
                  } else {
                    setLevel("subject");
                    setActiveSubject(null);
                  }
                }}
                className="h-8 w-8 rounded-full border-2 border-border flex items-center justify-center shrink-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <DialogTitle className="text-base">
              {level === "subject" && "সাবজেক্ট পজিশন"}
              {level === "chapter" && `চ্যাপ্টার পজিশন — ${activeSubject}`}
              {level === "topic" && `টপিক পজিশন — ${activeSubject} / ${activeChapter}`}
            </DialogTitle>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : level === "subject" ? (
          <ReorderList
            itemType="subject"
            parentKey=""
            items={subjects}
            savedOrder={subjectOrderQuery.data}
            onOpenChild={(name) => {
              setActiveSubject(name);
              setLevel("chapter");
            }}
          />
        ) : level === "chapter" ? (
          <ReorderList
            itemType="chapter"
            parentKey={activeSubject || ""}
            items={chapters}
            savedOrder={chapterOrderQuery.data}
            onOpenChild={(name) => {
              setActiveChapter(name);
              setLevel("topic");
            }}
          />
        ) : (
          <ReorderList
            itemType="topic"
            parentKey={activeSubject && activeChapter ? `${activeSubject}||${activeChapter}` : ""}
            items={topics}
            savedOrder={topicOrderQuery.data}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
