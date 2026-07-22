import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, GripVertical, Save, Loader2 } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface SubjectSortDialogProps {
  subjects: string[];
  onClose: () => void;
}

function SortableSubjectItem({ subject }: { subject: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: subject });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 bg-card border rounded-md ${
        isDragging ? "shadow-lg border-primary/50" : "hover:border-primary/30 text-muted-foreground hover:text-foreground"
      }`}
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 bg-muted/50 rounded flex-shrink-0 touch-none">
        <GripVertical className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm truncate text-foreground" title={subject}>{subject}</h4>
      </div>
    </div>
  );
}

// Drag subjects freely into any grid position — left/right/up/down.
// Order is saved as a flat sequence which the grid then lays out
// left-to-right, top-to-bottom, so position in the list == position on screen.
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
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
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
            Drag and drop to reorder subjects. Grid fills left-to-right, top-to-bottom — dragging a card left/right/up/down moves it to that position for students.
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

        <div className="flex-1 overflow-y-auto pr-2 min-h-0 bg-muted/10 rounded-md border p-2">
          {items.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">No subjects available.</div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={items} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                  {items.map((subject) => (
                    <SortableSubjectItem key={subject} subject={subject} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
