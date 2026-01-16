import { Card, CardContent } from "@/components/ui/card";
import { ReactNode, useRef } from "react";

interface Column {
  id: string;
  title: string;
}

interface KanbanBoardProps {
  columns: Column[];
  items: any[];
  onStatusChange: (itemId: string, newStatus: string) => void;
  renderCard: (item: any) => ReactNode;
  onCardClick?: (item: any) => void;
  getCardColor?: (item: any) => string;
}

export function KanbanBoard({ columns, items, onStatusChange, renderCard, onCardClick, getCardColor }: KanbanBoardProps) {
  const isDragging = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0 });

  const getItemsByStatus = (status: string) => {
    return items.filter((item) => item.status === status);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    isDragging.current = false;
  };

  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    isDragging.current = true;
    e.dataTransfer.setData("itemId", itemId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData("itemId");
    onStatusChange(itemId, newStatus);
    isDragging.current = false;
  };

  const handleDragEnd = () => {
    isDragging.current = false;
  };

  const handleCardClick = (e: React.MouseEvent, item: any) => {
    // Only trigger click if not dragging
    if (!isDragging.current) {
      onCardClick?.(item);
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {columns.map((column) => (
        <div
          key={column.id}
          className="space-y-3 sm:space-y-4"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, column.id)}
        >
          <div className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2 sm:bg-transparent sm:px-0 sm:py-0">
            <h3 className="font-semibold text-sm uppercase text-muted-foreground">
              {column.title}
            </h3>
            <span className="text-xs bg-muted rounded-full px-2 py-0.5 text-muted-foreground">
              {getItemsByStatus(column.id).length}
            </span>
          </div>
          <div className="space-y-2 sm:space-y-3">
            {getItemsByStatus(column.id).map((item) => (
              <Card
                key={item.id}
                draggable
                onMouseDown={handleMouseDown}
                onDragStart={(e) => handleDragStart(e, item.id)}
                onDragEnd={handleDragEnd}
                onClick={(e) => handleCardClick(e, item)}
                className={`cursor-pointer hover:shadow-lg transition-all active:scale-[0.98] sm:hover:scale-[1.02] ${getCardColor ? getCardColor(item) : ""}`}
              >
                <CardContent className="p-3 sm:p-4">
                  {renderCard(item)}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
