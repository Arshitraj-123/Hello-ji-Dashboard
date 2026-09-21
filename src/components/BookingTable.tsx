import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Eye,
  Pencil,
  Trash2,
  ArrowUpRight,
  Loader2,
  RefreshCw,
  ArrowUpDown,
  FileText,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PriorityBadge } from "@/components/StatusBadge";
import { ExportToolbar } from "@/components/shared/ExportToolbar";
import type { ExportColumn } from "@/lib/export";
import type { Booking, Status } from "@/types/booking";
import { authFetch, getUser } from "@/lib/auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STATUSES: Status[] = [
  "New Query",
  "Pipeline",
  "Confirmed",
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
  variant = "all-queries",
  onRefresh,
  exportFilename,
  exportTitle,
}: {
  rows: Booking[];
  showAssign?: boolean;
  showStatus?: boolean;
  variant?: "all-queries" | "confirmed" | "query" | "booking";
  onRefresh?: () => void;
  exportFilename?: string;
  exportTitle?: string;
}) {
  const isConfirmedTable = variant === "confirmed";
  const isBookingTable = variant === "booking";
  const isAllQueriesTable = variant === "all-queries" || variant === "query";

  const [q, setQ] = useState("");
  const [product, setProduct] = useState("all");
  const [page, setPage] = useState(0);
  const perPage = 10;
  const [busyAction, setBusyAction] = useState<string | null>(null);

  // Local pending selections for dropdowns before/after click
  const [pendingStatus, setPendingStatus] = useState<Record<string, string>>({});
  const [pendingAssign, setPendingAssign] = useState<Record<string, string>>({});
  const [pendingRaisedBy, setPendingRaisedBy] = useState<Record<string, string>>({});

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
      .catch(() => {});

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
      if (typeof r.createdBy === "object" && r.createdBy) {
        const id = (r.createdBy as any)._id || r.createdBy.id;
        if (id && r.createdBy.name) {
          map.set(id, r.createdBy.name);
        }
      }
    });

    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [agentOptions, rows]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      const pMatch =
        product === "all" || r.product?.toLowerCase() === product.toLowerCase();
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
        r.destination ?? "",
        r.enquiryType ?? "",
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

  // Agent reassignment handler via red button
  const handleAssignUpdate = async (booking: Booking) => {
    const targetId = booking.id || (booking as any)._id;
    const currentAgentId =
      typeof booking.assignedAgent === "object" && booking.assignedAgent
        ? (booking.assignedAgent as any)._id || booking.assignedAgent.id
        : booking.assignedAgent;
    const newAgentId = pendingAssign[targetId] || currentAgentId;
    if (!newAgentId) return;

    setBusyAction(`${targetId}-assign`);
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
        `${booking.bookingId} assigned to ${agentObj ? agentObj.name : "agent"}`
      );
      setPendingAssign((prev) => {
        const next = { ...prev };
        delete next[targetId];
        return next;
      });
      onRefresh?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to reassign agent");
    } finally {
      setBusyAction(null);
    }
  };

  // Raised by update handler via red button
  const handleRaisedByUpdate = async (booking: Booking) => {
    const targetId = booking.id || (booking as any)._id;
    const currentCreatedById =
      typeof booking.createdBy === "object" && booking.createdBy
        ? (booking.createdBy as any)._id || booking.createdBy.id
        : booking.createdBy;
    const newRaisedById = pendingRaisedBy[targetId] || currentCreatedById;
    if (!newRaisedById) return;

    setBusyAction(`${targetId}-raisedBy`);
    try {
      const res = await authFetch(`/api/queries/${targetId}/raised-by`, {
        method: "PATCH",
        body: JSON.stringify({ raisedBy: newRaisedById }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Failed to update raised by");
      }
      const userObj = availableAgents.find((a) => a.id === newRaisedById);
      toast.success(
        `${booking.bookingId} raised by updated to ${userObj ? userObj.name : "user"}`
      );
      setPendingRaisedBy((prev) => {
        const next = { ...prev };
        delete next[targetId];
        return next;
      });
      onRefresh?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to update raised by");
    } finally {
      setBusyAction(null);
    }
  };

  // Status update handler via red button
  const handleStatusUpdate = async (booking: Booking) => {
    const targetId = booking.id || (booking as any)._id;
    const newStatus = pendingStatus[targetId] || booking.status;

    setBusyAction(`${targetId}-status`);
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
      setPendingStatus((prev) => {
        const next = { ...prev };
        delete next[targetId];
        return next;
      });
      onRefresh?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    } finally {
      setBusyAction(null);
    }
  };

  // Convert to booking handler
  const handleConvert = async (booking: Booking) => {
    const targetId = booking.id || (booking as any)._id;
    setBusyAction(`${targetId}-convert`);
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
      setBusyAction(null);
    }
  };

  // Soft delete query handler
  const handleDelete = async (booking: Booking) => {
    const targetId = booking.id || (booking as any)._id;
    setBusyAction(`${targetId}-delete`);
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
      setBusyAction(null);
    }
  };

  const exportColumns: ExportColumn<Booking>[] = useMemo(() => {
    if (isConfirmedTable) {
      return [
        { header: "Sr.No", key: "bookingId", formatter: (_v, _r, idx) => String(idx + 1) },
        { header: "Ref_ID", key: "bookingId" },
        {
          header: "Raised By",
          key: "createdBy",
          formatter: (v) => (typeof v === "object" && v ? v.name : v || "—"),
        },
        {
          header: "Date",
          key: "date",
          formatter: (v, r) => v || (r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-IN") : "—"),
        },
        { header: "Type", key: "enquiryType", formatter: (v, r) => v || r.enqueryType || "B2C" },
        { header: "Destination", key: "destination" },
        { header: "Name", key: "name" },
        { header: "Phone", key: "phone" },
        { header: "Email", key: "email" },
        { header: "Product", key: "product" },
        {
          header: "Assigned To",
          key: "assignedAgent",
          formatter: (v) => (typeof v === "object" && v ? v.name : v || "Unassigned"),
        },
        { header: "Status", key: "status" },
      ];
    }
    return [
      { header: "Sr.No", key: "bookingId", formatter: (_v, _r, idx) => String(idx + 1) },
      { header: "Ref_ID", key: "bookingId" },
      {
        header: "Date",
        key: "date",
        formatter: (v, r) => v || (r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-IN") : "—"),
      },
      { header: "Type", key: "enquiryType", formatter: (v, r) => v || r.enqueryType || "B2C" },
      { header: "Destination", key: "destination" },
      { header: "Name", key: "name" },
      { header: "Phone", key: "phone" },
      { header: "Email", key: "email" },
      { header: "Priority", key: "priority" },
      { header: "Product", key: "product" },
      {
        header: "Raised By",
        key: "createdBy",
        formatter: (v) => (typeof v === "object" && v ? v.name : v || "—"),
      },
      {
        header: "Assigned To",
        key: "assignedAgent",
        formatter: (v) => (typeof v === "object" && v ? v.name : v || "Unassigned"),
      },
      { header: "Status", key: "status" },
    ];
  }, [isConfirmedTable]);

  return (
    <div className="card-surface overflow-hidden">
      {/* Search & Export Toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(0);
          }}
          placeholder="Search by name, Ref ID, phone, email…"
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
            <SelectValue placeholder="All products" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All products</SelectItem>
            <SelectItem value="hotel">Hotel</SelectItem>
            <SelectItem value="ticket">Ticket</SelectItem>
            <SelectItem value="package">Package</SelectItem>
            <SelectItem value="visa">Visa</SelectItem>
            <SelectItem value="insurance">Insurance</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          <ExportToolbar
            data={filtered}
            columns={exportColumns}
            filename={
              exportFilename ||
              (isConfirmedTable
                ? "confirmed-queries"
                : isBookingTable
                  ? "bookings"
                  : "queries")
            }
            title={
              exportTitle ||
              (isConfirmedTable
                ? "Confirmed Queries"
                : isBookingTable
                  ? "Bookings List"
                  : "All Queries List")
            }
          />
          <span className="text-sm text-muted-foreground">
            {filtered.length} record{filtered.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {/* Table Display */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1250px] text-sm">
          <thead className="bg-muted/60 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
            <tr>
              {/* Confirmed Queries Column Order */}
              {isConfirmedTable ? (
                <>
                  <th className="px-3 py-3 w-14">
                    <span className="inline-flex items-center gap-1 font-bold text-foreground">
                      Sr.No <ArrowUpDown className="size-3 text-muted-foreground/60" />
                    </span>
                  </th>
                  <th className="px-3 py-3">
                    <span className="inline-flex items-center gap-1 font-bold text-foreground">
                      Ref_ID <ArrowUpDown className="size-3 text-muted-foreground/60" />
                    </span>
                  </th>
                  <th className="px-3 py-3">
                    <span className="inline-flex items-center gap-1 font-bold text-foreground">
                      Raised By <ArrowUpDown className="size-3 text-muted-foreground/60" />
                    </span>
                  </th>
                  <th className="px-3 py-3">
                    <span className="inline-flex items-center gap-1 font-bold text-foreground">
                      Date <ArrowUpDown className="size-3 text-muted-foreground/60" />
                    </span>
                  </th>
                  <th className="px-3 py-3">
                    <span className="inline-flex items-center gap-1 font-bold text-foreground">
                      Type <ArrowUpDown className="size-3 text-muted-foreground/60" />
                    </span>
                  </th>
                  <th className="px-3 py-3">
                    <span className="inline-flex items-center gap-1 font-bold text-foreground">
                      Destination <ArrowUpDown className="size-3 text-muted-foreground/60" />
                    </span>
                  </th>
                  <th className="px-3 py-3">
                    <span className="inline-flex items-center gap-1 font-bold text-foreground">
                      Name <ArrowUpDown className="size-3 text-muted-foreground/60" />
                    </span>
                  </th>
                  <th className="px-3 py-3">
                    <span className="inline-flex items-center gap-1 font-bold text-foreground">
                      Phone <ArrowUpDown className="size-3 text-muted-foreground/60" />
                    </span>
                  </th>
                  <th className="px-3 py-3">
                    <span className="inline-flex items-center gap-1 font-bold text-foreground">
                      Email <ArrowUpDown className="size-3 text-muted-foreground/60" />
                    </span>
                  </th>
                  <th className="px-3 py-3">
                    <span className="inline-flex items-center gap-1 font-bold text-foreground">
                      Product <ArrowUpDown className="size-3 text-muted-foreground/60" />
                    </span>
                  </th>
                  <th className="px-3 py-3">
                    <span className="inline-flex items-center gap-1 font-bold text-foreground">
                      Assigned To <ArrowUpDown className="size-3 text-muted-foreground/60" />
                    </span>
                  </th>
                  <th className="px-3 py-3">
                    <span className="inline-flex items-center gap-1 font-bold text-foreground">
                      Status <ArrowUpDown className="size-3 text-muted-foreground/60" />
                    </span>
                  </th>
                  <th className="px-3 py-3 text-right">Action</th>
                </>
              ) : (
                /* All Queries Column Order */
                <>
                  <th className="px-3 py-3 w-14">
                    <span className="inline-flex items-center gap-1 font-bold text-foreground">
                      Sr.No <ArrowUpDown className="size-3 text-muted-foreground/60" />
                    </span>
                  </th>
                  <th className="px-3 py-3">
                    <span className="inline-flex items-center gap-1 font-bold text-foreground">
                      Ref_ID <ArrowUpDown className="size-3 text-muted-foreground/60" />
                    </span>
                  </th>
                  <th className="px-3 py-3">
                    <span className="inline-flex items-center gap-1 font-bold text-foreground">
                      Date <ArrowUpDown className="size-3 text-muted-foreground/60" />
                    </span>
                  </th>
                  <th className="px-3 py-3">
                    <span className="inline-flex items-center gap-1 font-bold text-foreground">
                      Type <ArrowUpDown className="size-3 text-muted-foreground/60" />
                    </span>
                  </th>
                  <th className="px-3 py-3">
                    <span className="inline-flex items-center gap-1 font-bold text-foreground">
                      Destination <ArrowUpDown className="size-3 text-muted-foreground/60" />
                    </span>
                  </th>
                  <th className="px-3 py-3">
                    <span className="inline-flex items-center gap-1 font-bold text-foreground">
                      Name <ArrowUpDown className="size-3 text-muted-foreground/60" />
                    </span>
                  </th>
                  <th className="px-3 py-3">
                    <span className="inline-flex items-center gap-1 font-bold text-foreground">
                      Phone <ArrowUpDown className="size-3 text-muted-foreground/60" />
                    </span>
                  </th>
                  <th className="px-3 py-3">
                    <span className="inline-flex items-center gap-1 font-bold text-foreground">
                      Email <ArrowUpDown className="size-3 text-muted-foreground/60" />
                    </span>
                  </th>
                  <th className="px-3 py-3">
                    <span className="inline-flex items-center gap-1 font-bold text-foreground">
                      Priority <ArrowUpDown className="size-3 text-muted-foreground/60" />
                    </span>
                  </th>
                  <th className="px-3 py-3">
                    <span className="inline-flex items-center gap-1 font-bold text-foreground">
                      Product <ArrowUpDown className="size-3 text-muted-foreground/60" />
                    </span>
                  </th>
                  <th className="px-3 py-3">
                    <span className="inline-flex items-center gap-1 font-bold text-foreground">
                      Raised By <ArrowUpDown className="size-3 text-muted-foreground/60" />
                    </span>
                  </th>
                  <th className="px-3 py-3">
                    <span className="inline-flex items-center gap-1 font-bold text-foreground">
                      Assigned To <ArrowUpDown className="size-3 text-muted-foreground/60" />
                    </span>
                  </th>
                  <th className="px-3 py-3">
                    <span className="inline-flex items-center gap-1 font-bold text-foreground">
                      Status <ArrowUpDown className="size-3 text-muted-foreground/60" />
                    </span>
                  </th>
                  <th className="px-3 py-3 text-right">Action</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {view.map((b, idx) => {
              const targetId = b.id || (b as any)._id;
              const srNo = page * perPage + idx + 1;

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

              const createdById =
                typeof b.createdBy === "object" && b.createdBy
                  ? (b.createdBy as any)._id || b.createdBy.id
                  : b.createdBy;

              const formattedDate =
                b.date ||
                (b.createdAt
                  ? new Date(b.createdAt).toLocaleDateString("en-IN")
                  : "—");

              const enquiryType = b.enquiryType || b.enqueryType || "B2C";
              const destination = b.destination || "Domestic";

              return (
                <tr key={targetId} className="hover:bg-muted/40 transition-colors">
                  {/* Confirmed Queries Row Cells */}
                  {isConfirmedTable ? (
                    <>
                      {/* 1. Sr.No */}
                      <td className="px-3 py-3 text-xs font-medium text-muted-foreground">
                        {srNo}
                      </td>

                      {/* 2. Ref_ID */}
                      <td className="px-3 py-3 font-semibold">
                        <Link
                          to="/queries/$id"
                          params={{ id: targetId }}
                          className="text-primary hover:underline"
                        >
                          {b.bookingId}
                        </Link>
                      </td>

                      {/* 3. Raised By */}
                      <td className="px-3 py-3 text-xs font-medium text-foreground">
                        {createdByName}
                      </td>

                      {/* 4. Date */}
                      <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {formattedDate}
                      </td>

                      {/* 5. Type */}
                      <td className="px-3 py-3 text-xs font-medium">
                        {enquiryType}
                      </td>

                      {/* 6. Destination */}
                      <td className="px-3 py-3 text-xs">
                        {destination}
                      </td>

                      {/* 7. Name */}
                      <td className="px-3 py-3 font-medium text-foreground">
                        {b.name}
                      </td>

                      {/* 8. Phone */}
                      <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {b.phone}
                      </td>

                      {/* 9. Email */}
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {b.email}
                      </td>

                      {/* 10. Product */}
                      <td className="px-3 py-3 text-xs capitalize font-medium">
                        {b.product}
                      </td>

                      {/* 11. Assigned To (Dropdown + Red Refresh Button) */}
                      <td className="px-3 py-3">
                        {canAssign && availableAgents.length > 0 ? (
                          <div className="flex items-center gap-1.5 whitespace-nowrap">
                            <Select
                              value={pendingAssign[targetId] ?? agentId ?? ""}
                              disabled={busyAction === `${targetId}-assign`}
                              onValueChange={(v) => {
                                setPendingAssign((prev) => ({
                                  ...prev,
                                  [targetId]: v,
                                }));
                              }}
                            >
                              <SelectTrigger className="h-8 w-28 text-xs bg-white">
                                <SelectValue placeholder="Assign">
                                  {availableAgents.find(
                                    (a) =>
                                      a.id ===
                                      (pendingAssign[targetId] ?? agentId)
                                  )?.name || agentName}
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
                            <button
                              type="button"
                              disabled={busyAction === `${targetId}-assign`}
                              onClick={() => handleAssignUpdate(b)}
                              className="h-8 w-8 rounded-md bg-[#b91c1c] hover:bg-[#991b1b] active:scale-95 flex items-center justify-center text-white shrink-0 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                              title="Update Assigned To"
                            >
                              <RefreshCw
                                className={cn(
                                  "size-3.5 text-white",
                                  busyAction === `${targetId}-assign` &&
                                    "animate-spin"
                                )}
                              />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs font-medium">
                            {agentName}
                          </span>
                        )}
                      </td>

                      {/* 12. Status (Text 'Confirmed' as in Image 1) */}
                      <td className="px-3 py-3 text-xs font-semibold text-foreground">
                        {b.status}
                      </td>

                      {/* 13. Action */}
                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            asChild
                            size="icon"
                            variant="ghost"
                            className="size-7"
                            aria-label="View"
                            title="View Query"
                          >
                            <Link to="/queries/$id" params={{ id: targetId }}>
                              <Eye className="size-4" />
                            </Link>
                          </Button>
                          <Button
                            asChild
                            size="icon"
                            variant="ghost"
                            className="size-7"
                            aria-label="Edit"
                            title="Edit Query"
                          >
                            <Link
                              to="/queries/$id"
                              params={{ id: targetId }}
                              search={{ edit: true }}
                            >
                              <Pencil className="size-4" />
                            </Link>
                          </Button>
                          <Button
                            asChild
                            size="icon"
                            variant="ghost"
                            className="size-7"
                            aria-label="Voucher"
                            title="View Voucher"
                          >
                            <Link
                              to="/bookings/$id/voucher"
                              params={{ id: targetId }}
                            >
                              <FileText className="size-4 text-primary" />
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </>
                  ) : (
                    /* All Queries Row Cells */
                    <>
                      {/* 1. Sr.No */}
                      <td className="px-3 py-3 text-xs font-medium text-muted-foreground">
                        {srNo}
                      </td>

                      {/* 2. Ref_ID */}
                      <td className="px-3 py-3 font-semibold">
                        <Link
                          to="/queries/$id"
                          params={{ id: targetId }}
                          className="text-primary hover:underline"
                        >
                          {b.bookingId}
                        </Link>
                      </td>

                      {/* 3. Date */}
                      <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {formattedDate}
                      </td>

                      {/* 4. Type */}
                      <td className="px-3 py-3 text-xs font-medium">
                        {enquiryType}
                      </td>

                      {/* 5. Destination */}
                      <td className="px-3 py-3 text-xs">
                        {destination}
                      </td>

                      {/* 6. Name */}
                      <td className="px-3 py-3 font-medium text-foreground">
                        {b.name}
                      </td>

                      {/* 7. Phone */}
                      <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {b.phone}
                      </td>

                      {/* 8. Email */}
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {b.email}
                      </td>

                      {/* 9. Priority */}
                      <td className="px-3 py-3">
                        <PriorityBadge priority={b.priority} />
                      </td>

                      {/* 10. Product */}
                      <td className="px-3 py-3 text-xs capitalize font-medium">
                        {b.product}
                      </td>

                      {/* 11. Raised By (Dropdown + Red Refresh Button) */}
                      <td className="px-3 py-3">
                        {canAssign && availableAgents.length > 0 ? (
                          <div className="flex items-center gap-1.5 whitespace-nowrap">
                            <Select
                              value={pendingRaisedBy[targetId] ?? createdById ?? ""}
                              disabled={busyAction === `${targetId}-raisedBy`}
                              onValueChange={(v) => {
                                setPendingRaisedBy((prev) => ({
                                  ...prev,
                                  [targetId]: v,
                                }));
                              }}
                            >
                              <SelectTrigger className="h-8 w-28 text-xs bg-white">
                                <SelectValue placeholder="Raised By">
                                  {availableAgents.find(
                                    (a) =>
                                      a.id ===
                                      (pendingRaisedBy[targetId] ?? createdById)
                                  )?.name || createdByName}
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
                            <button
                              type="button"
                              disabled={busyAction === `${targetId}-raisedBy`}
                              onClick={() => handleRaisedByUpdate(b)}
                              className="h-8 w-8 rounded-md bg-[#b91c1c] hover:bg-[#991b1b] active:scale-95 flex items-center justify-center text-white shrink-0 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                              title="Update Raised By"
                            >
                              <RefreshCw
                                className={cn(
                                  "size-3.5 text-white",
                                  busyAction === `${targetId}-raisedBy` &&
                                    "animate-spin"
                                )}
                              />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs font-medium">
                            {createdByName}
                          </span>
                        )}
                      </td>

                      {/* 12. Assigned To (Dropdown + Red Refresh Button) */}
                      <td className="px-3 py-3">
                        {showAssign && (
                          canAssign && availableAgents.length > 0 ? (
                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                              <Select
                                value={pendingAssign[targetId] ?? agentId ?? ""}
                                disabled={busyAction === `${targetId}-assign`}
                                onValueChange={(v) => {
                                  setPendingAssign((prev) => ({
                                    ...prev,
                                    [targetId]: v,
                                  }));
                                }}
                              >
                                <SelectTrigger className="h-8 w-28 text-xs bg-white">
                                  <SelectValue placeholder="Assign">
                                    {availableAgents.find(
                                      (a) =>
                                        a.id ===
                                        (pendingAssign[targetId] ?? agentId)
                                    )?.name || agentName}
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
                              <button
                                type="button"
                                disabled={busyAction === `${targetId}-assign`}
                                onClick={() => handleAssignUpdate(b)}
                                className="h-8 w-8 rounded-md bg-[#b91c1c] hover:bg-[#991b1b] active:scale-95 flex items-center justify-center text-white shrink-0 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                                title="Update Assigned To"
                              >
                                <RefreshCw
                                  className={cn(
                                    "size-3.5 text-white",
                                    busyAction === `${targetId}-assign` &&
                                      "animate-spin"
                                  )}
                                />
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs font-medium">
                              {agentName}
                            </span>
                          )
                        )}
                      </td>

                      {/* 13. Status (Dropdown + Red Refresh Button) */}
                      <td className="px-3 py-3">
                        {showStatus && (
                          canChangeStatus ? (
                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                              <Select
                                value={pendingStatus[targetId] ?? b.status}
                                disabled={busyAction === `${targetId}-status`}
                                onValueChange={(v) => {
                                  setPendingStatus((prev) => ({
                                    ...prev,
                                    [targetId]: v,
                                  }));
                                }}
                              >
                                <SelectTrigger className="h-8 w-28 text-xs bg-white">
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
                              <button
                                type="button"
                                disabled={busyAction === `${targetId}-status`}
                                onClick={() => handleStatusUpdate(b)}
                                className="h-8 w-8 rounded-md bg-[#b91c1c] hover:bg-[#991b1b] active:scale-95 flex items-center justify-center text-white shrink-0 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                                title="Update Status"
                              >
                                <RefreshCw
                                  className={cn(
                                    "size-3.5 text-white",
                                    busyAction === `${targetId}-status` &&
                                      "animate-spin"
                                  )}
                                />
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs font-medium">
                              {b.status}
                            </span>
                          )
                        )}
                      </td>

                      {/* 14. Action */}
                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {busyAction?.startsWith(targetId) && (
                            <Loader2 className="size-4 animate-spin text-primary mr-1" />
                          )}
                          <Button
                            asChild
                            size="icon"
                            variant="ghost"
                            className="size-7"
                            aria-label="View"
                            title="View Query"
                          >
                            <Link to="/queries/$id" params={{ id: targetId }}>
                              <Eye className="size-4" />
                            </Link>
                          </Button>
                          <Button
                            asChild
                            size="icon"
                            variant="ghost"
                            className="size-7"
                            aria-label="Edit"
                            title="Edit Query"
                          >
                            <Link
                              to="/queries/$id"
                              params={{ id: targetId }}
                              search={{ edit: true }}
                            >
                              <Pencil className="size-4" />
                            </Link>
                          </Button>
                          {b.status !== "booked" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7"
                              disabled={!!busyAction}
                              aria-label="Convert to booking"
                              title="Convert to booking"
                              onClick={() => handleConvert(b)}
                            >
                              <ArrowUpRight className="size-4 text-emerald-600" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7"
                            disabled={!!busyAction}
                            aria-label="Delete"
                            title="Move to recycle bin"
                            onClick={() => handleDelete(b)}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
            {view.length === 0 && (
              <tr>
                <td
                  colSpan={isConfirmedTable ? 13 : 14}
                  className="px-4 py-12 text-center text-muted-foreground"
                >
                  No records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
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
