/**
 * Centralized Booking ID Generator — Single Source of Truth
 *
 * Generates sequential booking identifiers following the HHL0001 format.
 * Called on every creation path (Mongoose pre-validate hook, seed scripts, direct queries).
 */

import mongoose from "mongoose";

export async function generateNextBookingId() {
  const latestBooking = await mongoose
    .model("Booking")
    .findOne({ bookingId: /^HHL\d+$/ })
    .sort({ bookingId: -1 })
    .select("bookingId")
    .lean();

  let nextNum = 1;
  if (latestBooking && latestBooking.bookingId) {
    const match = latestBooking.bookingId.match(/^HHL(\d+)$/);
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  }

  return `HHL${String(nextNum).padStart(4, "0")}`;
}
