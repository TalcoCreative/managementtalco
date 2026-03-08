import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Plus, Table as TableIcon, Trash2, GripVertical, Type, MoveUp, MoveDown } from "lucide-react";

export interface BriefBlock {
  type: "text" | "table";
  content?: string;
  headers?: string[];
  rows?: string[][];
}

export interface BriefData {
  version: 2;
  blocks: BriefBlock[];
}

// Legacy format from EditableTaskTable
interface LegacyTableData {
  headers: string[];
  rows: string[][];
}

function isLegacyFormat(data: any): data is LegacyTableData {
  return data && Array.isArray(data.headers) && Array.isArray(data.rows) && !data.version;
}

export function migrateLegacyData(data: any): BriefData | null {
  if (!data) return null;
  if (data.version === 2) return data as BriefData;
  if (isLegacyFormat(data)) {
    // Check if legacy table has any real content
    const hasContent = data.rows.some((row: string[]) =>
      row.some((cell: string, idx: number) => idx > 0 && cell.trim() !== "")
    );
    if (!hasContent) return null;
    return {
      version: 2,
      blocks: [{ type: "table", headers: data.headers, rows: data.rows }],
    };
  }
  return null;
}

export function briefDataToLegacy(data: BriefData | null): any {
  // Always store as v2 format
  return data;
}

const DEFAULT_TABLE_HEADERS = ["No", "Item", "Keterangan", "Status"];

interface RichBriefEditorProps {
  data: any;
  onChange: (data: BriefData | null) => void;
  readOnly?: boolean;
}

function TableBlockEditor({
  block,
  onChange,
  onRemove,
  readOnly,
}: {
  block: BriefBlock;
  onChange: (b: BriefBlock) => void;
  onRemove: () => void;
  readOnly: boolean;
}) {
  const headers = block.headers || DEFAULT_TABLE_HEADERS;
  const rows = block.rows || [["1", "", "", ""]];

  const updateCell = (rIdx: number, cIdx: number, value: string) => {
    const newRows = rows.map((row, ri) =>
      ri === rIdx ? row.map((cell, ci) => (ci === cIdx ? value : cell)) : row
    );
    onChange({ ...block, rows: newRows });
  };

  const updateHeader = (idx: number, value: string) => {
    if (idx === 0) return;
    const newHeaders = headers.map((h, i) => (i === idx ? value : h));
    onChange({ ...block, headers: newHeaders });
  };

  const addRow = () => {
    const num = String(rows.length + 1);
    const newRow = headers.map((_, i) => (i === 0 ? num : ""));
    onChange({ ...block, rows: [...rows, newRow] });
  };

  const removeRow = (idx: number) => {
    if (rows.length <= 1) return;
    const newRows = rows
      .filter((_, i) => i !== idx)
      .map((row, i) => {
        const r = [...row];
        r[0] = String(i + 1);
        return r;
      });
    onChange({ ...block, rows: newRows });
  };

  return (
    <div className="rounded-lg border bg-muted/30 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
          <TableIcon className="h-3.5 w-3.5" />
          Table
        </div>
        {!readOnly && (
          <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40">
              {headers.map((header, idx) => (
                <th key={idx} className={`border-b border-r last:border-r-0 px-2 py-1.5 text-left font-medium ${idx === 0 ? "w-10" : ""}`}>
                  {readOnly || idx === 0 ? (
                    header
                  ) : (
                    <Input
                      value={header}
                      onChange={(e) => updateHeader(idx, e.target.value)}
                      className="h-7 text-xs font-medium border-0 bg-transparent p-0 focus-visible:ring-0"
                    />
                  )}
                </th>
              ))}
              {!readOnly && <th className="w-8 border-b" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-muted/20">
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="border-b border-r last:border-r-0 px-2 py-1">
                    {readOnly || cIdx === 0 ? (
                      <span className={`text-sm ${cIdx === 0 ? "text-muted-foreground" : ""}`}>{cell}</span>
                    ) : (
                      <Input
                        value={cell}
                        onChange={(e) => updateCell(rIdx, cIdx, e.target.value)}
                        className="h-7 text-xs border-0 bg-transparent p-0 focus-visible:ring-0"
                      />
                    )}
                  </td>
                ))}
                {!readOnly && (
                  <td className="border-b px-1 py-1">
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeRow(rIdx)} disabled={rows.length <= 1} className="h-6 w-6 p-0">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <div className="px-3 py-1.5 border-t">
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={addRow}>
            <Plus className="h-3 w-3 mr-1" />
            Add Row
          </Button>
        </div>
      )}
    </div>
  );
}

export function RichBriefEditor({ data, onChange, readOnly = false }: RichBriefEditorProps) {
  const briefData = migrateLegacyData(data);
  const blocks = briefData?.blocks || [];

  const update = useCallback(
    (newBlocks: BriefBlock[]) => {
      if (newBlocks.length === 0) {
        onChange(null);
      } else {
        onChange({ version: 2, blocks: newBlocks });
      }
    },
    [onChange]
  );

  const updateBlock = (idx: number, block: BriefBlock) => {
    const newBlocks = blocks.map((b, i) => (i === idx ? block : b));
    update(newBlocks);
  };

  const removeBlock = (idx: number) => {
    update(blocks.filter((_, i) => i !== idx));
  };

  const moveBlock = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= blocks.length) return;
    const newBlocks = [...blocks];
    [newBlocks[idx], newBlocks[newIdx]] = [newBlocks[newIdx], newBlocks[idx]];
    update(newBlocks);
  };

  const addTextBlock = () => {
    update([...blocks, { type: "text", content: "" }]);
  };

  const addTableBlock = () => {
    update([
      ...blocks,
      {
        type: "table",
        headers: [...DEFAULT_TABLE_HEADERS],
        rows: [["1", "", "", ""]],
      },
    ]);
  };

  // Read-only: render blocks
  if (readOnly) {
    if (blocks.length === 0) {
      return <p className="text-sm text-muted-foreground italic">No brief content</p>;
    }
    return (
      <div className="space-y-3">
        {blocks.map((block, idx) =>
          block.type === "text" ? (
            <p key={idx} className="text-sm whitespace-pre-wrap">
              {block.content || ""}
            </p>
          ) : (
            <TableBlockEditor key={idx} block={block} onChange={() => {}} onRemove={() => {}} readOnly />
          )
        )}
      </div>
    );
  }

  // Editable
  return (
    <div className="space-y-3">
      {blocks.map((block, idx) => (
        <div key={idx} className="relative group">
          {blocks.length > 1 && (
            <div className="absolute -left-8 top-1 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button type="button" variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => moveBlock(idx, -1)} disabled={idx === 0}>
                <MoveUp className="h-3 w-3" />
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => moveBlock(idx, 1)} disabled={idx === blocks.length - 1}>
                <MoveDown className="h-3 w-3" />
              </Button>
            </div>
          )}
          {block.type === "text" ? (
            <div className="relative">
              <Textarea
                value={block.content || ""}
                onChange={(e) => updateBlock(idx, { ...block, content: e.target.value })}
                placeholder="Write your brief here..."
                rows={3}
                className="resize-y min-h-[60px]"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute top-1 right-1 h-6 w-6 p-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removeBlock(idx)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <TableBlockEditor
              block={block}
              onChange={(b) => updateBlock(idx, b)}
              onRemove={() => removeBlock(idx)}
              readOnly={false}
            />
          )}
        </div>
      ))}

      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" className="text-xs" onClick={addTextBlock}>
          <Type className="h-3.5 w-3.5 mr-1.5" />
          Add Text
        </Button>
        <Button type="button" variant="outline" size="sm" className="text-xs" onClick={addTableBlock}>
          <TableIcon className="h-3.5 w-3.5 mr-1.5" />
          Add Table
        </Button>
      </div>
    </div>
  );
}
