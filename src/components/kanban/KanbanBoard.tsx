import { Card, CardContent } from "@/components/ui/card";
import { ReactNode } from "react";

interface Column {
  id: string;
  title: string;
}

interface KanbanBoardProps {
  columns: Column[];
  items: any[];
  onStatusChange: (itemId: string, newStatus: string) => void;
  renderCard: (item: any) => ReactNode;
}

export function KanbanBoard({ columns, items, onStatusChange, renderCard }: KanbanBoardProps) {
  const getItemsByStatus = (status: string) => {
    return items.filter((item) => item.status === status);
  };

  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    e.dataTransfer.setData("itemId", itemId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData("itemId");
    onStatusChange(itemId, newStatus);
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
                onDragStart={(e) => handleDragStart(e, item.id)}
                className="cursor-move hover:shadow-md transition-shadow"
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
