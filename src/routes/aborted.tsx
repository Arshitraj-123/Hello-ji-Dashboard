import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { BookingTable } from "@/components/BookingTable";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { authFetch } from "@/lib/auth";
import type { Booking } from "@/types/booking";
import { AlertCircle, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/aborted")({
  head: () => ({
    meta: [
      { title: "Aborted Queries | Helloji Booking Desk" },
      {
        name: "description",
        content:
          "Enquiries that were dropped or lost, kept for reference and reporting on the Helloji travel desk.",
      },
      {
        property: "og:title",
        content: "Aborted Queries | Helloji Booking Desk",
      },
      {
        property: "og:description",
        content: "Dropped enquiries kept for reference and reporting.",
      },
    ],
  }),
  component: Aborted,
});

function Aborted() {
  const [rows, setRows] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAborted = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/bookings/aborted?limit=100");
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to load aborted records");
      }
      const data = await res.json();
      setRows(data.data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load aborted records");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAborted();
  }, [fetchAborted]);

  return (
    <DashboardShell
      title="All Aborted"
      subtitle="Enquiries that did not convert."
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={fetchAborted}
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
          <Button variant="outline" size="sm" onClick={fetchAborted}>
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
          onRefresh={fetchAborted}
          exportFilename="aborted-queries"
          exportTitle="Aborted Queries"
        />
      )}
    </DashboardShell>
  );
}
