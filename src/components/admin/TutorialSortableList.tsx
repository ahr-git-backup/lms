import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DraggableSortList, SortableItem } from "./DraggableSortList";

interface TutorialSortableListProps {
  videos: any[];
  onClose: () => void;
}

export function TutorialSortableList({ videos, onClose }: TutorialSortableListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const items: SortableItem[] = videos.map((v) => ({
    id: v.id,
    title: v.caption,
  }));

  const saveOrderMutation = useMutation({
    mutationFn: async (ordered: SortableItem[]) => {
      for (let i = 0; i < ordered.length; i++) {
        const { error } = await supabase
          .from("tutorial_videos")
          .update({ sort_order: i })
          .eq("id", ordered[i].id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Order saved!" });
      queryClient.invalidateQueries({ queryKey: ["admin-tutorial-videos"] });
      queryClient.invalidateQueries({ queryKey: ["tutorial-videos"] });
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
      title="Reorder Tutorial Videos"
      description="Drag items to reorder. Top = first shown. Click Save when done."
    />
  );
}
