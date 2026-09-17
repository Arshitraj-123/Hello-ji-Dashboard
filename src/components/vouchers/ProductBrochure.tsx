import type { Booking } from "@/lib/store";
import { HotelBrochure } from "./HotelBrochure";
import { PackageBrochure } from "./PackageBrochure";
import { TicketBrochure } from "./TicketBrochure";
import { VisaBrochure } from "./VisaBrochure";
import { InsuranceBrochure } from "./InsuranceBrochure";

/**
 * Dispatcher — given any Booking, renders the correct product-specific
 * brochure template inside the shared BrochureLayout shell.
 */
export function ProductBrochure({
  booking,
  showHeader = true,
}: {
  booking: Booking;
  showHeader?: boolean;
}) {
  switch (booking.product) {
    case "hotel":
      return <HotelBrochure booking={booking} showHeader={showHeader} />;
    case "package":
      return <PackageBrochure booking={booking} showHeader={showHeader} />;
    case "ticket":
      return <TicketBrochure booking={booking} showHeader={showHeader} />;
    case "visa":
      return <VisaBrochure booking={booking} showHeader={showHeader} />;
    case "insurance":
      return <InsuranceBrochure booking={booking} showHeader={showHeader} />;
    default:
      // Fallback for "Other" product type — use hotel layout as a generic template
      return <HotelBrochure booking={booking} showHeader={showHeader} />;
  }
}
