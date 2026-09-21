import { Phone, Mail, MapPin } from "lucide-react";
import type { Booking } from "@/lib/store";
import { HELLOJI_LOGO_DATA_URI } from "./voucherLogos";

const fmt = (value?: string) => value || "—";

export function getVoucherFields(booking: Booking) {
  if (booking.product === "hotel") return [
    ["Property", fmt(booking.propertyName)], ["Confirmation no.", fmt(booking.hotelConfirmationNo)],
    ["Check-in", fmt(booking.startDate)], ["Check-out", fmt(booking.endDate)],
    ["Rooms", fmt(booking.noRoom)], ["Room type", fmt(booking.roomType)],
    ["Meal plan", fmt(booking.mealPlan)], ["Extra bed", fmt(booking.extraBed)],
  ];
  if (booking.product === "ticket") return [
    ["Airline", fmt(booking.airlineName)], ["Flight", fmt(booking.flightNumber)],
    ["Sector", fmt(booking.sectorName)], ["Airline PNR", fmt(booking.airlinePnr)],
    ["GDS PNR", fmt(booking.gdsPnr)], ["Onward time", fmt(booking.timeOnward)],
    ["Return time", fmt(booking.timeReturn)], ["Infants", fmt(booking.infants)],
  ];
  if (booking.product === "package") return [
    ["Package", fmt(booking.packageName)], ["Duration", fmt(booking.duration)],
    ["Start date", fmt(booking.startDate)], ["End date", fmt(booking.endDate)],
    ["Travellers", `${fmt(booking.adults)} adults · ${booking.children ?? "0"} children`],
  ];
  if (booking.product === "visa") return [
    ["Destination", booking.destination], ["Travel date", fmt(booking.startDate)],
    ["Applicants", fmt(booking.adults)], ["Application type", fmt(booking.visaType)],
    ["Reference", fmt(booking.visaReference)], ["Processing status", "Documents verified"],
  ];
  return [
    ["Destination", booking.destination], ["Travel date", fmt(booking.startDate)],
    ["Travellers", fmt(booking.adults)], ["Policy type", fmt(booking.insuranceType)],
    ["Policy number", fmt(booking.insurancePolicyNo)], ["Coverage", fmt(booking.insuranceCoverage)],
  ];
}

export function VoucherPreview({ booking, compact = false }: { booking: Booking; compact?: boolean }) {
  const fields = getVoucherFields(booking);
  return (
    <article id="voucher-document" className={`voucher-sheet bg-card text-foreground ${compact ? "p-5" : "p-7 sm:p-10"}`}>
      <header className="flex items-start justify-between gap-6 border-b-2 border-primary pb-6">
        <div className="flex items-center gap-3">
          <img
            src={HELLOJI_LOGO_DATA_URI}
            alt="Helloji"
            className="h-10 w-auto object-contain"
          />
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase text-primary">Confirmed {booking.product} voucher</p>
          <p className="mt-1 font-display text-xl font-bold">{booking.bookingId}</p>
          <p className="text-xs text-muted-foreground">Issued {booking.date}</p>
        </div>
      </header>

      <section className="grid gap-5 border-b border-border py-6 sm:grid-cols-2">
        <div><p className="voucher-label">Guest</p><h1 className="mt-1 text-2xl font-bold">{booking.name}</h1><p className="mt-2 text-sm text-muted-foreground">{booking.enqueryType} · {booking.destination}</p></div>
        <div className="space-y-2 text-sm sm:text-right">
          <p className="flex items-center gap-2 sm:justify-end"><Phone className="size-4 text-primary" />{booking.phone}</p>
          <p className="flex items-center gap-2 sm:justify-end"><Mail className="size-4 text-primary" />{booking.email}</p>
          <p className="flex items-center gap-2 sm:justify-end"><MapPin className="size-4 text-primary" />{booking.city}</p>
        </div>
      </section>

      <section className="py-6 min-w-0">
        <h2 className="mb-4 text-base font-bold capitalize">{booking.product} details</h2>
        <dl className="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-4 min-w-0">
          {fields.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="voucher-label">{label}</dt>
              <dd className="mt-1 text-sm font-semibold break-all [overflow-wrap:anywhere] [word-break:break-word]">{value}</dd>
            </div>
          ))}
        </dl>
        {(booking.inclusion || booking.details) && (
          <div className="mt-6 rounded-md bg-muted p-4 min-w-0">
            <p className="voucher-label">{booking.product === "package" ? "Inclusions" : "Important details"}</p>
            <p className="mt-2 text-sm break-words [overflow-wrap:anywhere]">{booking.inclusion || booking.details}</p>
          </div>
        )}
      </section>

      <section className="grid gap-4 border-t border-border py-6 sm:grid-cols-2 min-w-0">
        <div className="min-w-0">
          <p className="voucher-label">Special request</p>
          <p className="mt-1 text-sm break-words [overflow-wrap:anywhere]">{booking.specialRequest}</p>
        </div>
        <div className="min-w-0">
          <p className="voucher-label">Assistance</p>
          <p className="mt-1 text-sm break-words [overflow-wrap:anywhere]">{booking.dmName} · {booking.dmContact}</p>
        </div>
      </section>
      <footer className="border-t border-border pt-5 text-xs text-muted-foreground min-w-0">
        <p className="font-semibold text-foreground">Booking policy</p>
        <p className="mt-1 break-words [overflow-wrap:anywhere]">{booking.bookingPolicy}</p>
        <p className="mt-5 text-center">Thank you for choosing Helloji. Have a wonderful journey.</p>
      </footer>
    </article>
  );
}