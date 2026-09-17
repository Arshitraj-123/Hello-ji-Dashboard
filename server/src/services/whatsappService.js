/**
 * WhatsApp Service — Pinbot.ai REST API Brochure Delivery.
 *
 * Implements:
 * 1. Environment-driven API key and WhatsApp number from config.pinbot.
 * 2. Unguessable, obscure temporary PDF hosting under /uploads/temp-brochures/.
 * 3. Automatic cleanup of temporary files after 10 minutes.
 * 4. Hard safeguards: refuses to fake delivery when Pinbot credentials are missing.
 * 5. Test injection hook for deterministic test verification.
 * 6. Detailed server-side error logging with safe user-facing error throws.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import config from "../config/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMP_BROCHURES_DIR = path.resolve(__dirname, "../../uploads/temp-brochures");

export class WhatsAppServiceError extends Error {
  constructor(code, message, originalError = null) {
    super(message);
    this.name = "WhatsAppServiceError";
    this.code = code;
    this.originalError = originalError;
  }
}

let testSender = null;

/**
 * Checks if Pinbot.ai is configured.
 */
export function isWhatsAppConfigured() {
  return Boolean(config.pinbot.apiKey && config.pinbot.waNumber);
}

/**
 * Allows test suites to inject a mock WhatsApp sender.
 *
 * @param {Function|null} sender - Mock sender function (receives payload, headers) or null
 */
export function setTestSender(sender) {
  testSender = sender;
}

/**
 * Logs a startup warning if Pinbot credentials are not configured.
 */
export function checkWhatsAppHealth() {
  if (!isWhatsAppConfigured() && !testSender) {
    console.warn(
      "[whatsapp] ⚠️  WARNING: Pinbot.ai credentials (PINBOT_API_KEY / PINBOT_WA_NUMBER) are not configured. Brochure WhatsApp delivery will reject requests with WHATSAPP_NOT_CONFIGURED."
    );
  } else {
    console.log(
      `[whatsapp] WhatsApp configured (provider: Pinbot.ai, waNumber: ${config.pinbot.waNumber || "test-mode"})`
    );
  }
}

/**
 * Ensures the temporary brochures directory exists.
 */
export async function ensureTempBrochuresDir() {
  await fs.promises.mkdir(TEMP_BROCHURES_DIR, { recursive: true });
}

/**
 * Writes a generated PDF buffer to an obscure, unguessable temporary file
 * and schedules its automated deletion after 10 minutes.
 *
 * @param {Buffer} pdfBuffer
 * @returns {Promise<{ filename: string, diskPath: string, publicUrl: string }>}
 */
export async function saveTempBrochure(pdfBuffer) {
  await ensureTempBrochuresDir();

  // Unguessable 48-hex-character filename to protect against enumeration
  const obscureName = `${crypto.randomBytes(24).toString("hex")}.pdf`;
  const diskPath = path.join(TEMP_BROCHURES_DIR, obscureName);

  await fs.promises.writeFile(diskPath, pdfBuffer);

  const publicUrl = `${config.publicBaseUrl}/uploads/temp-brochures/${obscureName}`;

  // Schedule cleanup after 10 minutes (unref so timer does not prevent process exit)
  const timer = setTimeout(async () => {
    try {
      if (fs.existsSync(diskPath)) {
        await fs.promises.unlink(diskPath);
        console.log(`[whatsapp] Cleaned up temporary brochure: ${obscureName}`);
      }
    } catch (err) {
      console.warn(`[whatsapp] Error deleting temporary brochure ${obscureName}:`, err.message);
    }
  }, 10 * 60 * 1000);

  if (timer.unref) {
    timer.unref();
  }

  return { filename: obscureName, diskPath, publicUrl };
}

/**
 * Formats a phone number for WhatsApp international delivery (e.g. 91XXXXXXXXXX).
 */
export function sanitizeWhatsAppPhone(phone) {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, "");
  // Default to 91 (India) prefix if 10 digits provided
  if (digits.length === 10) {
    digits = `91${digits}`;
  }
  return digits;
}

/**
 * Sends a booking brochure PDF to the specified recipient via Pinbot.ai REST API.
 *
 * @param {Object} params
 * @param {string} params.phone - Recipient phone number
 * @param {string} [params.message] - Custom caption / message
 * @param {Object} params.booking - Booking record
 * @param {Buffer} params.pdfBuffer - Generated PDF buffer
 * @returns {Promise<{ messageId: string, publicUrl: string }>}
 */
export async function sendBrochureWhatsApp({ phone, message, booking, pdfBuffer, testSimulate = false }) {
  if (!phone) {
    throw new WhatsAppServiceError("INVALID_PHONE", "Recipient phone number is required");
  }

  if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer)) {
    throw new WhatsAppServiceError("INVALID_ATTACHMENT", "Valid PDF buffer is required for brochure");
  }

  const sanitizedTo = sanitizeWhatsAppPhone(phone);
  if (!sanitizedTo || sanitizedTo.length < 10) {
    throw new WhatsAppServiceError("INVALID_PHONE", "Recipient phone number is invalid");
  }

  // 1. Host the file at a temporary obscure URL
  const { filename, publicUrl } = await saveTempBrochure(pdfBuffer);

  const caption =
    message?.trim() ||
    `Hello ${booking.name},\nYour ${booking.product} booking is confirmed (ID: ${booking.bookingId}). Please find your Helloji voucher attached. Have a wonderful journey!`;

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: sanitizedTo,
    type: "document",
    document: {
      link: publicUrl,
      filename: `${booking.bookingId}.pdf`,
      caption,
    },
  };

  // Check test simulation hook
  if (testSimulate) {
    console.log(`[whatsapp] (Simulation Mode) Delivering brochure to ${sanitizedTo}`);
    return {
      messageId: "simulated-wa-msg-id",
      publicUrl,
    };
  }

  // Check test injection hook
  if (testSender) {
    console.log(`[whatsapp] (Test Sender) Delivering brochure to ${sanitizedTo}`);
    const result = await testSender({
      payload,
      headers: {
        "Content-Type": "application/json",
        apikey: config.pinbot.apiKey,
        wanumber: config.pinbot.waNumber,
      },
      publicUrl,
      booking,
    });
    return {
      messageId: result?.messageId || "test-msg-id",
      publicUrl,
    };
  }

  // Hard safeguard: do not silently fake success when unconfigured
  if (!isWhatsAppConfigured()) {
    throw new WhatsAppServiceError(
      "WHATSAPP_NOT_CONFIGURED",
      "WhatsApp delivery service is not configured on the server. Please set PINBOT_API_KEY and PINBOT_WA_NUMBER in environment variables."
    );
  }

  try {
    const response = await fetch(config.pinbot.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: config.pinbot.apiKey,
        wanumber: config.pinbot.waNumber,
      },
      body: JSON.stringify(payload),
    });

    const responseBody = await response.json().catch(() => null);

    if (!response.ok) {
      console.error(
        `[whatsapp] Pinbot API returned HTTP ${response.status} for ${sanitizedTo}:`,
        responseBody
      );
      throw new WhatsAppServiceError(
        "PINBOT_API_ERROR",
        "Failed to deliver WhatsApp message via provider",
        responseBody
      );
    }

    console.log(
      `[whatsapp] Brochure successfully dispatched via Pinbot to ${sanitizedTo} (booking: ${booking.bookingId})`
    );

    const messageId =
      responseBody?.messages?.[0]?.id || responseBody?.id || "dispatched";

    return {
      messageId,
      publicUrl,
    };
  } catch (err) {
    if (err instanceof WhatsAppServiceError) {
      throw err;
    }
    console.error(`[whatsapp] Unexpected error during delivery to ${sanitizedTo}:`, err);
    throw new WhatsAppServiceError(
      "WHATSAPP_SEND_FAILED",
      "Failed to deliver WhatsApp message",
      err
    );
  }
}

export default {
  isWhatsAppConfigured,
  setTestSender,
  checkWhatsAppHealth,
  saveTempBrochure,
  sanitizeWhatsAppPhone,
  sendBrochureWhatsApp,
};
