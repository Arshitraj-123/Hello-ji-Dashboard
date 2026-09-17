import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExportToolbar } from "@/components/shared/ExportToolbar";
import type { ExportColumn } from "@/lib/export";
import { authFetch } from "@/lib/auth";
import type { Booking } from "@/types/booking";
import { AlertCircle, RefreshCw, Loader2 } from "lucide-react";

const accountsExportColumns: ExportColumn<Booking>[] = [
  { header: "Booking ID", key: "bookingId" },
  { header: "Guest Name", key: "name" },
  { header: "City", key: "city" },
  {
    header: "Product",
    key: "product",
    formatter: (val) => (val ? String(val).toUpperCase() : ""),
  },
  { header: "Invoice No", key: "billingNumber" },
  {
    header: "Billing Status",
    key: "billingStatus",
    formatter: (val) => (val ? String(val).toUpperCase() : "UNPAID"),
  },
  { header: "Remark", key: "billingRemark" },
  { header: "Phone", key: "phone" },
  { header: "Email", key: "email" },
];

export const Route = createFileRoute("/accounts")({
  head: () => ({
    meta: [
      { title: "Accounts | Helloji Booking Desk" },
      {
        name: "description",
        content:
          "Track paid and unpaid travel bookings, invoice numbers, billing dates and payment remarks in one place.",
      },
      { property: "og:title", content: "Accounts | Helloji Booking Desk" },
      {
        property: "og:description",
        content: "Track paid and unpaid bookings with invoice details.",
      },
    ],
  }),
  component: Accounts,
});

function Accounts() {
  const [activeTab, setActiveTab] = useState<"unpaid" | "paid">("unpaid");
  const [unpaidRows, setUnpaidRows] = useState<Booking[]>([]);
  const [paidRows, setPaidRows] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [unpaidRes, paidRes] = await Promise.all([
        authFetch("/api/accounts/unpaid?limit=100"),
        authFetch("/api/accounts/paid?limit=100"),
      ]);

      if (!unpaidRes.ok || !paidRes.ok) {
        throw new Error("Failed to load accounts records");
      }

      const unpaidData = await unpaidRes.json();
      const paidData = await paidRes.json();

      setUnpaidRows(unpaidData.data || []);
      setPaidRows(paidData.data || []);
    } catch (err: any) {
      setError(err.message || "An error occurred while loading billing data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  return (
    <DashboardShell
      title="Accounts Section"
      subtitle="Billing status for every confirmed booking."
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={fetchAccounts}
          disabled={loading}
        >
          <RefreshCw className={`size-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      }
    >
      {error && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={fetchAccounts}>
            Retry
          </Button>
        </div>
      )}

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "unpaid" | "paid")}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="unpaid">
              Unpaid ({loading ? "…" : unpaidRows.length})
            </TabsTrigger>
            <TabsTrigger value="paid">
              Paid ({loading ? "…" : paidRows.length})
            </TabsTrigger>
          </TabsList>
          <ExportToolbar
            data={activeTab === "unpaid" ? unpaidRows : paidRows}
            columns={accountsExportColumns}
            filename={`accounts-${activeTab}`}
            title={`Accounts - ${activeTab === "unpaid" ? "Unpaid" : "Paid"} Bookings`}
          />
        </div>
        <TabsContent value="unpaid" className="mt-4">
          <BillingTable
            rows={unpaidRows}
            loading={loading}
            showMarkPaid
            onRefresh={fetchAccounts}
          />
        </TabsContent>
        <TabsContent value="paid" className="mt-4">
          <BillingTable
            rows={paidRows}
            loading={loading}
            onRefresh={fetchAccounts}
          />
        </TabsContent>
      </Tabs>
    </DashboardShell>
  );
}

function BillingTable({
  rows,
  loading,
  showMarkPaid,
  onRefresh,
}: {
  rows: Booking[];
  loading: boolean;
  showMarkPaid?: boolean;
  onRefresh: () => void;
}) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const updateBilling = async (
    bookingId: string,
    updates: {
      billingStatus?: string;
      billingNumber?: string;
      billingRemark?: string;
    }
  ) => {
    setUpdatingId(bookingId);
    try {
      const res = await authFetch(`/api/accounts/${bookingId}/billing`, {
        method: "PUT",
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to update billing details");
      }
      toast.success("Billing updated");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to update billing");
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="card-surface p-4 space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="card-surface overflow-x-auto">
      <table className="w-full min-w-[860px] text-sm">
        <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Booking ID</th>
            <th className="px-4 py-3">Guest</th>
            <th className="px-4 py-3">Product</th>
            <th className="px-4 py-3">Invoice no.</th>
            <th className="px-4 py-3">Remark</th>
            <th className="px-4 py-3 text-right">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((b) => {
            const targetId = b.id || (b as any)._id;
            const isBusy = updatingId === targetId;

            return (
              <tr key={targetId} className="hover:bg-muted/40">
                <td className="px-4 py-3 font-medium">{b.bookingId}</td>
                <td className="px-4 py-3">
                  <p className="font-medium">{b.name}</p>
                  <p className="text-xs text-muted-foreground">{b.city}</p>
                </td>
                <td className="px-4 py-3 capitalize">{b.product}</td>
                <td className="px-4 py-3">
                  <Input
                    defaultValue={b.billingNumber ?? ""}
                    placeholder="INV-0000"
                    disabled={isBusy}
                    className="h-8 w-32"
                    onBlur={(e) => {
                      if (e.target.value !== (b.billingNumber ?? "")) {
                        updateBilling(targetId, {
                          billingNumber: e.target.value,
                        });
                      }
                    }}
                  />
                </td>
                <td className="px-4 py-3">
                  <Input
                    defaultValue={b.billingRemark ?? ""}
                    placeholder="Add remark"
                    disabled={isBusy}
                    className="h-8"
                    onBlur={(e) => {
                      if (e.target.value !== (b.billingRemark ?? "")) {
                        updateBilling(targetId, {
                          billingRemark: e.target.value,
                        });
                      }
                    }}
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  {showMarkPaid ? (
                    <Button
                      size="sm"
                      disabled={isBusy}
                      onClick={() =>
                        updateBilling(targetId, { billingStatus: "Paid" })
                      }
                    >
                      {isBusy && (
                        <Loader2 className="size-3.5 mr-1 animate-spin" />
                      )}
                      Mark paid
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isBusy}
                      onClick={() =>
                        updateBilling(targetId, { billingStatus: "Unpaid" })
                      }
                    >
                      {isBusy && (
                        <Loader2 className="size-3.5 mr-1 animate-spin" />
                      )}
                      Mark unpaid
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={6}
                className="px-4 py-12 text-center text-muted-foreground"
              >
                Nothing here yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
