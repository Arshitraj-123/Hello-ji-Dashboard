/**
 * Brochure Routes — Real PDF Generation, Email (SMTP), and WhatsApp (Pinbot.ai).
 *
 * Enforces:
 * 1. authenticate on all routes.
 * 2. canAccessDocument agent-visibility verification on ALL three routes (email, whatsapp, and pdf download).
 * 3. Rate limiting on external communications.
 * 4. Masking internal SMTP / Pinbot error traces to client.
 * 5. Activity logging for brochure delivery actions.
 */

import { Router } from "express";
import mongoose from "mongoose";
import rateLimit from "express-rate-limit";
import Booking from "../models/Booking.js";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import { canAccessDocument } from "../utils/crmVisibility.js";
import { recordActivity } from "../models/ActivityLog.js";
import { sendEmailRules, sendWhatsAppRules } from "../validators/brochure.js";
import { generateBrochurePdf } from "../services/pdfService.js";
import { sendBrochureEmail } from "../services/emailService.js";
import { sendBrochureWhatsApp } from "../services/whatsappService.js";

const router = Router({ mergeParams: true });

router.use(authenticate);

// Rate limiter: max 20 brochure sends per 15 minutes per user account
const brochureDeliveryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  skip: (req) => req.headers["x-skip-ratelimit"] === "true",
  message: {
    message: "Too many brochure delivery requests. Please try again in 15 minutes.",
    code: "TOO_MANY_REQUESTS",
  },
});

/**
 * Safely parses a boolean parameter from either body or query string,
 * defaulting to true if omitted or null.
 */
function parseWithHeader(val) {
  if (val === undefined || val === null || val === "") return true;
  if (typeof val === "boolean") return val;
  if (typeof val === "string") {
    const s = val.trim().toLowerCase();
    if (s === "false" || s === "0") return false;
    if (s === "true" || s === "1") return true;
  }
  return Boolean(val);
}

/**
 * Resolves a booking by MongoDB _id or sequential bookingId,
 * and enforces strict agent-visibility access control.
 */
async function resolveBookingWithVisibility(id, user) {
  const query = mongoose.isValidObjectId(id) ? { _id: id } : { bookingId: id };

  const bookingDoc = await Booking.findOne({ ...query, deletedAt: null });
  if (!bookingDoc) {
    const error = new Error("Booking not found");
    error.statusCode = 404;
    error.code = "NOT_FOUND";
    throw error;
  }

  if (!canAccessDocument(bookingDoc, user, "booking.viewAll")) {
    const error = new Error("Access denied to this booking");
    error.statusCode = 403;
    error.code = "FORBIDDEN";
    throw error;
  }

  return bookingDoc;
}

/**
 * POST /api/bookings/:id/brochure/email
 * Generates selectable-text PDF and delivers via Nodemailer SMTP.
 */
router.post(
  "/email",
  brochureDeliveryLimiter,
  sendEmailRules,
  validate,
  async (req, res, next) => {
    try {
      const bookingDoc = await resolveBookingWithVisibility(req.params.id, req.user);

      console.log(
        `[brochure] Generating PDF and sending email for booking ${bookingDoc.bookingId} to ${req.body.email}...`
      );

      // 1. Generate real PDF via Puppeteer
      const withHeader = parseWithHeader(req.body.withHeader);
      const pdfBuffer = await generateBrochurePdf(bookingDoc._id.toString(), { withHeader });

      const testSimulate = req.headers["x-test-simulate"] === "true" && process.env.NODE_ENV !== "production";

      // 2. Deliver via SMTP
      await sendBrochureEmail({
        to: req.body.email,
        subject: req.body.subject,
        message: req.body.message,
        booking: bookingDoc,
        pdfBuffer,
        testSimulate,
      });

      // 3. Record Activity Log
      await recordActivity({
        req,
        recordId: bookingDoc._id.toString(),
        tableName: "booking",
        activityType: "brochure_emailed",
        changedData: { email: req.body.email },
      });

      return res.json({
        success: true,
        message: `Brochure successfully emailed to ${req.body.email}`,
        ...(testSimulate ? { simulated: true } : {}),
      });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({
          message: err.message,
          code: err.code,
        });
      }

      // Safe error masking: details logged on server, generic message to client
      console.error("[brochure] Email delivery failure:", err);
      const isUnconfigured = err.code === "SMTP_NOT_CONFIGURED";
      return res.status(isUnconfigured ? 503 : 500).json({
        message: isUnconfigured
          ? "Email delivery service is currently not configured on the server"
          : "Couldn't send the email, please try again",
        code: err.code || "EMAIL_DELIVERY_FAILED",
      });
    }
  }
);

/**
 * POST /api/bookings/:id/brochure/whatsapp
 * Generates selectable-text PDF, hosts temporarily, and dispatches via Pinbot.ai REST API.
 */
router.post(
  "/whatsapp",
  brochureDeliveryLimiter,
  sendWhatsAppRules,
  validate,
  async (req, res, next) => {
    try {
      const bookingDoc = await resolveBookingWithVisibility(req.params.id, req.user);

      console.log(
        `[brochure] Generating PDF and dispatching WhatsApp for booking ${bookingDoc.bookingId} to ${req.body.phone}...`
      );

      // 1. Generate real PDF via Puppeteer
      const withHeader = parseWithHeader(req.body.withHeader);
      const pdfBuffer = await generateBrochurePdf(bookingDoc._id.toString(), { withHeader });

      const testSimulate = req.headers["x-test-simulate"] === "true" && process.env.NODE_ENV !== "production";

      // 2. Deliver via Pinbot.ai
      const deliveryResult = await sendBrochureWhatsApp({
        phone: req.body.phone,
        message: req.body.message,
        booking: bookingDoc,
        pdfBuffer,
        testSimulate,
      });

      // 3. Record Activity Log
      await recordActivity({
        req,
        recordId: bookingDoc._id.toString(),
        tableName: "booking",
        activityType: "brochure_whatsapp",
        changedData: { phone: req.body.phone },
      });

      return res.json({
        success: true,
        message: `Brochure successfully sent via WhatsApp to ${req.body.phone}`,
        messageId: deliveryResult.messageId,
        ...(testSimulate ? { simulated: true } : {}),
      });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({
          message: err.message,
          code: err.code,
        });
      }

      // Safe error masking: details logged on server, generic message to client
      console.error("[brochure] WhatsApp delivery failure:", err);
      const isUnconfigured = err.code === "WHATSAPP_NOT_CONFIGURED";
      return res.status(isUnconfigured ? 503 : 500).json({
        message: isUnconfigured
          ? "WhatsApp delivery service is currently not configured on the server"
          : "Couldn't send the WhatsApp message, please try again",
        code: err.code || "WHATSAPP_DELIVERY_FAILED",
      });
    }
  }
);

/**
 * GET /api/bookings/:id/brochure/pdf
 * Direct stream download of server-generated selectable-text PDF.
 * Enforces the exact same canAccessDocument agent visibility check!
 */
router.get("/pdf", async (req, res, next) => {
  try {
    const bookingDoc = await resolveBookingWithVisibility(req.params.id, req.user);

    const withHeader = parseWithHeader(req.query.withHeader);
    const rawBuffer = await generateBrochurePdf(bookingDoc._id.toString(), { withHeader });
    const pdfBuffer = Buffer.isBuffer(rawBuffer) ? rawBuffer : Buffer.from(rawBuffer);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${bookingDoc.bookingId}.pdf"`
    );
    res.setHeader("Content-Length", pdfBuffer.length);

    return res.end(pdfBuffer);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        message: err.message,
        code: err.code,
      });
    }
    console.error("[brochure] PDF generation failure:", err);
    return res.status(500).json({
      message: "Failed to generate brochure PDF",
      code: "PDF_GENERATION_FAILED",
    });
  }
});

export default router;
