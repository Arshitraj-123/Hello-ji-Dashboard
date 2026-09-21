import type { Booking } from "@/lib/store";
import { BrochureLayout } from "./BrochureLayout";

const fmt = (v?: string) => v || "—";

/** Hotel-specific voucher body. */
export function HotelBrochure({
  booking,
  showHeader = true,
}: {
  booking: Booking;
  showHeader?: boolean;
}) {
  return (
    <BrochureLayout booking={booking} showHeader={showHeader}>
      <h2 className="brochure-section-title">Hotel Details</h2>

      <dl className="brochure-grid">
        <Field label="Booking ID" value={booking.bookingId} />
        <Field label="Hotel Confirmation No." value={fmt(booking.hotelConfirmationNo)} />
        <Field label="Guest Name" value={booking.name} />
        <Field label="Property Name" value={fmt(booking.propertyName)} />
        <Field label="Property Phone" value={fmt(booking.propertyPhone)} />
        <Field label="Property Email" value={fmt(booking.propertyEmail)} />
      </dl>

      {booking.propertyAddress && (
        <div className="mt-4">
          <p className="brochure-label">Property Address</p>
          <p className="mt-1 text-sm">{booking.propertyAddress}</p>
        </div>
      )}

      <h2 className="brochure-section-title mt-6">Stay Details</h2>
      <dl className="brochure-grid">
        <Field label="Check-in" value={fmt(booking.startDate)} />
        <Field label="Check-out" value={fmt(booking.endDate)} />
        <Field label="No. of Rooms" value={fmt(booking.noRoom)} />
        <Field label="Adults" value={fmt(booking.adults)} />
        <Field label="Children" value={fmt(booking.children)} />
        <Field label="Extra Beds" value={fmt(booking.extraBed)} />
        <Field label="Meal Plan" value={fmt(booking.mealPlan)} />
        <Field label="Room Type" value={fmt(booking.roomType)} />
      </dl>

      <SpecialAndNotes booking={booking} />
    </BrochureLayout>
  );
}

/* ── Shared helpers ──────────────────────────────────────── */

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="brochure-label">{label}</dt>
      <dd className="mt-1 text-sm font-semibold break-all [overflow-wrap:anywhere] [word-break:break-word]">{value}</dd>
    </div>
  );
}

function SpecialAndNotes({ booking }: { booking: Booking }) {
  const notes = Array.isArray(booking.notes) ? booking.notes : [];
  return (
    <>
      {booking.specialRequest && (
        <div className="mt-6 rounded-md border border-[#e5e5e5] bg-[#fafafa] p-4">
          <p className="brochure-label">Special Request</p>
          <p className="mt-1 text-sm">{booking.specialRequest}</p>
        </div>
      )}
      {notes.length > 0 && (
        <div className="mt-4">
          <p className="brochure-label">Notes</p>
          {notes.map((n) => (
            <p key={n.id} className="mt-1 text-sm text-[#555]">
              • {n.note}{" "}
              <span className="text-xs text-[#999]">
                ({typeof n.user === "object" && n.user ? n.user.name : String(n.user || "")}, {n.at})
              </span>
            </p>
          ))}
        </div>
      )}
    </>
  );
}

export { Field, SpecialAndNotes };
