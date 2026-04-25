/**
 * ExamSortableList - Wraps DraggableSortList for exam reordering.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DraggableSortList, SortableItem } from "./DraggableSortList";

interface ExamSortableListProps {
  exams: any[];
  onClose: () => void;
  sortColumn?: "sort_order" | "archive_sort_order" | "readymade_sort_order" | "free_sort_order";
}

export function ExamSortableList({
  exams: initialExams,
  onClose,
  sortColumn = "sort_order",
}: ExamSortableListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const items: SortableItem[] = initialExams.map((exam) => ({
    id: exam.id,
    title: exam.title,
    subtitle: `${exam.exam_type || ""} • ${exam.duration_minutes || 0} min`,
  }));

  const saveOrderMutation = useMutation({
    mutationFn: async (ordered: SortableItem[]) => {
      for (let i = 0; i < ordered.length; i++) {
        const { error } = await supabase
          .from("exams")
          .update({ [sortColumn]: ordered.length - i })
          .eq("id", ordered[i].id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Exam order saved!" });
      queryClient.invalidateQueries({ queryKey: ["admin-exams"] });
      queryClient.invalidateQueries({ queryKey: ["course-exams"] });
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save order", description: err.message, variant: "destructive" });
    },
  });

  return (
    <DraggableSortList
      items={items}
      onSave={(ordered) => saveOrderMutation.mutateAsync(ordered)}
      onCancel={onClose}
      title="Reorder Exams"
      description="Drag to reorder. Top = higher priority. Save when done."
    />
  );
}
