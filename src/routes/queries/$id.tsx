import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge, PriorityBadge } from "@/components/StatusBadge";
import type { Booking, Status, BookingNote } from "@/types/booking";
import { authFetch, getUser } from "@/lib/auth";

type Search = { edit?: boolean };

export const Route = createFileRoute("/queries/$id")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    edit: s["edit"] === true || s["edit"] === "true",
  }),
  head: () => ({
    meta: [
      { title: "Query Details | Helloji Booking Desk" },
      {
        name: "description",
        content:
          "Full enquiry record with guest details, product information, booking policy, agent assignment and internal notes.",
      },
      { property: "og:title", content: "Query Details | Helloji Booking Desk" },
      {
        property: "og:description",
        content: "Full enquiry record with details, assignment and internal notes.",
      },
    ],
  }),
  component: QueryDetail,
});

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

function QueryDetail() {
  const { id } = Route.useParams();
  const { edit } = Route.useSearch();
  const navigate = useNavigate();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [notes, setNotes] = useState<BookingNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [noteText, setNoteText] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const [agentOptions, setAgentOptions] = useState<AgentOption[]>([]);
  const currentUser = getUser();
  const canAssign =
    currentUser?.role === "admin" ||
    currentUser?.permissions?.includes("queries.assign");
  const canChangeStatus =
    currentUser?.role === "admin" ||
    currentUser?.permissions?.includes("queries.changeStatus");

  // Load active agents list
  useEffect(() => {
    let mounted = true;
    authFetch("/api/admin/users")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (mounted && data?.users) {
          const agents = data.users
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

  // Fetch record and its notes
  const fetchQuery = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Try /api/queries/:id first, fallback to /api/bookings/:id
      let res = await authFetch(`/api/queries/${id}`);
      if (res.status === 404) {
        res = await authFetch(`/api/bookings/${id}`);
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Record not found");
      }

      const doc = await res.json();
      setBooking(doc);

      // Fetch dedicated notes
      const notesRes = await authFetch(`/api/queries/${id}/notes`);
      if (notesRes.ok) {
        const notesData = await notesRes.json();
        setNotes(notesData || []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load record details");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchQuery();
  }, [fetchQuery]);

  // General field update handler (name, phone, email, details, etc.)
  const handleFieldUpdate = async (field: string, value: string) => {
    if (!booking) return;
    const targetId = booking.id || (booking as any)._id;
    try {
      const endpoint =
        booking.status === "booked"
          ? `/api/bookings/${targetId}`
          : `/api/queries/${targetId}`;

      const res = await authFetch(endpoint, {
        method: "PUT",
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Update failed");
      }
      const updated = await res.json();
      setBooking(updated);
      toast.success("Changes saved");
    } catch (err: any) {
      toast.error(err.message || "Failed to save changes");
    }
  };

  // Dedicated status update
  const handleStatusChange = async (newStatus: string) => {
    if (!booking) return;
    const targetId = booking.id || (booking as any)._id;
    setIsUpdating(true);
    try {
      const res = await authFetch(`/api/queries/${targetId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Failed to update status");
      }
      setBooking(data);
      toast.success(`Status updated to ${newStatus}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    } finally {
      setIsUpdating(false);
    }
  };

  // Dedicated agent assignment
  const handleAssignChange = async (newAgentId: string) => {
    if (!booking) return;
    const targetId = booking.id || (booking as any)._id;
    setIsUpdating(true);
    try {
      const res = await authFetch(`/api/queries/${targetId}/assign`, {
        method: "PATCH",
        body: JSON.stringify({ assignedAgent: newAgentId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Failed to assign agent");
      }
      setBooking(data);
      const agentObj = agentOptions.find((a) => a.id === newAgentId);
      toast.success(`Assigned to ${agentObj ? agentObj.name : "agent"}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to assign agent");
    } finally {
      setIsUpdating(false);
    }
  };

  // Conversion to booking
  const handleConvert = async () => {
    if (!booking) return;
    const targetId = booking.id || (booking as any)._id;
    setIsUpdating(true);
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
        throw new Error(data.message || "Failed to convert query");
      }
      setBooking(data);
      toast.success("Successfully converted to booking!");
    } catch (err: any) {
      toast.error(err.message || "Conversion failed");
    } finally {
      setIsUpdating(false);
    }
  };

  // Add internal note
  const handleAddNote = async () => {
    if (!noteText.trim() || !booking) return;
    const targetId = booking.id || (booking as any)._id;
    setSubmittingNote(true);
    try {
      const res = await authFetch(`/api/queries/${targetId}/notes`, {
        method: "POST",
        body: JSON.stringify({ note: noteText.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Failed to add note");
      }
      setNotes((prev) => [data, ...prev]);
      setNoteText("");
      toast.success("Note added");
    } catch (err: any) {
      toast.error(err.message || "Failed to add note");
    } finally {
      setSubmittingNote(false);
    }
  };

  if (loading) {
    return (
      <DashboardShell title="Loading details…">
        <div className="card-surface p-8 space-y-6">
          <div className="flex justify-between items-center">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-10 w-24" />
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-44 w-full" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (error || !booking) {
    return (
      <DashboardShell title="Query not found">
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6">
          <div className="flex items-center gap-3 text-destructive">
            <AlertCircle className="size-5" />
            <p className="font-medium">{error || "This record no longer exists."}</p>
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchQuery}>
              <RefreshCw className="size-4 mr-1" /> Retry
            </Button>
            <Button asChild size="sm">
              <Link to="/queries">Back to queries</Link>
            </Button>
          </div>
        </div>
      </DashboardShell>
    );
  }

  const editing = !!edit;
  const currentAgentId =
    typeof booking.assignedAgent === "object" && booking.assignedAgent
      ? (booking.assignedAgent as any)._id || booking.assignedAgent.id
      : booking.assignedAgent;

  const currentAgentName =
    typeof booking.assignedAgent === "object" && booking.assignedAgent
      ? booking.assignedAgent.name
      : booking.assignedAgent || "Unassigned";

  const createdByName =
    typeof booking.createdBy === "object" && booking.createdBy
      ? booking.createdBy.name
      : booking.createdBy || "System";

  return (
    <DashboardShell
      title={`${booking.bookingId} · ${booking.name}`}
      subtitle={`${booking.product} enquiry · ${booking.destination} · ${
        booking.enquiryType || booking.enqueryType || "B2C"
      }`}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate({ to: "/queries" })}>
            <ArrowLeft className="size-4 mr-1" /> Back
          </Button>
          <Button
            onClick={() =>
              navigate({
                to: "/queries/$id",
                params: { id },
                search: { edit: !editing },
              })
            }
          >
            {editing ? "Done editing" : "Edit"}
          </Button>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card-surface space-y-5 p-6 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={booking.status} />
            <PriorityBadge priority={booking.priority} />
            <span className="text-sm text-muted-foreground">
              Raised {booking.date} by {createdByName}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <F
              label="Name"
              value={booking.name}
              editing={editing}
              onChange={(v) => handleFieldUpdate("name", v)}
            />
            <F
              label="Phone"
              value={booking.phone}
              editing={editing}
              onChange={(v) => handleFieldUpdate("phone", v)}
            />
            <F
              label="Email"
              value={booking.email}
              editing={editing}
              onChange={(v) => handleFieldUpdate("email", v)}
            />
            <F
              label="City"
              value={booking.city}
              editing={editing}
              onChange={(v) => handleFieldUpdate("city", v)}
            />
            <F
              label="Check-in / Start Date"
              value={booking.startDate ?? ""}
              editing={editing}
              onChange={(v) => handleFieldUpdate("startDate", v)}
            />
            <F
              label="Check-out / End Date"
              value={booking.endDate ?? ""}
              editing={editing}
              onChange={(v) => handleFieldUpdate("endDate", v)}
            />
          </div>

          {booking.product === "hotel" && (
            <Section title="Hotel details">
              <F
                label="Property"
                value={booking.propertyName ?? ""}
                editing={editing}
                onChange={(v) => handleFieldUpdate("propertyName", v)}
              />
              <F
                label="Confirmation no."
                value={booking.hotelConfirmationNo ?? ""}
                editing={editing}
                onChange={(v) => handleFieldUpdate("hotelConfirmationNo", v)}
              />
              <F
                label="Rooms"
                value={booking.noOfRooms || booking.noRoom || ""}
                editing={editing}
                onChange={(v) => handleFieldUpdate("noOfRooms", v)}
              />
              <F
                label="Meal plan"
                value={booking.mealPlan ?? ""}
                editing={editing}
                onChange={(v) => handleFieldUpdate("mealPlan", v)}
              />
              <F
                label="Room type"
                value={booking.roomType ?? ""}
                editing={editing}
                onChange={(v) => handleFieldUpdate("roomType", v)}
              />
              <F
                label="Adults / Children"
                value={`${booking.noOfAdults || booking.adults || "—"} / ${
                  booking.noOfChildren || booking.children || "—"
                }`}
                editing={false}
                onChange={() => {}}
              />
            </Section>
          )}

          {booking.product === "ticket" && (
            <Section title="Ticket details">
              <F
                label="Airline"
                value={booking.airlineName ?? ""}
                editing={editing}
                onChange={(v) => handleFieldUpdate("airlineName", v)}
              />
              <F
                label="Flight number"
                value={booking.flightNumber ?? ""}
                editing={editing}
                onChange={(v) => handleFieldUpdate("flightNumber", v)}
              />
              <F
                label="Sector"
                value={booking.sectorName ?? ""}
                editing={editing}
                onChange={(v) => handleFieldUpdate("sectorName", v)}
              />
              <F
                label="Airline PNR"
                value={booking.airlinePnr ?? ""}
                editing={editing}
                onChange={(v) => handleFieldUpdate("airlinePnr", v)}
              />
              <F
                label="GDS PNR"
                value={booking.gdsPnr ?? ""}
                editing={editing}
                onChange={(v) => handleFieldUpdate("gdsPnr", v)}
              />
            </Section>
          )}

          {booking.product === "package" && (
            <Section title="Package details">
              <F
                label="Package"
                value={booking.packageName ?? ""}
                editing={editing}
                onChange={(v) => handleFieldUpdate("packageName", v)}
              />
              <F
                label="Duration"
                value={booking.duration ?? ""}
                editing={editing}
                onChange={(v) => handleFieldUpdate("duration", v)}
              />
              <F
                label="Inclusions"
                value={booking.inclusion ?? ""}
                editing={editing}
                onChange={(v) => handleFieldUpdate("inclusion", v)}
              />
            </Section>
          )}

          <div className="space-y-2">
            <Label>Details</Label>
            {editing ? (
              <Textarea
                rows={4}
                defaultValue={booking.details}
                onBlur={(e) => handleFieldUpdate("details", e.target.value)}
              />
            ) : (
              <p className="text-sm text-muted-foreground">{booking.details || "—"}</p>
            )}
          </div>

          <div className="rounded-md bg-muted/60 p-4 text-sm">
            <p className="font-medium">Booking policy</p>
            <p className="mt-1 text-muted-foreground">{booking.bookingPolicy}</p>
            <p className="mt-3 text-muted-foreground">
              Emergency contact: {booking.dmName} · {booking.dmContact} ·{" "}
              {booking.specialRequest}
            </p>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="card-surface space-y-4 p-6">
            <h2 className="text-base font-semibold">Workflow</h2>
            <div className="space-y-2">
              <Label>Status</Label>
              {canChangeStatus ? (
                <Select
                  value={booking.status}
                  disabled={isUpdating}
                  onValueChange={handleStatusChange}
                >
                  <SelectTrigger>
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
                <div className="pt-1">
                  <StatusBadge status={booking.status} />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Assigned agent</Label>
              {canAssign && agentOptions.length > 0 ? (
                <Select
                  value={currentAgentId}
                  disabled={isUpdating}
                  onValueChange={handleAssignChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an agent">
                      {currentAgentName}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {agentOptions.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm font-medium">{currentAgentName}</p>
              )}
            </div>

            {booking.status !== "booked" && (
              <Button
                className="w-full"
                disabled={isUpdating}
                onClick={handleConvert}
              >
                {isUpdating && <Loader2 className="size-4 mr-2 animate-spin" />}
                Convert to booking
              </Button>
            )}

            {booking.status === "booked" && (
              <Button asChild className="w-full" variant="outline">
                <Link
                  to="/bookings/$id/voucher"
                  params={{ id: booking.id || (booking as any)._id }}
                >
                  View Brochure / Voucher
                </Link>
              </Button>
            )}
          </div>

          <div className="card-surface space-y-4 p-6">
            <h2 className="text-base font-semibold">Notes</h2>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {notes.map((n) => {
                const authorName =
                  typeof n.user === "object" && n.user
                    ? n.user.name
                    : n.user || "Staff";
                const noteDate = n.createdAt
                  ? new Date(n.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : n.at || "";

                return (
                  <div
                    key={n.id}
                    className="rounded-md border border-border p-3 text-sm bg-muted/20"
                  >
                    <p className="text-foreground">{n.note}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {authorName} · {noteDate}
                    </p>
                  </div>
                );
              })}
              {notes.length === 0 && (
                <p className="text-sm text-muted-foreground">No notes yet.</p>
              )}
            </div>
            <Textarea
              rows={3}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add an internal note…"
            />
            <Button
              variant="outline"
              className="w-full"
              disabled={submittingNote || !noteText.trim()}
              onClick={handleAddNote}
            >
              {submittingNote && (
                <Loader2 className="size-4 mr-2 animate-spin" />
              )}
              Add note
            </Button>
          </div>
        </aside>
      </div>
    </DashboardShell>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function F({
  label,
  value,
  editing,
  onChange,
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {editing ? (
        <Input defaultValue={value} onBlur={(e) => onChange(e.target.value)} />
      ) : (
        <p className="text-sm">{value || "—"}</p>
      )}
    </div>
  );
}
