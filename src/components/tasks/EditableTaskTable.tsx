import { useState, useEffect } from "react";
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

export function EditableTaskTable({ data, onChange, readOnly = false }: EditableTaskTableProps) {
  const [tableData, setTableData] = useState<TableData>(data || DEFAULT_TABLE);

  useEffect(() => {
    if (data) {
      setTableData(data);
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

  return (
    <div className="space-y-2">
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col className="w-10" />
            {tableData.headers.slice(1).map((_, idx) => (
              <col key={idx} />
            ))}
            {!readOnly && <col className="w-10" />}
          </colgroup>
          <thead>
            <tr className="bg-muted/50">
              {tableData.headers.map((header, idx) => (
                <th 
                  key={idx} 
                  className={`p-2 border-b border-r last:border-r-0 text-left ${idx === 0 ? 'w-10 text-center' : ''}`}
                >
                  {idx === 0 ? (
                    <span className="font-medium text-muted-foreground">No</span>
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
                    className={`p-2 border-b border-r last:border-r-0 align-top ${colIdx === 0 ? 'w-10 text-center' : ''}`}
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
