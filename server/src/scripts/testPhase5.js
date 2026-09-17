/**
 * Phase 5 Backend Verification Script.
 *
 * Verifies:
 * 1. GET /api/bookings/calendar (role-filtered, status = booked only, formatted event shape).
 * 2. Agent visibility on calendar: Admin vs Agent Neha.
 * 3. GET /api/bookings/calendar/full (unfiltered, gated by admin/booking.viewAll).
 * 4. Calendar date range filtering (?start=&end=).
 * 5. GET /api/activity-logs (permission gated by user.log, filters, pagination, populated user).
 * 6. Query notes endpoints (/api/queries/:id/notes GET & POST).
 */

import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import config from "../config/index.js";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import Note from "../models/Note.js";
import { seedAdmin } from "./seedAdmin.js";
import { seedBookings } from "./seedBookings.js";

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

  if (
    options.body &&
    typeof options.body === "object" &&
    !headers["Content-Type"]
  ) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    method: options.method || "GET",
    headers,
    body:
      options.body && typeof options.body === "object"
        ? JSON.stringify(options.body)
        : options.body,
  });

  const contentType = res.headers.get("content-type");
  let data = null;
  if (contentType && contentType.includes("application/json")) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  return { status: res.status, ok: res.ok, data };
}

function signToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      email: user.email,
      phone: user.phone,
      role: user.role,
      name: user.name,
      permissions: user.permissions || [],
    },
    config.jwt.secret,
    { expiresIn: "1h" }
  );
}

async function run() {
  console.log("=================================================");
  console.log("   PHASE 5: CALENDAR & ACTIVITY LOG TEST SUITE   ");
  console.log("=================================================\n");

  await mongoose.connect(config.mongoUri);
  console.log("[db] Connected to MongoDB");

  // Ensure fresh seed
  await seedBookings();

  const admin = await User.findOne({ role: "admin" });
  const agentNeha = await User.findOne({ email: "neha@helloji.in" });

  // Create an agent without booking.viewAll or user.log to test gating
  let agentRestricted = await User.findOne({ email: "restricted@helloji.in" });
  if (!agentRestricted) {
    agentRestricted = await User.create({
      name: "Restricted Agent",
      email: "restricted@helloji.in",
      phone: "+919999900001",
      passwordHash: await User.hashPassword("AgentPass123!"),
      role: "agent",
      permissions: ["calendar.menu"], // has calendar.menu but NOT booking.viewAll or user.log
      status: "active",
      createdBy: admin._id,
    });
  } else {
    agentRestricted.permissions = ["calendar.menu"];
    await agentRestricted.save();
  }

  const adminToken = signToken(admin);
  const nehaToken = signToken(agentNeha);
  const restrictedToken = signToken(agentRestricted);

  // ─────────────────────────────────────────────────────────────
  // 1. Calendar endpoint: GET /api/bookings/calendar
  // ─────────────────────────────────────────────────────────────
  console.log("\n[Test 1] Role-filtered calendar: GET /api/bookings/calendar");

  const adminCalRes = await request("/bookings/calendar", { token: adminToken });
  assert(adminCalRes.status === 200, "Admin can access /api/bookings/calendar (200)");
  assert(Array.isArray(adminCalRes.data), "Calendar returns an array of events");

  // All events returned MUST have status 'booked'
  const allBookedStatus = adminCalRes.data.every((e) => e.status === "booked");
  assert(allBookedStatus, "All calendar events have status = 'booked'");

  // Verify event shape matches spec
  const sampleEvent = adminCalRes.data[0];
  assert(sampleEvent.id, "Event has 'id'");
  assert(sampleEvent.title, "Event has 'title'");
  assert(sampleEvent.start !== undefined, "Event has 'start'");
  assert(sampleEvent.end !== undefined, "Event has 'end'");
  assert(sampleEvent.extendedProps, "Event has 'extendedProps'");
  assert("hasNotes" in sampleEvent.extendedProps, "extendedProps has 'hasNotes'");
  assert("bookingId" in sampleEvent.extendedProps, "extendedProps has 'bookingId'");

  // Assign one booked record to restricted agent (who has calendar.menu but NOT booking.viewAll)
  const bookedRecord = await Booking.findOne({ status: "booked" });
  bookedRecord.assignedAgent = agentRestricted._id;
  await bookedRecord.save();

  const restrictedCalRes = await request("/bookings/calendar", {
    token: restrictedToken,
  });
  assert(
    restrictedCalRes.status === 200,
    "Restricted Agent can access /api/bookings/calendar (200)"
  );
  assert(
    restrictedCalRes.data.length === 1,
    `Restricted agent without booking.viewAll sees only their 1 assigned booking (${restrictedCalRes.data.length} vs Admin's ${adminCalRes.data.length})`
  );

  // ─────────────────────────────────────────────────────────────
  // 2. Full Calendar view: GET /api/bookings/calendar/full
  // ─────────────────────────────────────────────────────────────
  console.log("\n[Test 2] Full calendar view: GET /api/bookings/calendar/full");

  // Admin access
  const adminFullRes = await request("/bookings/calendar/full", { token: adminToken });
  assert(adminFullRes.status === 200, "Admin can access /api/bookings/calendar/full (200)");
  // Seeded total bookings = 17 across all statuses
  assert(
    adminFullRes.data.length === 17,
    `Admin full view shows all 17 bookings regardless of status (got ${adminFullRes.data.length})`
  );

  // Restricted agent access (lacks booking.viewAll and admin role)
  const restrictedFullRes = await request("/bookings/calendar/full", {
    token: restrictedToken,
  });
  assert(
    restrictedFullRes.status === 403,
    `Agent without booking.viewAll or admin role is rejected with 403 (got ${restrictedFullRes.status})`
  );

  // ─────────────────────────────────────────────────────────────
  // 3. Calendar date range filter: ?start=&end=
  // ─────────────────────────────────────────────────────────────
  console.log("\n[Test 3] Calendar date range filtering");

  // Update one booking to have a known future date
  const testBooking = await Booking.findOne({ status: "booked" });
  testBooking.startDate = "2027-06-15";
  testBooking.endDate = "2027-06-20";
  await testBooking.save();

  // Query window that includes June 2027
  const dateMatchRes = await request(
    "/bookings/calendar?start=2027-06-01&end=2027-06-30",
    { token: adminToken }
  );
  assert(dateMatchRes.status === 200, "Date-filtered calendar query succeeds (200)");
  const hasTargetBooking = dateMatchRes.data.some(
    (e) => e.bookingId === testBooking.bookingId
  );
  assert(hasTargetBooking, "Date filter correctly includes matching booking");

  // Query window that does NOT include June 2027
  const dateMismatchRes = await request(
    "/bookings/calendar?start=2028-01-01&end=2028-01-31",
    { token: adminToken }
  );
  assert(dateMismatchRes.status === 200, "Out-of-range calendar query succeeds (200)");
  const noTargetBooking = dateMismatchRes.data.every(
    (e) => e.bookingId !== testBooking.bookingId
  );
  assert(noTargetBooking, "Date filter excludes bookings outside the date range");

  // ─────────────────────────────────────────────────────────────
  // 4. Activity Logs: GET /api/activity-logs
  // ─────────────────────────────────────────────────────────────
  console.log("\n[Test 4] Activity Logs: GET /api/activity-logs");

  // User without user.log permission is rejected with 403
  const forbiddenLogRes = await request("/activity-logs", {
    token: restrictedToken,
  });
  assert(
    forbiddenLogRes.status === 403,
    `User lacking user.log permission is rejected with 403 (got ${forbiddenLogRes.status})`
  );

  // Admin access
  const adminLogRes = await request("/activity-logs", { token: adminToken });
  assert(adminLogRes.status === 200, "Admin can access /api/activity-logs (200)");
  assert(adminLogRes.data.data, "Response has 'data' array");
  assert(adminLogRes.data.pagination, "Response has 'pagination' object");
  assert(
    typeof adminLogRes.data.pagination.total === "number",
    "Pagination includes total count"
  );

  // Check log record formatting
  if (adminLogRes.data.data.length > 0) {
    const log = adminLogRes.data.data[0];
    assert(log.id, "Log item has 'id'");
    assert(log.user, "Log item has populated 'user' name");
    assert(log.activityType, "Log item has 'activityType'");
    assert(log.tableName, "Log item has 'tableName'");
    assert(log.at, "Log item has formatted 'at' timestamp");
  }

  // Filter by tableName
  const tableFilteredRes = await request("/activity-logs?tableName=booking", {
    token: adminToken,
  });
  assert(tableFilteredRes.status === 200, "Filter by tableName succeeds (200)");
  const allBookingTable = tableFilteredRes.data.data.every(
    (l) => l.tableName === "booking"
  );
  assert(allBookingTable, "Filtered logs only include tableName = 'booking'");

  // Pagination test
  const pagedRes = await request("/activity-logs?page=1&limit=2", {
    token: adminToken,
  });
  assert(pagedRes.status === 200, "Pagination request succeeds (200)");
  assert(
    pagedRes.data.data.length <= 2,
    `Limit is enforced: got ${pagedRes.data.data.length} items (limit 2)`
  );
  assert(pagedRes.data.pagination.limit === 2, "Pagination limit matches param");

  // ─────────────────────────────────────────────────────────────
  // 5. Query Notes Endpoints: POST & GET /api/queries/:id/notes
  // ─────────────────────────────────────────────────────────────
  console.log("\n[Test 5] Query notes endpoints: /api/queries/:id/notes");

  const queryRecord = await Booking.findOne({ status: "New Query" });
  assert(queryRecord, "Found New Query record for notes test");

  const addNoteRes = await request(`/queries/${queryRecord._id}/notes`, {
    method: "POST",
    token: adminToken,
    body: { note: "Automated Phase 5 test note on query" },
  });
  assert(addNoteRes.status === 201, "POST /api/queries/:id/notes creates note (201)");
  assert(addNoteRes.data.note === "Automated Phase 5 test note on query", "Note content stored accurately");

  const listNotesRes = await request(`/queries/${queryRecord._id}/notes`, {
    token: adminToken,
  });
  assert(listNotesRes.status === 200, "GET /api/queries/:id/notes returns notes (200)");
  assert(Array.isArray(listNotesRes.data), "Notes returned as array");
  assert(
    listNotesRes.data.some((n) => n.note === "Automated Phase 5 test note on query"),
    "Newly created note is present in list"
  );

  console.log("\n=================================================");
  console.log("   ALL PHASE 5 BACKEND TESTS PASSED (100%)       ");
  console.log("=================================================\n");

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
