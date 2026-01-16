import { Card, CardContent } from "@/components/ui/card";
import { ReactNode, useRef, useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";

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

const MIN_COLUMN_WIDTH = 200;
const DEFAULT_COLUMN_WIDTH = 280;

export function KanbanBoard({ columns, items, onStatusChange, renderCard, onCardClick, getCardColor }: KanbanBoardProps) {
  const isDragging = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  
  // Column widths state - stored as percentages or pixels
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    // Try to load from sessionStorage
    try {
      const saved = sessionStorage.getItem('kanban-column-widths');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });
  
  // Resize state
  const [resizing, setResizing] = useState<string | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

  // Save widths to sessionStorage
  useEffect(() => {
    if (Object.keys(columnWidths).length > 0) {
      try {
        sessionStorage.setItem('kanban-column-widths', JSON.stringify(columnWidths));
      } catch {}
    }
  }, [columnWidths]);

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
    if (!isDragging.current) {
      onCardClick?.(item);
    }
  };

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent, columnId: string, currentWidth: number) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing(columnId);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = currentWidth;
  }, []);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizing) return;
    
    const delta = e.clientX - resizeStartX.current;
    const newWidth = Math.max(MIN_COLUMN_WIDTH, resizeStartWidth.current + delta);
    
    setColumnWidths(prev => ({
      ...prev,
      [resizing]: newWidth
    }));
  }, [resizing]);

  const handleResizeEnd = useCallback(() => {
    setResizing(null);
  }, []);

  // Add/remove mouse event listeners for resize
  useEffect(() => {
    if (resizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [resizing, handleResizeMove, handleResizeEnd]);

  const getColumnWidth = (columnId: string) => {
    return columnWidths[columnId] || DEFAULT_COLUMN_WIDTH;
  };

  const resetWidths = () => {
    setColumnWidths({});
    sessionStorage.removeItem('kanban-column-widths');
  };

  return (
    <div className="space-y-2">
      {/* Reset button */}
      {Object.keys(columnWidths).length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={resetWidths}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Reset column widths
          </button>
        </div>
      )}
      
      {/* Kanban columns - horizontal scroll on desktop */}
      <div className="grid grid-cols-1 sm:flex sm:gap-4 gap-3 sm:overflow-x-auto sm:pb-4">
        {columns.map((column, index) => {
          const width = getColumnWidth(column.id);
          const isLastColumn = index === columns.length - 1;
          
          return (
            <div
              key={column.id}
              className="space-y-3 sm:space-y-4 relative group sm:flex-shrink-0"
              style={{ 
                width: typeof window !== 'undefined' && window.innerWidth >= 640 ? `${width}px` : '100%',
                minWidth: MIN_COLUMN_WIDTH 
              }}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              {/* Column header */}
              <div className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2 sm:bg-transparent sm:px-0 sm:py-0">
                <h3 className="font-semibold text-sm uppercase text-muted-foreground">
                  {column.title}
                </h3>
                <span className="text-xs bg-muted rounded-full px-2 py-0.5 text-muted-foreground">
                  {getItemsByStatus(column.id).length}
                </span>
              </div>
              
              {/* Cards container */}
              <div className="space-y-2 sm:space-y-3">
                {getItemsByStatus(column.id).map((item) => (
                  <Card
                    key={item.id}
                    draggable
                    onMouseDown={handleMouseDown}
                    onDragStart={(e) => handleDragStart(e, item.id)}
                    onDragEnd={handleDragEnd}
                    onClick={(e) => handleCardClick(e, item)}
                    className={cn(
                      "cursor-pointer hover:shadow-lg transition-all active:scale-[0.98] sm:hover:scale-[1.02]",
                      getCardColor ? getCardColor(item) : ""
                    )}
                  >
                    <CardContent className="p-3 sm:p-4">
                      {renderCard(item)}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Resize handle - only on desktop, not on last column */}
              {!isLastColumn && (
                <div
                  className="hidden sm:block absolute top-0 right-0 w-1 h-full cursor-col-resize group-hover:bg-primary/20 hover:!bg-primary/40 transition-colors"
                  style={{ transform: 'translateX(8px)' }}
                  onMouseDown={(e) => handleResizeStart(e, column.id, width)}
                >
                  <div className="absolute top-1/2 right-0 transform -translate-y-1/2 translate-x-1/2 w-3 h-8 rounded-full bg-muted opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-0.5 h-4 bg-muted-foreground/50 rounded-full" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
