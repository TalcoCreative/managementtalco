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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {columns.map((column) => (
        <div
          key={column.id}
          className="space-y-4"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, column.id)}
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm uppercase text-muted-foreground">
              {column.title}
            </h3>
            <span className="text-xs text-muted-foreground">
              {getItemsByStatus(column.id).length}
            </span>
          </div>
          <div className="space-y-3">
            {getItemsByStatus(column.id).map((item) => (
              <Card
                key={item.id}
                draggable
                onMouseDown={handleMouseDown}
                onDragStart={(e) => handleDragStart(e, item.id)}
                onDragEnd={handleDragEnd}
                onClick={(e) => handleCardClick(e, item)}
                className={`cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] ${getCardColor ? getCardColor(item) : ""}`}
              >
                <CardContent className="p-4">
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
