import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import {
  RotateCcw,
  Trash2,
  RefreshCw,
  Search,
  Loader2,
  AlertCircle,
  Home,
  CheckCircle2,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeleteConfirm } from "@/components/shared/DeleteConfirm";
import { ExportToolbar } from "@/components/shared/ExportToolbar";
import type { ExportColumn } from "@/lib/export";
import { authFetch } from "@/lib/auth";
import type { BookingTicket } from "@/types/bookingTicket";

export const Route = createFileRoute("/booking-tickets/recycle-bin")({
  head: () => ({
    meta: [
      { title: "Booking Tickets Recycle Bin | Helloji Booking Desk" },
      { name: "description", content: "Restore or permanently delete removed booking tickets" },
    ],
  }),
  component: BookingTicketsRecycleBinPage,
});

const exportColumns: ExportColumn<BookingTicket>[] = [
  { header: "BT ID", key: "btId" },
  { header: "Guest Name", key: "guestName" },
  { header: "Sale By", key: "saleBy" },
  { header: "Product", key: "product" },
  { header: "Status Before Deletion", key: "status" },
  {
    header: "Deleted Date",
    key: "deletedAt",
    formatter: (val) => (val ? format(new Date(val), "dd-MMM-yyyy") : ""),
  },
];

function BookingTicketsRecycleBinPage() {
  const [tickets, setTickets] = useState<BookingTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [restoreId, setRestoreId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  const [permanentDeleteId, setPermanentDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchTrash = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (search.trim()) q.set("search", search.trim());

      const res = await authFetch(`/api/booking-tickets/recycle-bin?${q.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to load recycle bin tickets");
      }
      const data = await res.json();
      setTickets(data.data || []);
    } catch (err: any) {
      setError(err.message || "Failed to fetch trash");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchTrash();
  }, [fetchTrash]);

  const handleRestore = async (id: string) => {
    setRestoring(true);
    try {
      const res = await authFetch(`/api/booking-tickets/${id}/restore`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to restore ticket");
      toast.success("Booking ticket restored successfully");
      fetchTrash();
    } catch (err: any) {
      toast.error(err.message || "Failed to restore");
    } finally {
      setRestoring(false);
      setRestoreId(null);
    }
  };

  const handlePermanentDelete = async () => {
    if (!permanentDeleteId) return;
    setDeleting(true);
    try {
      const res = await authFetch(`/api/booking-tickets/${permanentDeleteId}/permanent`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to permanently delete ticket");
      toast.success("Booking ticket permanently deleted");
      setPermanentDeleteId(null);
      fetchTrash();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete permanently");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <DashboardShell
      title="Booking Tickets Recycle Bin"
      subtitle="Restore or permanently delete removed booking tickets"
    >
      <div className="space-y-4">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/dashboard" className="hover:text-foreground inline-flex items-center">
            <Home className="size-4 text-sky-500" />
          </Link>
          <span>&gt;</span>
          <span className="text-foreground font-medium">Recycle Bin</span>
        </div>

        {/* Toolbar & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-4 rounded-lg border border-border shadow-sm">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search deleted tickets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <ExportToolbar
              data={tickets}
              columns={exportColumns}
              filename="Recycle-Bin-Tickets"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={fetchTrash}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Deleted Tickets Table */}
        <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
                  <th className="px-3 py-3 text-center whitespace-nowrap">Sr.No</th>
                  <th className="px-3 py-3 whitespace-nowrap">BT ID</th>
                  <th className="px-3 py-3 whitespace-nowrap">Guest Name</th>
                  <th className="px-3 py-3 whitespace-nowrap">Sale By</th>
                  <th className="px-3 py-3 whitespace-nowrap">Product</th>
                  <th className="px-3 py-3 whitespace-nowrap">Status</th>
                  <th className="px-3 py-3 whitespace-nowrap">Deleted Date</th>
                  <th className="px-3 py-3 text-center whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="size-5 animate-spin text-primary" />
                        <span>Loading deleted tickets...</span>
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-destructive">
                      <div className="flex items-center justify-center gap-2">
                        <AlertCircle className="size-5" />
                        <span>{error}</span>
                      </div>
                    </td>
                  </tr>
                ) : tickets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      Recycle Bin is empty. No deleted booking tickets.
                    </td>
                  </tr>
                ) : (
                  tickets.map((t, idx) => (
                    <tr key={t._id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-3 text-center text-xs text-muted-foreground">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-3 font-semibold text-primary whitespace-nowrap">
                        {t.btId}
                      </td>
                      <td className="px-3 py-3 font-medium text-foreground whitespace-nowrap">
                        {t.guestName}
                      </td>
                      <td className="px-3 py-3 text-xs whitespace-nowrap">
                        {t.saleBy || "—"}
                      </td>
                      <td className="px-3 py-3 text-xs capitalize whitespace-nowrap">
                        {t.product || "Ticket"}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                            t.status === "approved"
                              ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                              : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                          }`}
                        >
                          {t.status === "approved" ? "Approved" : "Unapproved"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {t.deletedAt ? format(new Date(t.deletedAt), "dd-MMM-yyyy HH:mm") : "—"}
                      </td>
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRestore(t._id)}
                            disabled={restoring}
                            className="h-7 text-xs gap-1 text-emerald-600 hover:text-emerald-700"
                          >
                            <RotateCcw className="size-3" />
                            Restore
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPermanentDeleteId(t._id)}
                            className="h-7 text-xs gap-1 text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="size-3" />
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Permanent Delete Confirmation */}
      <DeleteConfirm
        open={!!permanentDeleteId}
        onOpenChange={(open) => !open && setPermanentDeleteId(null)}
        title="Permanently Delete Booking Ticket"
        description="This action cannot be undone. The ticket will be permanently removed from the database."
        onConfirm={handlePermanentDelete}
        loading={deleting}
      />
    </DashboardShell>
  );
}
