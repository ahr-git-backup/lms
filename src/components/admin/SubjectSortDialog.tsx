import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, GripVertical, Save, Loader2, ChevronUp, ChevronDown, Pencil, Check, X as XIcon, Eye, EyeOff, Tag } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { CreatableSelect } from "@/components/ui/creatable-select";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

interface SubjectSortDialogProps {
  onClose: () => void;
}

function SortableSubjectItem({
  subject,
  index,
  total,
  isHidden,
  parentTopic,
  topicOptions,
  onMoveUp,
  onMoveDown,
  onRename,
  onToggleHidden,
  onTopicChange,
  isRenaming,
  isTogglingHidden,
  isTopicChanging,
}: {
  subject: string;
  index: number;
  total: number;
  isHidden: boolean;
  parentTopic: string;
  topicOptions: { label: string; value: string }[];
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRename: (oldName: string, newName: string) => void;
  onToggleHidden: (subject: string) => void;
  onTopicChange: (subject: string, newTopic: string) => void;
  isRenaming: boolean;
  isTogglingHidden: boolean;
  isTopicChanging: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: subject });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(subject);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.85 : 1,
  };

  const startEdit = () => {
    setDraft(subject);
    setEditing(true);
  };

  const commitEdit = () => {
    const trimmed = draft.replace(/\r\n/g, "\n").trim();
    if (!trimmed || trimmed === subject) {
      setEditing(false);
      return;
    }
    onRename(subject, trimmed);
    setEditing(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 p-3 bg-card border-y sm:border rounded-none sm:rounded-lg mb-2",
        isDragging ? "shadow-lg border-primary/50" : "hover:border-primary/30",
        isHidden ? "opacity-50" : ""
      )}
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-2 -m-1 bg-muted/50 rounded flex-shrink-0 touch-none">
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>
      <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
        {index + 1}
      </span>
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex flex-col gap-1.5">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              ref={(el) => { if (el) setTimeout(() => el.focus({ preventScroll: true }), 0); }}
              className="text-sm py-1.5 min-h-0 resize-none"
              placeholder={"Xxx\n[yyy]"}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commitEdit(); }
                if (e.key === "Escape") setEditing(false);
              }}
            />
            <p className="text-[10px] text-muted-foreground -mt-0.5">Enter দিয়ে নতুন লাইন করা যাবে। Save করতে বাটনে ক্লিক করুন।</p>
            <div className="flex gap-1.5">
              <button type="button" onClick={commitEdit} disabled={isRenaming} className="h-6 px-2 rounded flex items-center gap-1 text-[11px] font-medium bg-primary text-primary-foreground disabled:opacity-50">
                {isRenaming ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
              </button>
              <button type="button" onClick={() => setEditing(false)} className="h-6 px-2 rounded flex items-center gap-1 text-[11px] font-medium border bg-background">
                <XIcon className="h-3 w-3" /> Cancel
              </button>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <Tag className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
              <div className="w-full max-w-[160px]">
                <CreatableSelect
                  options={topicOptions}
                  value={parentTopic}
                  onChange={(v) => onTopicChange(subject, v)}
                  onCreate={(v) => onTopicChange(subject, v)}
                  placeholder="Parent Topic"
                  className="h-6 text-[10px] px-2 py-1"
                />
              </div>
              {isTopicChanging && <Loader2 className="h-2.5 w-2.5 animate-spin text-muted-foreground" />}
            </div>
          </div>
        ) : (
          <div>
            <h4 className="font-medium text-sm leading-snug break-words whitespace-pre-line">
              {subject}
              {isHidden && <span className="ml-2 text-[10px] font-normal text-muted-foreground">(Hidden)</span>}
            </h4>
            <div className="flex items-center gap-1 mt-1">
              <Tag className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
              <div className="w-full max-w-[160px]">
                <CreatableSelect
                  options={topicOptions}
                  value={parentTopic}
                  onChange={(v) => onTopicChange(subject, v)}
                  onCreate={(v) => onTopicChange(subject, v)}
                  placeholder="Parent Topic"
                  className="h-6 text-[10px] px-2 py-1"
                />
              </div>
              {isTopicChanging && <Loader2 className="h-2.5 w-2.5 animate-spin text-muted-foreground" />}
            </div>
          </div>
        )}
      </div>
      {!editing && (
        <>
          <button
            type="button"
            onClick={() => onToggleHidden(subject)}
            disabled={isTogglingHidden}
            className={cn(
              "h-6 w-6 rounded flex items-center justify-center border bg-background hover:bg-muted flex-shrink-0 disabled:opacity-50",
              isHidden ? "text-primary" : "text-muted-foreground"
            )}
            aria-label={isHidden ? "Show subject" : "Hide subject"}
          >
            {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={startEdit}
            className="h-6 w-6 rounded flex items-center justify-center border bg-background hover:bg-muted flex-shrink-0"
            aria-label="Edit subject name"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </>
      )}
      <div className="flex flex-col gap-0.5 flex-shrink-0">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={index === 0}
          className="h-6 w-6 rounded flex items-center justify-center border bg-background disabled:opacity-30 disabled:cursor-not-allowed hover:bg-muted"
          aria-label="Move up"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={index === total - 1}
          className="h-6 w-6 rounded flex items-center justify-center border bg-background disabled:opacity-30 disabled:cursor-not-allowed hover:bg-muted"
          aria-label="Move down"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

const ORDER_KEY = "subject_order_global";
const HIDDEN_KEY = "subject_hidden_global";

// Simple vertical reorder list — full subject names are always visible (no truncation,
// no side-to-side empty space from a grid). Two ways to reorder, whichever feels easier:
// 1) Drag the grip handle up/down
// 2) Tap the up/down arrow buttons — foolproof on touch, no drag gesture needed at all
// Position in this list == display order on the actual page (grid fills left-to-right,
// top-to-bottom), so #1 becomes the top-left card, #2 next to it, etc.
// Fetches ALL subjects that exist on any readymade exam (not just the ones currently
// visible to students), so a hidden subject can still be found here and unhidden.
export function SubjectSortDialog({ onClose }: SubjectSortDialogProps) {
  const [items, setItems] = useState<string[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [isModified, setIsModified] = useState(false);
  const [subjectTopics, setSubjectTopics] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: allData, isLoading } = useQuery({
    queryKey: ["subject-sort-dialog-all-subjects"],
    queryFn: async () => {
      const BATCH = 1000;
      let from = 0;
      const unique = new Set<string>();
      // subject -> { topicValue -> examCount }, so we can show the majority
      // topic as this subject's current mapping when exams disagree.
      const topicCounts = new Map<string, Map<string, number>>();
      const allTopics = new Set<string>();
      while (true) {
        const { data: rows, error } = await supabase
          .from("exams")
          .select("subject, readymade_topic")
          .eq("is_readymade", true)
          .range(from, from + BATCH - 1);
        if (error) throw error;
        (rows || []).forEach((row: any) => {
          const subs: string[] = Array.isArray(row.subject) ? row.subject : (typeof row.subject === "string" ? [row.subject] : []);
          const topic: string = row.readymade_topic || "";
          if (topic) allTopics.add(topic);
          subs.forEach((s) => {
            if (!s) return;
            unique.add(s);
            if (!topicCounts.has(s)) topicCounts.set(s, new Map());
            const m = topicCounts.get(s)!;
            m.set(topic, (m.get(topic) || 0) + 1);
          });
        });
        if (!rows || rows.length < BATCH) break;
        from += BATCH;
      }

      const topicMap: Record<string, string> = {};
      topicCounts.forEach((counts, subj) => {
        let best = "";
        let bestCount = -1;
        counts.forEach((c, t) => {
          if (c > bestCount) { best = t; bestCount = c; }
        });
        topicMap[subj] = best;
      });

      const [{ data: orderRow }, { data: hiddenRow }] = await Promise.all([
        supabase.from("app_settings").select("value").eq("key", ORDER_KEY).maybeSingle(),
        supabase.from("app_settings").select("value").eq("key", HIDDEN_KEY).maybeSingle(),
      ]);
      const savedOrder: string[] = orderRow?.value ? (orderRow.value as string[]) : [];
      const hiddenList: string[] = hiddenRow?.value ? (hiddenRow.value as string[]) : [];

      const sorted = Array.from(unique).sort((a, b) => {
        const iA = savedOrder.indexOf(a), iB = savedOrder.indexOf(b);
        if (iA !== -1 && iB !== -1) return iA - iB;
        if (iA !== -1) return -1; if (iB !== -1) return 1;
        return a.localeCompare(b);
      });
      return { sorted, hiddenList, topicMap, allTopics: Array.from(allTopics).sort() };
    },
  });

  useEffect(() => {
    if (allData) {
      setItems(allData.sorted);
      setHidden(new Set(allData.hiddenList));
      setSubjectTopics(allData.topicMap);
      setIsModified(false);
    }
  }, [allData]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems((prev) => {
        const oldIndex = prev.indexOf(active.id as string);
        const newIndex = prev.indexOf(over.id as string);
        setIsModified(true);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    setItems((prev) => {
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      setIsModified(true);
      return arrayMove(prev, index, newIndex);
    });
  };

  const renameMutation = useMutation({
    mutationFn: async ({ oldName, newName }: { oldName: string; newName: string }) => {
      // Find every exam row whose subject array contains the old name, then
      // replace just that entry — other subjects on the same exam are untouched.
      const { data: rows, error: fetchErr } = await supabase
        .from("exams")
        .select("id, subject")
        .contains("subject", [oldName]);
      if (fetchErr) throw fetchErr;

      const targetRows = rows || [];
      // Run all updates in parallel and require every single one to succeed —
      // a partial failure here is exactly what causes one subject to silently
      // split into two groups (some exams renamed, some left on the old name).
      const results = await Promise.allSettled(
        targetRows.map((row) => {
          const updatedSubjects = (row.subject as string[]).map((s) => (s === oldName ? newName : s));
          return supabase.from("exams").update({ subject: updatedSubjects }).eq("id", row.id);
        })
      );

      const failures = results.filter(
        (r) => r.status === "rejected" || (r.status === "fulfilled" && (r.value as any).error)
      );
      if (failures.length > 0) {
        throw new Error(
          `${failures.length}/${targetRows.length} exams failed to rename — no changes were kept for "${oldName}" to avoid a split group. Please try again.`
        );
      }

      // Update the saved position order BEFORE any refetch happens, so the
      // subjects list query — which reads this order — never sees a stale
      // mapping (old name gone, new name unmapped => falls to the bottom).
      const newItems = items.map((s) => (s === oldName ? newName : s));
      const { error: orderErr } = await supabase
        .from("app_settings")
        .upsert({ key: ORDER_KEY, value: newItems }, { onConflict: "key" });
      if (orderErr) throw orderErr;

      // Carry the hidden flag over to the new name too, if it was hidden.
      if (hidden.has(oldName)) {
        const newHiddenList = Array.from(hidden).map((s) => (s === oldName ? newName : s));
        const { error: hiddenErr } = await supabase
          .from("app_settings")
          .upsert({ key: HIDDEN_KEY, value: newHiddenList }, { onConflict: "key" });
        if (hiddenErr) throw hiddenErr;
      }

      // Keep global_metadata (source of Main Exam Form's subject picklist) in sync too.
      // Note: a subject may exist on exams.subject without ever having a
      // global_metadata row (e.g. created before this table existed, or
      // added some other way) — update() then matches 0 rows silently.
      // Check first and insert the new name if nothing was there to rename.
      const { data: metaRow, error: metaSelErr } = await supabase
        .from("global_metadata")
        .select("id")
        .eq("type", "subject")
        .eq("value", oldName)
        .maybeSingle();
      if (metaSelErr) throw metaSelErr;

      if (metaRow) {
        const { error: metaErr } = await supabase
          .from("global_metadata")
          .update({ value: newName })
          .eq("id", metaRow.id);
        if (metaErr) throw metaErr;
      } else {
        const { error: metaInsErr } = await supabase
          .from("global_metadata")
          .insert({ type: "subject", value: newName });
        // Ignore duplicate (23505) — newName might already exist there.
        if (metaInsErr && (metaInsErr as any).code !== "23505") throw metaInsErr;
      }

      return newName;
    },
    onSuccess: (newName, { oldName }) => {
      setItems((prev) => prev.map((s) => (s === oldName ? newName : s)));
      setHidden((prev) => {
        if (!prev.has(oldName)) return prev;
        const next = new Set(prev);
        next.delete(oldName);
        next.add(newName);
        return next;
      });
      toast({ title: "Subject renamed successfully!" });
      queryClient.invalidateQueries({ queryKey: ["global-metadata"] });
      queryClient.invalidateQueries({ queryKey: ["subject-sort-dialog-all-subjects"] });
      queryClient.invalidateQueries({ queryKey: ["readymade-mcq-counts"] });
      queryClient.refetchQueries({ queryKey: ["readymade-exams-subjects"] });
      queryClient.refetchQueries({ queryKey: ["readymade-exams-list"] });
      queryClient.refetchQueries({ queryKey: ["readymade-exams-chapters"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to rename subject", description: err.message, variant: "destructive" });
    },
  });

  const handleRename = (oldName: string, newName: string) => {
    renameMutation.mutate({ oldName, newName });
  };

  // Bulk-assigns readymade_topic on every exam whose subject array contains
  // this subject, so a subject's parent-topic mapping is always consistent
  // across all its exams — no more per-exam manual entry that can be missed.
  const [changingTopicFor, setChangingTopicFor] = useState<string | null>(null);
  const topicChangeMutation = useMutation({
    mutationFn: async ({ subject, newTopic }: { subject: string; newTopic: string }) => {
      const { data: rows, error: fetchErr } = await supabase
        .from("exams")
        .select("id")
        .contains("subject", [subject]);
      if (fetchErr) throw fetchErr;

      const targetRows = rows || [];
      const results = await Promise.allSettled(
        targetRows.map((row) =>
          supabase.from("exams").update({ readymade_topic: newTopic || null }).eq("id", row.id)
        )
      );
      const failures = results.filter(
        (r) => r.status === "rejected" || (r.status === "fulfilled" && (r.value as any).error)
      );
      if (failures.length > 0) {
        throw new Error(`${failures.length}/${targetRows.length} exams failed to update — please try again.`);
      }
      return { subject, newTopic, count: targetRows.length };
    },
    onMutate: ({ subject }) => setChangingTopicFor(subject),
    onSuccess: ({ subject, newTopic, count }) => {
      setSubjectTopics((prev) => ({ ...prev, [subject]: newTopic }));
      toast({ title: `${count}টি এক্সাম আপডেট হয়েছে`, description: `"${subject}" এখন "${newTopic || "কোনো টপিক নেই"}" এর অধীনে।` });
      queryClient.invalidateQueries({ queryKey: ["subject-sort-dialog-all-subjects"] });
      queryClient.invalidateQueries({ queryKey: ["exam-topics"] });
      queryClient.invalidateQueries({ queryKey: ["readymade-parent-topics"] });
      queryClient.refetchQueries({ queryKey: ["readymade-exams-list"] });
    },
    onError: (err: any) => {
      toast({ title: "টপিক আপডেট করা যায়নি", description: err.message, variant: "destructive" });
    },
    onSettled: () => setChangingTopicFor(null),
  });

  const handleTopicChange = (subject: string, newTopic: string) => {
    topicChangeMutation.mutate({ subject, newTopic });
  };

  const toggleHiddenMutation = useMutation({
    mutationFn: async (subject: string) => {
      const next = new Set(hidden);
      if (next.has(subject)) next.delete(subject);
      else next.add(subject);
      const nextList = Array.from(next);
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: HIDDEN_KEY, value: nextList }, { onConflict: "key" });
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => {
      setHidden(next);
      queryClient.invalidateQueries({ queryKey: ["readymade-exams-subjects"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to update visibility", description: err.message, variant: "destructive" });
    },
  });

  const saveOrderMutation = useMutation({
    mutationFn: async (orderedItems: string[]) => {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: ORDER_KEY, value: orderedItems }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Subject order saved successfully!" });
      queryClient.invalidateQueries({ queryKey: ["readymade-exams-subjects"] });
      setIsModified(false);
      onClose();
    },
    onError: (err) => {
      toast({ title: "Failed to save order", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Card className="animate-in fade-in slide-in-from-bottom-4 duration-300">
      <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 mb-4 gap-4">
        <div>
          <CardTitle>Organize Subjects</CardTitle>
          <CardDescription>
            Drag the grip handle, or tap the up/down arrows — position here becomes each subject's position in the grid students see. Tap the eye icon to hide a subject from students.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={onClose} className="shrink-0">
          <ChevronLeft className="h-4 w-4 mr-2" /> Back
        </Button>
      </CardHeader>

      <CardContent className="flex flex-col px-0 sm:px-6">
        <div className="flex items-center justify-end py-2 px-2 sm:px-0">
          <div className="flex gap-2">
            {isModified && (
              <>
                <Button variant="ghost" size="sm" onClick={() => { if (allData) setItems(allData.sorted); }}>
                  Reset
                </Button>
                <Button
                  size="sm"
                  onClick={() => saveOrderMutation.mutate(items)}
                  disabled={saveOrderMutation.isPending}
                >
                  {saveOrderMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Position
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 bg-muted/10 sm:rounded-md sm:border p-0 sm:p-2">
          {isLoading ? (
            <div className="text-center p-8 text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading...
            </div>
          ) : items.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">No subjects available.</div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={items} strategy={verticalListSortingStrategy}>
                {items.map((subject, index) => (
                  <SortableSubjectItem
                    key={subject}
                    subject={subject}
                    index={index}
                    total={items.length}
                    isHidden={hidden.has(subject)}
                    parentTopic={subjectTopics[subject] || ""}
                    topicOptions={(allData?.allTopics || []).map((t) => ({ label: t, value: t }))}
                    onMoveUp={() => moveItem(index, -1)}
                    onMoveDown={() => moveItem(index, 1)}
                    onRename={handleRename}
                    onToggleHidden={(s) => toggleHiddenMutation.mutate(s)}
                    onTopicChange={handleTopicChange}
                    isRenaming={renameMutation.isPending}
                    isTogglingHidden={toggleHiddenMutation.isPending}
                    isTopicChanging={changingTopicFor === subject}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
