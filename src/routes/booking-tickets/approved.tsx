import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Plus,
  RefreshCw,
  Search,
  Eye,
  Edit,
  Printer,
  Trash2,
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DeleteConfirm } from "@/components/shared/DeleteConfirm";
import { ExportToolbar } from "@/components/shared/ExportToolbar";
import type { ExportColumn } from "@/lib/export";
import { BookingTicketPrint } from "@/components/tickets/BookingTicketPrint";
import { authFetch } from "@/lib/auth";
import type { BookingTicket } from "@/types/bookingTicket";

export const Route = createFileRoute("/booking-tickets/approved")({
  head: () => ({
    meta: [
      { title: "All Approved Tickets | Helloji Booking Desk" },
      { name: "description", content: "Approved booking ticket records" },
    ],
  }),
  component: ApprovedTicketsPage,
});

const exportColumns: ExportColumn<BookingTicket>[] = [
  { header: "BT ID", key: "btId" },
  {
    header: "Date",
    key: "date",
    formatter: (val) => (val ? format(new Date(val), "dd-MMM-yyyy") : ""),
  },
  { header: "Guest Name", key: "guestName" },
  { header: "Created By", key: "createdBy" },
  { header: "Sale By", key: "saleBy" },
  { header: "Approved By", key: "approvedBy" },
  { header: "SP", key: "sp" },
  { header: "Product", key: "product" },
  { header: "Detail", key: "detail" },
  { header: "Remark", key: "remark" },
];

const PRODUCT_OPTIONS = [
  "Hotel",
  "Ticket",
  "Visa",
  "Package",
  "Others",
];

function ApprovedTicketsPage() {
  const [tickets, setTickets] = useState<BookingTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Modals state
  const [viewTicket, setViewTicket] = useState<BookingTicket | null>(null);
  const [printTicket, setPrintTicket] = useState<BookingTicket | null>(null);
  const [editTicket, setEditTicket] = useState<BookingTicket | null>(null);
  const [editForm, setEditForm] = useState({
    guestName: "",
    saleBy: "",
    sp: "",
    product: "",
    detail: "",
    remark: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete modal state
  const [deleteTicketId, setDeleteTicketId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      q.set("status", "approved");
      if (search.trim()) q.set("search", search.trim());

      const res = await authFetch(`/api/booking-tickets?${q.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to load approved tickets");
      }
      const data = await res.json();
      setTickets(data.data || []);
    } catch (err: any) {
      setError(err.message || "Failed to fetch tickets");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Edit handling
  const openEdit = (t: BookingTicket) => {
    setEditTicket(t);
    setEditForm({
      guestName: t.guestName || "",
      saleBy: t.saleBy || "",
      sp: t.sp || "",
      product: t.product || "Ticket",
      detail: t.detail || "",
      remark: t.remark || "N/A",
    });
  };

  const handleSaveEdit = async () => {
    if (!editTicket) return;
    if (!editForm.guestName.trim()) {
      toast.error("Guest Name is required");
      return;
    }

    setSavingEdit(true);
    try {
      const res = await authFetch(`/api/booking-tickets/${editTicket._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || "Failed to update ticket");
      }
      toast.success("Ticket updated successfully");
      setEditTicket(null);
      fetchTickets();
    } catch (err: any) {
      toast.error(err.message || "Failed to save changes");
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete handling (soft delete to Recycle Bin)
  const handleConfirmDelete = async () => {
    if (!deleteTicketId) return;
    setDeleting(true);
    try {
      const res = await authFetch(`/api/booking-tickets/${deleteTicketId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete ticket");
      toast.success("Ticket moved to Recycle Bin");
      setDeleteTicketId(null);
      fetchTickets();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete ticket");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <DashboardShell
      title="All Approved Tickets"
      subtitle="Processed and approved booking tickets"
      actions={
        <div className="flex items-center gap-2">
          <Button asChild size="sm" className="bg-red-600 hover:bg-red-700 text-white gap-2">
            <Link to="/booking-tickets/add">
              <Plus className="size-4" />
              Add Ticket
            </Link>
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/dashboard" className="hover:text-foreground inline-flex items-center">
            <Home className="size-4 text-sky-500" />
          </Link>
          <span>&gt;</span>
          <span className="text-foreground font-medium">All Approved</span>
        </div>

        {/* Toolbar & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-4 rounded-lg border border-border shadow-sm">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by BT ID, guest, detail..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <ExportToolbar
              data={tickets}
              columns={exportColumns}
              filename="Approved-Tickets"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={fetchTickets}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Tickets Table */}
        <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
                  <th className="px-3 py-3 text-center whitespace-nowrap">Sr.No</th>
                  <th className="px-3 py-3 whitespace-nowrap">BT ID</th>
                  <th className="px-3 py-3 whitespace-nowrap">Date</th>
                  <th className="px-3 py-3 whitespace-nowrap">Guest Name</th>
                  <th className="px-3 py-3 whitespace-nowrap">Created By</th>
                  <th className="px-3 py-3 whitespace-nowrap">Sale By</th>
                  <th className="px-3 py-3 whitespace-nowrap">Approved By</th>
                  <th className="px-3 py-3 whitespace-nowrap">SP</th>
                  <th className="px-3 py-3 whitespace-nowrap">Product</th>
                  <th className="px-3 py-3 min-w-[200px]">Detail</th>
                  <th className="px-3 py-3 min-w-[120px]">Remark</th>
                  <th className="px-3 py-3 text-center whitespace-nowrap sticky right-0 bg-card/95 shadow-sm">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={12} className="p-8 text-center text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="size-5 animate-spin text-primary" />
                        <span>Loading approved tickets...</span>
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={12} className="p-8 text-center text-destructive">
                      <div className="flex items-center justify-center gap-2">
                        <AlertCircle className="size-5" />
                        <span>{error}</span>
                      </div>
                    </td>
                  </tr>
                ) : tickets.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="p-8 text-center text-muted-foreground">
                      No approved tickets found.
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
                      <td className="px-3 py-3 whitespace-nowrap text-xs text-muted-foreground">
                        {t.date ? format(new Date(t.date), "dd-MMM-yyyy") : "—"}
                      </td>
                      <td className="px-3 py-3 font-medium text-foreground whitespace-nowrap">
                        {t.guestName}
                      </td>
                      <td className="px-3 py-3 text-xs whitespace-nowrap">
                        {t.createdBy || "—"}
                      </td>
                      <td className="px-3 py-3 text-xs whitespace-nowrap">
                        {t.saleBy || "—"}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          <CheckCircle2 className="size-3" />
                          {t.approvedBy || "Approved"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs whitespace-nowrap">
                        {t.sp || "—"}
                      </td>
                      <td className="px-3 py-3 text-xs capitalize whitespace-nowrap">
                        {t.product || "Ticket"}
                      </td>
                      <td className="px-3 py-3 text-xs max-w-xs truncate" title={t.detail}>
                        {t.detail || "—"}
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground max-w-xs truncate" title={t.remark}>
                        {t.remark || "N/A"}
                      </td>
                      {/* Action buttons for Approved Ticket: Edit, Delete, View, Print */}
                      <td className="px-3 py-3 text-center whitespace-nowrap sticky right-0 bg-card/95">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(t)}
                            title="Edit Ticket"
                            className="size-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950"
                          >
                            <Edit className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTicketId(t._id)}
                            title="Delete Ticket (Move to Recycle Bin)"
                            className="size-7 text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setViewTicket(t)}
                            title="View Ticket"
                            className="size-7 text-slate-600 hover:text-slate-700 hover:bg-slate-100"
                          >
                            <Eye className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setPrintTicket(t)}
                            title="Print Ticket"
                            className="size-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          >
                            <Printer className="size-3.5" />
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

      {/* View Modal */}
      {viewTicket && (
        <Dialog open={!!viewTicket} onOpenChange={(open) => !open && setViewTicket(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="size-5 text-primary" />
                Booking Ticket {viewTicket.btId}
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 text-sm py-2">
              <div>
                <span className="text-xs text-muted-foreground">Date:</span>
                <p className="font-medium">
                  {viewTicket.date ? format(new Date(viewTicket.date), "dd-MMM-yyyy") : "—"}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Guest Name:</span>
                <p className="font-semibold uppercase">{viewTicket.guestName}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Created By:</span>
                <p>{viewTicket.createdBy || "—"}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Sale By:</span>
                <p>{viewTicket.saleBy || "—"}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Approved By:</span>
                <p className="text-emerald-600 font-medium">{viewTicket.approvedBy || "Approved"}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">SP:</span>
                <p>{viewTicket.sp || "—"}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Product:</span>
                <p className="capitalize">{viewTicket.product || "Ticket"}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Remark:</span>
                <p>{viewTicket.remark || "N/A"}</p>
              </div>
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground">Detail:</span>
                <p className="p-3 bg-muted rounded-md text-xs whitespace-pre-wrap mt-1">
                  {viewTicket.detail || "No details entered"}
                </p>
              </div>
            </div>
            <DialogFooter className="flex sm:justify-between items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const t = viewTicket;
                  setViewTicket(null);
                  setPrintTicket(t);
                }}
                className="gap-2"
              >
                <Printer className="size-4" />
                Print View
              </Button>
              <Button size="sm" onClick={() => setViewTicket(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Modal */}
      {editTicket && (
        <Dialog open={!!editTicket} onOpenChange={(open) => !open && setEditTicket(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit className="size-5 text-primary" />
                Edit Booking Ticket {editTicket.btId}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-guest">Guest Name</Label>
                  <Input
                    id="edit-guest"
                    value={editForm.guestName}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, guestName: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-sale">Sale By</Label>
                  <Input
                    id="edit-sale"
                    value={editForm.saleBy}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, saleBy: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-sp">SP</Label>
                  <Input
                    id="edit-sp"
                    value={editForm.sp}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, sp: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-product">Product</Label>
                  <Select
                    value={editForm.product}
                    onValueChange={(val) =>
                      setEditForm((p) => ({ ...p, product: val }))
                    }
                  >
                    <SelectTrigger id="edit-product">
                      <SelectValue placeholder="Select Product" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUCT_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-detail">Detail</Label>
                <Textarea
                  id="edit-detail"
                  rows={3}
                  value={editForm.detail}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, detail: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-remark">Remark</Label>
                <Input
                  id="edit-remark"
                  value={editForm.remark}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, remark: e.target.value }))
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setEditTicket(null)}
                disabled={savingEdit}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="bg-primary text-primary-foreground"
              >
                {savingEdit ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Print Preview Modal */}
      {printTicket && (
        <Dialog open={!!printTicket} onOpenChange={(open) => !open && setPrintTicket(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <BookingTicketPrint
              ticket={printTicket}
              onBack={() => setPrintTicket(null)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation */}
      <DeleteConfirm
        open={!!deleteTicketId}
        onOpenChange={(open) => !open && setDeleteTicketId(null)}
        title="Move Ticket to Recycle Bin"
        description="Are you sure you want to move this approved booking ticket to the Recycle Bin? You can restore it later if needed."
        onConfirm={handleConfirmDelete}
        loading={deleting}
      />
    </DashboardShell>
  );
}
