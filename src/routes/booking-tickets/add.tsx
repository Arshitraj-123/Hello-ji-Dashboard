import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Home, Loader2 } from "lucide-react";
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

export const Route = createFileRoute("/booking-tickets/add")({
  head: () => ({
    meta: [
      { title: "Add Booking Ticket | Helloji Booking Desk" },
      { name: "description", content: "Create a new booking ticket enquiry" },
    ],
  }),
  component: AddBookingTicketPage,
});

const PRODUCT_OPTIONS = [
  "Hotel",
  "Ticket",
  "Visa",
  "Package",
  "Others",
];

function AddBookingTicketPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    guestName: "",
    saleBy: "",
    sp: "",
    product: "",
    detail: "",
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.guestName.trim()) {
      toast.error("Please enter Guest Name");
      return;
    }

    setLoading(true);
    try {
      const res = await authFetch("/api/booking-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to create booking ticket");
      }

      toast.success(`Booking ticket ${data.ticket?.btId || ""} created successfully!`);
      navigate({ to: "/booking-tickets/unapproved" });
    } catch (err: any) {
      toast.error(err.message || "Failed to create ticket");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardShell
      title="Add Booking Ticket"
      subtitle="Create a new ticket request for guest processing"
    >
      <div className="space-y-4 max-w-6xl">
        {/* Breadcrumb matching Image 2 */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/dashboard" className="hover:text-foreground inline-flex items-center">
            <Home className="size-4 text-sky-500" />
          </Link>
          <span>&gt;</span>
          <span className="text-foreground font-medium">Add Booking Ticket</span>
        </div>

        {/* Section Heading matching Image 2 */}
        <h2 className="text-xl font-bold tracking-tight text-foreground uppercase">
          HELLOJI
        </h2>

        {/* Main Form Card matching Image 2 */}
        <div className="bg-card text-card-foreground rounded-lg border border-border p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Row 1: Guest Name, Sale By, SP */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label htmlFor="guestName" className="text-sm font-medium">
                  Guest Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="guestName"
                  placeholder="Enter guest name"
                  value={formData.guestName}
                  onChange={(e) => handleChange("guestName", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="saleBy" className="text-sm font-medium">
                  Sale By
                </Label>
                <Input
                  id="saleBy"
                  placeholder="Enter sales person"
                  value={formData.saleBy}
                  onChange={(e) => handleChange("saleBy", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sp" className="text-sm font-medium">
                  SP
                </Label>
                <Input
                  id="sp"
                  placeholder="Enter service provider / SP"
                  value={formData.sp}
                  onChange={(e) => handleChange("sp", e.target.value)}
                />
              </div>
            </div>

            {/* Row 2: Product, Detail */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label htmlFor="product" className="text-sm font-medium">
                  Product
                </Label>
                <Select
                  value={formData.product}
                  onValueChange={(val) => handleChange("product", val)}
                >
                  <SelectTrigger id="product">
                    <SelectValue placeholder="Select Product Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="detail" className="text-sm font-medium">
                  Detail
                </Label>
                <Textarea
                  id="detail"
                  placeholder="Enter ticket details (route, flight/bus numbers, travel dates, class, etc.)"
                  value={formData.detail}
                  onChange={(e) => handleChange("detail", e.target.value)}
                  rows={4}
                />
              </div>
            </div>

            {/* Red Submit Button matching Image 2 */}
            <div>
              <Button
                type="submit"
                disabled={loading}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold px-8 py-2.5 rounded shadow-sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit"
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </DashboardShell>
  );
}
