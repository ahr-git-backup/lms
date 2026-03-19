import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Class } from "@/types/admin";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { GripVertical, Save, X } from "lucide-react";
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
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableItem({ item }: { item: Class }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 border rounded-md bg-card mb-2 w-full max-w-[100vw] overflow-hidden"
    >
      <div {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground touch-none">
        <GripVertical className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0 overflow-hidden">
        <p className="font-medium truncate">{item.title}</p>
        <p className="text-xs text-muted-foreground truncate">{item.course?.name || "No Course"} • {item.subject}</p>
      </div>
      <div className="text-xs text-muted-foreground">
        Order: {item.sort_order || 0}
      </div>
    </div>
  );
}

interface ClassSortableListProps {
  classes: Class[];
  onClose: () => void;
}

export function ClassSortableList({ classes: initialClasses, onClose }: ClassSortableListProps) {
  const [items, setItems] = useState<Class[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Make sure we have the latest items sorted correctly locally
    setItems([...initialClasses]);
  }, [initialClasses]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const saveOrderMutation = useMutation({
    mutationFn: async (orderedItems: Class[]) => {
      // Top item gets highest index, bottom item gets lowest index
      // Assumes we only reorder what's on the CURRENT page.
      // E.g., if page size is 30, and there are 30 items.
      // Top = 30, Bottom = 1
      const updates = orderedItems.map((item, index) => ({
        id: item.id,
        sort_order: orderedItems.length - index,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from("classes")
          .update({ sort_order: update.sort_order })
          .eq("id", update.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Order saved successfully" });
      queryClient.invalidateQueries({ queryKey: ["admin-classes"] });
      onClose();
    },
    onError: (err) => {
      toast({ title: "Failed to save order", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4 border rounded-md p-4 bg-muted/20 w-full max-w-[100vw] overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-medium truncate">Reorder Classes (Current Page)</h3>
          <p className="text-xs text-muted-foreground break-words">Drag and drop items to adjust their sort order index. Top items get a higher priority number.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saveOrderMutation.isPending}>
            <X className="h-4 w-4 mr-2" /> Cancel
          </Button>
          <Button size="sm" onClick={() => saveOrderMutation.mutate(items)} disabled={saveOrderMutation.isPending}>
            <Save className="h-4 w-4 mr-2" /> {saveOrderMutation.isPending ? "Saving..." : "Save Order"}
          </Button>
        </div>
      </div>

      <div className="max-h-[60vh] overflow-y-auto p-1">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            {items.map((item) => (
              <SortableItem key={item.id} item={item} />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
