import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, Upload, FileSpreadsheet, ChevronDown } from "lucide-react";
import { exportToExcel, downloadTemplate, parseExcelFile } from "@/lib/excel-utils";
import { toast } from "sonner";

interface ExcelActionsProps {
  data: any[];
  columns: { key: string; header: string; example?: string }[];
  filename: string;
  onImport: (data: any[]) => Promise<void>;
  disabled?: boolean;
}

export const ExcelActions = ({
  data,
  columns,
  filename,
  onImport,
  disabled = false,
}: ExcelActionsProps) => {
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    exportToExcel(data, columns, filename);
  };

  const handleDownloadTemplate = () => {
    downloadTemplate(columns, filename);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const parsedData = await parseExcelFile(file, columns);
      
      if (parsedData.length === 0) {
        toast.error("File tidak memiliki data yang valid");
        return;
      }

      await onImport(parsedData);
      toast.success(`${parsedData.length} data berhasil diimport`);
    } catch (error: any) {
      toast.error(error.message || "Gagal mengimport data");
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileChange}
        className="hidden"
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={disabled || isImporting}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Excel
            <ChevronDown className="h-4 w-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export to Excel
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleDownloadTemplate}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Download Template
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleImportClick}>
            <Upload className="h-4 w-4 mr-2" />
            Import from Excel
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};
