import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useCallback, useEffect } from "react";
import { ArrowLeft, Download, Printer, Mail, MessageCircle, Loader2 } from "lucide-react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ProductBrochure } from "@/components/vouchers/ProductBrochure";
import { VoucherComposeDialog } from "@/components/vouchers/VoucherComposeDialog";
import { type Booking } from "@/types/booking";
import { getToken } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/bookings/$id/voucher")({
  head: () => ({
    meta: [
      { title: "Voucher Preview | Helloji Booking Desk" },
      {
        name: "description",
        content:
          "Preview, print and download a product-specific Helloji booking voucher.",
      },
      {
        property: "og:title",
        content: "Voucher Preview | Helloji Booking Desk",
      },
      {
        property: "og:description",
        content: "Product-specific Helloji booking voucher preview.",
      },
    ],
  }),
  component: VoucherPage,
});

function VoucherPage() {
  const { id } = Route.useParams();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const brochureRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [composeMode, setComposeMode] = useState<"email" | "whatsapp" | null>(null);

  // Check URL query params for headless service token
  const [isServiceRender, setIsServiceRender] = useState(false);
  const [withHeader, setWithHeader] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const searchParams = new URLSearchParams(window.location.search);
    const serviceToken = searchParams.get("serviceToken");
    const headerParam = searchParams.get("withHeader");

    if (serviceToken) {
      setIsServiceRender(true);
    }
    if (headerParam === "false") {
      setWithHeader(false);
    } else if (headerParam === "true") {
      setWithHeader(true);
    }

    setLoading(true);
    const url = `/api/bookings/${id}${serviceToken ? `?serviceToken=${serviceToken}` : ""}`;
    const headers: Record<string, string> = {};
    if (serviceToken) {
      headers["Authorization"] = `Bearer ${serviceToken}`;
    } else {
      const token = getToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
    }

    fetch(url, { headers })
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || "Failed to load booking voucher");
        }
        return res.json();
      })
      .then((data) => {
        setBooking(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Voucher fetch error:", err);
        setFetchError(err.message);
        setLoading(false);
      });
  }, [id]);


  const download = useCallback(async () => {
    if (!booking) return;

    setDownloading(true);
    try {
      // Attempt direct server PDF download first
      const token = getToken();
      const targetId = booking.id || (booking as any)._id;
      const res = await fetch(
        `/api/bookings/${targetId}/brochure/pdf?withHeader=${withHeader}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${booking.bookingId}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast.success("PDF downloaded");
        setDownloading(false);
        return;
      }
    } catch {
      // Fall through to client html2canvas fallback
    }

    // Client fallback
    const el = brochureRef.current;
    if (!el) {
      setDownloading(false);
      return;
    }

    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      const imgW = canvas.width;
      const imgH = canvas.height;
      const ratio = pdfW / imgW;
      const scaledH = imgH * ratio;

      if (scaledH <= pdfH) {
        pdf.addImage(imgData, "PNG", 0, 0, pdfW, scaledH);
      } else {
        let yOffset = 0;
        while (yOffset < imgH) {
          const sliceH = Math.min(pdfH / ratio, imgH - yOffset);
          const sliceCanvas = document.createElement("canvas");
          sliceCanvas.width = imgW;
          sliceCanvas.height = sliceH;
          const ctx = sliceCanvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(canvas, 0, -yOffset);
            const sliceImg = sliceCanvas.toDataURL("image/png");
            if (yOffset > 0) pdf.addPage();
            pdf.addImage(sliceImg, "PNG", 0, 0, pdfW, sliceH * ratio);
          }
          yOffset += sliceH;
        }
      }

      pdf.save(`${booking!.bookingId}.pdf`);
      toast.success("PDF downloaded");
    } catch {
      toast.error("Failed to generate PDF");
    } finally {
      setDownloading(false);
    }
  }, [booking]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted p-8">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="size-6 animate-spin text-primary" />
          <span className="text-sm font-medium">Loading booking voucher…</span>
        </div>
      </main>
    );
  }

  if (!booking) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-bold">Voucher not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {fetchError || `No booking record with ID "${id}" was found.`}
        </p>
        <Button asChild className="mt-4">
          <Link to="/bookings">Back to bookings</Link>
        </Button>
      </main>
    );
  }

  if (booking.status !== "booked") {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <div className="rounded-lg border border-border bg-card p-6 shadow-xs">
          <h1 className="text-2xl font-bold">Voucher Not Available</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Vouchers can only be generated for booked enquiries. The current status of this enquiry ({booking.bookingId}) is{" "}
            <span className="font-semibold text-foreground">"{booking.status}"</span>.
          </p>
          <div className="mt-6 flex gap-3">
            <Button asChild>
              <Link to="/queries/$id" params={{ id: booking.id || (booking as any)._id }}>
                View Query Details
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/bookings">Go to All Bookings</Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
      <main
        className="min-h-screen bg-muted px-3 py-4 sm:px-6 sm:py-8"
        data-pdf-ready="true"
      >
        {/* Toolbar — hidden during print or headless render */}
        {!isServiceRender && (
          <div className="print-hidden mx-auto mb-4 flex max-w-[850px] flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button asChild variant="outline">
                <Link to="/bookings">
                  <ArrowLeft className="size-4" /> Back
                </Link>
              </Button>

              {/* Header / Footer Toggle */}
              <div className="flex items-center rounded-lg border border-border bg-background p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setWithHeader(true)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-all",
                    withHeader
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  With Header
                </button>
                <button
                  type="button"
                  onClick={() => setWithHeader(false)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-all",
                    !withHeader
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Without Header
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={download} disabled={downloading}>
                {downloading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                {downloading ? "Generating…" : "Download PDF"}
              </Button>
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="size-4" /> Print
              </Button>
              <Button variant="outline" onClick={() => setComposeMode("email")}>
                <Mail className="size-4" /> Email
              </Button>
              <Button onClick={() => setComposeMode("whatsapp")}>
                <MessageCircle className="size-4" /> WhatsApp
              </Button>
            </div>
          </div>
        )}

        {/* Brochure preview */}
        <div
          ref={brochureRef}
          className="mx-auto max-w-[850px] overflow-hidden border border-border shadow-xl print:border-0 print:shadow-none"
        >
          <ProductBrochure booking={booking} showHeader={withHeader} />
        </div>
      </main>

      {/* Compose dialog for Email / WhatsApp */}
      {composeMode && (
        <VoucherComposeDialog
          booking={booking}
          mode={composeMode}
          open={!!composeMode}
          withHeader={withHeader}
          onOpenChange={(open) => {
            if (!open) setComposeMode(null);
          }}
        />
      )}
    </>
  );
}
