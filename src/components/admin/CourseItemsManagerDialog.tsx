import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { GripVertical, Save, ArrowUpDown, Loader2 } from "lucide-react";
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

interface CourseItemsManagerDialogProps {
  courseId: string | null;
  courseName: string;
  resourceType: "classes" | "exams";
  onClose: () => void;
}

interface ItemBase {
  id: string;
  title: string;
  sort_order: number;
  course_id: string | null;
  shared_course_ids?: string[];
  archive_course_ids?: string[];
}

function SortableListItem({ item, index }: { item: ItemBase; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

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
      className={`flex items-center gap-3 p-3 bg-card border rounded-md mb-2 ${
        isDragging ? "shadow-lg border-primary/50" : "hover:border-primary/30 text-muted-foreground hover:text-foreground"
      }`}
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 bg-muted/50 rounded flex-shrink-0">
        <GripVertical className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm truncate text-foreground" title={item.title}>{item.title}</h4>
      </div>
      <div className="text-xs bg-muted px-2 py-1 rounded-full flex-shrink-0">
        Order: {item.sort_order || 0}
      </div>
    </div>
  );
}

export function CourseItemsManagerDialog({ courseId, courseName, resourceType, onClose }: CourseItemsManagerDialogProps) {
  const [items, setItems] = useState<ItemBase[]>([]);
  const [isModified, setIsModified] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: fetchedItems, isLoading, isError } = useQuery({
    queryKey: ["admin-course-items", courseId, resourceType],
    queryFn: async () => {
      if (!courseId) return [];
      
      let query = supabase.from(resourceType).select("*");
      
      // We want to fetch items where course_id = courseId 
      // OR shared_course_ids contains courseId 
      // OR archive_course_ids contains courseId
      // For exams, wait, do exams have shared_course_ids?
      // Let's just fetch everything for this courseId. If columns don't exist, it might error, but we'll try safely.
      if (resourceType === 'classes') {
          query = query.or(`course_id.eq.${courseId},shared_course_ids.cs.{${courseId}},archive_course_ids.cs.{${courseId}}`);
      } else {
          query = query.or(`course_id.eq.${courseId}`);
      }
      
      const { data, error } = await query;

      if (error) {
          console.error("Error fetching items:", error);
          throw error;
      }

      // Sort primarily by sort_order descending, then by creation date or id
      const sorted = (data as ItemBase[]).sort((a, b) => {
          const orderA = a.sort_order || 0;
          const orderB = b.sort_order || 0;
          return orderB - orderA; // Highest order first
      });

      // User instruction: shared/archive items should be at the bottom
      // So we will sort them first by primary (1) vs shared (0), then by sort_order
      const finalSorted = sorted.sort((a, b) => {
          const aIsPrimary = a.course_id === courseId ? 1 : 0;
          const bIsPrimary = b.course_id === courseId ? 1 : 0;
          if (aIsPrimary !== bIsPrimary) {
              return bIsPrimary - aIsPrimary; // Primary first
          }
          const orderA = a.sort_order || 0;
          const orderB = b.sort_order || 0;
          return orderB - orderA;
      });

      return finalSorted;
    },
    enabled: !!courseId,
  });

  useEffect(() => {
    if (fetchedItems) {
      setItems(fetchedItems);
      setIsModified(false);
    }
  }, [fetchedItems]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        setIsModified(true);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleReverse = () => {
    setItems((prev) => [...prev].reverse());
    setIsModified(true);
  };

  const saveOrderMutation = useMutation({
    mutationFn: async (orderedItems: ItemBase[]) => {
      // The first item gets the highest index, the last gets 0 (or n-index)
      const len = orderedItems.length;
      const updates = orderedItems.map((item, index) => ({
        id: item.id,
        sort_order: len - index,
      }));

      // Supabase update array
      // Unfortunately we must do individual updates or bulk rpc.
      for (const update of updates) {
        const { error } = await supabase
          .from(resourceType)
          .update({ sort_order: update.sort_order })
          .eq("id", update.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: `Successfully updated ${resourceType} order!` });
      queryClient.invalidateQueries({ queryKey: ["admin-course-items", courseId, resourceType] });
      queryClient.invalidateQueries({ queryKey: ["admin-classes"] });
      queryClient.invalidateQueries({ queryKey: ["admin-exams"] });
      setIsModified(false);
    },
    onError: (err) => {
      toast({ title: "Failed to save order", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={!!courseId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Organize {resourceType === 'classes' ? 'Classes' : 'Exams'} - {courseName}</DialogTitle>
          <DialogDescription>
            Drag and drop to reorder items within this course. Shared items are included at the bottom by default.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between py-2">
            <Button variant="outline" size="sm" onClick={handleReverse} disabled={items.length === 0}>
                <ArrowUpDown className="h-4 w-4 mr-2" /> Reverse Array
            </Button>
            
            <div className="flex gap-2">
                {isModified && (
                    <>
                    <Button variant="ghost" size="sm" onClick={() => setItems(fetchedItems || [])}>
                        Reset
                    </Button>
                    <Button 
                        size="sm" 
                        onClick={() => saveOrderMutation.mutate(items)} 
                        disabled={saveOrderMutation.isPending}
                    >
                        {saveOrderMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                        Save Sequence
                    </Button>
                    </>
                )}
            </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 min-h-0 bg-muted/10 rounded-md border p-2">
            {isLoading ? (
                <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : items.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground">No {resourceType} found for this course.</div>
            ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                        {items.map((item, index) => (
                            <SortableListItem key={item.id} item={item} index={index} />
                        ))}
                    </SortableContext>
                </DndContext>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
