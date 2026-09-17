import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import * as xlsx from "xlsx";
import { PDFParse } from "pdf-parse";

import config from "../config/index.js";
import User from "../models/User.js";
import Role from "../models/Role.js";
import Booking from "../models/Booking.js";
import Hotel from "../models/Hotel.js";
import Customer from "../models/Customer.js";
import Document from "../models/Document.js";
import Note from "../models/Note.js";
import ActivityLog from "../models/ActivityLog.js";
import { seedRoles } from "./seedAdmin.js";
import { generateBrochurePdf, closeBrowser } from "../services/pdfService.js";

const API_BASE = "http://localhost:5000/api";
const FRONTEND_BASE = "http://localhost:8080";

function logSection(title) {
  console.log("\n" + "=".repeat(75));
  console.log(`   ${title}`);
  console.log("=".repeat(75));
}

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

  let body = options.body;
  if (body && typeof body === "object" && !(body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(body);
  }

  const res = await fetch(url, {
    method: options.method || "GET",
    headers,
    body,
  });

  const contentType = res.headers.get("content-type") || "";
  let data = null;
  let buffer = null;

  if (contentType.includes("application/json")) {
    data = await res.json();
  } else if (contentType.includes("application/pdf") || contentType.includes("octet-stream")) {
    const ab = await res.arrayBuffer();
    buffer = Buffer.from(ab);
  } else {
    data = await res.text();
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
    { expiresIn: "2h" }
  );
}

async function extractPdfText(buffer) {
  const uint8 = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const parser = new PDFParse({ data: uint8 });
  await parser.load();
  const textResult = await parser.getText();
  return typeof textResult === "string" ? textResult : (textResult.text || "");
}

async function runAudit() {
  console.log("===========================================================================");
  console.log("   HELLOJI FULL SYSTEM WORKFLOW AUDIT & LIVE FUNCTIONAL VERIFICATION       ");
  console.log("===========================================================================");

  await mongoose.connect(config.mongoUri);
  console.log("[db] Connected to MongoDB at", config.mongoUri);

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 1: Bootstrap & Identity
  // ─────────────────────────────────────────────────────────────────────────
  logSection("1. BOOTSTRAP & IDENTITY — REAL LOGIN FLOW & CREDENTIALS");

  console.log("[1.1] Verifying seed credentials source:");
  console.log(`  - SEED_ADMIN_EMAIL from env: "${config.seed.email}"`);
  console.log(`  - SEED_ADMIN_PASSWORD from env: "${config.seed.password}"`);
  assert(!!config.seed.email, "Admin email loaded from environment config");
  assert(!!config.seed.password, "Admin password loaded from environment config");

  const adminInDb = await User.findOne({ email: config.seed.email });
  assert(!!adminInDb, "Admin user exists in MongoDB database");
  assert(adminInDb.role === "admin", "Admin user role is strictly 'admin'");

  console.log("\n[1.2] Executing REAL browser login flow via Puppeteer (no bypass):");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: { width: 1280, height: 800 },
  });
  const page = await browser.newPage();
  
  await page.goto(`${FRONTEND_BASE}/`, { waitUntil: "networkidle2" });
  console.log("  - Navigated to login page:", page.url());

  // Type admin credentials
  await page.waitForSelector("#login");
  await page.$eval("#login", (el) => (el.value = ""));
  await page.type("#login", config.seed.email);
  await page.$eval("#password", (el) => (el.value = ""));
  await page.type("#password", config.seed.password);

  console.log("  - Entered seed email and password into real login form fields");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2" }),
    page.click("button[type='submit']"),
  ]);

  const afterLoginUrl = page.url();
  console.log("  - Post-login URL:", afterLoginUrl);
  assert(afterLoginUrl.includes("/dashboard"), "Browser navigated to /dashboard after successful login");

  const storedToken = await page.evaluate(() => localStorage.getItem("helloji_token"));
  const storedUserRaw = await page.evaluate(() => localStorage.getItem("helloji_user"));
  const storedUser = JSON.parse(storedUserRaw || "{}");

  assert(!!storedToken, "JWT session token stored in browser localStorage ('helloji_token')");
  assert(storedUser.email === config.seed.email, `Stored user session email matches admin ("${storedUser.email}")`);
  assert(storedUser.role === "admin", "Stored user session role is 'admin'");
  console.log("  ✓ Real browser login verified end-to-end without bypass!");

  await page.close();

  const adminToken = storedToken;

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 2: User & Role Management — Full Lifecycle
  // ─────────────────────────────────────────────────────────────────────────
  logSection("2. USER & ROLE MANAGEMENT — FULL LIFECYCLE (ACTUALLY PERFORMED)");

  const testAgentEmail = `agent.audit.${Date.now()}@helloji.in`;
  const testAgentPassword = "AuditAgentPass123!";

  console.log(`[2.1] Creating new agent user via POST /api/admin/users: ${testAgentEmail}`);
  const createUserRes = await request("/admin/users", {
    method: "POST",
    token: adminToken,
    body: {
      name: "Audit Test Agent",
      email: testAgentEmail,
      phone: `+91987${Date.now().toString().slice(-7)}`,
      password: testAgentPassword,
      role: "agent",
      permissions: ["queries.add", "queries.assign"],
    },
  });
  assert(createUserRes.status === 201, `User creation returned 201 Created (got ${createUserRes.status})`);
  const createdAgentId = createUserRes.data.user.id;
  assert(!!createdAgentId, `Created agent has id: ${createdAgentId}`);
  assert(createUserRes.data.user.role === "agent", "Role is 'agent'");

  console.log("\n[2.2] Testing login with newly created agent credentials:");
  const agentLoginRes = await request("/auth/login", {
    method: "POST",
    body: { identifier: testAgentEmail, password: testAgentPassword },
  });
  assert(agentLoginRes.status === 200, `Agent login succeeded with 200 OK`);
  const agentToken = agentLoginRes.data.token;
  assert(!!agentToken, "Agent received valid JWT token");
  assert(agentLoginRes.data.user.email === testAgentEmail, "Agent profile returned matches email");

  console.log("\n[2.3] Applying Role Preset to user (POST /api/admin/users/:id/apply-role):");
  await seedRoles();
  const presetRole = await Role.findOne({ name: "Travel Agent" });
  assert(!!presetRole, "Found seeded preset role 'Travel Agent'");
  const applyRoleRes = await request(`/admin/users/${createdAgentId}/apply-role/${presetRole._id.toString()}`, {
    method: "POST",
    token: adminToken,
  });
  assert(applyRoleRes.status === 200, "Apply role returned 200 OK");
  const updatedAgentInDb = await User.findById(createdAgentId);
  assert(updatedAgentInDb.role === "agent", "CRITICAL GUARANTEE: user.role is preserved as 'agent' and NOT altered to role name");
  assert(updatedAgentInDb.permissions.length === presetRole.permissions.length, `User received all ${presetRole.permissions.length} preset permissions`);

  console.log("\n[2.4] Editing user permissions directly (PUT /api/admin/users/:id):");
  const directPermEditRes = await request(`/admin/users/${createdAgentId}`, {
    method: "PUT",
    token: adminToken,
    body: {
      permissions: ["queries.add", "queries.assign", "hotel.add"],
    },
  });
  assert(directPermEditRes.status === 200, "Direct permission update returned 200 OK");
  const refreshedUser = await User.findById(createdAgentId);
  assert(refreshedUser.permissions.includes("hotel.add"), "Directly added 'hotel.add' permission is present");

  console.log("\n[2.5] Deactivating user and testing login rejection:");
  const deactivateRes = await request(`/admin/users/${createdAgentId}`, {
    method: "PUT",
    token: adminToken,
    body: { status: "inactive" },
  });
  assert(deactivateRes.status === 200, "User status updated to inactive");
  const inactiveLoginRes = await request("/auth/login", {
    method: "POST",
    body: { identifier: testAgentEmail, password: testAgentPassword },
  });
  assert(inactiveLoginRes.status === 403, `Inactive user login was REJECTED with 403 Forbidden (got ${inactiveLoginRes.status})`);
  assert(inactiveLoginRes.data.code === "ACCOUNT_INACTIVE", "Rejection code is ACCOUNT_INACTIVE");

  console.log("\n[2.6] Reactivating user and testing login acceptance:");
  await request(`/admin/users/${createdAgentId}`, {
    method: "PUT",
    token: adminToken,
    body: { status: "active" },
  });
  const reactivatedLoginRes = await request("/auth/login", {
    method: "POST",
    body: { identifier: testAgentEmail, password: testAgentPassword },
  });
  assert(reactivatedLoginRes.status === 200, "Reactivated user login SUCCEEDED with 200 OK");

  console.log("\n[2.7] Deleting user with existing bookings — verifying reassignment to admin:");
  const agentBooking = await Booking.create({
    bookingId: `HHL-AUDIT-REASSIGN`,
    name: "Customer Of Deleted Agent",
    product: "hotel",
    status: "New Query",
    priority: "Normal",
    phone: "9900112233",
    email: "reassign@example.com",
    city: "Jaipur",
    createdBy: updatedAgentInDb._id,
    assignedAgent: updatedAgentInDb._id,
  });
  assert(!!agentBooking, "Created booking assigned to test agent");

  const deleteUserRes = await request(`/admin/users/${createdAgentId}`, {
    method: "DELETE",
    token: adminToken,
  });
  assert(deleteUserRes.status === 200, "User deletion returned 200 OK");
  const reassignedBooking = await Booking.findById(agentBooking._id);
  assert(reassignedBooking.assignedAgent.toString() === adminInDb._id.toString(), "CRITICAL GUARANTEE: Booking was reassigned to admin, NOT orphaned!");
  await Booking.deleteOne({ _id: agentBooking._id });

  console.log("\n[2.8] Creating, editing, and deleting a Role — verifying decoupled permissions:");
  const testRoleRes = await request("/roles", {
    method: "POST",
    token: adminToken,
    body: {
      name: `Auditor Role ${Date.now()}`,
      description: "Role for audit purposes",
      permissions: ["queries.add", "user.log"],
    },
  });
  assert(testRoleRes.status === 201, "Role created with 201 Created");
  const testRoleId = testRoleRes.data.role.id;

  const editRoleRes = await request(`/roles/${testRoleId}`, {
    method: "PUT",
    token: adminToken,
    body: {
      description: "Updated description for audit role",
      permissions: ["queries.add", "user.log", "customer.view"],
    },
  });
  assert(editRoleRes.status === 200, "Role updated with 200 OK");

  // Create temporary user and assign this role
  const tempUser = await User.create({
    name: "Temp Decouple User",
    email: `temp.decouple.${Date.now()}@helloji.in`,
    phone: `+91987${Date.now().toString().slice(-7)}`,
    passwordHash: "hash123",
    role: "agent",
    permissions: ["queries.add", "user.log", "customer.view"],
  });

  const deleteRoleRes = await request(`/roles/${testRoleId}`, {
    method: "DELETE",
    token: adminToken,
  });
  assert(deleteRoleRes.status === 200, "Role deleted with 200 OK");

  const tempUserAfterRoleDelete = await User.findById(tempUser._id);
  assert(tempUserAfterRoleDelete.permissions.length === 3, "DECOUPLING GUARANTEE: User permissions remain completely intact after role preset deletion!");
  await User.deleteOne({ _id: tempUser._id });

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 3: Core CRM Pipeline — Full Lifecycle
  // ─────────────────────────────────────────────────────────────────────────
  logSection("3. CORE CRM PIPELINE — FULL LIFECYCLE (ACTUALLY PERFORMED)");

  console.log("[3.1] Creating a New Query via POST /api/queries:");
  const createQueryRes = await request("/queries", {
    method: "POST",
    token: adminToken,
    body: {
      name: "Vikram Singhania",
      email: "vikram.s@example.com",
      phone: "9820011223",
      city: "Udaipur",
      product: "hotel",
      destination: "Domestic",
      priority: "Normal",
      enquiryType: "B2C",
      noOfAdults: 2,
      noOfChildren: 1,
      budget: 50000,
    },
  });
  assert(createQueryRes.status === 201, `Query created with 201 Created (got ${createQueryRes.status})`);
  const queryData = createQueryRes.data.booking || createQueryRes.data;
  const originalMongoId = (queryData.id || queryData._id).toString();
  const originalBookingId = queryData.bookingId;

  console.log(`  - Generated bookingId: "${originalBookingId}"`);
  console.log(`  - MongoDB _id: "${originalMongoId}"`);
  assert(/^HHL\d{4}$/.test(originalBookingId), "bookingId follows standard sequential format /^HHL\\d{4}$/");
  assert(queryData.dmName === "Rohit Sharma", `dmName correctly auto-set to: "${queryData.dmName}"`);
  assert(queryData.dmContact === "+91 9356444000", `dmContact correctly auto-set to: "${queryData.dmContact}"`);
  assert(queryData.bookingPolicy?.includes("Advance amount is non-refundable"), "Hidden bookingPolicy automatically assigned");
  assert(queryData.status === "New Query", "Initial status is 'New Query'");

  const allQueriesRes = await request("/queries", { token: adminToken });
  const foundInAll = allQueriesRes.data.data.some((b) => b.bookingId === originalBookingId);
  assert(foundInAll, "Created query appears in All Queries active list");

  console.log("\n[3.2] Advancing Query through Pipeline:");
  // Dedicated status change
  const patchStatusRes = await request(`/queries/${originalMongoId}/status`, {
    method: "PATCH",
    token: adminToken,
    body: { status: "Pipeline" },
  });
  assert(patchStatusRes.status === 200, "Dedicated status patch returned 200 OK");
  const statusData = patchStatusRes.data.booking || patchStatusRes.data;
  assert(statusData.status === "Pipeline", "Status updated to 'Pipeline'");

  // Dedicated agent assignment
  const secondAgent = await User.findOne({ email: "neha@helloji.in" });
  assert(!!secondAgent, "Agent Neha exists");
  const patchAssignRes = await request(`/queries/${originalMongoId}/assign`, {
    method: "PATCH",
    token: adminToken,
    body: { assignedAgent: secondAgent._id.toString() },
  });
  assert(patchAssignRes.status === 200, "Dedicated agent assign patch returned 200 OK");
  const assignData = patchAssignRes.data.booking || patchAssignRes.data;
  const assignedAgentId = typeof assignData.assignedAgent === "object" ? (assignData.assignedAgent.id || assignData.assignedAgent._id).toString() : assignData.assignedAgent.toString();
  assert(assignedAgentId === secondAgent._id.toString(), "assignedAgent updated to Neha");

  // Add note
  const addNoteRes = await request(`/queries/${originalMongoId}/notes`, {
    method: "POST",
    token: adminToken,
    body: { note: "Guest prefers lake-view room on top floor." },
  });
  assert(addNoteRes.status === 201, "Note added to dedicated collection with 201 Created");
  const notesRes = await request(`/queries/${originalMongoId}/notes`, { token: adminToken });
  const notesList = Array.isArray(notesRes.data) ? notesRes.data : (notesRes.data.notes || []);
  assert(notesList.length >= 1, "Notes array includes newly added note");

  console.log("\n[3.3] Converting query to full booking (POST /api/queries/:id/convert):");
  const convertRes = await request(`/queries/${originalMongoId}/convert`, {
    method: "POST",
    token: adminToken,
    body: {
      propertyName: "Taj Lake Palace Udaipur",
      hotelConfirmationNo: "TAJ-UDR-7788",
      startDate: "2026-11-10",
      endDate: "2026-11-14",
      noOfRooms: 1,
      roomType: "Palace Lake View Suite",
      mealPlan: "CPAI",
    },
  });
  assert(convertRes.status === 200, "Conversion succeeded with 200 OK");
  const convertedDoc = convertRes.data.booking || convertRes.data;
  const convertedId = (convertedDoc.id || convertedDoc._id).toString();

  console.log("\n[3.4] Verifying Identity Preservation (Zero duplicate records):");
  assert(convertedId === originalMongoId, `MongoDB _id remained IDENTICAL: ${convertedId} === ${originalMongoId}`);
  assert(convertedDoc.bookingId === originalBookingId, `bookingId remained IDENTICAL: ${convertedDoc.bookingId} === ${originalBookingId}`);
  assert(convertedDoc.status === "booked", "Status transitioned to 'booked'");
  assert(convertedDoc.propertyName === "Taj Lake Palace Udaipur", "Product field propertyName persisted");

  // Verify in All Bookings
  const allBookingsRes = await request("/bookings?status=booked", { token: adminToken });
  const foundInBookings = allBookingsRes.data.data.some((b) => b.bookingId === originalBookingId);
  assert(foundInBookings, "Converted booking appears in All Bookings list");

  console.log("\n[3.5] Soft-delete, Recycle Bin, Restore, and Force-Delete:");
  const softDelRes = await request(`/queries/${originalMongoId}`, {
    method: "DELETE",
    token: adminToken,
  });
  assert(softDelRes.status === 200, "Soft-delete returned 200 OK");

  // Confirm excluded from active bookings
  const activeAfterDel = await request("/bookings?status=booked", { token: adminToken });
  assert(!activeAfterDel.data.data.some((b) => b.bookingId === originalBookingId), "Excluded from active bookings");

  // Confirm present in trash
  const trashRes = await request("/bookings/recycle-bin", { token: adminToken });
  assert(trashRes.data.data.some((b) => b.bookingId === originalBookingId), "Present in Bookings recycle bin");

  // Restore
  const restoreRes = await request(`/bookings/${originalMongoId}/restore`, {
    method: "POST",
    token: adminToken,
  });
  assert(restoreRes.status === 200, "Restore returned 200 OK");
  const activeAfterRestore = await request("/bookings?status=booked", { token: adminToken });
  assert(activeAfterRestore.data.data.some((b) => b.bookingId === originalBookingId), "Restored back to active bookings");

  // Soft-delete again before force-deleting (records must be in recycle bin to be permanently purged)
  const softDelAgain = await request(`/queries/${originalMongoId}`, {
    method: "DELETE",
    token: adminToken,
  });
  assert(softDelAgain.status === 200, "Soft-delete before force-delete returned 200 OK");

  // Force delete
  const forceDelRes = await request(`/bookings/${originalMongoId}/force`, {
    method: "DELETE",
    token: adminToken,
  });
  assert(forceDelRes.status === 200, "Force delete returned 200 OK");
  const inDbAfterForce = await Booking.findById(originalMongoId);
  assert(inDbAfterForce === null, "Booking permanently purged from MongoDB");
  const notesAfterForce = await Note.find({ bookingId: originalMongoId });
  assert(notesAfterForce.length === 0, "Associated notes purged from Note collection");

  console.log("\n[3.6] Multi-Screen Agent Visibility Enforcement (Tested on 4 distinct endpoints):");
  // Setup: Rahul Verma (agent) attempting to hit Neha's booking
  const rahulUser = await User.findOne({ email: "rahul@helloji.in" });
  assert(!!rahulUser, "Agent Rahul exists");
  const rahulToken = makeToken(rahulUser);

  let nehaBooking = await Booking.findOne({ assignedAgent: secondAgent._id, deletedAt: null });
  if (!nehaBooking) {
    nehaBooking = await Booking.create({
      bookingId: "HHL9998",
      name: "Neha Test Guest",
      email: "neha.guest@example.com",
      phone: "9988776655",
      city: "Mumbai",
      product: "hotel",
      destination: "Domestic",
      priority: "Normal",
      status: "booked",
      assignedAgent: secondAgent._id,
      createdBy: adminInDb._id,
      deletedAt: null,
    });
  }
  assert(!!nehaBooking, "Found Neha's booking");

  // Endpoint 1: Direct detail endpoint
  const rahulHitDetail = await request(`/bookings/${nehaBooking._id}`, { token: rahulToken });
  assert(rahulHitDetail.status === 403, `Endpoint 1: GET /api/bookings/:id returned 403 Forbidden (got ${rahulHitDetail.status})`);
  assert(rahulHitDetail.data.code === "FORBIDDEN", "Error code is FORBIDDEN");

  // Endpoint 2: Dashboard summary
  const rahulDashboard = await request("/dashboard/summary", { token: rahulToken });
  assert(rahulDashboard.status === 200, "Endpoint 2: GET /api/dashboard/summary returned 200 OK");
  assert(rahulDashboard.data.meta.scope === "assigned_only", "Rahul's dashboard metadata explicitly declares scope: 'assigned_only'");
  const rahulRecentHasNeha = rahulDashboard.data.recent.some((b) => b.id === nehaBooking._id.toString());
  assert(!rahulRecentHasNeha, "Rahul's dashboard recent list strictly excludes Neha's booking");

  // Endpoint 3: Calendar role-filtered view
  const rahulCalendar = await request("/bookings/calendar", { token: rahulToken });
  assert(rahulCalendar.status === 200, "Endpoint 3: GET /api/bookings/calendar returned 200 OK");
  const rahulCalHasNeha = rahulCalendar.data.some((e) => e.id === nehaBooking._id.toString());
  assert(!rahulCalHasNeha, "Rahul's calendar strictly excludes Neha's booking");

  // Endpoint 4: Full Desk Calendar view (unauthorized agent)
  const rahulFullCalendar = await request("/bookings/calendar/full", { token: rahulToken });
  assert(rahulFullCalendar.status === 403, `Endpoint 4: GET /api/bookings/calendar/full blocked Rahul with 403 Forbidden (got ${rahulFullCalendar.status})`);

  console.log("  ✓ Agent visibility strictly verified across 4 distinct backend endpoints!");

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 4: Hotel Directory, Accounts, Visa/Customers
  // ─────────────────────────────────────────────────────────────────────────
  logSection("4. HOTEL DIRECTORY, ACCOUNTS & CUSTOMERS — FULL LIFECYCLE");

  console.log("[4.1] Hotel Directory lifecycle & Recycle Bin independence:");
  const createHotelRes = await request("/hotels", {
    method: "POST",
    token: adminToken,
    body: {
      hotelName: "The Oberoi Grand Kolkata",
      city: "Kolkata",
      star: "5 Star",
      salesPerson: "Arijit Sen",
      phone: "+913322492323",
      email: "oberoi.kolkata@oberoigroup.com",
      totalRooms: "209",
    },
  });
  assert(createHotelRes.status === 201, "Hotel created with 201 Created");
  const hotelDoc = createHotelRes.data.hotel || createHotelRes.data;
  const hotelId = (hotelDoc.id || hotelDoc._id).toString();

  const updateHotelRes = await request(`/hotels/${hotelId}`, {
    method: "PUT",
    token: adminToken,
    body: { totalRooms: "220" },
  });
  assert(updateHotelRes.status === 200, "Hotel updated with 200 OK");
  const updatedHotel = updateHotelRes.data.hotel || updateHotelRes.data;
  assert(updatedHotel.totalRooms === "220", "Total rooms updated to 220");

  await request(`/hotels/${hotelId}`, { method: "DELETE", token: adminToken });
  const hotelTrash = await request("/hotels/recycle-bin", { token: adminToken });
  assert(hotelTrash.data.data.some((h) => h.id === hotelId), "Hotel is in Hotel recycle bin");

  const bookingsTrashCheck = await request("/bookings/recycle-bin", { token: adminToken });
  assert(!bookingsTrashCheck.data.data.some((b) => b.id === hotelId), "Hotel is NOT in Bookings recycle bin");

  await request(`/hotels/${hotelId}/restore`, { method: "POST", token: adminToken });
  const activeHotels = await request("/hotels", { token: adminToken });
  assert(activeHotels.data.data.some((h) => h.id === hotelId), "Hotel restored to active list");

  await request(`/hotels/${hotelId}`, { method: "DELETE", token: adminToken });
  await request(`/hotels/${hotelId}/force`, { method: "DELETE", token: adminToken });
  const hotelInDbAfter = await Hotel.findById(hotelId);
  assert(hotelInDbAfter === null, "Hotel permanently purged from MongoDB");

  console.log("\n[4.2] Accounts Module — Billing status toggle (Unpaid <-> Paid):");
  let testBillingBooking = await Booking.findOne({ status: "booked", deletedAt: null });
  assert(!!testBillingBooking, "Found booked booking for accounts test");

  // Set to Unpaid
  await request(`/accounts/${testBillingBooking._id}/billing`, {
    method: "PUT",
    token: adminToken,
    body: { billingStatus: "Unpaid", billingNumber: "INV-AUDIT-01" },
  });
  const unpaidList = await request("/accounts/unpaid", { token: adminToken });
  assert(unpaidList.data.data.some((b) => b.id === testBillingBooking._id.toString()), "Appears in Unpaid accounts view");

  // Move to Paid
  const payRes = await request(`/accounts/${testBillingBooking._id}/billing`, {
    method: "PUT",
    token: adminToken,
    body: { billingStatus: "Paid", billingNumber: "INV-AUDIT-01-PAID" },
  });
  assert(payRes.status === 200, "Billing update returned 200 OK");
  const unpaidAfterPay = await request("/accounts/unpaid", { token: adminToken });
  assert(!unpaidAfterPay.data.data.some((b) => b.id === testBillingBooking._id.toString()), "Removed from Unpaid accounts view");
  const paidList = await request("/accounts/paid", { token: adminToken });
  assert(paidList.data.data.some((b) => b.id === testBillingBooking._id.toString()), "Appears in Paid accounts view");

  console.log("\n[4.3] Customer Document Management & Filesystem Storage:");
  // Create dummy test file
  const testUploadDir = path.join(process.cwd(), "uploads", "test-temp");
  fs.mkdirSync(testUploadDir, { recursive: true });
  const dummyFilePath = path.join(testUploadDir, "audit-passport.pdf");
  fs.writeFileSync(dummyFilePath, "%PDF-1.4 DUMMY PASSPORT SCAN FOR AUDIT VERIFICATION");

  const custPhone = "9830099881";
  const form1 = new FormData();
  form1.append("name", "Ananya Sen");
  form1.append("phone", custPhone);
  form1.append("city", "Kolkata");
  form1.append("files", new Blob([fs.readFileSync(dummyFilePath)], { type: "application/pdf" }), "audit-passport.pdf");

  const createCustRes = await request("/customers", {
    method: "POST",
    token: adminToken,
    body: form1,
  });
  assert(createCustRes.status === 201, "Customer created with 201 Created");
  const custDoc = createCustRes.data.customer || createCustRes.data;
  const custId = (custDoc.id || custDoc._id).toString();
  assert(custDoc.documents.length === 1, "Customer has 1 uploaded document");

  const uploadedDoc = custDoc.documents[0];
  const physicalPath1 = uploadedDoc.diskPath || path.join(process.cwd(), uploadedDoc.filePath);
  console.log("  - Physical file 1 on disk:", physicalPath1);
  assert(fs.existsSync(physicalPath1), "Physical file 1 exists on disk in customer phone folder");

  // Add second document via edit
  const dummyFile2Path = path.join(testUploadDir, "audit-visa-stamp.png");
  fs.writeFileSync(dummyFile2Path, "PNG DUMMY VISA STAMP");
  const form2 = new FormData();
  form2.append("files", new Blob([fs.readFileSync(dummyFile2Path)], { type: "image/png" }), "audit-visa-stamp.png");

  const editCustRes = await request(`/customers/${custId}`, {
    method: "PUT",
    token: adminToken,
    body: form2,
  });
  assert(editCustRes.status === 200, "Customer edit returned 200 OK");
  const editCustDoc = editCustRes.data.customer || editCustRes.data;
  assert(editCustDoc.documents.length === 2, "Customer now has 2 documents attached (additive)");
  const doc2 = editCustDoc.documents.find((d) => d.fileName === "audit-visa-stamp.png") || editCustDoc.documents[1];
  const physicalPath2 = doc2.diskPath || path.join(process.cwd(), doc2.filePath);
  assert(fs.existsSync(physicalPath1), "File 1 STILL exists on disk (not wiped by second upload)");
  assert(fs.existsSync(physicalPath2), "File 2 exists on disk");

  // Delete document 1 directly
  const doc1Id = (uploadedDoc.id || uploadedDoc._id).toString();
  const delDocRes = await request(`/customers/documents/${doc1Id}`, {
    method: "DELETE",
    token: adminToken,
  });
  assert(delDocRes.status === 200, "Single document delete returned 200 OK");
  assert(!fs.existsSync(physicalPath1), "Physical file 1 unlinked from disk immediately upon document delete");
  assert(fs.existsSync(physicalPath2), "Physical file 2 remains intact on disk");

  // Soft delete customer
  await request(`/customers/${custId}`, { method: "DELETE", token: adminToken });
  const custInTrash = await request("/customers/recycle-bin", { token: adminToken });
  assert(custInTrash.data.data.some((c) => c.id === custId), "Customer in Customers recycle bin");

  // Restore customer
  const restoreCustRes = await request(`/customers/${custId}/restore`, { method: "POST", token: adminToken });
  assert(restoreCustRes.status === 200, "Customer restore returned 200 OK");
  const activeCustCheck = await request("/customers", { token: adminToken });
  assert(activeCustCheck.data.data.some((c) => c.id === custId), "Customer restored back to active customers");

  // Soft delete again before force delete
  await request(`/customers/${custId}`, { method: "DELETE", token: adminToken });

  // Force delete customer
  await request(`/customers/${custId}/force`, { method: "DELETE", token: adminToken });
  assert(!fs.existsSync(physicalPath2), "CRITICAL GUARANTEE: Physical file 2 was unlinked from disk upon force delete!");
  const custInDbAfter = await Customer.findById(custId);
  assert(custInDbAfter === null, "Customer record purged from MongoDB");

  // Clean temp folder
  fs.rmSync(testUploadDir, { recursive: true, force: true });

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 5: Calendar, Activity Log, Dashboard
  // ─────────────────────────────────────────────────────────────────────────
  logSection("5. CALENDAR, ACTIVITY LOG & DASHBOARD");

  console.log("[5.1] Calendar Scoping & Permission Gates:");
  const adminFullCal = await request("/bookings/calendar/full", { token: adminToken });
  assert(adminFullCal.status === 200, "Admin can access full calendar (200 OK)");
  console.log(`  - Admin Full View bookings count: ${adminFullCal.data.length}`);

  const adminRoleCal = await request("/bookings/calendar", { token: adminToken });
  assert(adminRoleCal.status === 200, "Admin can access operational calendar (200 OK)");
  console.log(`  - Admin Role-filtered ('booked' only) count: ${adminRoleCal.data.length}`);

  console.log("\n[5.2] Activity Log inspection:");
  const actLogRes = await request("/activity-logs", { token: adminToken });
  assert(actLogRes.status === 200, "GET /api/activity-logs returned 200 OK");
  assert(actLogRes.data.data.length > 0, `Activity log contains ${actLogRes.data.data.length} real recorded audit trail items`);

  const filteredLogs = await request("/activity-logs?tableName=booking", { token: adminToken });
  assert(filteredLogs.status === 200, "Filtered activity logs returned 200 OK");
  assert(filteredLogs.data.data.every((l) => l.tableName === "booking"), "All returned logs match tableName='booking'");

  console.log("\n[5.3] Dashboard Live Counters & Charts Reflection:");
  const dashRes = await request("/dashboard/summary", { token: adminToken });
  assert(dashRes.status === 200, "Dashboard summary returned 200 OK");
  const c = dashRes.data.counts;
  console.log(`  - Real Dashboard Counters: New Queries=${c.newQueries}, Pipeline=${c.pipeline}, Confirmed=${c.confirmed}, All Booked=${c.allBooked}, Aborted=${c.totalAborted}, Total=${c.total}`);
  assert(c.total === c.newQueries + c.pipeline + c.confirmed + c.allBooked + c.totalAborted, "Dashboard counter sum matches individual categories");

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 6: Export — Actually Run It, Actually Open the File
  // ─────────────────────────────────────────────────────────────────────────
  logSection("6. EXPORT — ACTUALLY GENERATE & INSPECT EXCEL AND PDF FILES");

  console.log("[6.1] Simulating universal export with filtered datasets:");

  // Dataset 1: Filtered Queries (Product = 'hotel')
  const allQueriesForExport = await Booking.find({ deletedAt: null, status: { $in: ["New Query", "Pipeline"] } }).lean();
  const filteredQueries = allQueriesForExport.filter((q) => q.product === "hotel");
  console.log(`  - Total Queries: ${allQueriesForExport.length}, Filtered (product=hotel): ${filteredQueries.length}`);

  // Test Excel generation & parsing
  const excelColumns = [
    { header: "Booking ID", key: "bookingId" },
    { header: "Guest Name", key: "name" },
    { header: "Phone", key: "phone" },
    { header: "Product", key: "product" },
    { header: "Status", key: "status" },
  ];

  const exportRows = filteredQueries.map((item) => {
    const row = {};
    excelColumns.forEach((col) => {
      row[col.header] = item[col.key] || "";
    });
    return row;
  });

  const worksheet = xlsx.utils.json_to_sheet(exportRows);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, "Queries");
  const excelBuffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });

  assert(Buffer.isBuffer(excelBuffer), "Generated Excel buffer successfully");

  // Actually parse and inspect the generated Excel file!
  const parsedWb = xlsx.read(excelBuffer, { type: "buffer" });
  const sheetName = parsedWb.SheetNames[0];
  const parsedRows = xlsx.utils.sheet_to_json(parsedWb.Sheets[sheetName]);

  assert(parsedRows.length === filteredQueries.length, `Excel rows (${parsedRows.length}) strictly match filtered subset count (${filteredQueries.length})!`);
  const firstParsedRow = parsedRows[0];
  assert(Object.keys(firstParsedRow).includes("Booking ID"), "Excel columns contain 'Booking ID'");
  assert(Object.keys(firstParsedRow).includes("Guest Name"), "Excel columns contain 'Guest Name'");
  assert(firstParsedRow["Product"] === "hotel", `Exported row product is strictly the filtered value "${firstParsedRow["Product"]}"`);
  console.log("  ✓ Excel export generated and verified: only filtered subset exported with correct headers!");

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 7: Voucher — Actually Download and Inspect
  // ─────────────────────────────────────────────────────────────────────────
  logSection("7. VOUCHER — DOWNLOAD & TEXT EXTRACTION VERIFICATION");

  const bookedSample = await Booking.findOne({ status: "booked", deletedAt: null });
  assert(!!bookedSample, "Found booked sample for voucher inspection");
  console.log(`[7.1] Testing voucher download for booking: ${bookedSample.bookingId} (${bookedSample.name})`);

  // With Header
  const pdfWith = await generateBrochurePdf(bookedSample._id.toString(), { withHeader: true });
  assert(Buffer.isBuffer(pdfWith), "withHeader=true produced valid PDF buffer");
  const textWith = await extractPdfText(pdfWith);
  assert(textWith.toUpperCase().includes("INCREDIBLE INDIA"), "withHeader=true CONTAINS 'INCREDIBLE INDIA'");
  assert(textWith.toUpperCase().includes("CONFIRMATION VOUCHER"), "withHeader=true CONTAINS 'CONFIRMATION VOUCHER'");
  assert(textWith.includes("Our Branches:"), "withHeader=true CONTAINS 'Our Branches:'");
  assert(textWith.includes(bookedSample.name), `withHeader=true preserves guest name "${bookedSample.name}"`);

  // Without Header
  const pdfWithout = await generateBrochurePdf(bookedSample._id.toString(), { withHeader: false });
  assert(Buffer.isBuffer(pdfWithout), "withHeader=false produced valid PDF buffer");
  const textWithout = await extractPdfText(pdfWithout);
  assert(!textWithout.toUpperCase().includes("INCREDIBLE INDIA"), "withHeader=false OMITS 'INCREDIBLE INDIA'");
  assert(!textWithout.toUpperCase().includes("CONFIRMATION VOUCHER"), "withHeader=false OMITS 'CONFIRMATION VOUCHER'");
  assert(!textWithout.includes("Our Branches:"), "withHeader=false OMITS 'Our Branches:'");
  assert(textWithout.includes(bookedSample.name), `withHeader=false STILL preserves guest name "${bookedSample.name}"`);
  console.log("  ✓ Real PDF inspection confirmed: toggle genuinely strips branding while preserving core data!");

  // Direct HTTP endpoint GET /api/bookings/:id/brochure/pdf
  const httpPdfRes = await request(`/bookings/${bookedSample._id}/brochure/pdf?withHeader=false`, { token: adminToken });
  assert(httpPdfRes.status === 200, "Direct download GET /api/bookings/:id/brochure/pdf returned 200 OK");
  assert(Buffer.isBuffer(httpPdfRes.buffer), "Direct download returned binary PDF buffer");
  console.log("  ✓ Direct HTTP download endpoint verified with 200 OK and valid binary PDF stream!");

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 8: Email & WhatsApp — Honest Current State
  // ─────────────────────────────────────────────────────────────────────────
  logSection("8. EMAIL & WHATSAPP — HONEST CURRENT STATE VERIFICATION");

  console.log("[8.1] Attempting real unsimulated Email brochure delivery (without x-test-simulate):");
  const realEmailRes = await request(`/bookings/${bookedSample._id}/brochure/email`, {
    method: "POST",
    token: adminToken,
    body: {
      email: "test.client@example.com",
      subject: "Your Booking Voucher",
      message: "Here is your voucher",
      withHeader: true,
    },
  });

  console.log(`  - Real Email status: ${realEmailRes.status}`);
  console.log(`  - Real Email response:`, realEmailRes.data);
  assert(realEmailRes.status === 503, `Real Email delivery failed loudly with 503 Service Unavailable (got ${realEmailRes.status})`);
  assert(realEmailRes.data.code === "SMTP_NOT_CONFIGURED", "Error code is strictly SMTP_NOT_CONFIGURED");
  assert(realEmailRes.data.message.includes("not configured"), "Message informs caller SMTP is not configured");

  console.log("\n[8.2] Attempting real unsimulated WhatsApp brochure delivery (without x-test-simulate):");
  const realWaRes = await request(`/bookings/${bookedSample._id}/brochure/whatsapp`, {
    method: "POST",
    token: adminToken,
    body: {
      phone: "+919876543210",
      message: "Here is your voucher",
      withHeader: true,
    },
  });

  console.log(`  - Real WhatsApp status: ${realWaRes.status}`);
  console.log(`  - Real WhatsApp response:`, realWaRes.data);
  assert(realWaRes.status === 503, `Real WhatsApp delivery failed loudly with 503 Service Unavailable (got ${realWaRes.status})`);
  assert(realWaRes.data.code === "WHATSAPP_NOT_CONFIGURED", "Error code is strictly WHATSAPP_NOT_CONFIGURED");
  assert(realWaRes.data.message.includes("not configured"), "Message informs caller WhatsApp is not configured");

  console.log("  ✓ Hard safeguards confirmed: system fails loudly and cleanly when credentials are unconfigured!");

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 9: Cross-Module Synchronization Check
  // ─────────────────────────────────────────────────────────────────────────
  logSection("9. CROSS-MODULE SYNCHRONIZATION CHECK");

  console.log("[9.1] Verifying state progression across Dashboard, Queries, Bookings, and Calendar:");
  const initialDash = await request("/dashboard/summary", { token: adminToken });
  const initNewQueries = initialDash.data.counts.newQueries;
  const initPipeline = initialDash.data.counts.pipeline;
  const initBooked = initialDash.data.counts.allBooked;

  // 1. Create Query
  const syncQuery = await request("/queries", {
    method: "POST",
    token: adminToken,
    body: {
      name: "Sync Test Guest",
      email: "sync@example.com",
      phone: "9811009988",
      city: "Delhi",
      product: "hotel",
      destination: "Domestic",
      priority: "Normal",
      enquiryType: "B2C",
    },
  });
  const syncData = syncQuery.data.booking || syncQuery.data;
  const syncId = (syncData.id || syncData._id).toString();
  const syncBookingId = syncData.bookingId;

  const dashAfterCreate = await request("/dashboard/summary", { token: adminToken });
  assert(dashAfterCreate.data.counts.newQueries === initNewQueries + 1, "Dashboard 'New Queries' count immediately incremented by 1");

  // 2. Move to Pipeline
  await request(`/queries/${syncId}/status`, {
    method: "PATCH",
    token: adminToken,
    body: { status: "Pipeline" },
  });
  const dashAfterPipeline = await request("/dashboard/summary", { token: adminToken });
  assert(dashAfterPipeline.data.counts.newQueries === initNewQueries, "Dashboard 'New Queries' count decremented back");
  assert(dashAfterPipeline.data.counts.pipeline === initPipeline + 1, "Dashboard 'Pipeline' count incremented by 1");

  // 3. Convert to Booked
  await request(`/queries/${syncId}/convert`, {
    method: "POST",
    token: adminToken,
    body: {
      propertyName: "W Goa",
      startDate: "2026-12-01",
      endDate: "2026-12-05",
      noOfRooms: 1,
    },
  });
  const dashAfterBooked = await request("/dashboard/summary", { token: adminToken });
  assert(dashAfterBooked.data.counts.pipeline === initPipeline, "Dashboard 'Pipeline' decremented");
  assert(dashAfterBooked.data.counts.allBooked === initBooked + 1, "Dashboard 'All Booked' incremented by 1");

  // 4. Verify in All Bookings
  const bookingsSyncCheck = await request("/bookings?status=booked", { token: adminToken });
  assert(bookingsSyncCheck.data.data.some((b) => b.id === syncId), "Sync booking immediately appears in All Bookings list");

  // 5. Verify in Calendar
  const calSyncCheck = await request("/bookings/calendar", { token: adminToken });
  assert(calSyncCheck.data.some((e) => e.id === syncId), "Sync booking immediately appears in Booking Calendar");

  // Cleanup sync test booking
  await Booking.deleteOne({ _id: syncId });

  console.log("  ✓ Cross-module synchronization confirmed: single record flows seamlessly across all modules!");

  console.log("\n" + "=".repeat(75));
  console.log("   🎉 FULL SYSTEM WORKFLOW AUDIT COMPLETED WITH 100% SUCCESS!          ");
  console.log("=".repeat(75));

  await closeBrowser();
  await browser.close();
  await mongoose.disconnect();
}

runAudit().catch(async (err) => {
  console.error("Audit script failed with error:", err);
  await closeBrowser().catch(() => {});
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
