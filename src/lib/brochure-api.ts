/**
 * Real Brochure Delivery API Client.
 *
 * Dispatches requests to the backend Express API for server-side PDF generation,
 * Nodemailer SMTP email delivery, and Pinbot.ai WhatsApp messaging.
 */

import { authFetch } from "@/lib/auth";

export async function sendBrochureEmail(
  bookingId: string,
  email: string,
  subject: string,
  message: string,
  withHeader = true,
): Promise<{ ok: boolean; message?: string }> {
  const res = await authFetch(`/api/bookings/${bookingId}/brochure/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, subject, message, withHeader }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || "Failed to send email");
  }

  return { ok: true, message: data.message };
}

export async function sendBrochureWhatsApp(
  bookingId: string,
  phone: string,
  message: string,
  withHeader = true,
): Promise<{ ok: boolean; message?: string }> {
  const res = await authFetch(`/api/bookings/${bookingId}/brochure/whatsapp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ phone, message, withHeader }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || "Failed to send WhatsApp message");
  }

  return { ok: true, message: data.message };
}

export function getBrochurePdfUrl(bookingId: string, withHeader = true): string {
  return `/api/bookings/${bookingId}/brochure/pdf?withHeader=${withHeader}`;
}
