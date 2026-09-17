/**
 * Phase 2 CRM Core Comprehensive Verification Suite — Approved Field Schema
 *
 * Asserts all core requirements and critical user-specified tests:
 * 1. Agent hitting another agent's query detail -> 403 Forbidden
 * 2. Conversion preserving identity (MongoDB _id AND bookingId) rather than duplicating
 * 3. Dedicated assign & status permission gates tested independently of general edit (PUT rejects tampering)
 * 4. Soft-delete / recycle-bin / force-delete lifecycle asserted as three distinct states
 * 5. Server-side conditional omission of `createdBy` ("Raised By") based on `queries.viewRaisedBy`
 * 6. Dedicated Notes collection operations and cascade cleanup on force-delete
 * 7. Exact field name compliance:
 *    - Hotel: propertyName, hotelConfirmationNo, startDate, endDate, noOfRooms, noOfAdults, noOfChildren, noOfExtraBed, mealPlan, roomType, propertyPhone, propertyEmail, propertyAddress
 *    - Ticket: airlineName, flightNumber, sectorName, airlinePnr, gdsPnr, timeOnward, timeReturn, noOfInfant (distinct airlinePnr and gdsPnr)
 *    - Billing: billingStatus, billingNumber, billingDate, billingRemark (NO unrequested costPrice, sellingPrice, profit, advanceReceived, balanceDue)
 */

import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import config from "../config/index.js";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import Note from "../models/Note.js";
import ActivityLog from "../models/ActivityLog.js";

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
    "Content-Type": "application/json",
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const contentType = res.headers.get("content-type");
  let data = null;
  if (contentType && contentType.includes("application/json")) {
    data = await res.json();
  }

  return { status: res.status, ok: res.ok, data };
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
  console.log("   PHASE 2 CRM CORE — APPROVED SCHEMA VERIFICATION SUITE         ");
  console.log("==================================================================");

  await mongoose.connect(config.mongoUri);
  console.log("[db] Connected to MongoDB");

  // ─── Step 0: Ensure Test Users & Roles ─────────────────────────────────
  console.log("\n[Step 0] Setting up test agents and tokens...");

  // Bootstrap Admin
  const adminUser = await User.findOne({ email: "admin@helloji.in" });
  assert(!!adminUser, "Admin user exists in database");
  const adminToken = makeToken(adminUser);
  assert(!!adminToken, "Admin token generated");

  const defaultPasswordHash = await User.hashPassword("AgentPass123!");

  // Agent Neha
  let agentNeha = await User.findOne({ email: "neha@helloji.in" });
  if (!agentNeha) {
    agentNeha = await User.create({
      name: "Neha Sharma",
      email: "neha@helloji.in",
      passwordHash: defaultPasswordHash,
      role: "agent",
      permissions: [
        "queries.add",
        "queries.viewRaisedBy",
        "queries.changeStatus",
        "queries.assign",
        "booking.viewAll",
        "trash.recycleBin",
      ],
    });
  } else {
    agentNeha.permissions = [
      "queries.add",
      "queries.viewRaisedBy",
      "queries.changeStatus",
      "queries.assign",
      "booking.viewAll",
      "trash.recycleBin",
    ];
    await agentNeha.save();
  }
  const nehaToken = makeToken(agentNeha);
  assert(!!nehaToken, "Agent Neha token generated");

  // Agent Rahul
  let agentRahul = await User.findOne({ email: "rahul@helloji.in" });
  if (!agentRahul) {
    agentRahul = await User.create({
      name: "Rahul Verma",
      email: "rahul@helloji.in",
      passwordHash: defaultPasswordHash,
      role: "agent",
      permissions: ["queries.add"],
    });
  } else {
    agentRahul.permissions = ["queries.add"];
    await agentRahul.save();
  }
  const rahulToken = makeToken(agentRahul);
  assert(!!rahulToken, "Agent Rahul token generated");

  // Agent Restricted
  let agentRestricted = await User.findOne({ email: "restricted@helloji.in" });
  if (!agentRestricted) {
    agentRestricted = await User.create({
      name: "Restricted Agent",
      email: "restricted@helloji.in",
      passwordHash: defaultPasswordHash,
      role: "agent",
      permissions: ["queries.add"],
    });
  } else {
    agentRestricted.permissions = ["queries.add"];
    await agentRestricted.save();
  }
  const restrictedToken = makeToken(agentRestricted);
  assert(!!restrictedToken, "Restricted Agent token generated");

  // ─── Test 1: Query Creation & Approved Schema Fields ───────────────────
  console.log("\n[Test 1] Testing Query creation with auto-increment bookingId & approved schema...");
  const createRes = await request("/queries", {
    method: "POST",
    token: nehaToken,
    body: {
      name: "Rohan Kapoor",
      email: "rohan.kapoor@example.com",
      phone: "+91 98765 43210",
      city: "New Delhi",
      product: "hotel",
      enquiryType: "B2C",
      destination: "Domestic",
      priority: "Urgent",
      details: "Urgent couple getaway to Goa",
      startDate: "2026-10-01",
      endDate: "2026-10-05",
      noOfRooms: "1",
      noOfAdults: "2",
      noOfChildren: "0",
      noOfExtraBed: "0",
    },
  });

  assert(createRes.status === 201, "Query created with 201 Created");
  const nehaQuery = createRes.data;
  assert(!!nehaQuery.id, `Created query has id: ${nehaQuery.id}`);
  assert(
    /^HHL\d{4,}$/.test(nehaQuery.bookingId),
    `Sequential bookingId generated: ${nehaQuery.bookingId}`
  );
  assert(nehaQuery.status === "New Query", "Initial status is 'New Query'");
  assert(nehaQuery.product === "hotel", "Product is 'hotel'");
  assert(nehaQuery.noOfAdults === "2", "Approved field noOfAdults preserved");
  assert(
    nehaQuery.bookingPolicy.startsWith("Please Note: Advance amount is non-refundable"),
    "Auto-set hidden bookingPolicy matches specification"
  );
  assert(nehaQuery.dmName === "Rohit Sharma", "Auto-set dmName matches specification");
  assert(nehaQuery.dmContact === "+91 9356444000", "Auto-set dmContact matches specification");

  // ─── Test 2: Agent Visibility Rule (Rahul hits Neha's query) ───────────
  console.log("\n[Test 2] Testing Agent Visibility Rule (Rahul hits Neha's query)...");
  const rahulAccessRes = await request(`/queries/${nehaQuery.id}`, {
    method: "GET",
    token: rahulToken,
  });

  assert(
    rahulAccessRes.status === 403,
    `Rahul denied access with 403 Forbidden (got status ${rahulAccessRes.status})`
  );
  assert(
    rahulAccessRes.data.code === "FORBIDDEN",
    "Response code is FORBIDDEN"
  );

  const adminAccessRes = await request(`/queries/${nehaQuery.id}`, {
    method: "GET",
    token: adminToken,
  });
  assert(adminAccessRes.status === 200, "Admin can access Neha's query (200 OK)");

  const nehaAccessRes = await request(`/queries/${nehaQuery.id}`, {
    method: "GET",
    token: nehaToken,
  });
  assert(nehaAccessRes.status === 200, "Neha can access her own query (200 OK)");

  // ─── Test 3: Conditional Omission of createdBy ('Raised By') ───────────
  console.log("\n[Test 3] Testing queries.viewRaisedBy conditional omission...");
  const restrictedQueryRes = await request("/queries", {
    method: "POST",
    token: restrictedToken,
    body: {
      name: "Restricted Client",
      product: "ticket",
    },
  });
  assert(restrictedQueryRes.status === 201, "Restricted agent created own query");
  const restrictedQueryId = restrictedQueryRes.data.id;

  const restrictedFetchRes = await request(`/queries/${restrictedQueryId}`, {
    method: "GET",
    token: restrictedToken,
  });
  assert(restrictedFetchRes.status === 200, "Restricted agent fetched own query");
  assert(
    restrictedFetchRes.data.createdBy === undefined,
    "createdBy field is STRIPPED when user lacks queries.viewRaisedBy"
  );

  const adminFetchRestrictedRes = await request(`/queries/${restrictedQueryId}`, {
    method: "GET",
    token: adminToken,
  });
  assert(
    adminFetchRestrictedRes.data.createdBy !== undefined,
    "createdBy field is INCLUDED for Admin"
  );

  // ─── Test 4: Dedicated Assign & Status Gates vs General PUT ────────────
  console.log("\n[Test 4] Testing Dedicated Assign/Status gates vs General PUT...");

  const putStatusTamper = await request(`/queries/${nehaQuery.id}`, {
    method: "PUT",
    token: nehaToken,
    body: {
      status: "Pipeline",
    },
  });
  assert(
    putStatusTamper.status === 400,
    `General PUT with status change rejected with 400 (got ${putStatusTamper.status})`
  );
  assert(
    putStatusTamper.data.code === "STATUS_UPDATE_NOT_ALLOWED",
    "Code is STATUS_UPDATE_NOT_ALLOWED"
  );

  const putAgentTamper = await request(`/queries/${nehaQuery.id}`, {
    method: "PUT",
    token: nehaToken,
    body: {
      assignedAgent: agentRahul._id.toString(),
    },
  });
  assert(
    putAgentTamper.status === 400,
    `General PUT with assignedAgent change rejected with 400 (got ${putAgentTamper.status})`
  );
  assert(
    putAgentTamper.data.code === "ASSIGNMENT_NOT_ALLOWED",
    "Code is ASSIGNMENT_NOT_ALLOWED"
  );

  const restrictedStatusRes = await request(`/queries/${restrictedQueryId}/status`, {
    method: "PATCH",
    token: restrictedToken,
    body: { status: "Pipeline" },
  });
  assert(
    restrictedStatusRes.status === 403,
    `Restricted agent without queries.changeStatus gets 403 (got ${restrictedStatusRes.status})`
  );

  const statusUpdateRes = await request(`/queries/${nehaQuery.id}/status`, {
    method: "PATCH",
    token: nehaToken,
    body: { status: "Pipeline" },
  });
  assert(statusUpdateRes.status === 200, "Dedicated status patch succeeded (200 OK)");
  assert(
    statusUpdateRes.data.status === "Pipeline",
    "Query status updated to 'Pipeline'"
  );

  const restrictedAssignRes = await request(`/queries/${restrictedQueryId}/assign`, {
    method: "PATCH",
    token: restrictedToken,
    body: { assignedAgent: agentRahul._id.toString() },
  });
  assert(
    restrictedAssignRes.status === 403,
    `Restricted agent without queries.assign gets 403 (got ${restrictedAssignRes.status})`
  );

  const assignUpdateRes = await request(`/queries/${nehaQuery.id}/assign`, {
    method: "PATCH",
    token: nehaToken,
    body: { assignedAgent: agentRahul._id.toString() },
  });
  assert(assignUpdateRes.status === 200, "Dedicated assign patch succeeded (200 OK)");
  assert(
    (assignUpdateRes.data.assignedAgent?.id || assignUpdateRes.data.assignedAgent) ===
      agentRahul._id.toString(),
    "Query assignedAgent updated to Rahul"
  );

  const rahulNowCanAccess = await request(`/queries/${nehaQuery.id}`, {
    method: "GET",
    token: rahulToken,
  });
  assert(
    rahulNowCanAccess.status === 200,
    "Rahul can now access query because he is the assignedAgent (200 OK)"
  );

  // ─── Test 5: Conversion to Booked (Identity & Approved Fields) ─────────
  console.log("\n[Test 5] Testing Conversion with EXACT approved schema fields...");
  const totalCountBefore = await Booking.countDocuments();
  const originalBookingId = nehaQuery.bookingId;

  const convertRes = await request(`/queries/${nehaQuery.id}/convert`, {
    method: "POST",
    token: nehaToken,
    body: {
      propertyName: "Taj Exotica Resort & Spa",
      propertyPhone: "+91 832 6683333",
      propertyEmail: "taj.goa@tajhotels.com",
      propertyAddress: "Calwaddo, Benaulim, Goa 403716",
      hotelConfirmationNo: "TAJ-GOA-9921",
      roomType: "Deluxe Sea View Villa",
      mealPlan: "CPAI",
      startDate: "2026-10-01",
      endDate: "2026-10-05",
      noOfRooms: "1",
      noOfAdults: "2",
      noOfChildren: "0",
      noOfExtraBed: "0",
      billingStatus: "Unpaid",
      billingNumber: "INV-2026-001",
      billingDate: "2026-09-15",
      billingRemark: "Advance payment pending",
    },
  });

  assert(convertRes.status === 200, "Conversion succeeded with 200 OK");
  const converted = convertRes.data;

  // Identity assertions
  assert(
    converted.id === nehaQuery.id,
    `Document MongoDB _id remained identical: ${converted.id} === ${nehaQuery.id}`
  );
  assert(
    converted.bookingId === originalBookingId,
    `BookingId remained identical: ${converted.bookingId} === ${originalBookingId}`
  );
  assert(
    converted.status === "booked",
    `Status transitioned to 'booked'`
  );

  // Exact approved field name assertions
  assert(
    converted.propertyName === "Taj Exotica Resort & Spa",
    `propertyName matches approved schema: ${converted.propertyName}`
  );
  assert(
    converted.hotelConfirmationNo === "TAJ-GOA-9921",
    `hotelConfirmationNo matches approved schema: ${converted.hotelConfirmationNo}`
  );
  assert(
    converted.startDate === "2026-10-01",
    `startDate matches approved schema: ${converted.startDate}`
  );
  assert(
    converted.endDate === "2026-10-05",
    `endDate matches approved schema: ${converted.endDate}`
  );
  assert(
    converted.mealPlan === "CPAI",
    `mealPlan matches approved schema: ${converted.mealPlan}`
  );
  assert(
    converted.billingStatus === "Unpaid",
    `billingStatus matches approved schema: ${converted.billingStatus}`
  );
  assert(
    converted.billingNumber === "INV-2026-001",
    `billingNumber matches approved schema: ${converted.billingNumber}`
  );

  // Assert NO unapproved/invented financial fields exist
  assert(
    converted.costPrice === undefined,
    "Unapproved 'costPrice' field is NOT present"
  );
  assert(
    converted.sellingPrice === undefined,
    "Unapproved 'sellingPrice' field is NOT present"
  );
  assert(
    converted.profit === undefined,
    "Unapproved 'profit' field is NOT present"
  );
  assert(
    converted.advanceReceived === undefined,
    "Unapproved 'advanceReceived' field is NOT present"
  );
  assert(
    converted.balanceDue === undefined,
    "Unapproved 'balanceDue' field is NOT present"
  );

  const totalCountAfter = await Booking.countDocuments();
  assert(
    totalCountAfter === totalCountBefore,
    `Total Booking collection count stayed unchanged (${totalCountBefore}) — identity preserved, not duplicated`
  );

  // ─── Test 5b: Ticket Conversion with Distinct airlinePnr & gdsPnr ──────
  console.log("\n[Test 5b] Testing Ticket conversion with DISTINCT airlinePnr and gdsPnr...");
  const ticketQueryRes = await request("/queries", {
    method: "POST",
    token: nehaToken,
    body: {
      name: "Vikram Malhotra",
      product: "ticket",
      destination: "International",
    },
  });
  assert(ticketQueryRes.status === 201, "Created ticket query");
  const ticketQueryId = ticketQueryRes.data.id;

  const ticketConvertRes = await request(`/queries/${ticketQueryId}/convert`, {
    method: "POST",
    token: nehaToken,
    body: {
      airlineName: "Air India",
      flightNumber: "AI 101",
      sectorName: "DEL - LHR",
      airlinePnr: "AI9821X",
      gdsPnr: "1E7749B",
      timeOnward: "02:15",
      timeReturn: "18:45",
      noOfInfant: "1",
      billingStatus: "Paid",
      billingNumber: "INV-TKT-101",
    },
  });
  assert(ticketConvertRes.status === 200, "Ticket conversion succeeded with 200 OK");
  const convertedTicket = ticketConvertRes.data;

  // CRITICAL: airlinePnr and gdsPnr are TWO DISTINCT FIELDS per original PDF
  assert(
    convertedTicket.airlinePnr === "AI9821X",
    `airlinePnr preserved distinctly: ${convertedTicket.airlinePnr}`
  );
  assert(
    convertedTicket.gdsPnr === "1E7749B",
    `gdsPnr preserved distinctly: ${convertedTicket.gdsPnr}`
  );
  assert(
    convertedTicket.airlinePnr !== convertedTicket.gdsPnr,
    "airlinePnr and gdsPnr are distinct fields, not collapsed into a single pnr"
  );
  assert(
    convertedTicket.flightNumber === "AI 101",
    `flightNumber preserved: ${convertedTicket.flightNumber}`
  );
  assert(
    convertedTicket.noOfInfant === "1",
    `noOfInfant ticket field preserved: ${convertedTicket.noOfInfant}`
  );

  // ─── Test 6: Dedicated Note Collection CRUD ───────────────────────────
  console.log("\n[Test 6] Testing Dedicated Note collection CRUD...");
  const addNoteRes = await request(`/bookings/${nehaQuery.id}/notes`, {
    method: "POST",
    token: nehaToken,
    body: {
      note: "Client requested early check-in at 11 AM.",
    },
  });
  assert(addNoteRes.status === 201, "Note added with 201 Created");
  const noteObj = addNoteRes.data;
  assert(noteObj.note === "Client requested early check-in at 11 AM.", "Note text saved");

  const dbNote = await Note.findOne({ bookingId: nehaQuery.id });
  assert(!!dbNote, "Note document verified in dedicated Note collection");
  assert(dbNote.user.toString() === agentNeha._id.toString(), "Note author is Neha");

  const listNotesRes = await request(`/bookings/${nehaQuery.id}/notes`, {
    method: "GET",
    token: nehaToken,
  });
  assert(listNotesRes.status === 200, "Fetched notes array (200 OK)");
  assert(listNotesRes.data.length >= 1, "Notes array contains added note");
  assert(
    listNotesRes.data[0].user?.email === "neha@helloji.in",
    "Note populated with author user details (Neha)"
  );

  // ─── Test 7: Soft-Delete -> Recycle Bin -> Restore -> Force-Delete ─────
  console.log("\n[Test 7] Testing 3-state lifecycle (Active -> Soft-Delete -> Restore -> Force-Delete)...");
  const queryForDeleteRes = await request("/queries", {
    method: "POST",
    token: nehaToken,
    body: {
      name: "Temporary Enquiry",
      product: "insurance",
    },
  });
  assert(queryForDeleteRes.status === 201, "Created temporary query for lifecycle test");
  const tempId = queryForDeleteRes.data.id;

  await request(`/bookings/${tempId}/notes`, {
    method: "POST",
    token: nehaToken,
    body: { note: "Temporary note to be purged on force delete" },
  });

  let activeListRes = await request("/queries", { token: nehaToken });
  assert(
    activeListRes.data.data.some((q) => q.id === tempId),
    "Query is present in active queries list"
  );
  let binListRes = await request("/bookings/recycle-bin", { token: nehaToken });
  assert(
    !binListRes.data.data.some((q) => q.id === tempId),
    "Query is NOT present in recycle bin"
  );

  const softDelRes = await request(`/queries/${tempId}`, {
    method: "DELETE",
    token: nehaToken,
  });
  assert(softDelRes.status === 200, "Soft-delete returned 200 OK");

  activeListRes = await request("/queries", { token: nehaToken });
  assert(
    !activeListRes.data.data.some((q) => q.id === tempId),
    "Query is NO LONGER present in active queries list"
  );
  binListRes = await request("/bookings/recycle-bin", { token: nehaToken });
  assert(
    binListRes.data.data.some((q) => q.id === tempId),
    "Query IS present in recycle bin list"
  );

  const restoreRes = await request(`/bookings/${tempId}/restore`, {
    method: "POST",
    token: nehaToken,
  });
  assert(restoreRes.status === 200, "Restore returned 200 OK");

  activeListRes = await request("/queries", { token: nehaToken });
  assert(
    activeListRes.data.data.some((q) => q.id === tempId),
    "Query is RESTORED back into active queries list"
  );

  await request(`/queries/${tempId}`, {
    method: "DELETE",
    token: nehaToken,
  });

  const forceDelRes = await request(`/bookings/${tempId}/force`, {
    method: "DELETE",
    token: nehaToken,
  });
  assert(forceDelRes.status === 200, "Force delete returned 200 OK");

  const dbBookingAfterForce = await Booking.findById(tempId);
  assert(dbBookingAfterForce === null, "Booking completely removed from MongoDB");

  const dbNotesAfterForce = await Note.find({ bookingId: tempId });
  assert(dbNotesAfterForce.length === 0, "All associated notes purged from Note collection");

  // ─── Test 8: ActivityLog Verification ──────────────────────────────────
  console.log("\n[Test 8] Verifying ActivityLog audit trail...");
  const logs = await ActivityLog.find({ recordId: nehaQuery.id });
  const eventTypes = logs.map((l) => l.activityType);
  console.log("  Audit trail events recorded for query:", eventTypes);
  assert(eventTypes.includes("created"), "Audit trail has 'created' log");
  assert(eventTypes.includes("status_changed"), "Audit trail has 'status_changed' log");
  assert(eventTypes.includes("assigned"), "Audit trail has 'assigned' log");
  assert(eventTypes.includes("converted"), "Audit trail has 'converted' log");

  console.log("\n==================================================================");
  console.log("   🎉 ALL PHASE 2 TESTS PASSED WITH 100% SCHEMA COMPLIANCE!      ");
  console.log("==================================================================");

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
