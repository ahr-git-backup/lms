import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, GripVertical, Save, Loader2, ChevronUp, ChevronDown, Pencil, Check, X as XIcon } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
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
  subjects: string[];
  onClose: () => void;
}

function SortableSubjectItem({
  subject,
  index,
  total,
  onMoveUp,
  onMoveDown,
  onRename,
  isRenaming,
}: {
  subject: string;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRename: (oldName: string, newName: string) => void;
  isRenaming: boolean;
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
    const trimmed = draft.trim();
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
        "flex items-center gap-2 p-3 bg-card border rounded-lg mb-2",
        isDragging ? "shadow-lg border-primary/50" : "hover:border-primary/30"
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
              autoFocus
              className="text-sm py-1.5 min-h-0 resize-none"
              placeholder={"Xxx\n[yyy]"}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitEdit(); }
                if (e.key === "Escape") setEditing(false);
              }}
            />
            <div className="flex gap-1.5">
              <button type="button" onClick={commitEdit} disabled={isRenaming} className="h-6 px-2 rounded flex items-center gap-1 text-[11px] font-medium bg-primary text-primary-foreground disabled:opacity-50">
                {isRenaming ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
              </button>
              <button type="button" onClick={() => setEditing(false)} className="h-6 px-2 rounded flex items-center gap-1 text-[11px] font-medium border bg-background">
                <XIcon className="h-3 w-3" /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <h4 className="font-medium text-sm leading-snug break-words whitespace-pre-line">{subject}</h4>
        )}
      </div>
      {!editing && (
        <button
          type="button"
          onClick={startEdit}
          className="h-6 w-6 rounded flex items-center justify-center border bg-background hover:bg-muted flex-shrink-0"
          aria-label="Edit subject name"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
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

// Simple vertical reorder list — full subject names are always visible (no truncation,
// no side-to-side empty space from a grid). Two ways to reorder, whichever feels easier:
// 1) Drag the grip handle up/down
// 2) Tap the up/down arrow buttons — foolproof on touch, no drag gesture needed at all
// Position in this list == display order on the actual page (grid fills left-to-right,
// top-to-bottom), so #1 becomes the top-left card, #2 next to it, etc.
export function SubjectSortDialog({ subjects, onClose }: SubjectSortDialogProps) {
  const [items, setItems] = useState<string[]>([]);
  const [isModified, setIsModified] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const settingsKey = "subject_order_global";

  useEffect(() => {
    setItems([...subjects]);
    setIsModified(false);
  }, [subjects]);

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

      for (const row of rows || []) {
        const updatedSubjects = (row.subject as string[]).map((s) => (s === oldName ? newName : s));
        const { error: updateErr } = await supabase
          .from("exams")
          .update({ subject: updatedSubjects })
          .eq("id", row.id);
        if (updateErr) throw updateErr;
      }

      return newName;
    },
    onSuccess: (newName, { oldName }) => {
      setItems((prev) => prev.map((s) => (s === oldName ? newName : s)));
      toast({ title: "Subject renamed successfully!" });
      queryClient.invalidateQueries({ queryKey: ["readymade-exams-subjects"] });
      queryClient.invalidateQueries({ queryKey: ["readymade-exams-list"] });
      queryClient.invalidateQueries({ queryKey: ["readymade-exams-chapters"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to rename subject", description: err.message, variant: "destructive" });
    },
  });

  const handleRename = (oldName: string, newName: string) => {
    renameMutation.mutate({ oldName, newName }, {
      onSuccess: () => {
        // Also keep the saved order list in sync with the new name so
        // position is preserved after rename.
        const newItems = items.map((s) => (s === oldName ? newName : s));
        supabase.from("app_settings").upsert({ key: settingsKey, value: newItems }, { onConflict: "key" });
      },
    });
  };

  const saveOrderMutation = useMutation({
    mutationFn: async (orderedItems: string[]) => {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: settingsKey, value: orderedItems }, { onConflict: "key" });
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
            Drag the grip handle, or tap the up/down arrows — position here becomes each subject's position in the grid students see.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={onClose} className="shrink-0">
          <ChevronLeft className="h-4 w-4 mr-2" /> Back
        </Button>
      </CardHeader>

      <CardContent className="flex flex-col">
        <div className="flex items-center justify-end py-2">
          <div className="flex gap-2">
            {isModified && (
              <>
                <Button variant="ghost" size="sm" onClick={() => setItems([...subjects])}>
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

        <div className="flex-1 overflow-y-auto pr-1 min-h-0 bg-muted/10 rounded-md border p-2">
          {items.length === 0 ? (
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
                    onMoveUp={() => moveItem(index, -1)}
                    onMoveDown={() => moveItem(index, 1)}
                    onRename={handleRename}
                    isRenaming={renameMutation.isPending}
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
