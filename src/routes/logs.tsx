import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { RefreshCw, AlertCircle, Search, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { authFetch } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { ExportToolbar } from "@/components/shared/ExportToolbar";
import type { ExportColumn } from "@/lib/export";

const logExportColumns: ExportColumn<LogItem>[] = [
  { header: "Timestamp", key: "at" },
  { header: "User", key: "user" },
  { header: "Action", key: "activityType" },
  { header: "Module", key: "tableName" },
  { header: "Record ID", key: "tableId" },
  { header: "Details", key: "changedData" },
  { header: "IP Address", key: "ip" },
];

export const Route = createFileRoute("/logs")({
  head: () => ({
    meta: [
      { title: "Activity Log | Helloji Booking Desk" },
      {
        name: "description",
        content:
          "Audit trail of every create, update and delete performed on bookings, hotels and customer records.",
      },
      { property: "og:title", content: "Activity Log | Helloji Booking Desk" },
      { property: "og:description", content: "Audit trail of all record changes across the desk." },
    ],
  }),
  component: Logs,
});

const tone: Record<string, string> = {
  created: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  updated: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  deleted: "bg-destructive/10 text-destructive border-destructive/20",
  force_deleted: "bg-destructive/15 text-destructive font-semibold border-destructive/30",
  restored: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
};

interface LogItem {
  id: string;
  user: string;
  activityType: string;
  tableName: string;
  tableId: string;
  changedData: string;
  ip: string;
  at: string;
}

function Logs() {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [tableName, setTableName] = useState("all");
  const [activityType, setActivityType] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1, limit: 25 });

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "25");
      if (tableName !== "all") params.set("tableName", tableName);
      if (activityType !== "all") params.set("activityType", activityType);
      if (search.trim()) params.set("q", search.trim());

      const res = await authFetch(`/api/activity-logs?${params.toString()}`);
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error("You do not have permission to view activity logs (user.log).");
        }
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to load activity logs");
      }

      const data = await res.json();
      setLogs(data.data || []);
      if (data.pagination) {
        setPagination({
          total: data.pagination.total || 0,
          pages: data.pagination.pages || 1,
          limit: data.pagination.limit || 25,
        });
      }
    } catch (err: any) {
      setError(err.message || "Could not load activity logs");
    } finally {
      setLoading(false);
    }
  }, [page, tableName, activityType, search]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleTableChange = (val: string) => {
    setTableName(val);
    setPage(1);
  };

  const handleActivityChange = (val: string) => {
    setActivityType(val);
    setPage(1);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  return (
    <DashboardShell
      title="Activity Log"
      subtitle="Who changed what, and when. An auditable trail across bookings, hotels, and customer records."
      actions={
        <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
          <RefreshCw className={`size-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      }
    >
      {/* Filter toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-1 items-center gap-2 sm:max-w-xs">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search user, record ID, IP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={tableName} onValueChange={handleTableChange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Modules" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Modules</SelectItem>
              <SelectItem value="booking">Bookings</SelectItem>
              <SelectItem value="hotel">Hotels</SelectItem>
              <SelectItem value="customer">Customers</SelectItem>
            </SelectContent>
          </Select>

          <Select value={activityType} onValueChange={handleActivityChange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All Actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="created">Created</SelectItem>
              <SelectItem value="updated">Updated</SelectItem>
              <SelectItem value="deleted">Deleted</SelectItem>
              <SelectItem value="restored">Restored</SelectItem>
              <SelectItem value="force_deleted">Force Deleted</SelectItem>
            </SelectContent>
          </Select>

          <ExportToolbar
            data={logs}
            columns={logExportColumns}
            filename="activity-logs"
            title="Activity Audit Log"
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-5 shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={fetchLogs}>
            Retry
          </Button>
        </div>
      )}

      {loading ? (
        <div className="card-surface space-y-3 p-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <div className="card-surface overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Record</th>
                <th className="px-4 py-3">Changed data</th>
                <th className="px-4 py-3">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No activity logs found for the selected criteria.
                  </td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id} className="hover:bg-muted/40">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {l.at ? new Date(l.at).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">{l.user}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full border px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider",
                          tone[l.activityType] || "bg-muted text-muted-foreground border-border"
                        )}
                      >
                        {l.activityType?.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="capitalize font-medium">{l.tableName}</span>
                      {l.tableId && (
                        <span className="text-xs text-muted-foreground ml-1.5 font-mono">
                          · {l.tableId.length > 12 ? `${l.tableId.slice(0, 8)}...` : l.tableId}
                        </span>
                      )}
                    </td>
                    <td className="max-w-[280px] px-4 py-3 font-mono text-xs text-muted-foreground truncate" title={l.changedData}>
                      {l.changedData || "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {l.ip || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination bar */}
          {pagination.total > 0 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Showing {Math.min((page - 1) * pagination.limit + 1, pagination.total)} to{" "}
                {Math.min(page * pagination.limit, pagination.total)} of {pagination.total} entries
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="size-4 mr-1" /> Previous
                </Button>
                <span className="text-xs font-medium px-1">
                  Page {page} of {pagination.pages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next <ChevronRight className="size-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </DashboardShell>
  );
}

