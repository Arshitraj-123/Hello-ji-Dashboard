import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { BookingTable } from "@/components/BookingTable";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { authFetch } from "@/lib/auth";
import type { Booking } from "@/types/booking";
import { AlertCircle, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/queries/")({
  head: () => ({
    meta: [
      { title: "All Queries | Helloji Booking Desk" },
      {
        name: "description",
        content:
          "Active travel enquiry pipeline: new queries and in-progress leads with agent assignment and status control.",
      },
      { property: "og:title", content: "All Queries | Helloji Booking Desk" },
      {
        property: "og:description",
        content:
          "Active travel enquiry pipeline with agent assignment and status control.",
      },
    ],
  }),
  component: AllQueries,
});

function AllQueries() {
  const [rows, setRows] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQueries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/queries?limit=100");
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to load enquiries");
      }
      const data = await res.json();
      setRows(data.data || []);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueries();
  }, [fetchQueries]);

  return (
    <DashboardShell
      title="All Queries"
      subtitle="Active enquiries that are not yet confirmed, booked or aborted."
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchQueries}
            disabled={loading}
          >
            <RefreshCw className={`size-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button asChild>
            <Link to="/queries/new">New Query</Link>
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
          <Button variant="outline" size="sm" onClick={fetchQueries}>
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
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      ) : (
        <BookingTable
          rows={rows}
          variant="all-queries"
          onRefresh={fetchQueries}
        />
      )}
    </DashboardShell>
  );
}
