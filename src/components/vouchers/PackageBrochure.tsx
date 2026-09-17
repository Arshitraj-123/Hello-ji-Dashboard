import type { Booking } from "@/lib/store";
import { BrochureLayout } from "./BrochureLayout";
import { Field, SpecialAndNotes } from "./HotelBrochure";

const fmt = (v?: string) => v || "—";

/** Package-specific voucher body.  Includes hotel fields since packages bundle hotel stays. */
export function PackageBrochure({
  booking,
  showHeader = true,
}: {
  booking: Booking;
  showHeader?: boolean;
}) {
  return (
    <BrochureLayout booking={booking} showHeader={showHeader}>
      <h2 className="brochure-section-title">Package Details</h2>

      <dl className="brochure-grid">
        <Field label="Package Name" value={fmt(booking.packageName)} />
        <Field label="Duration" value={fmt(booking.duration)} />
        <Field label="Destination" value={booking.destination} />
        <Field label="Start Date" value={fmt(booking.startDate)} />
        <Field label="End Date" value={fmt(booking.endDate)} />
        <Field label="Adults" value={fmt(booking.adults)} />
        <Field label="Children" value={fmt(booking.children)} />
      </dl>

      {booking.inclusion && (
        <div className="mt-5 rounded-md border border-[#e5e5e5] bg-[#fafafa] p-4">
          <p className="brochure-label">Inclusions</p>
          <p className="mt-1 text-sm">{booking.inclusion}</p>
        </div>
      )}

      {/* Hotel / property details (packages bundle hotel stays) */}
      {booking.propertyName && (
        <>
          <h2 className="brochure-section-title mt-6">Hotel Details</h2>
          <dl className="brochure-grid">
            <Field label="Property Name" value={fmt(booking.propertyName)} />
            <Field label="Property Phone" value={fmt(booking.propertyPhone)} />
            <Field label="Property Email" value={fmt(booking.propertyEmail)} />
            <Field label="No. of Rooms" value={fmt(booking.noRoom)} />
            <Field label="Room Type" value={fmt(booking.roomType)} />
            <Field label="Meal Plan" value={fmt(booking.mealPlan)} />
          </dl>
        </>
      )}

      <SpecialAndNotes booking={booking} />
    </BrochureLayout>
  );
}
