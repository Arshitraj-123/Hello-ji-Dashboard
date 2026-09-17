import { Phone, Mail, MapPin } from "lucide-react";
import type { Booking } from "@/lib/store";
import type { ReactNode } from "react";

/**
 * Shared brochure / voucher wrapper.
 *
 * Implements the client's official voucher layout with:
 * - Official Helloji.com branding + Incredible India (Ministry of Tourism) mark
 * - Dynamic product confirmation banner (e.g., "Hotel Confirmation Voucher")
 * - Centralized office & contact bar
 * - Footer service categories and branches list
 * - Conditional showHeader prop (omitting header and footer when false)
 */
export function BrochureLayout({
  booking,
  showHeader = true,
  children,
}: {
  booking: Booking;
  showHeader?: boolean;
  children: ReactNode;
}) {
  const productName = booking.product
    ? booking.product.charAt(0).toUpperCase() + booking.product.slice(1).toLowerCase()
    : "Service";

  return (
    <article
      id="voucher-document"
      className="voucher-sheet bg-white text-[#1a1a2e]"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* ── Letterhead header (Toggled via showHeader) ──────── */}
      {showHeader && (
        <header className="voucher-header">
          {/* Top Brand Bar */}
          <div className="flex items-center justify-between px-8 py-5 sm:px-12">
            {/* Left: Official HelloJi Brand Logo with Angled Plane & Tagline */}
            <div className="flex flex-col items-start">
              <div className="flex items-baseline">
                <span
                  className="text-3xl font-black tracking-tight text-[#d32f2f]"
                  style={{ fontFamily: "'Arial Black', 'Impact', sans-serif" }}
                >
                  HELL
                  <span className="relative inline-flex items-center justify-center">
                    O
                    {/* Red angled plane swooshing across the O */}
                    <svg
                      className="absolute -top-1 -right-0.5 size-4 text-[#d32f2f]"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M21 3L3 10.53L9.67 13.5L12.5 21L15.33 15.33L21 3Z" />
                    </svg>
                  </span>
                </span>
                <span
                  className="text-3xl font-bold tracking-tight text-[#111827] ml-0.5"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                >
                  Ji
                </span>
                <div className="flex flex-col text-[9px] font-bold leading-none ml-0.5 self-start pt-0.5">
                  <span className="text-[#111827]">®</span>
                  <span className="text-[#111827] -mt-0.5">.com</span>
                </div>
              </div>
              <p className="text-[10px] font-bold tracking-wide text-[#d32f2f] mt-0.5">
                book here <span className="font-semibold text-[#4b5563]">go anywhere</span>
              </p>
            </div>

            {/* Right: Incredible India Government Approval Mark (plain text, no border/container) */}
            <div className="text-right">
              <p
                className="text-xl font-bold tracking-tight text-[#111827]"
                style={{ fontFamily: "'Playfair Display', 'Times New Roman', Georgia, serif" }}
              >
                Incredible <span className="text-[#d32f2f] font-black">!</span>ndia
                <span className="sr-only">Incredible India</span>
              </p>
              <p className="text-[10px] font-medium text-[#111827] mt-0.5">
                Approved by Ministry of Tourism <span className="text-[#d32f2f] font-bold mx-0.5">|</span> Govt. of India
              </p>
            </div>
          </div>

          {/* Thin horizontal divider line before banner */}
          <div className="w-full border-b border-[#cbd5e1]" />

          {/* Dark Charcoal/Slate Confirmation Banner */}
          <div className="bg-[#37474f] px-8 py-2.5 text-center text-white sm:px-12">
            <h1
              className="text-base sm:text-lg font-bold tracking-wider text-white uppercase text-center"
              style={{ fontFamily: "'Archivo', sans-serif" }}
            >
              {productName} Confirmation Voucher
            </h1>
            <p className="text-xs text-slate-200 font-normal text-center mt-0.5">
              Please Present this copy upon check-in
            </p>
          </div>
        </header>
      )}

      {/* ── Guest summary ─────────────────────────────────── */}
      <section className="border-b border-[#e5e5e5] px-8 pt-6 pb-6 sm:px-12">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="flex items-center gap-2">
              <p className="brochure-label">Guest</p>
              <span className="text-[11px] text-[#888]">· {booking.bookingId}</span>
            </div>
            <h2
              className="mt-1 text-2xl font-bold"
              style={{ fontFamily: "'Archivo', sans-serif" }}
            >
              {booking.name}
            </h2>
            <p className="mt-1.5 text-sm text-[#666]">
              {booking.enqueryType || booking.product} · {booking.destination || booking.city || "India"}
            </p>
          </div>
          <div className="space-y-1.5 text-sm sm:text-right">
            <p className="flex items-center gap-2 sm:justify-end">
              <Phone className="size-3.5 text-[#c0392b]" />
              {booking.phone}
            </p>
            <p className="flex items-center gap-2 sm:justify-end">
              <Mail className="size-3.5 text-[#c0392b]" />
              {booking.email}
            </p>
            <p className="flex items-center gap-2 sm:justify-end">
              <MapPin className="size-3.5 text-[#c0392b]" />
              {booking.city}
            </p>
          </div>
        </div>
      </section>

      {/* ── Product-specific body ─────────────────────────── */}
      <section className="px-8 py-6 sm:px-12">{children}</section>

      {/* ── Policy & Duty Manager ──────────────────────────── */}
      <div className="border-t border-[#e5e5e5] px-8 py-5 text-xs text-[#666] sm:px-12">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="font-bold text-[#1a1a2e]">Booking Policy</p>
            <p className="mt-1 leading-relaxed">{booking.bookingPolicy}</p>
          </div>
          <div className="sm:text-right">
            <p className="font-bold text-[#1a1a2e]">Duty Manager</p>
            <p className="mt-1">
              {booking.dmName} · {booking.dmContact}
            </p>
          </div>
        </div>
      </div>

      {/* ── Footer Branding (Toggled via showHeader) ──────── */}
      {showHeader ? (
        <footer className="mt-auto border-t border-[#cbd5e1] bg-white px-8 py-5 sm:px-12 text-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
            {/* Left side: Red service categories row separated by pipes */}
            <div className="text-[11px] font-bold text-[#d32f2f] tracking-wide self-start sm:self-end pb-1">
              Flights | Hotels | Holidays | Cruises | MICE | Cabs
            </div>

            {/* Right side: Stacked company details, strictly right-aligned */}
            <div className="text-right text-[10.5px] leading-relaxed text-[#334155]">
              <p className="text-xs font-bold text-[#d32f2f]">Helloji.com</p>
              <p className="text-[#475569]">WA-89, Shakarpur, Delhi - 110092 India</p>
              <p className="text-[#475569]">
                Contact@helloji.com |{" "}
                <span className="text-[#0284c7] underline">www.helloji.com</span>
              </p>
              <p className="text-[#475569]">Contact: +91-11-42720272 | +91-9356444000</p>
              <p className="text-[#475569] font-medium mt-0.5">
                Our Branches: Delhi | Chandigarh | Jammu | Faridabad | Vadodara | Sirsa
              </p>
            </div>
          </div>
        </footer>
      ) : (
        <footer className="mt-auto border-t border-[#e5e5e5] px-8 py-3 text-center text-[11px] text-[#999] sm:px-12">
          Thank you for choosing Helloji. Have a wonderful journey.
        </footer>
      )}
    </article>
  );
}
