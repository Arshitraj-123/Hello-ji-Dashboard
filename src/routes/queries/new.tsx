import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { authFetch } from "@/lib/auth";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/queries/new")({
  head: () => ({
    meta: [
      { title: "New Query | Helloji Booking Desk" },
      {
        name: "description",
        content:
          "Log a new travel enquiry with guest details, product type, destination and priority for the Helloji booking desk.",
      },
      { property: "og:title", content: "New Query | Helloji Booking Desk" },
      {
        property: "og:description",
        content: "Log a new travel enquiry in seconds.",
      },
    ],
  }),
  component: NewQuery,
});

const DEFAULTS = {
  bookingPolicy:
    "This Booking is non-refundable and cannot be amended or modified",
  dmName: "Duty Manager",
  dmContact: "+91 9356444000",
  specialRequest: "VIP Request",
};

function NewQuery() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    city: "",
    enquiryType: "B2C",
    destination: "Domestic",
    product: "hotel",
    details: "",
    priority: "Normal",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Guest name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await authFetch("/api/queries", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          bookingPolicy: DEFAULTS.bookingPolicy,
          dmName: DEFAULTS.dmName,
          dmContact: DEFAULTS.dmContact,
          specialRequest: DEFAULTS.specialRequest,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Failed to create enquiry");
      }

      toast.success(`Query ${data.bookingId || ""} created successfully!`);
      navigate({ to: "/queries" });
    } catch (err: any) {
      toast.error(err.message || "An error occurred while creating query");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardShell
      title="New Query"
      subtitle="Capture a fresh customer enquiry."
    >
      <form className="grid gap-6 lg:grid-cols-3" onSubmit={handleSubmit}>
        <div className="card-surface space-y-5 p-6 lg:col-span-2">
          <h2 className="text-base font-semibold">Customer details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              <Input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Guest name"
                required
              />
            </Field>
            <Field label="Phone">
              <Input
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+91 …"
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="guest@email.com"
              />
            </Field>
            <Field label="City">
              <Input
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                placeholder="City"
              />
            </Field>
          </div>

          <h2 className="pt-2 text-base font-semibold">Enquiry</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type">
              <Picker
                value={form.enquiryType}
                onChange={(v) => set("enquiryType", v)}
                options={["B2B", "Corporate", "B2C"]}
              />
            </Field>
            <Field label="Destination">
              <Picker
                value={form.destination}
                onChange={(v) => set("destination", v)}
                options={["Domestic", "International"]}
              />
            </Field>
            <Field label="Product">
              <Picker
                value={form.product}
                onChange={(v) => set("product", v)}
                options={[
                  "hotel",
                  "ticket",
                  "package",
                  "visa",
                  "insurance",
                  "Other",
                ]}
              />
            </Field>
            <Field label="Priority">
              <Picker
                value={form.priority}
                onChange={(v) => set("priority", v)}
                options={["Urgent", "Normal"]}
              />
            </Field>
          </div>
          <Field label="Details">
            <Textarea
              rows={5}
              value={form.details}
              onChange={(e) => set("details", e.target.value)}
              placeholder="What is the customer asking for?"
            />
          </Field>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="size-4 mr-2 animate-spin" />
              )}
              Save query
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate({ to: "/queries" })}
            >
              Cancel
            </Button>
          </div>
        </div>

        <aside className="card-surface h-fit space-y-4 p-6 text-sm">
          <h2 className="text-base font-semibold">Applied automatically</h2>
          <Row label="Status" value="New Query" />
          <Row label="Duty manager" value={DEFAULTS.dmName} />
          <Row label="DM contact" value={DEFAULTS.dmContact} />
          <Row label="Special request" value={DEFAULTS.specialRequest} />
          <div>
            <p className="text-muted-foreground">Booking policy</p>
            <p className="mt-1">{DEFAULTS.bookingPolicy}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            A booking ID (HHL0001 format) is generated on save and the query is
            assigned to you.
          </p>
        </aside>
      </form>
    </DashboardShell>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Picker({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o} className="capitalize">
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
