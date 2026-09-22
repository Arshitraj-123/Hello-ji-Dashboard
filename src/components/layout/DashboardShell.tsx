import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard, FilePlus2, ListChecks, BadgeCheck, BookMarked, CalendarDays,
  Ban, Hotel, Users, Wallet, Trash2, Settings, LogOut, Menu, Search, Bell, Plane,
  ScrollText, UserCog, ShieldCheck,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { getUser, logout } from "@/lib/auth";

type Item = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  soon?: boolean;
  permission?: string;
  adminOnly?: boolean;
};

const groups: { title?: string; items: Item[] }[] = [
  {
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/queries/new", label: "New Query", icon: FilePlus2, permission: "queries.add" },
      { to: "/queries", label: "All Queries", icon: ListChecks },
      { to: "/confirmed", label: "Confirmed Queries", icon: BadgeCheck },
      { to: "/bookings", label: "All Bookings", icon: BookMarked },
      { to: "/calendar", label: "Booking Calendar", icon: CalendarDays, permission: "calendar.menu" },
      { to: "/aborted", label: "All Aborted", icon: Ban },
    ],
  },
  {
    title: "Manage Hotel",
    items: [{ to: "/hotels", label: "All Hotel", icon: Hotel, permission: "hotel.viewAll" }],
  },
  {
    title: "Accounts Section",
    items: [{ to: "/accounts", label: "Unpaid / Paid", icon: Wallet, permission: "accounts.menu" }],
  },
  {
    title: "Visa Customers",
    items: [{ to: "/customers", label: "All Customers", icon: Users, permission: "customer.view" }],
  },
  {
    title: "Administration",
    items: [
      { to: "/users", label: "User Management", icon: Settings, adminOnly: true },
      { to: "/roles", label: "Roles & Permissions", icon: ShieldCheck, adminOnly: true },
      { to: "/logs", label: "Activity Log", icon: ScrollText, permission: "user.log" },
      { to: "/profile", label: "My Profile", icon: UserCog },
      { to: "/trash", label: "Recycle Bin", icon: Trash2, permission: "trash.recycleBin" },
    ],
  },
];


export function DashboardShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const user = getUser();

  const filteredGroups = groups
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => {
        if (item.adminOnly && user?.role !== "admin") return false;
        if (
          item.permission &&
          user?.role !== "admin" &&
          !user?.permissions?.includes(item.permission)
        ) {
          return false;
        }
        return true;
      }),
    }))
    .filter((g) => g.items.length > 0);

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "HJ";

  const displayRole = user?.role === "admin" ? "Admin" : "Agent";

  return (
    <div className="min-h-screen bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 overflow-y-auto bg-sidebar text-sidebar-foreground transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
          <span className="flex size-9 items-center justify-center rounded-md brand-gradient">
            <Plane className="size-5 text-primary-foreground" />
          </span>
          <div className="leading-tight">
            <p className="font-display text-base font-bold text-sidebar-accent-foreground">Helloji</p>
            <p className="text-[11px] uppercase tracking-widest opacity-60">Booking Desk</p>
          </div>
        </div>

        <nav className="space-y-5 px-3 py-5">
          {filteredGroups.map((g, i) => (
            <div key={i} className="space-y-1">
              {g.title && (
                <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] opacity-45">
                  {g.title}
                </p>
              )}
              {g.items.map((item) => {
                const isExact = path === item.to;
                const hasMoreSpecificItem = filteredGroups.some((group) =>
                  group.items.some(
                    (other) =>
                      other.to !== item.to &&
                      other.to.startsWith(item.to) &&
                      (path === other.to || path.startsWith(other.to + "/"))
                  )
                );
                const active =
                  isExact ||
                  (!hasMoreSpecificItem &&
                    item.to !== "/dashboard" &&
                    (path === item.to || path.startsWith(item.to + "/")));
                return (
                  <Link
                    key={item.to}
                    to={item.soon ? "/dashboard" : item.to}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                        : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <item.icon className="size-4 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {item.soon && <span className="text-[9px] uppercase opacity-50">soon</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      {open && (
        <div className="fixed inset-0 z-30 bg-foreground/40 lg:hidden" onClick={() => setOpen(false)} />
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-card px-4 md:px-6">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="size-5" />
          </button>
          <div className="relative hidden max-w-sm flex-1 md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search guests, booking ID…" className="pl-9" />
          </div>
          <div className="ml-auto flex items-center gap-4">
            <Bell className="size-5 text-muted-foreground" />
            <div className="flex items-center gap-2">
              {user?.photo ? (
                <img
                  src={user.photo}
                  alt={user.name}
                  className="size-9 rounded-full object-cover border border-border"
                />
              ) : (
                <span className="flex size-9 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                  {initials}
                </span>
              )}
              <div className="hidden text-sm leading-tight sm:block">
                <p className="font-medium">{user?.name || "Guest"}</p>
                <p className="text-xs text-muted-foreground">{displayRole}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="text-muted-foreground hover:text-primary transition-colors"
              aria-label="Log out"
              title="Sign out"
            >
              <LogOut className="size-5" />
            </button>
          </div>
        </header>

        <main className="p-4 md:p-6">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">{title}</h1>
              {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            {actions}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
