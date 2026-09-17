/**
 * Email Service — SMTP Brochure Delivery via Nodemailer.
 *
 * Implements:
 * 1. Environment-driven SMTP configuration via config.smtp.
 * 2. PDF attachment of booking brochure.
 * 3. Hard safeguards: refuses to fake success when SMTP is unconfigured.
 * 4. Test injection hook for deterministic test verification.
 * 5. Detailed server-side error logging with safe user-facing error throws.
 */

import nodemailer from "nodemailer";
import config from "../config/index.js";

export class EmailServiceError extends Error {
  constructor(code, message, originalError = null) {
    super(message);
    this.name = "EmailServiceError";
    this.code = code;
    this.originalError = originalError;
  }
}

let testTransporter = null;

/**
 * Checks if SMTP is configured with required host and credentials.
 */
export function isSmtpConfigured() {
  return Boolean(config.smtp.host && (config.smtp.user || config.smtp.port === 1025));
}

/**
 * Creates or retrieves the Nodemailer transporter.
 */
function getTransporter() {
  if (testTransporter) {
    return testTransporter;
  }

  if (!isSmtpConfigured()) {
    throw new EmailServiceError(
      "SMTP_NOT_CONFIGURED",
      "Email delivery service is not configured on the server. Please set SMTP environment variables."
    );
  }

  return nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: config.smtp.user
      ? {
          user: config.smtp.user,
          pass: config.smtp.pass,
        }
      : undefined,
  });
}

/**
 * Allows test suites to inject a mock transporter.
 *
 * @param {Object|null} transporter - Mock nodemailer transporter or null to reset
 */
export function setTestTransporter(transporter) {
  testTransporter = transporter;
}

/**
 * Logs a startup warning if SMTP is not configured.
 */
export function checkSmtpHealth() {
  if (!isSmtpConfigured() && !testTransporter) {
    console.warn(
      "[email] ⚠️  WARNING: SMTP credentials (SMTP_HOST / SMTP_USER) are not configured. Brochure email delivery will reject requests with SMTP_NOT_CONFIGURED."
    );
  } else {
    console.log(
      `[email] SMTP configured (host: ${config.smtp.host || "test-transporter"}, from: ${config.smtp.from})`
    );
  }
}

/**
 * Sends a booking brochure PDF to the specified recipient via SMTP.
 *
 * @param {Object} params
 * @param {string} params.to - Recipient email address
 * @param {string} [params.subject] - Email subject
 * @param {string} [params.message] - Email body text
 * @param {Object} params.booking - Booking record
 * @param {Buffer} params.pdfBuffer - Generated PDF buffer
 * @returns {Promise<{ messageId: string }>}
 */
export async function sendBrochureEmail({ to, subject, message, booking, pdfBuffer, testSimulate = false }) {
  if (!to) {
    throw new EmailServiceError("INVALID_RECIPIENT", "Recipient email address is required");
  }

  if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer)) {
    throw new EmailServiceError("INVALID_ATTACHMENT", "Valid PDF buffer is required for brochure email");
  }

  if (testSimulate) {
    console.log(`[email] (Simulation Mode) Brochure sent for ${booking.bookingId} to ${to}`);
    return { messageId: "<simulated-email-id>" };
  }

  const transporter = getTransporter();

  const mailOptions = {
    from: config.smtp.from,
    to: to.trim(),
    subject:
      subject?.trim() ||
      `${booking.bookingId} · Helloji ${booking.product} voucher`,
    text:
      message?.trim() ||
      `Hello ${booking.name},\n\nYour ${booking.product} booking is confirmed. Please find your Helloji voucher attached.\n\nBooking ID: ${booking.bookingId}\n\nHave a wonderful journey!`,
    attachments: [
      {
        filename: `${booking.bookingId}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(
      `[email] Brochure successfully sent for booking ${booking.bookingId} to ${to} (msgId: ${info.messageId || "ok"})`
    );
    return { messageId: info.messageId || "sent" };
  } catch (err) {
    console.error(`[email] SMTP delivery failed for ${to}:`, err);
    throw new EmailServiceError(
      "SMTP_SEND_FAILED",
      "Failed to deliver email through SMTP server",
      err
    );
  }
}

export default {
  isSmtpConfigured,
  setTestTransporter,
  checkSmtpHealth,
  sendBrochureEmail,
};
