import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, RefreshCw, AlertCircle, Loader2 } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { authFetch, getUser } from "@/lib/auth";
import { ExportToolbar } from "@/components/shared/ExportToolbar";
import type { ExportColumn } from "@/lib/export";
import type { Hotel } from "@/types/hotel";

const hotelExportColumns: ExportColumn<Hotel>[] = [
  { header: "Hotel Name", key: "hotelName" },
  { header: "City", key: "city" },
  { header: "Star Rating", key: "star" },
  { header: "Sales Person", key: "salesPerson" },
  { header: "Phone", key: "phone" },
  { header: "Email", key: "email" },
  { header: "Reservation Number", key: "reservationNumber" },
  { header: "Total Rooms", key: "totalRooms" },
  { header: "Room Categories", key: "roomsCategory" },
  { header: "Address", key: "address" },
  { header: "Remarks", key: "remarks" },
];

export const Route = createFileRoute("/hotels")({
  head: () => ({
    meta: [
      { title: "Hotel Directory | Helloji Booking Desk" },
      {
        name: "description",
        content:
          "Supplier hotel directory with sales contacts, reservation numbers, room inventory and city-wise search.",
      },
      { property: "og:title", content: "Hotel Directory | Helloji Booking Desk" },
      {
        property: "og:description",
        content: "Supplier hotel directory with contacts and room inventory.",
      },
    ],
  }),
  component: Hotels,
});

const empty: Omit<Hotel, "id"> = {
  hotelName: "",
  city: "",
  star: "",
  salesPerson: "",
  email: "",
  phone: "",
  address: "",
  reservationNumber: "",
  totalRooms: "",
  roomsCategory: "",
  remarks: "",
};

function Hotels() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Hotel | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const currentUser = getUser();
  const canAddHotel =
    currentUser?.role === "admin" ||
    currentUser?.permissions?.includes("hotel.add");

  const fetchHotels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/hotels?limit=100");
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to load hotels");
      }
      const data = await res.json();
      setHotels(data.data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load hotels");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHotels();
  }, [fetchHotels]);

  const rows = hotels.filter((h) =>
    `${h.hotelName} ${h.city} ${h.salesPerson}`
      .toLowerCase()
      .includes(q.toLowerCase())
  );

  const startAdd = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const startEdit = (h: Hotel) => {
    setEditing(h);
    setForm(h);
    setOpen(true);
  };

  const save = async () => {
    if (!form.hotelName.trim()) {
      return toast.error("Hotel name is required");
    }

    setSaving(true);
    try {
      if (editing) {
        const targetId = editing.id || (editing as any)._id;
        const res = await authFetch(`/api/hotels/${targetId}`, {
          method: "PUT",
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || "Failed to update hotel");
        }
        toast.success("Hotel updated");
      } else {
        const res = await authFetch("/api/hotels", {
          method: "POST",
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || "Failed to add hotel");
        }
        toast.success("Hotel added");
      }
      setOpen(false);
      fetchHotels();
    } catch (err: any) {
      toast.error(err.message || "Failed to save hotel");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (hotel: Hotel) => {
    const targetId = hotel.id || (hotel as any)._id;
    try {
      const res = await authFetch(`/api/hotels/${targetId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to delete hotel");
      }
      toast.success("Hotel moved to recycle bin");
      fetchHotels();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete hotel");
    }
  };

  return (
    <DashboardShell
      title="All Hotel"
      subtitle="Your supplier hotel directory and reservation contacts."
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchHotels}
            disabled={loading}
          >
            <RefreshCw className={`size-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          {canAddHotel && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button onClick={startAdd}>
                  <Plus className="size-4 mr-1" /> Add Hotel
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editing ? "Edit hotel" : "Add hotel"}
                  </DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 sm:grid-cols-2">
                  {(
                    [
                      ["hotelName", "Hotel name *"],
                      ["city", "City"],
                      ["star", "Star rating (e.g. 5)"],
                      ["salesPerson", "Sales person"],
                      ["email", "Email"],
                      ["phone", "Phone"],
                      ["reservationNumber", "Reservation number"],
                      ["totalRooms", "Total rooms"],
                      ["roomsCategory", "Room categories"],
                      ["address", "Address"],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key} className="space-y-2">
                      <Label>{label}</Label>
                      <Input
                        value={form[key]}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, [key]: e.target.value }))
                        }
                      />
                    </div>
                  ))}
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Remarks</Label>
                    <Textarea
                      rows={3}
                      value={form.remarks}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, remarks: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setOpen(false)}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button onClick={save} disabled={saving}>
                    {saving && <Loader2 className="size-4 mr-2 animate-spin" />}
                    Save hotel
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      }
    >
      {error && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={fetchHotels}>
            Retry
          </Button>
        </div>
      )}

      <div className="card-surface overflow-hidden">
        <div className="border-b border-border p-4 flex flex-wrap items-center justify-between gap-4">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search hotels, cities or contacts…"
            className="max-w-xs"
          />
          <div className="flex items-center gap-3">
            <ExportToolbar
              data={rows}
              columns={hotelExportColumns}
              filename="hotels-directory"
              title="Hotel Directory"
            />
            <span className="text-sm text-muted-foreground">
              {rows.length} hotel{rows.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="p-4 space-y-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Hotel</th>
                  <th className="px-4 py-3">City</th>
                  <th className="px-4 py-3">Star</th>
                  <th className="px-4 py-3">Sales contact</th>
                  <th className="px-4 py-3">Reservation</th>
                  <th className="px-4 py-3">Rooms</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((h) => {
                  const targetId = h.id || (h as any)._id;
                  return (
                    <tr key={targetId} className="hover:bg-muted/40">
                      <td className="px-4 py-3">
                        <p className="font-medium">{h.hotelName}</p>
                        <p className="text-xs text-muted-foreground">{h.address}</p>
                      </td>
                      <td className="px-4 py-3">{h.city || "—"}</td>
                      <td className="px-4 py-3">{h.star ? `${h.star}★` : "—"}</td>
                      <td className="px-4 py-3">
                        <p>{h.salesPerson || "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          {h.phone} {h.email ? `· ${h.email}` : ""}
                        </p>
                      </td>
                      <td className="px-4 py-3">{h.reservationNumber || "—"}</td>
                      <td className="px-4 py-3">
                        {h.totalRooms || "—"}
                        {h.roomsCategory && (
                          <p className="text-xs text-muted-foreground">
                            {h.roomsCategory}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Edit"
                            onClick={() => startEdit(h)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Delete"
                            onClick={() => handleDelete(h)}
                          >
                            <Trash2 className="size-4 text-primary" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-12 text-center text-muted-foreground"
                    >
                      No hotels found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
