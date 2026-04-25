/**
 * DraggableSortList - A scroll-safe drag-and-drop list using @atlaskit/pragmatic-drag-and-drop
 * Supports per-course and per-chapter sorting for classes and exams.
 */
import { useEffect, useRef, useState } from "react";
import { draggable, dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";

import { extractClosestEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { reorderWithEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/util/reorder-with-edge";
import { GripVertical, Save, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface SortableItem {
  id: string;
  title: string;
  subtitle?: string;
}

interface DraggableSortListProps {
  items: SortableItem[];
  onSave: (orderedItems: SortableItem[]) => Promise<void>;
  onCancel: () => void;
  title?: string;
  description?: string;
}

type DragState = "idle" | "dragging-over";

function DraggableRow({
  item,
  index,
  onDragStart,
}: {
  item: SortableItem;
  index: number;
  onDragStart: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<DragState>("idle");

  useEffect(() => {
    const el = ref.current;
    const handle = dragHandleRef.current;
    if (!el || !handle) return;

    return combine(
      draggable({
        element: el,
        dragHandle: handle,
        getInitialData: () => ({ id: item.id, index }),
        onDragStart: () => {
          setState("dragging-over");
          onDragStart();
        },
        onDrop: () => setState("idle"),
      }),
      dropTargetForElements({
        element: el,
        getData: ({ input, element }) => {
          const closestEdge = extractClosestEdge(input, element as HTMLElement, ["top", "bottom"]);
          return { id: item.id, index, closestEdge };
        },
        onDragEnter: () => setState("dragging-over"),
        onDragLeave: () => setState("idle"),
        onDrop: () => setState("idle"),
      })
    );
  }, [item.id, index, onDragStart]);

  return (
    <div
      ref={ref}
      className={`flex items-center gap-3 p-3 border rounded-md bg-card mb-2 w-full transition-all duration-150 ${
        state === "dragging-over"
          ? "border-primary/60 bg-primary/5 shadow-md"
          : "border-border/60"
      }`}
    >
      <div
        ref={dragHandleRef}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none shrink-0"
      >
        <GripVertical className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0 overflow-hidden">
        <p className="font-medium truncate">{item.title}</p>
        {item.subtitle && (
          <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
        )}
      </div>
      <div className="text-xs text-muted-foreground shrink-0 font-mono bg-muted/40 px-1.5 py-0.5 rounded">
        #{index + 1}
      </div>
    </div>
  );
}

export function DraggableSortList({
  items: initialItems,
  onSave,
  onCancel,
  title = "Reorder Items",
  description = "Drag and drop to change order.",
}: DraggableSortListProps) {
  const [items, setItems] = useState<SortableItem[]>(initialItems);
  const [saving, setSaving] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);



  // Listen to drop events on the list container
  useEffect(() => {
    const container = listRef.current;
    if (!container) return;

    return dropTargetForElements({
      element: container,
      onDrop: ({ source, location }) => {
        if (!location.current.dropTargets.length) return;

        const draggedId = source.data.id as string;
        const target = location.current.dropTargets[0]?.data;

        if (!target || draggedId === target.id) return;

        const fromIndex = items.findIndex((i) => i.id === draggedId);
        const toIndex = items.findIndex((i) => i.id === target.id);

        if (fromIndex === -1 || toIndex === -1) return;

        const edge = (target.closestEdge as "top" | "bottom") ?? "bottom";

        setItems((prev) =>
          reorderWithEdge({
            list: prev,
            startIndex: fromIndex,
            indexOfTarget: toIndex,
            closestEdgeOfTarget: edge,
            axis: "vertical",
          })
        );
      },
    });
  }, [items]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(items);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 border rounded-lg p-4 bg-muted/20 w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold truncate">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>
            <X className="h-4 w-4 mr-2" /> Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {saving ? "Saving..." : "Save Order"}
          </Button>
        </div>
      </div>

      <div ref={listRef} className="max-h-[65vh] overflow-y-auto pr-1 space-y-0">
        {items.map((item, index) => (
          <DraggableRow
            key={item.id}
            item={item}
            index={index}
            onDragStart={() => {}}
          />
        ))}
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No items to sort.</p>
        )}
      </div>
    </div>
  );
}
