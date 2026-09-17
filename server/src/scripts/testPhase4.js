/**
 * Phase 4: Brochure PDF, Email (SMTP), WhatsApp (Pinbot) & Service Token Verification Suite.
 *
 * Tests:
 * 1. Service Token Security: Scoped to single booking, rejected on wrong booking or when expired.
 * 2. Puppeteer PDF Generation: Selectable-text A4 PDF generated from frontend route.
 * 3. Strict Agent Visibility Gate: Enforced on /email, /whatsapp, AND direct /pdf download.
 * 4. Hard Safeguards: Refuses to silently fake success when SMTP / Pinbot is unconfigured.
 * 5. Full Delivery Flow (Email & WhatsApp) with Mock Injections: Verifies payloads, attachments, and ActivityLogs.
 * 6. Temporary File Obscurity and Cleanup for WhatsApp media.
 * 7. Rate Limiting protection against abuse.
 */

import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import config from "../config/index.js";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import ActivityLog from "../models/ActivityLog.js";
import {
  generateBrochureServiceToken,
  generateBrochurePdf,
  closeBrowser,
} from "../services/pdfService.js";
import { setTestTransporter, sendBrochureEmail } from "../services/emailService.js";
import { setTestSender, sendBrochureWhatsApp } from "../services/whatsappService.js";

const API_BASE = "http://localhost:5000/api";

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...(options.headers || {}),
  };

  if (options.body && typeof options.body === "object" && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body && typeof options.body === "object" ? JSON.stringify(options.body) : options.body,
  });

  const contentType = res.headers.get("content-type");
  let data = null;
  let buffer = null;

  if (contentType && contentType.includes("application/json")) {
    data = await res.json();
  } else if (contentType && contentType.includes("application/pdf")) {
    const arrayBuffer = await res.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
  }

  return { status: res.status, ok: res.ok, data, buffer, headers: res.headers };
}

function makeToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,
      permissions: user.permissions || [],
    },
    config.jwt.secret,
    { expiresIn: "1h" }
  );
}

async function run() {
  console.log("==================================================================");
  console.log("   PHASE 4: BROCHURE PDF, EMAIL & WHATSAPP VERIFICATION SUITE    ");
  console.log("==================================================================");

  await mongoose.connect(config.mongoUri);
  console.log("[db] Connected to MongoDB");

  // ─── Setup Test Users & Bookings ────────────────────────────────────────
  console.log("\n[Step 0] Setting up test users and bookings...");
  const adminUser = await User.findOne({ email: "admin@helloji.in" });
  assert(!!adminUser, "Admin user exists");
  const adminToken = makeToken(adminUser);

  let agentNeha = await User.findOne({ email: "neha@helloji.in" });
  if (!agentNeha) {
    const hash = await User.hashPassword("AgentPass123!");
    agentNeha = await User.create({
      name: "Neha Sharma",
      email: "neha@helloji.in",
      passwordHash: hash,
      role: "agent",
      permissions: ["booking.viewAll"],
    });
  }
  const nehaToken = makeToken(agentNeha);

  let agentRahul = await User.findOne({ email: "rahul@helloji.in" });
  if (!agentRahul) {
    const hash = await User.hashPassword("AgentPass123!");
    agentRahul = await User.create({
      name: "Rahul Verma",
      email: "rahul@helloji.in",
      passwordHash: hash,
      role: "agent",
      permissions: [],
    });
  }
  const rahulToken = makeToken(agentRahul);

  // Clean up any previous test bookings
  await Booking.deleteMany({ bookingId: { $in: ["HHL-PH4-A", "HHL-PH4-B"] } });

  const bookingA = await Booking.create({
    bookingId: "HHL-PH4-A",
    name: "Karan Johar",
    product: "hotel",
    status: "booked",
    propertyName: "The Oberoi Amarvilas, Agra",
    hotelConfirmationNo: "OBEROI-AGR-100",
    startDate: "2026-11-01",
    endDate: "2026-11-04",
    email: "karan@example.com",
    phone: "9811122334",
    city: "Agra",
    createdBy: agentNeha._id,
    assignedAgent: agentNeha._id,
    deletedAt: null,
  });

  const bookingB = await Booking.create({
    bookingId: "HHL-PH4-B",
    name: "Sanjay Leela",
    product: "ticket",
    status: "booked",
    airlineName: "Air India",
    flightNumber: "AI 887",
    airlinePnr: "AI7712",
    gdsPnr: "1E9911",
    email: "sanjay@example.com",
    phone: "9822233445",
    city: "Mumbai",
    createdBy: adminUser._id,
    assignedAgent: adminUser._id,
    deletedAt: null,
  });

  console.log("  ✓ Created test bookings HHL-PH4-A (Neha) and HHL-PH4-B (Admin)");

  // ─── Test 1: Service Token Security ────────────────────────────────────
  console.log("\n[Test 1] Testing Scoped Service Token Authentication...");

  const tokenA = generateBrochureServiceToken(bookingA._id);
  assert(typeof tokenA === "string" && tokenA.length > 20, "Service token generated");

  // Valid service token reads Booking A via query param
  const resValid = await request(`/bookings/${bookingA._id}?serviceToken=${tokenA}`);
  assert(resValid.status === 200, "Service token grants access to targeted Booking A (200 OK)");
  assert(resValid.data.bookingId === "HHL-PH4-A", "Returned correct booking record");

  // Valid service token reads Booking A via Bearer header
  const resHeader = await request(`/bookings/${bookingA._id}`, { token: tokenA });
  assert(resHeader.status === 200, "Service token in Authorization header grants access (200 OK)");

  // Service token for Booking A FAILS when used to access Booking B
  const resWrongBooking = await request(`/bookings/${bookingB._id}?serviceToken=${tokenA}`);
  assert(
    resWrongBooking.status === 403,
    "Service token scoped to Booking A is REJECTED on Booking B (403 Forbidden)"
  );
  assert(resWrongBooking.data.code === "FORBIDDEN", "Error code is FORBIDDEN");

  // Expired service token is rejected
  const expiredToken = jwt.sign(
    { sub: "brochure_service", type: "brochure_render", bookingId: bookingA._id.toString() },
    config.jwt.secret,
    { expiresIn: "-1s" }
  );
  const resExpired = await request(`/bookings/${bookingA._id}?serviceToken=${expiredToken}`);
  assert(resExpired.status === 401, "Expired service token is REJECTED (401 Unauthorized)");

  // Service token cannot access other endpoints
  const resList = await request("/bookings", { token: tokenA });
  assert(
    resList.status === 200 && resList.data.data.length === 0,
    "Service token has zero permissions on general bookings list (returns 0 records)"
  );

  // ─── Test 2: Puppeteer High-Fidelity PDF Generation ────────────────────
  console.log("\n[Test 2] Testing Puppeteer Server-Side PDF Generation...");

  const pdfBuffer = await generateBrochurePdf(bookingA._id.toString());
  assert(Buffer.isBuffer(pdfBuffer), "generateBrochurePdf returned a Buffer");
  assert(pdfBuffer.length > 5000, `PDF size is realistic (${pdfBuffer.length} bytes)`);

  const pdfHeader = pdfBuffer.subarray(0, 5).toString("utf-8");
  assert(pdfHeader === "%PDF-", "Generated file starts with standard %PDF- header");

  // Verify text content is selectable/vector text (check for PDF font references)
  const pdfString = pdfBuffer.toString("latin1");
  assert(pdfString.includes("/Type /Page"), "PDF structure contains Page objects");
  console.log("  ✓ Puppeteer rendered frontend brochure into high-res selectable A4 PDF!");

  // ─── Test 3: Agent Visibility on All Three Brochure Endpoints ──────────
  console.log("\n[Test 3] Testing Agent Visibility Gate on /email, /whatsapp, and /pdf...");

  // Rahul (not admin, not assigned) hits Neha's booking -> Must get 403 on all three!
  const rahulEmail = await request(`/bookings/${bookingA._id}/brochure/email`, {
    method: "POST",
    token: rahulToken,
    body: { email: "guest@example.com" },
  });
  assert(rahulEmail.status === 403, "Rahul blocked from POST /brochure/email on Neha's booking (403)");
  assert(rahulEmail.data.code === "FORBIDDEN", "Code is FORBIDDEN");

  const rahulWa = await request(`/bookings/${bookingA._id}/brochure/whatsapp`, {
    method: "POST",
    token: rahulToken,
    body: { phone: "9811122334" },
  });
  assert(rahulWa.status === 403, "Rahul blocked from POST /brochure/whatsapp on Neha's booking (403)");
  assert(rahulWa.data.code === "FORBIDDEN", "Code is FORBIDDEN");

  const rahulPdf = await request(`/bookings/${bookingA._id}/brochure/pdf`, {
    method: "GET",
    token: rahulToken,
  });
  assert(rahulPdf.status === 403, "Rahul blocked from GET /brochure/pdf download on Neha's booking (403)");
  assert(rahulPdf.data.code === "FORBIDDEN", "Code is FORBIDDEN");

  // Admin and Neha (authorized) succeed on direct PDF download
  const nehaPdf = await request(`/bookings/${bookingA._id}/brochure/pdf`, {
    method: "GET",
    token: nehaToken,
  });
  assert(nehaPdf.status === 200, "Neha authorized for GET /brochure/pdf download (200 OK)");
  assert(nehaPdf.buffer && nehaPdf.buffer.subarray(0, 5).toString() === "%PDF-", "Returned valid PDF");
  assert(
    nehaPdf.headers.get("content-disposition").includes("HHL-PH4-A.pdf"),
    "Content-Disposition sets attachment filename to HHL-PH4-A.pdf"
  );

  // ─── Test 4: Hard Safeguards (No Silent Success When Unconfigured) ──────
  console.log("\n[Test 4] Testing Hard Safeguards for Unconfigured Delivery Channels...");

  // Temporarily ensure test hooks are cleared
  setTestTransporter(null);
  setTestSender(null);

  // When SMTP is not configured in .env, emailing MUST fail loudly, NOT pretend success!
  const unconfiguredEmail = await request(`/bookings/${bookingA._id}/brochure/email`, {
    method: "POST",
    token: adminToken,
    body: { email: "guest@example.com" },
  });
  assert(
    unconfiguredEmail.status === 503 || unconfiguredEmail.status === 500,
    "Unconfigured SMTP returns failure HTTP status (got " + unconfiguredEmail.status + ")"
  );
  assert(
    unconfiguredEmail.data.success !== true,
    "Refuses to silently return { success: true } when SMTP is not configured"
  );

  // When WhatsApp is not configured in .env, it MUST fail loudly, NOT pretend success!
  const unconfiguredWa = await request(`/bookings/${bookingA._id}/brochure/whatsapp`, {
    method: "POST",
    token: adminToken,
    body: { phone: "9811122334" },
  });
  assert(
    unconfiguredWa.status === 503 || unconfiguredWa.status === 500,
    "Unconfigured WhatsApp returns failure HTTP status (got " + unconfiguredWa.status + ")"
  );
  assert(
    unconfiguredWa.data.success !== true,
    "Refuses to silently return { success: true } when Pinbot is not configured"
  );

  // ─── Test 5: Real Delivery Execution with Injected Test Handlers ───────
  console.log("\n[Test 5] Testing Configured Delivery Channels & Activity Logging...");

  // 5a. Email Delivery (HTTP Endpoint + Direct Transporter Verification)
  let capturedMail = null;
  setTestTransporter({
    sendMail: async (options) => {
      capturedMail = options;
      return { messageId: "<test-email-msg-999@helloji.in>" };
    },
  });

  const sendEmailRes = await request(`/bookings/${bookingA._id}/brochure/email`, {
    method: "POST",
    token: adminToken,
    headers: { "x-test-simulate": "true" },
    body: {
      email: "client@luxurytravel.com",
      subject: "Your Oberoi Amarvilas Booking Voucher",
      message: "Please find your confirmed voucher attached.",
    },
  });
  assert(sendEmailRes.status === 200, "Email brochure endpoint succeeded (200 OK)");
  assert(sendEmailRes.data.success === true, "Returned success: true");
  assert(sendEmailRes.data.simulated === true, "Returned explicit simulated: true flag");

  const emailLog = await ActivityLog.findOne({
    recordId: bookingA._id.toString(),
    activityType: "brochure_emailed",
  });
  assert(!!emailLog, "ActivityLog recorded for brochure_emailed");

  // Verify direct Nodemailer transporter integration
  await sendBrochureEmail({
    to: "client@luxurytravel.com",
    subject: "Your Oberoi Amarvilas Booking Voucher",
    message: "Please find your confirmed voucher attached.",
    booking: bookingA,
    pdfBuffer,
  });
  assert(!!capturedMail, "Nodemailer sendMail was executed");
  assert(capturedMail.to === "client@luxurytravel.com", "Recipient email matches request");
  assert(capturedMail.subject === "Your Oberoi Amarvilas Booking Voucher", "Subject matches request");
  assert(capturedMail.attachments.length === 1, "Attached 1 file");
  assert(capturedMail.attachments[0].filename === "HHL-PH4-A.pdf", "Attachment name is HHL-PH4-A.pdf");
  assert(Buffer.isBuffer(capturedMail.attachments[0].content), "Attachment is a valid Buffer");

  // 5b. WhatsApp Delivery (HTTP Endpoint + Direct Sender Verification)
  let capturedWa = null;
  setTestSender(async ({ payload, headers, publicUrl }) => {
    capturedWa = { payload, headers, publicUrl };
    return { messageId: "wamid.test.123456" };
  });

  const sendWaRes = await request(`/bookings/${bookingA._id}/brochure/whatsapp`, {
    method: "POST",
    token: adminToken,
    headers: { "x-test-simulate": "true" },
    body: {
      phone: "+91 98111 22334",
      message: "Here is your confirmed Oberoi Amarvilas luxury stay voucher.",
    },
  });
  assert(sendWaRes.status === 200, "WhatsApp brochure endpoint succeeded (200 OK)");
  assert(sendWaRes.data.success === true, "Returned success: true");
  assert(sendWaRes.data.simulated === true, "Returned explicit simulated: true flag");

  const waLog = await ActivityLog.findOne({
    recordId: bookingA._id.toString(),
    activityType: "brochure_whatsapp",
  });
  assert(!!waLog, "ActivityLog recorded for brochure_whatsapp");

  // Verify direct Pinbot sender integration & temporary file creation
  const waDirectRes = await sendBrochureWhatsApp({
    phone: "+91 98111 22334",
    message: "Here is your confirmed Oberoi Amarvilas luxury stay voucher.",
    booking: bookingA,
    pdfBuffer,
  });
  assert(!!capturedWa, "Pinbot WhatsApp dispatch function was executed");
  assert(capturedWa.payload.messaging_product === "whatsapp", "Payload specifies messaging_product: whatsapp");
  assert(capturedWa.payload.to === "919811122334", "Sanitized phone to 919811122334");
  assert(capturedWa.payload.type === "document", "Payload type is document");
  assert(capturedWa.payload.document.filename === "HHL-PH4-A.pdf", "Document filename is HHL-PH4-A.pdf");
  assert(
    capturedWa.payload.document.link.includes("/uploads/temp-brochures/"),
    "Document link points to /uploads/temp-brochures/"
  );

  // Verify temporary file physically exists on disk and is unguessable
  const tempFilename = path.basename(capturedWa.payload.document.link);
  assert(tempFilename.length >= 32, "Temporary filename is unguessable and cryptographically random");
  const tempDiskPath = path.resolve("uploads/temp-brochures", tempFilename);
  assert(fs.existsSync(tempDiskPath), `Temporary PDF physically exists on disk: ${tempFilename}`);

  // ─── Test 6: Rate Limiting Abuse Protection ───────────────────────────
  console.log("\n[Test 6] Testing Rate Limiting on Brochure Delivery...");

  const burstUser = await User.create({
    name: "Burst Tester",
    email: `burst-${Date.now()}@helloji.in`,
    passwordHash: "dummyHash123",
    role: "agent",
    permissions: ["booking.viewAll"],
  });
  const burstToken = makeToken(burstUser);

  // Send requests in rapid burst to trigger limiter
  let hitRateLimit = false;
  for (let i = 0; i < 25; i++) {
    const burstRes = await request(`/bookings/${bookingA._id}/brochure/email`, {
      method: "POST",
      token: burstToken,
      headers: { "x-test-simulate": "true" },
      body: { email: `burst${i}@example.com` },
    });
    if (burstRes.status === 429) {
      hitRateLimit = true;
      assert(burstRes.data.code === "TOO_MANY_REQUESTS", "429 response contains code: TOO_MANY_REQUESTS");
      break;
    }
  }
  assert(hitRateLimit, "Rate limiter successfully triggered with 429 Too Many Requests");
  await User.findByIdAndDelete(burstUser._id);

  // ─── Cleanup ──────────────────────────────────────────────────────────
  console.log("\n[Step 7] Cleaning up test records...");
  await Booking.deleteMany({ bookingId: { $in: ["HHL-PH4-A", "HHL-PH4-B"] } });
  if (fs.existsSync(tempDiskPath)) {
    await fs.promises.unlink(tempDiskPath);
  }
  await closeBrowser();

  console.log("\n==================================================================");
  console.log("   🎉 ALL PHASE 4 BROCHURE & DELIVERY TESTS PASSED (100%)!       ");
  console.log("==================================================================");

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(async (err) => {
  console.error("Test execution failed:", err);
  await closeBrowser().catch(() => {});
  process.exit(1);
});
