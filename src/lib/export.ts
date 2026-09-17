import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export interface ExportColumn<T = any> {
  header: string;
  key: string;
  formatter?: (value: any, item: T) => string | number;
}

/**
 * Exports data to an Excel spreadsheet (.xlsx).
 * Uses the currently-displayed/filtered dataset passed in.
 */
export function exportToExcel<T extends Record<string, any>>(
  data: T[],
  columns: ExportColumn<T>[],
  filename: string,
): void {
  if (!data || data.length === 0) {
    throw new Error("No data available to export");
  }

  const rows = data.map((item) => {
    const row: Record<string, string | number> = {};
    columns.forEach((col) => {
      const rawVal = col.key.includes(".")
        ? col.key.split(".").reduce((acc, part) => acc?.[part], item)
        : item[col.key];
      const formatted = col.formatter
        ? col.formatter(rawVal, item)
        : rawVal ?? "";
      row[col.header] = formatted !== null && formatted !== undefined ? formatted : "";
    });
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows);

  // Auto-fit column widths
  const colWidths = columns.map((col) => {
    const headerLen = col.header.length;
    const maxDataLen = rows.reduce((max, row) => {
      const val = String(row[col.header] ?? "");
      return Math.max(max, val.length);
    }, headerLen);
    return { wch: Math.min(Math.max(maxDataLen + 2, 10), 50) };
  });
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Export");

  const cleanName = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, cleanName);
}

/**
 * Exports data to a formatted PDF table.
 * Uses the currently-displayed/filtered dataset passed in.
 */
export function exportToPdf<T extends Record<string, any>>(
  data: T[],
  columns: ExportColumn<T>[],
  filename: string,
  title: string,
): void {
  if (!data || data.length === 0) {
    throw new Error("No data available to export");
  }

  const orientation = columns.length > 5 ? "landscape" : "portrait";
  const doc = new jsPDF({
    orientation,
    unit: "pt",
    format: "a4",
  });

  // Header Title & Meta
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text(title, 40, 40);

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // slate-500
  const dateStr = new Date().toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  doc.text(`Generated on: ${dateStr} · Total records: ${data.length}`, 40, 56);

  const head = [columns.map((c) => c.header)];
  const body = data.map((item) =>
    columns.map((col) => {
      const rawVal = col.key.includes(".")
        ? col.key.split(".").reduce((acc, part) => acc?.[part], item)
        : item[col.key];
      const formatted = col.formatter
        ? col.formatter(rawVal, item)
        : rawVal ?? "";
      return formatted !== null && formatted !== undefined ? String(formatted) : "";
    }),
  );

  autoTable(doc, {
    head,
    body,
    startY: 68,
    margin: { left: 40, right: 40, bottom: 40 },
    theme: "striped",
    headStyles: {
      fillColor: [192, 57, 43], // #c0392b (Helloji brand red)
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: "bold",
      halign: "left",
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
      cellPadding: 4,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // slate-50
    },
    styles: {
      overflow: "linebreak",
      cellWidth: "auto",
    },
    didDrawPage: (hookData) => {
      // Footer page numbers
      const pageNumber = hookData.pageNumber;
      const totalPages = (doc.internal as any).getNumberOfPages
        ? (doc.internal as any).getNumberOfPages()
        : "";
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      const footerText = `Page ${pageNumber}${totalPages ? ` of ${totalPages}` : ""} · Helloji Travel Desk`;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.text(footerText, pageWidth - 40, pageHeight - 20, { align: "right" });
    },
  });

  const cleanName = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  doc.save(cleanName);
}
