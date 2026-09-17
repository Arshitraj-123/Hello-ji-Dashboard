import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { BookingTable } from "@/components/BookingTable";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { authFetch } from "@/lib/auth";
import type { Booking } from "@/types/booking";
import { cn } from "@/lib/utils";
import { AlertCircle, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/confirmed")({
  head: () => ({
    meta: [
      { title: "Confirmed Queries | Helloji Booking Desk" },
      {
        name: "description",
        content:
          "Confirmed travel enquiries ready to be converted into full hotel, ticket, package, visa or insurance bookings.",
      },
      { property: "og:title", content: "Confirmed Queries | Helloji Booking Desk" },
      {
        property: "og:description",
        content: "Confirmed enquiries ready to convert into bookings.",
      },
    ],
  }),
  component: Confirmed,
});

const FILTERS = [
  { key: "today", label: "Today" },
  { key: "last_7_days", label: "Last 7 days" },
  { key: "last_30_days", label: "Last 30 days" },
  { key: "all", label: "All" },
] as const;

function Confirmed() {
  const [filter, setFilter] = useState<string>("all");
  const [rows, setRows] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfirmed = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/api/bookings/confirmed?filter=${filter}&limit=100`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to load confirmed enquiries");
      }
      const data = await res.json();
      setRows(data.data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load confirmed enquiries");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchConfirmed();
  }, [fetchConfirmed]);

  return (
    <DashboardShell
      title="Confirmed Queries"
      subtitle="Enquiries the customer has confirmed — convert them into a full booking."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={filter === f.key ? "default" : "outline"}
              className={cn(filter === f.key && "shadow-sm")}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchConfirmed}
            disabled={loading}
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
          <Button variant="outline" size="sm" onClick={fetchConfirmed}>
            Retry
          </Button>
        </div>
      )}

      {loading ? (
        <div className="card-surface p-6 space-y-4">
          <div className="flex gap-4">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-10 w-44" />
          </div>
          <div className="space-y-3 pt-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      ) : (
        <BookingTable
          rows={rows}
          onRefresh={fetchConfirmed}
          exportFilename="confirmed-queries"
          exportTitle="Confirmed Queries"
        />
      )}
    </DashboardShell>
  );
}
