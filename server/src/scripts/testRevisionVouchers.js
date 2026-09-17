import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { PDFParse } from "pdf-parse";
import config from "../config/index.js";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import {
  generateBrochureServiceToken,
  generateBrochurePdf,
  closeBrowser,
} from "../services/pdfService.js";

const API_BASE = "http://localhost:5000/api";

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
}

async function extractPdfText(buffer) {
  const uint8 = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const parser = new PDFParse({ data: uint8 });
  await parser.load();
  const textResult = await parser.getText();
  return typeof textResult === "string" ? textResult : (textResult.text || "");
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
  console.log("   REVISION: BROCHURE HEADER/FOOTER TOGGLE VERIFICATION SUITE    ");
  console.log("==================================================================");

  await mongoose.connect(config.mongoUri);
  console.log("[db] Connected to MongoDB");

  const adminUser = await User.findOne({ email: "admin@helloji.in" });
  assert(!!adminUser, "Admin user exists");
  const adminToken = makeToken(adminUser);

  // Find or create a test booked booking
  let testBooking = await Booking.findOne({ status: "booked", deletedAt: null });
  if (!testBooking) {
    testBooking = await Booking.create({
      bookingId: "HHL-REV-01",
      name: "Rohan Mehra",
      product: "hotel",
      status: "booked",
      priority: "Normal",
      startDate: "2026-10-01",
      endDate: "2026-10-05",
      propertyName: "Taj Lake Palace Udaipur",
      hotelConfirmationNo: "TAJ-9988",
      roomType: "Luxury Suite",
      mealPlan: "CP",
      email: "rohan@example.com",
      phone: "9811122334",
      city: "Udaipur",
      createdBy: adminUser._id,
      assignedAgent: adminUser._id,
    });
  }

  console.log(`[test] Using booking: ${testBooking.bookingId} (${testBooking.name})`);

  // --- Test 1: Service-level generateBrochurePdf withHeader=true ---
  console.log("\n[Test 1] Testing generateBrochurePdf withHeader=true...");
  const pdfWithHeader = await generateBrochurePdf(testBooking._id.toString(), { withHeader: true });
  assert(Buffer.isBuffer(pdfWithHeader), "Returns a valid buffer");
  assert(pdfWithHeader.subarray(0, 5).toString() === "%PDF-", "Starts with standard %PDF- header");

  const textWith = await extractPdfText(pdfWithHeader);
  console.log(`  [info] Extracted text length (with header): ${textWith.length}`);
  console.log("--- START EXTRACTED TEXT ---");
  console.log(textWith);
  console.log("--- END EXTRACTED TEXT ---");
  const hasIncredibleIndia = (t) => t.toUpperCase().includes("INCREDIBLE !NDIA") || t.toUpperCase().includes("INCREDIBLE INDIA");

  assert(hasIncredibleIndia(textWith), 'Text CONTAINS "INCREDIBLE !NDIA" / "INCREDIBLE INDIA"');
  assert(textWith.toUpperCase().includes("CONFIRMATION VOUCHER"), 'Text CONTAINS "CONFIRMATION VOUCHER"');
  assert(textWith.includes("Our Branches:"), 'Text CONTAINS "Our Branches:"');
  assert(textWith.includes(testBooking.name), `Text CONTAINS guest name "${testBooking.name}"`);
  console.log("  ✓ withHeader=true correctly rendered branding, dark banner, and footer!");

  // --- Test 2: Service-level generateBrochurePdf withHeader=false ---
  console.log("\n[Test 2] Testing generateBrochurePdf withHeader=false...");
  const pdfWithoutHeader = await generateBrochurePdf(testBooking._id.toString(), { withHeader: false });
  assert(Buffer.isBuffer(pdfWithoutHeader), "Returns a valid buffer");
  assert(pdfWithoutHeader.subarray(0, 5).toString() === "%PDF-", "Starts with standard %PDF- header");

  const textWithout = await extractPdfText(pdfWithoutHeader);
  console.log(`  [info] Extracted text length (without header): ${textWithout.length}`);
  assert(!hasIncredibleIndia(textWithout), 'Text DOES NOT CONTAIN "INCREDIBLE !NDIA"');
  assert(!textWithout.toUpperCase().includes("CONFIRMATION VOUCHER"), 'Text DOES NOT CONTAIN "CONFIRMATION VOUCHER"');
  assert(!textWithout.includes("Our Branches:"), 'Text DOES NOT CONTAIN "Our Branches:"');
  assert(textWithout.includes(testBooking.name), `Text STILL CONTAINS guest name "${testBooking.name}"`);
  console.log("  ✓ withHeader=false strictly stripped header, dark banner, and footer branding!");

  // --- Test 3: GET /api/bookings/:id/brochure/pdf?withHeader=false ---
  console.log("\n[Test 3] Testing GET /api/bookings/:id/brochure/pdf?withHeader=false...");
  const resPdfFalse = await request(`/bookings/${testBooking._id}/brochure/pdf?withHeader=false`, {
    token: adminToken,
  });
  assert(resPdfFalse.status === 200, "GET /brochure/pdf?withHeader=false returns 200 OK");
  assert(Buffer.isBuffer(resPdfFalse.buffer), "Response body is PDF Buffer");
  const textApiWithout = await extractPdfText(resPdfFalse.buffer);
  assert(!hasIncredibleIndia(textApiWithout), 'API generated PDF without header has NO "INCREDIBLE !NDIA"');
  assert(!textApiWithout.toUpperCase().includes("CONFIRMATION VOUCHER"), 'API generated PDF without header has NO "CONFIRMATION VOUCHER"');
  assert(textApiWithout.includes(testBooking.name), `API generated PDF without header STILL HAS guest name "${testBooking.name}"`);
  console.log("  ✓ GET /pdf endpoint withHeader=false verified end-to-end!");

  // --- Test 4: GET /api/bookings/:id/brochure/pdf?withHeader=true ---
  console.log("\n[Test 4] Testing GET /api/bookings/:id/brochure/pdf?withHeader=true...");
  const resPdfTrue = await request(`/bookings/${testBooking._id}/brochure/pdf?withHeader=true`, {
    token: adminToken,
  });
  assert(resPdfTrue.status === 200, "GET /brochure/pdf?withHeader=true returns 200 OK");
  const textApiWith = await extractPdfText(resPdfTrue.buffer);
  assert(hasIncredibleIndia(textApiWith), 'API generated PDF with header HAS "INCREDIBLE !NDIA"');
  assert(textApiWith.toUpperCase().includes("CONFIRMATION VOUCHER"), 'API generated PDF with header HAS "CONFIRMATION VOUCHER"');
  console.log("  ✓ GET /pdf endpoint withHeader=true verified end-to-end!");

  // --- Test 5: POST /email and /whatsapp with withHeader parameter ---
  console.log("\n[Test 5] Testing POST /email and POST /whatsapp with withHeader=false...");
  const resEmail = await request(`/bookings/${testBooking._id}/brochure/email`, {
    method: "POST",
    token: adminToken,
    headers: { "x-test-simulate": "true" },
    body: {
      email: "client@example.com",
      subject: "Your Hotel Voucher",
      message: "Please find attached your voucher",
      withHeader: false,
    },
  });
  assert(resEmail.status === 200, "POST /brochure/email accepts withHeader=false and returns 200");
  assert(resEmail.data.success === true, "Email dispatch succeeded");

  const resWhatsApp = await request(`/bookings/${testBooking._id}/brochure/whatsapp`, {
    method: "POST",
    token: adminToken,
    headers: { "x-test-simulate": "true" },
    body: {
      phone: "+919876543210",
      message: "Here is your voucher",
      withHeader: false,
    },
  });
  assert(resWhatsApp.status === 200, "POST /brochure/whatsapp accepts withHeader=false and returns 200");
  assert(resWhatsApp.data.success === true, "WhatsApp dispatch succeeded");

  console.log("\n==================================================================");
  console.log("   🎉 ALL REVISION HEADER/FOOTER TOGGLE CHECKS PASSED!           ");
  console.log("==================================================================");

  await closeBrowser();
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("Test failed with error:", err);
  await closeBrowser();
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
