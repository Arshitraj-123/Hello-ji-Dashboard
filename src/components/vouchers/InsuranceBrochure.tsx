import type { Booking } from "@/lib/store";
import { BrochureLayout } from "./BrochureLayout";
import { Field, SpecialAndNotes } from "./HotelBrochure";

const fmt = (v?: string) => v || "—";

/**
 * Insurance voucher body.
 *
 * Fields mirror exactly what the Booking type captures for insurance products:
 * insuranceType, insurancePolicyNo, insuranceCoverage, plus common fields.
 */
export function InsuranceBrochure({
  booking,
  showHeader = true,
}: {
  booking: Booking;
  showHeader?: boolean;
}) {
  return (
    <BrochureLayout booking={booking} showHeader={showHeader}>
      <h2 className="brochure-section-title">Insurance Details</h2>

      <dl className="brochure-grid">
        <Field label="Guest Name" value={booking.name} />
        <Field label="Destination" value={booking.destination} />
        <Field label="Policy Type" value={fmt(booking.insuranceType)} />
        <Field label="Policy Number" value={fmt(booking.insurancePolicyNo)} />
        <Field label="Coverage" value={fmt(booking.insuranceCoverage)} />
        <Field label="Travellers" value={`${fmt(booking.adults)} adults · ${booking.children ?? "0"} children`} />
        <Field label="Start Date" value={fmt(booking.startDate)} />
        <Field label="End Date" value={fmt(booking.endDate)} />
      </dl>

      <SpecialAndNotes booking={booking} />
    </BrochureLayout>
  );
}
