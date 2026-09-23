import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { BookingTicketPrint } from "@/components/tickets/BookingTicketPrint";
import { authFetch } from "@/lib/auth";
import type { BookingTicket } from "@/types/bookingTicket";

export const Route = createFileRoute("/booking-tickets/$id/print")({
  head: () => ({
    meta: [
      { title: "Print Booking Ticket | Helloji Booking Desk" },
      { name: "description", content: "Official Helloji Booking Ticket print sheet" },
    ],
  }),
  component: TicketPrintRoute,
});

function TicketPrintRoute() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<BookingTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    authFetch(`/api/booking-tickets/${id}`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || "Failed to load booking ticket");
        }
        return res.json();
      })
      .then((data) => {
        if (mounted) {
          setTicket(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err.message || "Failed to fetch ticket");
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-5 animate-spin text-primary" />
          <span>Loading ticket details...</span>
        </div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
        <AlertCircle className="size-10 text-destructive mb-2" />
        <h2 className="text-xl font-bold">Ticket Not Found</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">{error || "Unable to display ticket"}</p>
        <button
          onClick={() => navigate({ to: "/booking-tickets/unapproved" })}
          className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/60 p-4 md:p-8 print:p-0 print:bg-white">
      <div className="max-w-4xl mx-auto">
        <BookingTicketPrint ticket={ticket} onBack={() => window.history.back()} />
      </div>
    </div>
  );
}
