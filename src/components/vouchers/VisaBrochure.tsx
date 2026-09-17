import type { Booking } from "@/lib/store";
import { BrochureLayout } from "./BrochureLayout";
import { Field, SpecialAndNotes } from "./HotelBrochure";

const fmt = (v?: string) => v || "—";

/**
 * Visa voucher body.
 *
 * Fields mirror exactly what the Booking type captures for visa products:
 * visaType, visaReference, destination, startDate, adults.
 */
export function VisaBrochure({
  booking,
  showHeader = true,
}: {
  booking: Booking;
  showHeader?: boolean;
}) {
  return (
    <BrochureLayout booking={booking} showHeader={showHeader}>
      <h2 className="brochure-section-title">Visa Details</h2>

      <dl className="brochure-grid">
        <Field label="Guest Name" value={booking.name} />
        <Field label="Destination" value={booking.destination} />
        <Field label="Visa Type" value={fmt(booking.visaType)} />
        <Field label="Visa Reference" value={fmt(booking.visaReference)} />
        <Field label="Travel Date" value={fmt(booking.startDate)} />
        <Field label="Applicants" value={fmt(booking.adults)} />
      </dl>

      <SpecialAndNotes booking={booking} />
    </BrochureLayout>
  );
}
