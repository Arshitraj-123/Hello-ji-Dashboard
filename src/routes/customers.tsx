import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  FileText,
  Plus,
  Trash2,
  Upload,
  X,
  RefreshCw,
  AlertCircle,
  Loader2,
  ExternalLink,
  Search,
} from "lucide-react";
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
} from "@/components/ui/dialog";
import { ExportToolbar } from "@/components/shared/ExportToolbar";
import type { ExportColumn } from "@/lib/export";
import { authFetch, getUser } from "@/lib/auth";
import type { Customer } from "@/types/customer";

const customerExportColumns: ExportColumn<Customer>[] = [
  { header: "Customer Name", key: "name" },
  { header: "Phone", key: "phone" },
  { header: "City", key: "city" },
  { header: "Document Type", key: "documentType" },
  { header: "Reference", key: "reference" },
  {
    header: "Documents Count",
    key: "documents",
    formatter: (val) => (Array.isArray(val) ? val.length : 0),
  },
  { header: "Remarks", key: "remarks" },
  {
    header: "Created Date",
    key: "createdAt",
    formatter: (val) => (val ? new Date(val).toLocaleDateString("en-IN") : ""),
  },
];

export const Route = createFileRoute("/customers")({
  head: () => ({
    meta: [
      { title: "Visa Customers | Helloji Booking Desk" },
      {
        name: "description",
        content:
          "Customer records for visa processing with passports and supporting documents stored against each phone number.",
      },
      {
        property: "og:title",
        content: "Visa Customers | Helloji Booking Desk",
      },
      {
        property: "og:description",
        content: "Customer records and visa documents in one place.",
      },
    ],
  }),
  component: Customers,
});

const emptyForm = {
  name: "",
  city: "",
  phone: "",
  documentType: "Passport",
  reference: "",
  remarks: "",
};

function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [openAdd, setOpenAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [appendFiles, setAppendFiles] = useState<File[]>([]);
  const [appending, setAppending] = useState(false);

  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter((c) =>
      [c.name, c.phone, c.city, c.documentType, c.reference]
        .filter(Boolean)
        .some((val) => String(val).toLowerCase().includes(term)),
    );
  }, [customers, q]);

  const currentUser = getUser();
  const canAddCustomer =
    currentUser?.role === "admin" ||
    currentUser?.permissions?.includes("customer.add");

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/customers?limit=100");
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to load customers");
      }
      const data = await res.json();
      setCustomers(data.data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load customers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Handle creating new customer with multipart file attachments
  const handleSaveCustomer = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error("Name and phone number are required");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("name", form.name.trim());
      formData.append("phone", form.phone.trim());
      if (form.city) formData.append("city", form.city.trim());
      if (form.documentType) formData.append("documentType", form.documentType);
      if (form.reference) formData.append("reference", form.reference.trim());
      if (form.remarks) formData.append("remarks", form.remarks.trim());

      selectedFiles.forEach((file) => {
        formData.append("files", file);
      });

      const res = await authFetch("/api/customers", {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Failed to create customer");
      }

      toast.success(
        `Customer "${form.name}" created with ${selectedFiles.length} document(s)`
      );
      setForm(emptyForm);
      setSelectedFiles([]);
      setOpenAdd(false);
      fetchCustomers();
    } catch (err: any) {
      toast.error(err.message || "Failed to create customer");
    } finally {
      setUploading(false);
    }
  };

  // Handle appending documents to an existing customer
  const handleAppendDocuments = async () => {
    if (!selectedCustomer || appendFiles.length === 0) return;

    setAppending(true);
    try {
      const targetId = selectedCustomer.id || (selectedCustomer as any)._id;
      const formData = new FormData();
      appendFiles.forEach((file) => {
        formData.append("files", file);
      });

      const res = await authFetch(`/api/customers/${targetId}`, {
        method: "PUT",
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Failed to upload documents");
      }

      toast.success(`${appendFiles.length} document(s) uploaded successfully`);
      setSelectedCustomer(null);
      setAppendFiles([]);
      fetchCustomers();
    } catch (err: any) {
      toast.error(err.message || "Failed to upload documents");
    } finally {
      setAppending(false);
    }
  };

  // Handle deleting an individual document
  const handleDeleteDocument = async (docId: string, customerId: string) => {
    try {
      const res = await authFetch(`/api/customers/documents/${docId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to delete document");
      }
      toast.success("Document deleted");
      // Optimistically update or re-fetch
      setCustomers((prev) =>
        prev.map((c) => {
          const cId = c.id || (c as any)._id;
          if (cId === customerId) {
            return {
              ...c,
              documents: c.documents.filter(
                (d) => (d.id || (d as any)._id) !== docId
              ),
            };
          }
          return c;
        })
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to remove document");
    }
  };

  // Handle moving customer to recycle bin
  const handleDeleteCustomer = async (customer: Customer) => {
    const targetId = customer.id || (customer as any)._id;
    try {
      const res = await authFetch(`/api/customers/${targetId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to delete customer");
      }
      toast.success(`${customer.name} moved to recycle bin`);
      fetchCustomers();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete customer");
    }
  };

  return (
    <DashboardShell
      title="Visa Customers"
      subtitle="Customer records and the documents collected from them."
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchCustomers}
            disabled={loading}
          >
            <RefreshCw className={`size-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          {canAddCustomer && (
            <Button onClick={() => setOpenAdd(true)}>
              <Plus className="size-4 mr-1" /> Add Customer
            </Button>
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
          <Button variant="outline" size="sm" onClick={fetchCustomers}>
            Retry
          </Button>
        </div>
      )}

      <div className="card-surface mb-6 flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search customers, phones, cities…"
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-3">
          <ExportToolbar
            data={filtered}
            columns={customerExportColumns}
            filename="visa-customers"
            title="Visa Customers"
          />
          <span className="text-sm text-muted-foreground">
            {filtered.length} customer{filtered.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card-surface space-y-4 p-5">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
              <div className="space-y-2 pt-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card-surface p-12 text-center text-muted-foreground">
          <p className="text-base font-medium">No customers found</p>
          <p className="mt-1 text-sm">
            {q
              ? "Try adjusting your search query."
              : "No customer records have been added yet."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => {
            const customerId = c.id || (c as any)._id;
            return (
              <article key={customerId} className="card-surface p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-bold">{c.name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {c.phone} · {c.city || "—"}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Delete customer"
                    onClick={() => handleDeleteCustomer(c)}
                  >
                    <Trash2 className="size-4 text-primary" />
                  </Button>
                </div>
                <dl className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Document type</dt>
                    <dd className="font-medium">{c.documentType}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Reference</dt>
                    <dd className="font-medium">{c.reference || "—"}</dd>
                  </div>
                </dl>
                {c.remarks && (
                  <p className="mt-3 text-sm text-muted-foreground">{c.remarks}</p>
                )}
                <div className="mt-4 space-y-2">
                  {c.documents.map((doc) => {
                    const docId = doc.id || (doc as any)._id;
                    return (
                      <div
                        key={docId}
                        className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm bg-muted/20"
                      >
                        <FileText className="size-4 text-muted-foreground shrink-0" />
                        <span className="flex-1 truncate font-medium">
                          {doc.fileName}
                        </span>
                        {doc.filePath && (
                          <a
                            href={doc.filePath}
                            target="_blank"
                            rel="noreferrer"
                            className="text-muted-foreground hover:text-foreground"
                            title="View document"
                          >
                            <ExternalLink className="size-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          aria-label="Remove document"
                          className="hover:text-destructive text-muted-foreground transition-colors"
                          onClick={() => handleDeleteDocument(docId, customerId)}
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    );
                  })}
                  {c.documents.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No documents uploaded.
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 w-full"
                  onClick={() => {
                    setSelectedCustomer(c);
                    setAppendFiles([]);
                  }}
                >
                  <Upload className="size-4 mr-1" /> Add document
                </Button>
              </article>
            );
          })}
          {customers.length === 0 && (
            <p className="text-muted-foreground p-8 card-surface col-span-3 text-center">
              No visa customers found.
            </p>
          )}
        </div>
      )}

      {/* Dialog for adding new customer with multipart file upload */}
      <Dialog open={openAdd} onOpenChange={setOpenAdd}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Visa Customer</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Full Name"
              />
            </div>
            <div className="space-y-2">
              <Label>Phone *</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+91 9876543210"
              />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                placeholder="City"
              />
            </div>
            <div className="space-y-2">
              <Label>Document type</Label>
              <Input
                value={form.documentType}
                onChange={(e) =>
                  setForm((f) => ({ ...f, documentType: e.target.value }))
                }
                placeholder="Passport, Visa, etc."
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Reference</Label>
              <Input
                value={form.reference}
                onChange={(e) =>
                  setForm((f) => ({ ...f, reference: e.target.value }))
                }
                placeholder="Visa Reference / Application No."
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Remarks</Label>
              <Textarea
                rows={3}
                value={form.remarks}
                onChange={(e) =>
                  setForm((f) => ({ ...f, remarks: e.target.value }))
                }
                placeholder="Additional notes"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Documents (PDF, PNG, JPG)</Label>
              <Input
                type="file"
                multiple
                onChange={(e) =>
                  setSelectedFiles(Array.from(e.target.files ?? []))
                }
              />
              {selectedFiles.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedFiles.length} file(s) selected:{" "}
                  {selectedFiles.map((f) => f.name).join(", ")}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpenAdd(false)}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveCustomer} disabled={uploading}>
              {uploading && <Loader2 className="size-4 mr-2 animate-spin" />}
              {uploading ? "Uploading…" : "Save customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog for appending documents to existing customer */}
      <Dialog
        open={!!selectedCustomer}
        onOpenChange={(v) => !v && setSelectedCustomer(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Upload documents for {selectedCustomer?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input
              type="file"
              multiple
              disabled={appending}
              onChange={(e) =>
                setAppendFiles(Array.from(e.target.files ?? []))
              }
            />
            {appendFiles.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Selected: {appendFiles.map((f) => f.name).join(", ")}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelectedCustomer(null)}
              disabled={appending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAppendDocuments}
              disabled={appending || appendFiles.length === 0}
            >
              {appending && <Loader2 className="size-4 mr-2 animate-spin" />}
              {appending ? "Uploading…" : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
