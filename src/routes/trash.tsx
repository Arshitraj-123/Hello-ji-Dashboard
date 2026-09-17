import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { RotateCcw, Trash2, RefreshCw, AlertCircle, Loader2 } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { DeleteConfirm } from "@/components/shared/DeleteConfirm";
import { authFetch } from "@/lib/auth";
import { ExportToolbar } from "@/components/shared/ExportToolbar";
import type { ExportColumn } from "@/lib/export";

const trashBookingColumns: ExportColumn<any>[] = [
  { header: "Booking ID", key: "bookingId" },
  { header: "Guest Name", key: "name" },
  { header: "Product", key: "product" },
  { header: "City", key: "city" },
  {
    header: "Deleted Date",
    key: "deletedAt",
    formatter: (val) => (val ? new Date(val).toLocaleDateString("en-IN") : ""),
  },
];

const trashHotelColumns: ExportColumn<any>[] = [
  { header: "Hotel Name", key: "hotelName" },
  { header: "City", key: "city" },
  { header: "Sales Person", key: "salesPerson" },
  { header: "Phone", key: "phone" },
  {
    header: "Deleted Date",
    key: "deletedAt",
    formatter: (val) => (val ? new Date(val).toLocaleDateString("en-IN") : ""),
  },
];

const trashCustomerColumns: ExportColumn<any>[] = [
  { header: "Customer Name", key: "name" },
  { header: "Phone", key: "phone" },
  { header: "City", key: "city" },
  { header: "Document Type", key: "documentType" },
  {
    header: "Deleted Date",
    key: "deletedAt",
    formatter: (val) => (val ? new Date(val).toLocaleDateString("en-IN") : ""),
  },
];

export const Route = createFileRoute("/trash")({
  head: () => ({
    meta: [
      { title: "Recycle Bin | Helloji Booking Desk" },
      {
        name: "description",
        content:
          "Restore or permanently remove deleted enquiries, hotels and visa customer records from the recycle bin.",
      },
      {
        property: "og:title",
        content: "Recycle Bin | Helloji Booking Desk",
      },
      {
        property: "og:description",
        content: "Restore or permanently delete removed records.",
      },
    ],
  }),
  component: Trash,
});

export function Trash() {
  const [activeTab, setActiveTab] = useState("bookings");
  const [bookings, setBookings] = useState<any[]>([]);
  const [hotels, setHotels] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const fetchTrash = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bookingsRes, hotelsRes, customersRes] = await Promise.all([
        authFetch("/api/bookings/recycle-bin?limit=100"),
        authFetch("/api/hotels/recycle-bin?limit=100"),
        authFetch("/api/customers/recycle-bin?limit=100"),
      ]);

      if (!bookingsRes.ok && bookingsRes.status === 403) {
        throw new Error("You do not have permission to view the recycle bin (trash.recycleBin).");
      }

      if (bookingsRes.ok) {
        const data = await bookingsRes.json();
        setBookings(data.data || []);
      }
      if (hotelsRes.ok) {
        const data = await hotelsRes.json();
        setHotels(data.data || []);
      }
      if (customersRes.ok) {
        const data = await customersRes.json();
        setCustomers(data.data || []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load recycle bin records");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrash();
  }, [fetchTrash]);

  // Restore handlers
  const handleRestoreBooking = async (id: string, name: string) => {
    setActionInProgress(`restore-${id}`);
    try {
      const res = await authFetch(`/api/bookings/${id}/restore`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to restore booking");
      }
      toast.success(`${name} restored`);
      setBookings((prev) => prev.filter((b) => (b.id || b._id) !== id));
    } catch (err: any) {
      toast.error(err.message || "Failed to restore booking");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleForceDeleteBooking = async (id: string, name: string) => {
    setActionInProgress(`delete-${id}`);
    try {
      const res = await authFetch(`/api/bookings/${id}/force`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to permanently delete booking");
      }
      toast.success(`${name} permanently deleted`);
      setBookings((prev) => prev.filter((b) => (b.id || b._id) !== id));
    } catch (err: any) {
      toast.error(err.message || "Failed to permanently delete booking");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRestoreHotel = async (id: string, name: string) => {
    setActionInProgress(`restore-${id}`);
    try {
      const res = await authFetch(`/api/hotels/${id}/restore`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to restore hotel");
      }
      toast.success(`Hotel "${name}" restored`);
      setHotels((prev) => prev.filter((h) => (h.id || h._id) !== id));
    } catch (err: any) {
      toast.error(err.message || "Failed to restore hotel");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleForceDeleteHotel = async (id: string, name: string) => {
    setActionInProgress(`delete-${id}`);
    try {
      const res = await authFetch(`/api/hotels/${id}/force`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to delete hotel");
      }
      toast.success(`Hotel "${name}" permanently deleted`);
      setHotels((prev) => prev.filter((h) => (h.id || h._id) !== id));
    } catch (err: any) {
      toast.error(err.message || "Failed to delete hotel");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRestoreCustomer = async (id: string, name: string) => {
    setActionInProgress(`restore-${id}`);
    try {
      const res = await authFetch(`/api/customers/${id}/restore`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to restore customer");
      }
      toast.success(`Customer "${name}" restored`);
      setCustomers((prev) => prev.filter((c) => (c.id || c._id) !== id));
    } catch (err: any) {
      toast.error(err.message || "Failed to restore customer");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleForceDeleteCustomer = async (id: string, name: string) => {
    setActionInProgress(`delete-${id}`);
    try {
      const res = await authFetch(`/api/customers/${id}/force`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to delete customer");
      }
      toast.success(`Customer "${name}" permanently deleted`);
      setCustomers((prev) => prev.filter((c) => (c.id || c._id) !== id));
    } catch (err: any) {
      toast.error(err.message || "Failed to delete customer");
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <DashboardShell
      title="Recycle Bin"
      subtitle="Soft-deleted records are retained here across bookings, hotels, and customers until permanently purged."
      actions={
        <Button variant="outline" size="sm" onClick={fetchTrash} disabled={loading}>
          <RefreshCw className={`size-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      }
    >
      {error && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-5 shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={fetchTrash}>
            Retry
          </Button>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="bookings">
              Bookings ({bookings.length})
            </TabsTrigger>
            <TabsTrigger value="hotels">
              Hotels ({hotels.length})
            </TabsTrigger>
            <TabsTrigger value="customers">
              Customers ({customers.length})
            </TabsTrigger>
          </TabsList>
          <ExportToolbar
            data={
              activeTab === "bookings"
                ? bookings
                : activeTab === "hotels"
                  ? hotels
                  : customers
            }
            columns={
              activeTab === "bookings"
                ? trashBookingColumns
                : activeTab === "hotels"
                  ? trashHotelColumns
                  : trashCustomerColumns
            }
            filename={`recycle-bin-${activeTab}`}
            title={`Recycle Bin - ${activeTab.toUpperCase()}`}
          />
        </div>

        {/* ── Bookings bin ────────────────────────────────── */}
        <TabsContent value="bookings" className="mt-4">
          {loading ? (
            <LoadingSkeleton />
          ) : bookings.length > 0 ? (
            <div className="card-surface overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Booking ID</th>
                    <th className="px-4 py-3">Guest</th>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">City</th>
                    <th className="px-4 py-3">Deleted Date</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {bookings.map((b) => {
                    const id = b.id || b._id;
                    const isBusy = actionInProgress === `restore-${id}` || actionInProgress === `delete-${id}`;
                    return (
                      <tr key={id} className="hover:bg-muted/40">
                        <td className="px-4 py-3 font-medium">{b.bookingId || id}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{b.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {b.phone}
                          </p>
                        </td>
                        <td className="px-4 py-3 capitalize">{b.product || "hotel"}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {b.city || "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {b.deletedAt ? new Date(b.deletedAt).toLocaleDateString() : b.date || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isBusy}
                              onClick={() => handleRestoreBooking(id, b.bookingId || b.name)}
                            >
                              <RotateCcw className="size-4 mr-1" /> Restore
                            </Button>
                            <DeleteConfirm
                              trigger={
                                <Button size="sm" variant="destructive" disabled={isBusy}>
                                  <Trash2 className="size-4 mr-1" /> Delete forever
                                </Button>
                              }
                              title="Permanently delete this booking?"
                              description={`"${b.bookingId || b.name}" will be permanently erased along with all notes. This cannot be undone.`}
                              confirmLabel="Delete forever"
                              onConfirm={() => handleForceDeleteBooking(id, b.bookingId || b.name)}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty message="No deleted bookings in the recycle bin." />
          )}
        </TabsContent>

        {/* ── Hotels bin ──────────────────────────────────── */}
        <TabsContent value="hotels" className="mt-4">
          {loading ? (
            <LoadingSkeleton />
          ) : hotels.length > 0 ? (
            <div className="card-surface overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Hotel Name</th>
                    <th className="px-4 py-3">City</th>
                    <th className="px-4 py-3">Star</th>
                    <th className="px-4 py-3">Sales Contact</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {hotels.map((h) => {
                    const id = h.id || h._id;
                    const isBusy = actionInProgress === `restore-${id}` || actionInProgress === `delete-${id}`;
                    return (
                      <tr key={id} className="hover:bg-muted/40">
                        <td className="px-4 py-3 font-medium">{h.hotelName}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {h.city}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {h.star}★
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{h.salesPerson || "—"}</p>
                          <p className="text-xs text-muted-foreground">
                            {h.email || "—"}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {h.phone || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isBusy}
                              onClick={() => handleRestoreHotel(id, h.hotelName)}
                            >
                              <RotateCcw className="size-4 mr-1" /> Restore
                            </Button>
                            <DeleteConfirm
                              trigger={
                                <Button size="sm" variant="destructive" disabled={isBusy}>
                                  <Trash2 className="size-4 mr-1" /> Delete forever
                                </Button>
                              }
                              title="Permanently delete this hotel?"
                              description={`"${h.hotelName}" in ${h.city} will be removed from the database permanently.`}
                              confirmLabel="Delete forever"
                              onConfirm={() => handleForceDeleteHotel(id, h.hotelName)}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty message="No deleted hotels in the recycle bin." />
          )}
        </TabsContent>

        {/* ── Customers bin ───────────────────────────────── */}
        <TabsContent value="customers" className="mt-4">
          {loading ? (
            <LoadingSkeleton />
          ) : customers.length > 0 ? (
            <div className="card-surface overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">City</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Document Type</th>
                    <th className="px-4 py-3">Documents</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {customers.map((c) => {
                    const id = c.id || c._id;
                    const docsCount = Array.isArray(c.documents) ? c.documents.length : 0;
                    const isBusy = actionInProgress === `restore-${id}` || actionInProgress === `delete-${id}`;
                    return (
                      <tr key={id} className="hover:bg-muted/40">
                        <td className="px-4 py-3 font-medium">{c.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {c.city}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {c.phone}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {c.documentType || "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {docsCount} file{docsCount !== 1 ? "s" : ""}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isBusy}
                              onClick={() => handleRestoreCustomer(id, c.name)}
                            >
                              <RotateCcw className="size-4 mr-1" /> Restore
                            </Button>
                            <DeleteConfirm
                              trigger={
                                <Button size="sm" variant="destructive" disabled={isBusy}>
                                  <Trash2 className="size-4 mr-1" /> Delete forever
                                </Button>
                              }
                              title="Permanently delete this customer?"
                              description={`"${c.name}" and all their stored files will be permanently erased.`}
                              confirmLabel="Delete forever"
                              onConfirm={() => handleForceDeleteCustomer(id, c.name)}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty message="No deleted customers in the recycle bin." />
          )}
        </TabsContent>
      </Tabs>
    </DashboardShell>
  );
}

function LoadingSkeleton() {
  return (
    <div className="card-surface space-y-3 p-4">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}

function Empty({ message = "Nothing in the bin." }: { message?: string }) {
  return (
    <p className="card-surface p-12 text-center text-muted-foreground">
      {message}
    </p>
  );
}

