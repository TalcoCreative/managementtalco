import { Card, CardContent } from "@/components/ui/card";
import { ReactNode, useRef } from "react";
import { GripVertical, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Column {
  id: string;
  title: string;
  color?: string;
}

interface KanbanBoardProps {
  columns: Column[];
  items: any[];
  onStatusChange: (itemId: string, newStatus: string) => void;
  renderCard: (item: any) => ReactNode;
  onCardClick?: (item: any) => void;
  getCardColor?: (item: any) => string;
  onAddItem?: (columnId: string) => void;
}

// Map common column ids to semantic HSL dot colors
const DEFAULT_DOT: Record<string, string> = {
  todo: "hsl(var(--status-pending))",
  pending: "hsl(var(--status-pending))",
  in_progress: "hsl(var(--info))",
  progress: "hsl(var(--info))",
  review: "hsl(var(--status-on-hold))",
  on_hold: "hsl(var(--status-on-hold))",
  completed: "hsl(var(--status-completed))",
  done: "hsl(var(--status-completed))",
};

export function KanbanBoard({
  columns,
  items,
  onStatusChange,
  renderCard,
  onCardClick,
  getCardColor,
  onAddItem,
}: KanbanBoardProps) {
  const isDragging = useRef(false);

  const getItemsByStatus = (status: string) => items.filter((item) => item.status === status);

  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    isDragging.current = true;
    e.dataTransfer.setData("itemId", itemId);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData("itemId");
    if (itemId) onStatusChange(itemId, newStatus);
    isDragging.current = false;
  };
  const handleDragEnd = () => {
    isDragging.current = false;
  };
  const handleCardClick = (item: any) => {
    if (!isDragging.current) onCardClick?.(item);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {columns.map((column) => {
        const colItems = getItemsByStatus(column.id);
        const dot = column.color || DEFAULT_DOT[column.id] || "hsl(var(--muted-foreground))";
        return (
          <div
            key={column.id}
            className="flex flex-col gap-3 rounded-2xl bg-muted/30 p-3 min-h-[200px] transition-colors"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            {/* Column header */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: dot }}
                  aria-hidden
                />
                <h3 className="text-sm font-semibold text-foreground tracking-tight">
                  {column.title}
                </h3>
                <span className="text-xs font-medium text-muted-foreground bg-background/80 rounded-full px-2 py-0.5">
                  {colItems.length}
                </span>
              </div>
              {onAddItem && (
                <button
                  type="button"
                  onClick={() => onAddItem(column.id)}
                  className="text-muted-foreground hover:text-foreground transition-colors rounded-md p-1 hover:bg-background/80"
                  aria-label={`Add to ${column.title}`}
                >
                  <Plus className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-2.5">
              {colItems.map((item) => (
                <Card
                  key={item.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item.id)}
                  onDragEnd={handleDragEnd}
                  onClick={() => handleCardClick(item)}
                  className={cn(
                    "group relative cursor-grab active:cursor-grabbing rounded-xl border border-border/40 bg-card hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200",
                    getCardColor?.(item),
                  )}
                >
                  <span className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground">
                    <GripVertical className="h-4 w-4" />
                  </span>
                  <CardContent className="p-3.5">{renderCard(item)}</CardContent>
                </Card>
              ))}
              {colItems.length === 0 && (
                <div className="text-xs text-muted-foreground/60 italic text-center py-6">
                  No items
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
