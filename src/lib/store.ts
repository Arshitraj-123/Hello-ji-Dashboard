export type { Product, Status, Booking, BookingNote } from "@/types/booking";
import type { Booking, Status } from "@/types/booking";

export const AGENTS = ["Arshit Sharma", "Neha Kapoor", "Rahul Verma", "Simran Kaur"] as const;

export const DEFAULTS = {
  bookingPolicy: "This Booking is non-refundable and cannot be amended or modified",
  dmName: "Duty Manager",
  dmContact: "+91 9356444000",
  specialRequest: "VIP Request",
};

export { statusTone } from "@/lib/statusColors";

let bookings: Booking[] = [];

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const store = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get: () => bookings,
  add(data: Partial<Booking>) {
    bookings = [{ ...(data as Booking) }, ...bookings];
    emit();
  },
  update(id: string, patch: Partial<Booking>) {
    bookings = bookings.map((b) => (b.id === id ? { ...b, ...patch } : b));
    emit();
  },
  remove(id: string) {
    bookings = bookings.filter((b) => b.id !== id);
    emit();
  },
  trash(id: string) {
    bookings = bookings.map((b) => (b.id === id ? { ...b, deleted: true } : b));
    emit();
  },
  restore(id: string) {
    bookings = bookings.map((b) => (b.id === id ? { ...b, deleted: false } : b));
    emit();
  },
};

export function useBookings() {
  return bookings.filter((b) => !b.deleted);
}

export function useAllBookings() {
  return bookings;
}

