import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  FilePlus2,
  Layers,
  BadgeCheck,
  BookMarked,
  Ban,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CountUp } from "@/components/shared/CountUp";
import { authFetch, getUser, isAuthenticated } from "@/lib/auth";
import { getProductColor } from "@/lib/productColors";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard | Helloji Booking Desk" },
      {
        name: "description",
        content:
          "Live overview of travel enquiries, pipeline, confirmed queries and bookings for the Helloji travel desk.",
      },
      { property: "og:title", content: "Dashboard | Helloji Booking Desk" },
      {
        property: "og:description",
        content: "Live overview of travel enquiries, pipeline and bookings.",
      },
    ],
  }),
  component: Dashboard,
});

interface DashboardSummary {
  counts: {
    newQueries: number;
    pipeline: number;
    confirmed: number;
    allBooked: number;
    totalAborted: number;
    total: number;
  };
  charts: {
    queriesVsConfirmedVsBooked: { name: string; value: number; fill: string }[];
    pipelineVsAborted: { name: string; value: number; fill: string }[];
    byProduct: { product: string; count: number }[];
  };
  recent: Array<{
    id: string;
    bookingId: string;
    name: string;
    product: string;
    city: string;
    assignedAgent: string;
    status: string;
    date: string;
  }>;
  meta: {
    role: "admin" | "agent";
    scope: "all" | "assigned_only";
  };
}

function Dashboard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentUser = getUser();

  const fetchSummary = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/dashboard/summary");

      if (res.status === 401) {
        navigate({ to: "/" });
        return;
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to load dashboard data");
      }

      const data: DashboardSummary = await res.json();
      setSummary(data);
    } catch (err: any) {
      setError(
        err.message || "Couldn't load dashboard data — check your connection"
      );
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    // If not authenticated, redirect to login
    if (!isAuthenticated()) {
      navigate({ to: "/" });
      return;
    }
    fetchSummary();
  }, [fetchSummary, navigate]);

  const cards = summary
    ? [
        {
          label: "New Queries",
          value: summary.counts.newQueries,
          icon: FilePlus2,
          to: "/queries",
        },
        {
          label: "Pipeline",
          value: summary.counts.pipeline,
          icon: Layers,
          to: "/queries",
        },
        {
          label: "Confirmed",
          value: summary.counts.confirmed,
          icon: BadgeCheck,
          to: "/confirmed",
        },
        {
          label: "All Booked",
          value: summary.counts.allBooked,
          icon: BookMarked,
          to: "/bookings",
        },
        {
          label: "Total Aborted",
          value: summary.counts.totalAborted,
          icon: Ban,
          to: "/aborted",
        },
      ]
    : [];

  const isAdmin = summary?.meta.role === "admin" || currentUser?.role === "admin";

  return (
    <DashboardShell
      title="Dashboard"
      subtitle={
        isAdmin
          ? "Full desk view — showing all bookings across the agency."
          : "Personal desk view — showing only bookings assigned to or created by you."
      }
      actions={
        <div className="flex items-center gap-2">
          {summary && (
            <span className="hidden items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground sm:inline-flex">
              {isAdmin ? (
                <>
                  <ShieldCheck className="size-3.5 text-primary" />
                  Admin Visibility (All Bookings)
                </>
              ) : (
                <>
                  <UserCheck className="size-3.5 text-primary" />
                  Agent Visibility (My Bookings)
                </>
              )}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSummary}
            disabled={isLoading}
            title="Refresh dashboard"
          >
            <RefreshCw
              className={`size-3.5 mr-1 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button asChild>
            <Link to="/queries/new">New Query</Link>
          </Button>
        </div>
      }
    >
      {/* ─── Error state with retry ──────────────────────────────────────── */}
      {error && (
        <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="size-5 shrink-0" />
            <div>
              <p className="font-semibold text-sm">Dashboard sync error</p>
              <p className="text-xs opacity-90">{error}</p>
            </div>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={fetchSummary}
            className="ml-4 shrink-0"
          >
            Try Again
          </Button>
        </div>
      )}

      {/* ─── 5 KPI Cards ─────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="card-surface p-5 space-y-3">
                <div className="flex justify-between items-center">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="size-4 rounded-full" />
                </div>
                <Skeleton className="h-8 w-16" />
              </div>
            ))
          : cards.map((c) => (
              <Link
                key={c.label}
                to={c.to}
                className="card-surface p-5 transition-shadow hover:shadow-lg group"
              >
                <div className="flex items-start justify-between">
                  <p className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                    {c.label}
                  </p>
                  <c.icon className="size-4 text-primary" />
                </div>
                <p className="mt-3 font-display text-3xl font-bold">
                  <CountUp value={c.value} duration={900} />
                </p>
              </Link>
            ))}
      </div>

      {/* ─── Donut & Bar Charts ───────────────────────────────────────────── */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {/* Donut 1: Queries vs Confirmed vs Booked */}
        <div className="card-surface p-5">
          <h2 className="text-base font-semibold">
            Queries vs Confirmed vs Booked
          </h2>
          <div className="mt-2 h-64">
            {isLoading ? (
              <div className="flex h-full items-center justify-center">
                <Skeleton className="size-44 rounded-full" />
              </div>
            ) : summary ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={summary.charts.queriesVsConfirmedVsBooked}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                  >
                    {summary.charts.queriesVsConfirmedVsBooked.map((d) => (
                      <Cell key={d.name} fill={d.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        </div>

        {/* Donut 2: Pipeline vs Aborted */}
        <div className="card-surface p-5">
          <h2 className="text-base font-semibold">Pipeline vs Aborted</h2>
          <div className="mt-2 h-64">
            {isLoading ? (
              <div className="flex h-full items-center justify-center">
                <Skeleton className="size-44 rounded-full" />
              </div>
            ) : summary ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={summary.charts.pipelineVsAborted}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                  >
                    {summary.charts.pipelineVsAborted.map((d) => (
                      <Cell key={d.name} fill={d.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        </div>

        {/* Bar Chart: Enquiries by Product */}
        <div className="card-surface p-5">
          <h2 className="text-base font-semibold">Enquiries by product</h2>
          <div className="mt-2 h-64">
            {isLoading ? (
              <div className="flex h-full items-center justify-center">
                <Skeleton className="h-44 w-full" />
              </div>
            ) : summary ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.charts.byProduct}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="var(--color-border)"
                  />
                  <XAxis
                    dataKey="product"
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                  />
                  <Tooltip />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {summary.charts.byProduct.map((d) => (
                      <Cell key={d.product} fill={getProductColor(d.product).hex} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        </div>
      </div>

      {/* ─── Recent Activity List ────────────────────────────────────────── */}
      <div className="card-surface mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <h2 className="text-base font-semibold">Recent activity</h2>
            <p className="text-xs text-muted-foreground">
              {isAdmin
                ? "Recent queries and bookings across all desk agents"
                : "Your recently assigned queries and bookings"}
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/queries">View all queries</Link>
          </Button>
        </div>

        <div className="divide-y divide-border">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-40 flex-1" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            ))
          ) : summary?.recent && summary.recent.length > 0 ? (
            summary.recent.map((b) => (
              <Link
                key={b.id}
                to="/queries/$id"
                params={{ id: b.id }}
                className="flex flex-wrap items-center gap-3 p-4 hover:bg-muted/40 transition-colors"
              >
                <span className="w-24 font-mono font-medium text-xs text-primary">
                  {b.bookingId}
                </span>
                <span className="flex-1 min-w-40">
                  <span className="font-medium text-sm text-foreground">
                    {b.name}
                  </span>
                  <span className="block text-xs text-muted-foreground capitalize">
                    {b.product} {b.city ? `· ${b.city}` : ""}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {b.assignedAgent}
                </span>
                <StatusBadge status={b.status as any} />
              </Link>
            ))
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No recent bookings found for your desk scope.
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
