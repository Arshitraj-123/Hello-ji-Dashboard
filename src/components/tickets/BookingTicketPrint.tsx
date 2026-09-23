import { useRef, useState } from "react";
import { Printer, Download, ArrowLeft, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { BookingTicket } from "@/types/bookingTicket";
import {
  HELLOJI_LOGO_DATA_URI,
  INCREDIBLE_INDIA_LOGO_DATA_URI,
} from "@/components/vouchers/voucherLogos";

export function BookingTicketPrint({
  ticket,
  onBack,
}: {
  ticket: BookingTicket;
  onBack?: () => void;
}) {
  const printSheetRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const formattedDate = ticket.date
    ? format(new Date(ticket.date), "dd-MMM-yyyy")
    : "N/A";

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!printSheetRef.current) return;
    setDownloading(true);
    try {
      const element = printSheetRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Booking-Ticket-${ticket.btId || "BT"}.pdf`);
      toast.success("Ticket downloaded successfully!");
    } catch (err) {
      console.error("PDF download error:", err);
      toast.error("Failed to generate PDF");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top action bar - Hidden during print */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        {onBack && (
          <Button variant="outline" size="sm" onClick={onBack} className="gap-2">
            <ArrowLeft className="size-4" />
            Back
          </Button>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="gap-2"
          >
            {downloading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Download PDF
          </Button>
          <Button size="sm" onClick={handlePrint} className="gap-2 bg-red-600 hover:bg-red-700 text-white">
            <Printer className="size-4" />
            Print Ticket
          </Button>
        </div>
      </div>

      {/* Printable Sheet */}
      <div className="flex justify-center">
        <div
          ref={printSheetRef}
          id="booking-ticket-sheet"
          className="w-full max-w-[820px] bg-white text-black p-6 sm:p-10 shadow-sm border border-slate-200 rounded-md print:shadow-none print:border-none print:p-4 print:max-w-none"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          {/* ── Official Letterhead Header (Copied from Voucher part) ── */}
          <header className="mb-6">
            <div className="flex items-center justify-between pb-4">
              <div className="flex items-center">
                <img
                  src={HELLOJI_LOGO_DATA_URI}
                  alt="Helloji.com - book here go anywhere"
                  className="h-12 w-auto max-h-12 object-contain sm:h-14 sm:max-h-14"
                />
              </div>
              <div className="flex items-center justify-end">
                <img
                  src={INCREDIBLE_INDIA_LOGO_DATA_URI}
                  alt="Incredible India - Ministry of Tourism"
                  className="h-10 w-auto max-h-10 object-contain sm:h-12 sm:max-h-12"
                />
              </div>
            </div>

            <div className="w-full border-b border-[#cbd5e1] mb-6" />

            {/* Document Title matching Images 1 & 4 */}
            <h1
              className="text-2xl sm:text-3xl font-bold text-center text-[#263238] tracking-tight mb-6"
              style={{ fontFamily: "'Archivo', sans-serif" }}
            >
              Helloji - Booking Ticket
            </h1>
          </header>

          {/* ── 2-Column Details Table matching Images 1 & 4 ── */}
          <div className="overflow-hidden border border-black rounded-none">
            <table className="w-full border-collapse text-left text-sm sm:text-base">
              <tbody className="divide-y divide-black">
                <tr>
                  <th className="w-[32%] sm:w-[28%] px-4 py-3 font-bold text-black border-r border-black bg-slate-50/50">
                    BT ID
                  </th>
                  <td className="px-4 py-3 text-black font-medium">{ticket.btId || "—"}</td>
                </tr>
                <tr>
                  <th className="px-4 py-3 font-bold text-black border-r border-black bg-slate-50/50">
                    Date
                  </th>
                  <td className="px-4 py-3 text-black">{formattedDate}</td>
                </tr>
                <tr>
                  <th className="px-4 py-3 font-bold text-black border-r border-black bg-slate-50/50">
                    Guest Name
                  </th>
                  <td className="px-4 py-3 text-black font-medium uppercase">{ticket.guestName || "—"}</td>
                </tr>
                <tr>
                  <th className="px-4 py-3 font-bold text-black border-r border-black bg-slate-50/50">
                    Created By
                  </th>
                  <td className="px-4 py-3 text-black">{ticket.createdBy || "—"}</td>
                </tr>
                <tr>
                  <th className="px-4 py-3 font-bold text-black border-r border-black bg-slate-50/50">
                    Sale By
                  </th>
                  <td className="px-4 py-3 text-black">{ticket.saleBy || "—"}</td>
                </tr>
                <tr>
                  <th className="px-4 py-3 font-bold text-black border-r border-black bg-slate-50/50">
                    Approved By
                  </th>
                  <td className="px-4 py-3 text-black">
                    {ticket.status === "approved"
                      ? ticket.approvedBy || "Approved"
                      : "Unapproved"}
                  </td>
                </tr>
                <tr>
                  <th className="px-4 py-3 font-bold text-black border-r border-black bg-slate-50/50">
                    SP
                  </th>
                  <td className="px-4 py-3 text-black">{ticket.sp || ""}</td>
                </tr>
                <tr>
                  <th className="px-4 py-3 font-bold text-black border-r border-black bg-slate-50/50">
                    Product
                  </th>
                  <td className="px-4 py-3 text-black capitalize">{ticket.product || "Ticket"}</td>
                </tr>
                <tr>
                  <th className="px-4 py-3 font-bold text-black border-r border-black bg-slate-50/50 align-top">
                    Detail
                  </th>
                  <td className="px-4 py-3 text-black whitespace-pre-wrap">{ticket.detail || "—"}</td>
                </tr>
                <tr>
                  <th className="px-4 py-3 font-bold text-black border-r border-black bg-slate-50/50">
                    Remark
                  </th>
                  <td className="px-4 py-3 text-black">{ticket.remark || "N/A"}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ── Generated Note matching Image 1 ── */}
          <div className="py-5 text-center">
            <p className="text-xs text-slate-600 font-medium">
              Generated by Helloji Admin Dashboard
            </p>
          </div>

          {/* ── Official Letterhead Footer (Copied from Voucher part) ── */}
          <footer className="mt-4 border-t border-[#cbd5e1] pt-5 text-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
              {/* Left: Red service categories row */}
              <div className="text-[11px] font-bold text-[#d32f2f] tracking-wide self-start sm:self-end pb-1">
                Flights | Hotels | Holidays | Cruises | MICE | Cabs
              </div>

              {/* Right: Stacked company details */}
              <div className="text-right text-[10.5px] leading-relaxed text-[#334155]">
                <p className="text-xs font-bold text-[#d32f2f]">Helloji.com</p>
                <p className="text-[#475569]">WA-89, Shakarpur, Delhi - 110092 India</p>
                <p className="text-[#475569]">
                  Contact@helloji.com |{" "}
                  <span className="text-[#0284c7] underline">www.helloji.com</span>
                </p>
                <p className="text-[#475569]">Contact: +91-11-42720272 | +91-9356444000</p>
                <p className="text-[#475569] font-medium mt-0.5">
                  Our Branches: Delhi | Chandigarh | Jammu | Faridabad | Vadodara | Sirsa
                </p>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
