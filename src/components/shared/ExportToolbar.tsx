import { useState } from "react";
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { exportToExcel, exportToPdf, type ExportColumn } from "@/lib/export";

export interface ExportToolbarProps<T = any> {
  data: T[];
  columns: ExportColumn<T>[];
  filename: string;
  title: string;
  disabled?: boolean;
}

export function ExportToolbar<T extends Record<string, any>>({
  data,
  columns,
  filename,
  title,
  disabled = false,
}: ExportToolbarProps<T>) {
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);

  const handleExcel = () => {
    if (!data.length) {
      toast.error("No data to export");
      return;
    }
    setExporting("excel");
    try {
      exportToExcel(data, columns, filename);
      toast.success("Excel exported successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to export Excel");
    } finally {
      setExporting(null);
    }
  };

  const handlePdf = () => {
    if (!data.length) {
      toast.error("No data to export");
      return;
    }
    setExporting("pdf");
    try {
      exportToPdf(data, columns, filename, title);
      toast.success("PDF exported successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to export PDF");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant="outline"
        size="sm"
        onClick={handleExcel}
        disabled={disabled || !data.length || exporting !== null}
        className="h-8 gap-1.5 text-xs"
        title="Export current table view to Excel (.xlsx)"
      >
        {exporting === "excel" ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <FileSpreadsheet className="size-3.5 text-emerald-600 dark:text-emerald-400" />
        )}
        <span>Export Excel</span>
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={handlePdf}
        disabled={disabled || !data.length || exporting !== null}
        className="h-8 gap-1.5 text-xs"
        title="Export current table view to PDF (.pdf)"
      >
        {exporting === "pdf" ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <FileText className="size-3.5 text-rose-600 dark:text-rose-400" />
        )}
        <span>Export PDF</span>
      </Button>
    </div>
  );
}
