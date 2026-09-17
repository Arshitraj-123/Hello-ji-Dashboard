import type { Booking } from "@/lib/store";
import { BrochureLayout } from "./BrochureLayout";
import { Field, SpecialAndNotes } from "./HotelBrochure";

const fmt = (v?: string) => v || "—";

/** Ticket (flight) voucher body. */
export function TicketBrochure({
  booking,
  showHeader = true,
}: {
  booking: Booking;
  showHeader?: boolean;
}) {
  return (
    <BrochureLayout booking={booking} showHeader={showHeader}>
      <h2 className="brochure-section-title">Flight Details</h2>

      <dl className="brochure-grid">
        <Field label="Guest Name" value={booking.name} />
        <Field label="Airline Name" value={fmt(booking.airlineName)} />
        <Field label="Flight Number" value={fmt(booking.flightNumber)} />
        <Field label="Sector" value={fmt(booking.sectorName)} />
        <Field label="Airline PNR" value={fmt(booking.airlinePnr)} />
        <Field label="GDS PNR" value={fmt(booking.gdsPnr)} />
        <Field label="Onward Time" value={fmt(booking.timeOnward)} />
        <Field label="Return Time" value={fmt(booking.timeReturn)} />
        <Field label="Infants" value={fmt(booking.infants)} />
      </dl>

      <SpecialAndNotes booking={booking} />
    </BrochureLayout>
  );
}
