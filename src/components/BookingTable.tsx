import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Eye, Pencil, Trash2, ArrowUpRight, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge, PriorityBadge } from "@/components/StatusBadge";
import { ExportToolbar } from "@/components/shared/ExportToolbar";
import type { ExportColumn } from "@/lib/export";
import type { Booking, Status } from "@/types/booking";
import { authFetch, getUser } from "@/lib/auth";
import { toast } from "sonner";

const bookingExportColumns: ExportColumn<Booking>[] = [
  { header: "Booking ID", key: "bookingId" },
  { header: "Guest Name", key: "name" },
  {
    header: "Product",
    key: "product",
    formatter: (val) => (val ? String(val).toUpperCase() : ""),
  },
  { header: "Status", key: "status" },
  { header: "Priority", key: "priority" },
  { header: "City", key: "city" },
  { header: "Phone", key: "phone" },
  { header: "Email", key: "email" },
  {
    header: "Assigned Agent",
    key: "assignedAgent",
    formatter: (val) =>
      typeof val === "object" && val ? val.name : val || "Unassigned",
  },
  {
    header: "Created Date",
    key: "createdAt",
    formatter: (val) => (val ? new Date(val).toLocaleDateString("en-IN") : ""),
  },
];

const STATUSES: Status[] = [
  "New Query",
  "Pipeline",
  "confirmed",
  "booked",
  "Abort",
];

interface AgentOption {
  id: string;
  name: string;
}

export function BookingTable({
  rows,
  showAssign = true,
  showStatus = true,
  variant = "query",
  onRefresh,
  exportFilename,
  exportTitle,
}: {
  rows: Booking[];
  showAssign?: boolean;
  showStatus?: boolean;
  variant?: "query" | "booking";
  onRefresh?: () => void;
  exportFilename?: string;
  exportTitle?: string;
}) {
  const [q, setQ] = useState("");
  const [product, setProduct] = useState("all");
  const [page, setPage] = useState(0);
  const perPage = 10;
  const [busyId, setBusyId] = useState<string | null>(null);

  const currentUser = getUser();
  const canAssign =
    currentUser?.role === "admin" ||
    currentUser?.permissions?.includes("queries.assign");
  const canChangeStatus =
    currentUser?.role === "admin" ||
    currentUser?.permissions?.includes("queries.changeStatus");

  // Load active agents for assignment dropdown
  const [agentOptions, setAgentOptions] = useState<AgentOption[]>([]);

  useEffect(() => {
    let mounted = true;
    authFetch("/api/admin/users")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (mounted && data?.users) {
          const agents: AgentOption[] = data.users
            .filter((u: any) => u.status === "active")
            .map((u: any) => ({ id: u.id || u._id, name: u.name }));
          setAgentOptions(agents);
        }
      })
      .catch(() => {
        // Non-admin may not have access to /api/admin/users; fallback to users in rows
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Compute available agent choices (combining fetched agents + unique agents present in rows)
  const availableAgents = useMemo(() => {
    const map = new Map<string, string>();
    agentOptions.forEach((a) => map.set(a.id, a.name));

    rows.forEach((r) => {
      if (typeof r.assignedAgent === "object" && r.assignedAgent) {
        const id = (r.assignedAgent as any)._id || r.assignedAgent.id;
        if (id && r.assignedAgent.name) {
          map.set(id, r.assignedAgent.name);
        }
      }
    });

    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [agentOptions, rows]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      const pMatch = product === "all" || r.product?.toLowerCase() === product.toLowerCase();
      if (!pMatch) return false;
      if (!term) return true;

      const agentName =
        typeof r.assignedAgent === "object" && r.assignedAgent
          ? r.assignedAgent.name
          : r.assignedAgent || "";
      const createdByName =
        typeof r.createdBy === "object" && r.createdBy
          ? r.createdBy.name
          : r.createdBy || "";

      return [
        r.name,
        r.bookingId,
        r.phone,
        r.email,
        r.city,
        r.propertyName ?? "",
        agentName,
        createdByName,
      ]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [rows, q, product]);

  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const view = filtered.slice(page * perPage, page * perPage + perPage);

  // Agent reassignment handler
  const handleAssign = async (booking: Booking, newAgentId: string) => {
    const targetId = booking.id || (booking as any)._id;
    setBusyId(targetId);
    try {
      const res = await authFetch(`/api/queries/${targetId}/assign`, {
        method: "PATCH",
        body: JSON.stringify({ assignedAgent: newAgentId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Failed to reassign agent");
      }
      const agentObj = availableAgents.find((a) => a.id === newAgentId);
      toast.success(
        `${booking.bookingId} assigned to ${agentObj ? agentObj.name : "new agent"}`
      );
      onRefresh?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to reassign agent");
    } finally {
      setBusyId(null);
    }
  };

  // Status update handler
  const handleStatusChange = async (booking: Booking, newStatus: string) => {
    const targetId = booking.id || (booking as any)._id;
    setBusyId(targetId);
    try {
      const res = await authFetch(`/api/queries/${targetId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Failed to update status");
      }
      toast.success(`${booking.bookingId} moved to ${newStatus}`);
      onRefresh?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    } finally {
      setBusyId(null);
    }
  };

  // Convert to booking handler
  const handleConvert = async (booking: Booking) => {
    const targetId = booking.id || (booking as any)._id;
    setBusyId(targetId);
    try {
      const res = await authFetch(`/api/queries/${targetId}/convert`, {
        method: "POST",
        body: JSON.stringify({
          startDate: booking.startDate,
          endDate: booking.endDate,
          noOfRooms: booking.noOfRooms || booking.noRoom,
          propertyName: booking.propertyName,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Failed to convert query to booking");
      }
      toast.success(`${booking.bookingId} converted to booking!`);
      onRefresh?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to convert query");
    } finally {
      setBusyId(null);
    }
  };

  // Soft delete query handler
  const handleDelete = async (booking: Booking) => {
    const targetId = booking.id || (booking as any)._id;
    setBusyId(targetId);
    try {
      const res = await authFetch(`/api/queries/${targetId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Failed to delete query");
      }
      toast.success(`${booking.bookingId} moved to recycle bin`);
      onRefresh?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete record");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="card-surface overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(0);
          }}
          placeholder="Search by name, booking ID, phone…"
          className="max-w-xs"
        />
        <Select
          value={product}
          onValueChange={(v) => {
            setProduct(v);
            setPage(0);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Product" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All products</SelectItem>
            {["hotel", "ticket", "package", "visa", "insurance", "Other"].map(
              (p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-3">
          <ExportToolbar
            data={filtered}
            columns={bookingExportColumns}
            filename={
              exportFilename ||
              (variant === "booking" ? "bookings" : "queries")
            }
            title={
              exportTitle ||
              (variant === "booking" ? "Bookings List" : "Queries List")
            }
          />
          <span className="text-sm text-muted-foreground">
            {filtered.length} record{filtered.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Booking ID</th>
              <th className="px-4 py-3">Guest</th>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">
                {variant === "booking" ? "Travel dates" : "Enquiry"}
              </th>
              <th className="px-4 py-3">Raised by</th>
              {showAssign && <th className="px-4 py-3">Assigned to</th>}
              {showStatus && <th className="px-4 py-3">Status</th>}
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {view.map((b) => {
              const targetId = b.id || (b as any)._id;
              const isBusy = busyId === targetId;

              const agentName =
                typeof b.assignedAgent === "object" && b.assignedAgent
                  ? b.assignedAgent.name
                  : b.assignedAgent || "Unassigned";

              const agentId =
                typeof b.assignedAgent === "object" && b.assignedAgent
                  ? (b.assignedAgent as any)._id || b.assignedAgent.id
                  : b.assignedAgent;

              const createdByName =
                typeof b.createdBy === "object" && b.createdBy
                  ? b.createdBy.name
                  : b.createdBy || "—";

              return (
                <tr key={targetId} className="hover:bg-muted/40">
                  <td className="px-4 py-3 font-medium">{b.bookingId}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{b.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.phone} · {b.city}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="capitalize">{b.product}</span>
                    <p className="text-xs text-muted-foreground">
                      {b.destination} · {b.enquiryType || b.enqueryType || "B2C"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {variant === "booking" ? (
                      b.startDate ? (
                        `${b.startDate} → ${b.endDate ?? "—"}`
                      ) : (
                        "—"
                      )
                    ) : (
                      <PriorityBadge priority={b.priority} />
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {createdByName}
                  </td>
                  {showAssign && (
                    <td className="px-4 py-3">
                      {canAssign && availableAgents.length > 0 ? (
                        <Select
                          value={agentId}
                          disabled={isBusy}
                          onValueChange={(v) => handleAssign(b, v)}
                        >
                          <SelectTrigger className="h-8 w-40 text-xs">
                            <SelectValue placeholder="Assign agent">
                              {agentName}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {availableAgents.map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-xs font-medium">{agentName}</span>
                      )}
                    </td>
                  )}
                  {showStatus && (
                    <td className="px-4 py-3">
                      {canChangeStatus ? (
                        <Select
                          value={b.status}
                          disabled={isBusy}
                          onValueChange={(v) => handleStatusChange(b, v)}
                        >
                          <SelectTrigger className="h-8 w-36 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <StatusBadge status={b.status} />
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {isBusy && (
                        <Loader2 className="size-4 animate-spin text-primary mr-1" />
                      )}
                      <Button
                        asChild
                        size="icon"
                        variant="ghost"
                        aria-label="View"
                      >
                        <Link to="/queries/$id" params={{ id: targetId }}>
                          <Eye className="size-4" />
                        </Link>
                      </Button>
                      <Button
                        asChild
                        size="icon"
                        variant="ghost"
                        aria-label="Edit"
                      >
                        <Link
                          to="/queries/$id"
                          params={{ id: targetId }}
                          search={{ edit: true }}
                        >
                          <Pencil className="size-4" />
                        </Link>
                      </Button>
                      {variant === "query" && b.status !== "booked" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={isBusy}
                          aria-label="Convert to booking"
                          title="Convert to booking"
                          onClick={() => handleConvert(b)}
                        >
                          <ArrowUpRight className="size-4" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={isBusy}
                        aria-label="Delete"
                        title="Move to recycle bin"
                        onClick={() => handleDelete(b)}
                      >
                        <Trash2 className="size-4 text-primary" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {view.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-12 text-center text-muted-foreground"
                >
                  No records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
        <span className="text-muted-foreground">
          Page {page + 1} of {pages}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
