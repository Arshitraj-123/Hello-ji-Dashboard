import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Printer,
  Mail,
  MessageCircle,
  Eye,
  FileText,
  Loader2,
  Check,
  X,
  AlertCircle,
  RefreshCw,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { createRoot } from "react-dom/client";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ExportToolbar } from "@/components/shared/ExportToolbar";
import type { ExportColumn } from "@/lib/export";
import { ProductBrochure } from "@/components/vouchers/ProductBrochure";
import { VoucherComposeDialog } from "@/components/vouchers/VoucherComposeDialog";
import { authFetch } from "@/lib/auth";
import type { Booking } from "@/types/booking";

const bookingExportColumns: ExportColumn<Booking>[] = [
  { header: "Booking ID", key: "bookingId" },
  { header: "Guest Name", key: "name" },
  {
    header: "Product",
    key: "product",
    formatter: (val) => (val ? String(val).toUpperCase() : ""),
  },
  { header: "City", key: "city" },
  { header: "Phone", key: "phone" },
  { header: "Email", key: "email" },
  { header: "Start Date", key: "startDate" },
  { header: "End Date", key: "endDate" },
  {
    header: "Property / Flight",
    key: "propertyName",
    formatter: (val, item) => val || item.airlinePnr || item.city || "",
  },
  {
    header: "Assigned Agent",
    key: "assignedAgent",
    formatter: (val) =>
      typeof val === "object" && val ? val.name : val || "Unassigned",
  },
  {
    header: "Booked On",
    key: "createdAt",
    formatter: (val) => (val ? new Date(val).toLocaleDateString("en-IN") : ""),
  },
];

export const Route = createFileRoute("/bookings/")({
  head: () => ({
    meta: [
      { title: "All Bookings | Helloji Booking Desk" },
      {
        name: "description",
        content:
          "Every confirmed booking with vouchers to download, print, email or send on WhatsApp from the Helloji travel desk.",
      },
      {
        property: "og:title",
        content: "All Bookings | Helloji Booking Desk",
      },
      {
        property: "og:description",
        content:
          "Confirmed bookings with voucher download, print, email and WhatsApp.",
      },
    ],
  }),
  component: Bookings,
});

type ActionState = "idle" | "loading" | "success" | "error";

function Bookings() {
  const [rows, setRows] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Per-row action states: { [bookingId]: { download: "idle"|..., ... } }
  const [actionStates, setActionStates] = useState<
    Record<string, Record<string, ActionState>>
  >({});

  // Compose dialog state
  const [compose, setCompose] = useState<{
    booking: Booking;
    mode: "email" | "whatsapp";
  } | null>(null);

  const [q, setQ] = useState("");
  const [productFilter, setProductFilter] = useState("all");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      const pMatch =
        productFilter === "all" ||
        r.product?.toLowerCase() === productFilter.toLowerCase();
      if (!pMatch) return false;
      if (!term) return true;
      const agentName =
        typeof r.assignedAgent === "object" && r.assignedAgent
          ? r.assignedAgent.name
          : r.assignedAgent || "";
      return [
        r.name,
        r.bookingId,
        r.phone,
        r.email,
        r.city,
        r.product,
        r.propertyName,
        agentName,
      ]
        .filter(Boolean)
        .some((val) => String(val).toLowerCase().includes(term));
    });
  }, [rows, q, productFilter]);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/bookings?limit=100");
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to load bookings");
      }
      const data = await res.json();
      setRows(data.data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const setAction = useCallback(
    (bookingId: string, action: string, state: ActionState) => {
      setActionStates((prev) => ({
        ...prev,
        [bookingId]: { ...prev[bookingId], [action]: state },
      }));
      // Auto-reset success/error after 2s
      if (state === "success" || state === "error") {
        setTimeout(() => {
          setActionStates((prev) => ({
            ...prev,
            [bookingId]: { ...prev[bookingId], [action]: "idle" },
          }));
        }, 2000);
      }
    },
    [],
  );

  const getAction = (bookingId: string, action: string): ActionState =>
    actionStates[bookingId]?.[action] ?? "idle";

  // Hidden render container ref for PDF generation
  const hiddenRef = useRef<HTMLDivElement>(null);

  const handleDownload = useCallback(
    async (booking: Booking) => {
      const targetId = booking.id || (booking as any)._id;
      setAction(targetId, "download", "loading");
      try {
        // Render the brochure into a hidden container
        const container = document.createElement("div");
        container.style.cssText =
          "position:fixed;left:-9999px;top:0;width:850px;background:white;";
        document.body.appendChild(container);

        const root = createRoot(container);
        root.render(<ProductBrochure booking={booking} />);

        // Wait for render
        await new Promise((r) => setTimeout(r, 300));

        const canvas = await html2canvas(container, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
        });

        root.unmount();
        document.body.removeChild(container);

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

        pdf.save(`${booking.bookingId}.pdf`);
        setAction(targetId, "download", "success");
        toast.success(`${booking.bookingId}.pdf downloaded`);
      } catch {
        setAction(targetId, "download", "error");
        toast.error("Failed to generate PDF");
      }
    },
    [setAction],
  );

  const handlePrint = useCallback((booking: Booking) => {
    const targetId = booking.id || (booking as any)._id;
    window.open(`/bookings/${targetId}/voucher`, "_blank");
  }, []);

  return (
    <DashboardShell
      title="All Bookings"
      subtitle="Fully booked records and their vouchers."
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={fetchBookings}
          disabled={loading}
        >
          <RefreshCw className={`size-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      }
    >
      {error && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={fetchBookings}>
            Retry
          </Button>
        </div>
      )}

      {/* Filter & Export Toolbar */}
      <div className="card-surface mb-6 flex flex-wrap items-center gap-3 p-4">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search bookings, guests, phones…"
            className="pl-8"
          />
        </div>
        <Select value={productFilter} onValueChange={setProductFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Product" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All products</SelectItem>
            {["hotel", "ticket", "package", "visa", "insurance", "other"].map(
              (p) => (
                <SelectItem key={p} value={p}>
                  <span className="capitalize">{p}</span>
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-3">
          <ExportToolbar
            data={filtered}
            columns={bookingExportColumns}
            filename="all-bookings"
            title="All Bookings"
          />
          <span className="text-sm text-muted-foreground">
            {filtered.length} booking{filtered.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card-surface space-y-4 p-5">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
              <div className="grid grid-cols-3 gap-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="flex gap-2 pt-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card-surface p-12 text-center text-muted-foreground">
          <p className="text-base font-medium">No bookings found</p>
          <p className="mt-1 text-sm">
            {q || productFilter !== "all"
              ? "Try adjusting your search query or product filter."
              : "No confirmed bookings yet."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filtered.map((b) => {
            const targetId = b.id || (b as any)._id;
            const agentName =
              typeof b.assignedAgent === "object" && b.assignedAgent
                ? b.assignedAgent.name
                : b.assignedAgent || "—";

            return (
              <article key={targetId} className="card-surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-lg font-bold">{b.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {b.bookingId} ·{" "}
                      <span className="capitalize">{b.product}</span> · {b.city}
                    </p>
                  </div>
                  <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium">
                    {b.billingStatus || "Unpaid"}
                  </span>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  <Cell
                    label="Travel"
                    value={
                      b.startDate ? `${b.startDate} → ${b.endDate || "—"}` : "—"
                    }
                  />
                  <Cell
                    label="Guests"
                    value={`${b.noOfAdults || b.adults || "—"} adults · ${
                      b.noOfChildren || b.children || 0
                    } child`}
                  />
                  <Cell label="Agent" value={agentName} />
                  {b.product === "hotel" && (
                    <Cell label="Property" value={b.propertyName ?? "—"} />
                  )}
                  {b.product === "hotel" && (
                    <Cell
                      label="Confirmation"
                      value={b.hotelConfirmationNo ?? "—"}
                    />
                  )}
                  {b.product === "hotel" && (
                    <Cell label="Meal plan" value={b.mealPlan ?? "—"} />
                  )}
                  {b.product === "ticket" && (
                    <Cell label="Airline" value={b.airlineName ?? "—"} />
                  )}
                  {b.product === "ticket" && (
                    <Cell label="Flight" value={b.flightNumber ?? "—"} />
                  )}
                  {b.product === "ticket" && (
                    <Cell label="PNR" value={b.airlinePnr ?? "—"} />
                  )}
                  {b.product === "package" && (
                    <Cell label="Package" value={b.packageName ?? "—"} />
                  )}
                  {b.product === "package" && (
                    <Cell label="Duration" value={b.duration ?? "—"} />
                  )}
                </dl>

                <div className="mt-5 flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="default">
                    <Link to="/bookings/$id/voucher" params={{ id: targetId }}>
                      <FileText className="size-4 mr-1" /> Voucher
                    </Link>
                  </Button>

                  <Button asChild size="sm" variant="outline">
                    <Link to="/queries/$id" params={{ id: targetId }}>
                      <Eye className="size-4 mr-1" /> Details
                    </Link>
                  </Button>

                  <ActionButton
                    state={getAction(targetId, "download")}
                    onClick={() => handleDownload(b)}
                    icon={Download}
                    label="Download"
                  />

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePrint(b)}
                  >
                    <Printer className="size-4 mr-1" /> Print
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCompose({ booking: b, mode: "email" })}
                  >
                    <Mail className="size-4 mr-1" /> Email
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCompose({ booking: b, mode: "whatsapp" })}
                  >
                    <MessageCircle className="size-4 mr-1" /> WhatsApp
                  </Button>
                </div>
              </article>
            );
          })}
          {rows.length === 0 && (
            <p className="text-muted-foreground p-6 card-surface col-span-2 text-center">
              No bookings yet.
            </p>
          )}
        </div>
      )}

      {/* Hidden div for PDF rendering */}
      <div ref={hiddenRef} className="hidden" />

      {/* Compose dialog */}
      {compose && (
        <VoucherComposeDialog
          booking={compose.booking}
          mode={compose.mode}
          open={!!compose}
          onOpenChange={(open) => {
            if (!open) setCompose(null);
          }}
        />
      )}
    </DashboardShell>
  );
}

/* ── Helpers ───────────────────────────────────────────── */

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}

function ActionButton({
  state,
  onClick,
  icon: Icon,
  label,
}: {
  state: ActionState;
  onClick: () => void;
  icon: typeof Download;
  label: string;
}) {
  const isLoading = state === "loading";

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={onClick}
      disabled={isLoading}
    >
      {state === "loading" && <Loader2 className="size-4 animate-spin mr-1" />}
      {state === "success" && <Check className="size-4 text-green-600 mr-1" />}
      {state === "error" && <X className="size-4 text-red-600 mr-1" />}
      {state === "idle" && <Icon className="size-4 mr-1" />}
      {isLoading ? "…" : label}
    </Button>
  );
}
