import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

interface TableData {
  headers: string[];
  rows: string[][];
}

interface EditableTaskTableProps {
  data: TableData | null;
  onChange: (data: TableData) => void;
  readOnly?: boolean;
}

const DEFAULT_TABLE: TableData = {
  headers: ["No", "Item", "Keterangan", "Status"],
  rows: [["1", "", "", ""]],
};

const MIN_COL_WIDTH = 60;
const DEFAULT_COL_WIDTHS = [50, 150, 200, 100]; // No, Item, Keterangan, Status

export function EditableTaskTable({ data, onChange, readOnly = false }: EditableTaskTableProps) {
  const [tableData, setTableData] = useState<TableData>(data || DEFAULT_TABLE);
  const [columnWidths, setColumnWidths] = useState<number[]>(() => {
    const colCount = (data || DEFAULT_TABLE).headers.length;
    return DEFAULT_COL_WIDTHS.slice(0, colCount);
  });
  
  // Resize state
  const [resizingCol, setResizingCol] = useState<number | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);
  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    if (data) {
      setTableData(data);
      // Adjust column widths if headers changed
      if (data.headers.length !== columnWidths.length) {
        const newWidths = data.headers.map((_, idx) => 
          columnWidths[idx] || DEFAULT_COL_WIDTHS[idx] || 120
        );
        setColumnWidths(newWidths);
      }
    }
  }, [data]);

  const updateAndNotify = (newData: TableData) => {
    setTableData(newData);
    onChange(newData);
  };

  const handleHeaderChange = (index: number, value: string) => {
    if (readOnly || index === 0) return;
    const newHeaders = [...tableData.headers];
    newHeaders[index] = value;
    updateAndNotify({ ...tableData, headers: newHeaders });
  };

  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    if (readOnly) return;
    const newRows = tableData.rows.map((row, rIdx) => {
      if (rIdx === rowIndex) {
        const newRow = [...row];
        newRow[colIndex] = value;
        return newRow;
      }
      return row;
    });
    updateAndNotify({ ...tableData, rows: newRows });
  };

  const addRow = () => {
    if (readOnly) return;
    const newRowNumber = String(tableData.rows.length + 1);
    const newRow = Array(tableData.headers.length).fill("").map((_, i) => i === 0 ? newRowNumber : "");
    updateAndNotify({ ...tableData, rows: [...tableData.rows, newRow] });
  };

  const removeRow = (rowIndex: number) => {
    if (readOnly || tableData.rows.length <= 1) return;
    const newRows = tableData.rows
      .filter((_, idx) => idx !== rowIndex)
      .map((row, idx) => {
        const newRow = [...row];
        newRow[0] = String(idx + 1);
        return newRow;
      });
    updateAndNotify({ ...tableData, rows: newRows });
  };

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent, colIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingCol(colIndex);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = columnWidths[colIndex] || 100;
  }, [columnWidths]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (resizingCol === null) return;
    
    const delta = e.clientX - resizeStartX.current;
    const newWidth = Math.max(MIN_COL_WIDTH, resizeStartWidth.current + delta);
    
    setColumnWidths(prev => {
      const updated = [...prev];
      updated[resizingCol] = newWidth;
      return updated;
    });
  }, [resizingCol]);

  const handleResizeEnd = useCallback(() => {
    setResizingCol(null);
  }, []);

  useEffect(() => {
    if (resizingCol !== null) {
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
  }, [resizingCol, handleResizeMove, handleResizeEnd]);

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto border rounded-lg">
        <table ref={tableRef} className="text-sm" style={{ tableLayout: 'fixed', minWidth: 'max-content' }}>
          <colgroup>
            {columnWidths.map((width, idx) => (
              <col key={idx} style={{ width: `${width}px`, minWidth: `${MIN_COL_WIDTH}px` }} />
            ))}
            {!readOnly && <col style={{ width: '40px' }} />}
          </colgroup>
          <thead>
            <tr className="bg-muted/50">
              {tableData.headers.map((header, idx) => (
                <th 
                  key={idx} 
                  className="p-2 border-b border-r last:border-r-0 text-left relative group"
                  style={{ width: `${columnWidths[idx]}px` }}
                >
                  {idx === 0 ? (
                    <span className="font-medium text-muted-foreground block">No</span>
                  ) : readOnly ? (
                    <span className="font-medium">{header || `Kolom ${idx + 1}`}</span>
                  ) : (
                    <Input
                      value={header}
                      onChange={(e) => handleHeaderChange(idx, e.target.value)}
                      placeholder={`Kolom ${idx + 1}`}
                      className="h-8 text-sm font-medium bg-transparent border-0 p-0 focus-visible:ring-0"
                    />
                  )}
                  {/* Resize handle */}
                  {idx < tableData.headers.length - 1 && (
                    <div
                      className="absolute top-0 right-0 w-1 h-full cursor-col-resize bg-transparent hover:bg-primary/40 transition-colors"
                      style={{ transform: 'translateX(50%)' }}
                      onMouseDown={(e) => handleResizeStart(e, idx)}
                    />
                  )}
                </th>
              ))}
              {!readOnly && <th className="w-10 p-2 border-b"></th>}
            </tr>
          </thead>
          <tbody>
            {tableData.rows.map((row, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-muted/30">
                {row.map((cell, colIdx) => (
                  <td 
                    key={colIdx} 
                    className="p-2 border-b border-r last:border-r-0 align-top"
                    style={{ width: `${columnWidths[colIdx]}px` }}
                  >
                    {colIdx === 0 ? (
                      <span className="text-muted-foreground block text-center">{cell}</span>
                    ) : readOnly ? (
                      <span className="whitespace-pre-wrap break-words">{cell || "-"}</span>
                    ) : (
                      <Textarea
                        value={cell}
                        onChange={(e) => handleCellChange(rowIdx, colIdx, e.target.value)}
                        placeholder="..."
                        rows={1}
                        className="min-h-[32px] text-sm bg-transparent border-0 p-0 resize-none focus-visible:ring-0 overflow-hidden w-full"
                        style={{ height: 'auto' }}
                        onInput={(e) => {
                          const target = e.target as HTMLTextAreaElement;
                          target.style.height = 'auto';
                          target.style.height = target.scrollHeight + 'px';
                        }}
                      />
                    )}
                  </td>
                ))}
                {!readOnly && (
                  <td className="p-2 border-b">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRow(rowIdx)}
                      disabled={tableData.rows.length <= 1}
                      className="h-6 w-6 p-0"
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <Button variant="outline" size="sm" onClick={addRow} className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Tambah Baris
        </Button>
      )}
    </div>
  );
}
