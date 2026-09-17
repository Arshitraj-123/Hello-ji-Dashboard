import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  FileText,
  CheckCircle,
  ExternalLink,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { ExportToolbar } from "@/components/shared/ExportToolbar";
import type { ExportColumn } from "@/lib/export";
import { PRODUCT_COLORS, getProductColor } from "@/lib/productColors";
import { authFetch, getUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

const calendarExportColumns: ExportColumn<CalendarEvent>[] = [
  { header: "Booking ID", key: "bookingId" },
  { header: "Guest Name", key: "name" },
  {
    header: "Product",
    key: "product",
    formatter: (val) => (val ? String(val).toUpperCase() : ""),
  },
  { header: "Status", key: "status" },
  {
    header: "Start Date",
    key: "startDate",
    formatter: (val, item) => val || item.start || "",
  },
  {
    header: "End Date",
    key: "endDate",
    formatter: (val, item) => val || item.end || "",
  },
  {
    header: "Property / Details",
    key: "propertyName",
    formatter: (val) => val || "—",
  },
  {
    header: "Agent",
    key: "assignedAgent",
    formatter: (val) => val || "Unassigned",
  },
];

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "Booking Calendar | Helloji Booking Desk" },
      {
        name: "description",
        content:
          "Month view of check-ins and travel dates across all Helloji bookings, with guest and property details on click.",
      },
      {
        property: "og:title",
        content: "Booking Calendar | Helloji Booking Desk",
      },
      {
        property: "og:description",
        content: "Month view of check-ins and travel dates across all bookings.",
      },
    ],
  }),
  component: CalendarPage,
});

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  name: string;
  bookingId: string;
  product: string;
  status: string;
  startDate: string;
  endDate: string;
  city?: string;
  propertyName?: string;
  hotelConfirmationNo?: string;
  roomType?: string;
  mealPlan?: string;
  assignedAgent?: string;
  hasNotes?: boolean;
  extendedProps?: {
    bookingId?: string;
    hotelConfirmationNo?: string;
    propertyName?: string;
    roomType?: string;
    hasNotes?: boolean;
    status?: string;
    product?: string;
    assignedAgent?: string;
  };
}

function CalendarPage() {
  const [cursor, setCursor] = useState(() => new Date());
  const [showAll, setShowAll] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentUser = getUser();
  const canAccessFullView =
    currentUser?.role === "admin" ||
    currentUser?.permissions?.includes("booking.viewAll");

  // Calculate start & end of the displayed month (including boundary days for calendar cells)
  const { monthStartStr, monthEndStr } = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const format = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;

    return {
      monthStartStr: format(firstDay),
      monthEndStr: format(lastDay),
    };
  }, [cursor]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = showAll
        ? `/api/bookings/calendar/full?start=${monthStartStr}&end=${monthEndStr}`
        : `/api/bookings/calendar?start=${monthStartStr}&end=${monthEndStr}`;

      const res = await authFetch(endpoint);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to load calendar events");
      }
      const data = await res.json();
      setEvents(data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load calendar events");
    } finally {
      setLoading(false);
    }
  }, [showAll, monthStartStr, monthEndStr]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(
      cursor.getFullYear(),
      cursor.getMonth() + 1,
      0
    ).getDate();
    const out: (string | null)[] = Array(offset).fill(null);
    for (let i = 1; i <= daysInMonth; i++) {
      out.push(
        `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(
          2,
          "0"
        )}-${String(i).padStart(2, "0")}`
      );
    }
    return out;
  }, [cursor]);

  const monthLabel = cursor.toLocaleString("en-GB", {
    month: "long",
    year: "numeric",
  });
  const shift = (n: number) =>
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));

  const activeProducts = useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => {
      if (e.product) set.add(e.product.toLowerCase().trim());
    });
    if (set.size === 0) return ["hotel", "ticket", "package", "visa", "insurance"];
    return Array.from(set);
  }, [events]);

  return (
    <DashboardShell
      title="Booking Calendar"
      subtitle="Check-ins and travel dates at a glance."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <ExportToolbar
            data={events}
            columns={calendarExportColumns}
            filename={`calendar-${monthLabel.toLowerCase().replace(/\s+/g, "-")}`}
            title={`Booking Calendar - ${monthLabel}`}
          />
          <Button
            size="sm"
            variant={showAll ? "outline" : "default"}
            onClick={() => setShowAll(false)}
          >
            My Bookings
          </Button>
          {canAccessFullView ? (
            <Button
              size="sm"
              variant={showAll ? "default" : "outline"}
              onClick={() => setShowAll(true)}
            >
              Full Company View
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled
              title="Full cross-agent calendar requires Admin or booking.viewAll permission"
            >
              Full Company View (Admin)
            </Button>
          )}
          <Button
            size="icon"
            variant="outline"
            onClick={fetchEvents}
            disabled={loading}
            title="Refresh calendar"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      }
    >
      {error && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={fetchEvents}>
            Retry
          </Button>
        </div>
      )}

      <div className="card-surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-base font-semibold">{monthLabel}</h2>
          <div className="flex gap-2">
            <Button
              size="icon"
              variant="outline"
              onClick={() => shift(-1)}
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCursor(new Date())}
            >
              Today
            </Button>
            <Button
              size="icon"
              variant="outline"
              onClick={() => shift(1)}
              aria-label="Next month"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        {/* Product Color Legend Strip */}
        <div className="flex flex-wrap items-center gap-4 border-b border-border bg-muted/30 px-4 py-2 text-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Legend:
          </span>
          {activeProducts.map((p) => {
            const info = getProductColor(p);
            return (
              <div key={p} className="flex items-center gap-1.5">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: info.hex }}
                />
                <span className="font-medium text-foreground capitalize">
                  {info.label}
                </span>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-7 border-b border-border bg-muted/60 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {DAYS.map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-7 gap-2 p-4">
            {[...Array(35)].map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {cells.map((date, i) => {
              // Match events where startDate equals date or date falls within [startDate, endDate]
              const dayEvents = date
                ? events.filter((e) => {
                    const start = e.startDate || e.start;
                    const end = e.endDate || e.end || start;
                    if (!start) return false;
                    return date >= start && date <= end;
                  })
                : [];

              const isToday = date === new Date().toISOString().slice(0, 10);
              return (
                <div
                  key={i}
                  className={cn(
                    "min-h-28 border-b border-r border-border p-2 text-xs",
                    !date && "bg-muted/30",
                    isToday && "bg-accent/40",
                  )}
                >
                  {date && (
                    <p className="mb-1 font-medium text-muted-foreground">
                      {Number(date.slice(-2))}
                    </p>
                  )}
                  <div className="space-y-1">
                    {dayEvents.map((e) => {
                      const pInfo = getProductColor(e.product);
                      return (
                        <button
                          key={e.id}
                          onClick={() => setSelected(e)}
                          className={cn(
                            "block w-full truncate rounded border px-1.5 py-1 text-left font-medium transition-all hover:opacity-90",
                            pInfo.bg,
                            pInfo.text,
                            pInfo.border,
                          )}
                          title={`${e.bookingId} - ${e.name} (${pInfo.label})`}
                        >
                          <span className="truncate">{e.name}</span>
                          {e.hasNotes && (
                            <span
                              className="ml-1 inline-block size-1.5 rounded-full"
                              style={{ backgroundColor: pInfo.hex }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Click-to-detail Modal Dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-start justify-between gap-3 pr-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <DialogTitle className="font-display text-lg font-bold">
                        {selected.name}
                      </DialogTitle>
                      {selected.hasNotes && (
                        <span className="flex items-center gap-1 rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground">
                          <CheckCircle className="size-3" /> Notes
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {selected.bookingId} ·{" "}
                      <span className="capitalize">{selected.product}</span>
                      {selected.city ? ` · ${selected.city}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={selected.status as any} />
                </div>
              </DialogHeader>

              <div className="py-2">
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border border-border bg-muted/30 p-2.5">
                    <dt className="text-xs text-muted-foreground">
                      Check-in / Start
                    </dt>
                    <dd className="mt-0.5 font-medium">
                      {selected.startDate || selected.start || "—"}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-2.5">
                    <dt className="text-xs text-muted-foreground">
                      Check-out / End
                    </dt>
                    <dd className="mt-0.5 font-medium">
                      {selected.endDate || selected.end || "—"}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-2.5">
                    <dt className="text-xs text-muted-foreground">
                      Product Type
                    </dt>
                    <dd className="mt-0.5 font-medium capitalize">
                      {selected.product || "—"}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-2.5">
                    <dt className="text-xs text-muted-foreground">
                      Assigned Agent
                    </dt>
                    <dd className="mt-0.5 font-medium">
                      {selected.assignedAgent || "Unassigned"}
                    </dd>
                  </div>
                  {selected.propertyName && (
                    <div className="col-span-2 rounded-lg border border-border bg-muted/30 p-2.5">
                      <dt className="text-xs text-muted-foreground">
                        Property / Details
                      </dt>
                      <dd className="mt-0.5 font-medium">
                        {selected.propertyName}
                      </dd>
                    </div>
                  )}
                  {selected.hotelConfirmationNo && (
                    <div className="rounded-lg border border-border bg-muted/30 p-2.5">
                      <dt className="text-xs text-muted-foreground">
                        Confirmation / PNR
                      </dt>
                      <dd className="mt-0.5 font-medium">
                        {selected.hotelConfirmationNo}
                      </dd>
                    </div>
                  )}
                  {selected.roomType && (
                    <div className="rounded-lg border border-border bg-muted/30 p-2.5">
                      <dt className="text-xs text-muted-foreground">
                        Room Type
                      </dt>
                      <dd className="mt-0.5 font-medium">{selected.roomType}</dd>
                    </div>
                  )}
                  {selected.mealPlan && (
                    <div className="rounded-lg border border-border bg-muted/30 p-2.5">
                      <dt className="text-xs text-muted-foreground">
                        Meal Plan
                      </dt>
                      <dd className="mt-0.5 font-medium">{selected.mealPlan}</dd>
                    </div>
                  )}
                </dl>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <div className="flex w-full items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {selected.status === "booked" && (
                      <Button asChild size="sm" variant="default">
                        <Link
                          to="/bookings/$id/voucher"
                          params={{ id: selected.id }}
                        >
                          <FileText className="size-3.5 mr-1" /> View Voucher
                        </Link>
                      </Button>
                    )}
                    <Button asChild size="sm" variant="outline">
                      <Link to="/queries/$id" params={{ id: selected.id }}>
                        <ExternalLink className="size-3.5 mr-1" /> View Details
                      </Link>
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelected(null)}
                  >
                    Close
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
