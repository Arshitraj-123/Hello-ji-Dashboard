/**
 * Phase 3 Integration & Security Verification Suite
 *
 * Tests:
 * 1. Hotel Directory: CRUD, search, pagination, auto-activity logging (tableName: 'hotel'), dedicated recycle bin.
 * 2. Accounts Module: unpaid/paid filtered views over Booking collection, strict role visibility rule, dedicated billing update endpoint.
 * 3. Visa / Customer Documents: Multipart upload (PDFs + images), per-phone folder storage, additive document updates,
 *    direct single-document permanent deletion with disk unlinking, cascading soft-delete/restore, and force-delete with filesystem cleanup.
 * 4. Three Independent Recycle Bins: Zero cross-contamination between bookings, hotels, and customers bins.
 */

import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import config from "../config/index.js";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import Hotel from "../models/Hotel.js";
import Customer from "../models/Customer.js";
import Document from "../models/Document.js";
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
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...(options.headers || {}),
  };

  // Only set Content-Type if body is not FormData
  if (options.body && !(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    method: options.method || "GET",
    headers,
    body:
      options.body instanceof FormData
        ? options.body
        : options.body && typeof options.body === "object"
        ? JSON.stringify(options.body)
        : options.body,
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
  console.log("   PHASE 3: HOTEL DIRECTORY, ACCOUNTS & CUSTOMER DOCUMENTS TEST  ");
  console.log("==================================================================");

  await mongoose.connect(config.mongoUri);
  console.log("[db] Connected to MongoDB");

  // ─── Step 0: Ensure Test Users ─────────────────────────────────────────
  console.log("\n[Step 0] Setting up test users...");
  const adminUser = await User.findOne({ email: "admin@helloji.in" });
  assert(!!adminUser, "Admin user exists in database");
  const adminToken = makeToken(adminUser);

  // Agent Neha with full operational permissions
  let agentNeha = await User.findOne({ email: "neha@helloji.in" });
  if (!agentNeha) {
    const hash = await User.hashPassword("AgentPass123!");
    agentNeha = await User.create({
      name: "Neha Sharma",
      email: "neha@helloji.in",
      passwordHash: hash,
      role: "agent",
      permissions: [
        "hotel.add",
        "hotel.viewAll",
        "customer.add",
        "customer.view",
        "customer.recycleBin",
        "accounts.menu",
        "trash.recycleBin",
        "booking.viewAll",
      ],
    });
  } else {
    agentNeha.permissions = [
      "hotel.add",
      "hotel.viewAll",
      "customer.add",
      "customer.view",
      "customer.recycleBin",
      "accounts.menu",
      "trash.recycleBin",
      "booking.viewAll",
    ];
    await agentNeha.save();
  }
  const nehaToken = makeToken(agentNeha);

  // Agent Rahul (Standard Agent without accounts.menu, hotel.add, customer.add)
  let agentRahul = await User.findOne({ email: "rahul@helloji.in" });
  if (!agentRahul) {
    const hash = await User.hashPassword("AgentPass123!");
    agentRahul = await User.create({
      name: "Rahul Verma",
      email: "rahul@helloji.in",
      passwordHash: hash,
      role: "agent",
      permissions: ["queries.add"],
    });
  } else {
    agentRahul.permissions = ["queries.add"];
    await agentRahul.save();
  }
  const rahulToken = makeToken(agentRahul);

  // Agent Accounts Only (Has accounts.menu, but NOT admin, restricted visibility)
  let agentAccounts = await User.findOne({ email: "accounts@helloji.in" });
  if (!agentAccounts) {
    const hash = await User.hashPassword("AgentPass123!");
    agentAccounts = await User.create({
      name: "Accounts Officer",
      email: "accounts@helloji.in",
      passwordHash: hash,
      role: "agent",
      permissions: ["accounts.menu"],
    });
  } else {
    agentAccounts.permissions = ["accounts.menu"];
    await agentAccounts.save();
  }
  const accountsToken = makeToken(agentAccounts);

  // ─── MODULE 1: Hotel Directory & Activity Logging ──────────────────────
  console.log("\n[Module 1] Testing Hotel Directory CRUD & Activity Logging...");

  // 1a. Permission gate on POST /api/hotels
  const unauthHotelRes = await request("/hotels", {
    method: "POST",
    token: rahulToken,
    body: { hotelName: "Unauthorized Hotel" },
  });
  assert(unauthHotelRes.status === 403, "POST /api/hotels requires hotel.add permission (got 403)");

  // 1b. Create Hotel as authorized agent
  const createHotelRes = await request("/hotels", {
    method: "POST",
    token: nehaToken,
    body: {
      hotelName: "Grand Hyatt Mumbai",
      city: "Mumbai",
      star: "5 Star",
      salesPerson: "Amitabh Sen",
      email: "amitabh.sen@hyatt.com",
      phone: "+91 22 6676 1234",
      address: "Bandra Kurla Complex, Mumbai",
      reservationNumber: "RES-MUM-551",
      totalRooms: "547",
      roomsCategory: "Grand King, Club View, Suite",
      remarks: "Corporate contract active through Dec 2026",
    },
  });
  assert(createHotelRes.status === 201, "Created hotel with 201 Created");
  const createdHotel = createHotelRes.data;
  assert(createdHotel.hotelName === "Grand Hyatt Mumbai", "Hotel name saved correctly");
  assert(createdHotel.totalRooms === "547", "Total rooms saved correctly");

  // 1c. Verify Activity Log auto-created with tableName: 'hotel'
  const hotelLog = await ActivityLog.findOne({
    tableName: "hotel",
    recordId: createdHotel.id,
    activityType: "created",
  });
  assert(!!hotelLog, "ActivityLog automatically recorded for Hotel creation with tableName: 'hotel'");

  // 1d. List active hotels (GET /api/hotels)
  const listHotelsRes = await request("/hotels?q=Hyatt", {
    method: "GET",
    token: nehaToken,
  });
  assert(listHotelsRes.status === 200, "Listed hotels with 200 OK");
  assert(
    listHotelsRes.data.data.some((h) => h.id === createdHotel.id),
    "Created hotel found in search query"
  );

  // 1e. Update Hotel (PUT /api/hotels/:id)
  const updateHotelRes = await request(`/hotels/${createdHotel.id}`, {
    method: "PUT",
    token: nehaToken,
    body: {
      totalRooms: "550",
      remarks: "Updated corporate contract rate",
    },
  });
  assert(updateHotelRes.status === 200, "Updated hotel with 200 OK");
  assert(updateHotelRes.data.totalRooms === "550", "Hotel totalRooms updated");

  const hotelUpdateLog = await ActivityLog.findOne({
    tableName: "hotel",
    recordId: createdHotel.id,
    activityType: "updated",
  });
  assert(!!hotelUpdateLog, "ActivityLog recorded for Hotel update");

  // 1f. Soft-delete Hotel (DELETE /api/hotels/:id)
  const deleteHotelRes = await request(`/hotels/${createdHotel.id}`, {
    method: "DELETE",
    token: nehaToken,
  });
  assert(deleteHotelRes.status === 200, "Soft-deleted hotel with 200 OK");

  // Verify absent from active list
  const listAfterDelete = await request("/hotels", {
    method: "GET",
    token: nehaToken,
  });
  assert(
    !listAfterDelete.data.data.some((h) => h.id === createdHotel.id),
    "Hotel excluded from active hotels list"
  );

  // 1g. Hotel Dedicated Recycle Bin (GET /api/hotels/recycle-bin)
  const hotelBinRes = await request("/hotels/recycle-bin", {
    method: "GET",
    token: nehaToken,
  });
  assert(hotelBinRes.status === 200, "Fetched hotel recycle bin with 200 OK");
  assert(
    hotelBinRes.data.data.some((h) => h.id === createdHotel.id),
    "Soft-deleted hotel found in dedicated hotel recycle bin"
  );

  // 1h. Restore Hotel (POST /api/hotels/:id/restore)
  const restoreHotelRes = await request(`/hotels/${createdHotel.id}/restore`, {
    method: "POST",
    token: nehaToken,
  });
  assert(restoreHotelRes.status === 200, "Restored hotel with 200 OK");

  const listAfterRestore = await request("/hotels", {
    method: "GET",
    token: nehaToken,
  });
  assert(
    listAfterRestore.data.data.some((h) => h.id === createdHotel.id),
    "Restored hotel back in active list"
  );

  // 1i. Soft-delete again then Force Delete (DELETE /api/hotels/:id/force)
  await request(`/hotels/${createdHotel.id}`, {
    method: "DELETE",
    token: nehaToken,
  });
  const forceDelHotelRes = await request(`/hotels/${createdHotel.id}/force`, {
    method: "DELETE",
    token: nehaToken,
  });
  assert(forceDelHotelRes.status === 200, "Force deleted hotel with 200 OK");

  const dbHotelAfterForce = await Hotel.findById(createdHotel.id);
  assert(dbHotelAfterForce === null, "Hotel permanently purged from MongoDB");

  // ─── MODULE 2: Accounts Views & Role Visibility ────────────────────────
  console.log("\n[Module 2] Testing Accounts Module & Billing Views...");

  // 2a. Permission gate on /api/accounts
  const unauthAccountsRes = await request("/accounts/unpaid", {
    method: "GET",
    token: rahulToken,
  });
  assert(unauthAccountsRes.status === 403, "GET /api/accounts/unpaid requires accounts.menu (got 403)");

  // 2b. Create two test bookings: one assigned to agentAccounts, one assigned to someone else
  await Booking.deleteMany({ bookingId: { $in: ["HHL9001", "HHL9002", "HHL-BIN-TEST"] } });
  const accountsBooking = await Booking.create({
    bookingId: "HHL9001",
    name: "Sunil Narang",
    product: "hotel",
    status: "booked",
    billingStatus: "Unpaid",
    billingNumber: "INV-9001",
    createdBy: agentAccounts._id,
    assignedAgent: agentAccounts._id,
    deletedAt: null,
  });

  const otherBooking = await Booking.create({
    bookingId: "HHL9002",
    name: "Deepak Chopra",
    product: "ticket",
    status: "booked",
    billingStatus: "Unpaid",
    billingNumber: "INV-9002",
    createdBy: adminUser._id,
    assignedAgent: adminUser._id,
    deletedAt: null,
  });

  // 2c. Admin sees both bookings in unpaid view
  const adminUnpaidRes = await request("/accounts/unpaid", {
    method: "GET",
    token: adminToken,
  });
  assert(adminUnpaidRes.status === 200, "Admin fetched unpaid accounts");
  assert(
    adminUnpaidRes.data.data.some((b) => b.id === accountsBooking.id) &&
      adminUnpaidRes.data.data.some((b) => b.id === otherBooking.id),
    "Admin sees all unpaid bookings across company desk"
  );

  // 2d. Restricted Accounts Agent strictly sees ONLY their assigned booking
  const agentUnpaidRes = await request("/accounts/unpaid", {
    method: "GET",
    token: accountsToken,
  });
  assert(agentUnpaidRes.status === 200, "Agent fetched unpaid accounts");
  assert(
    agentUnpaidRes.data.data.some((b) => b.id === accountsBooking.id),
    "Agent sees own assigned unpaid booking"
  );
  assert(
    !agentUnpaidRes.data.data.some((b) => b.id === otherBooking.id),
    "Agent is strictly blocked from seeing unassigned unpaid booking (visibility enforced)"
  );

  // 2e. Dedicated billing update endpoint (PUT /api/accounts/:bookingId/billing)
  // Agent tries to update billing on other's booking -> 403 Forbidden
  const agentTamperRes = await request(`/accounts/${otherBooking.id}/billing`, {
    method: "PUT",
    token: accountsToken,
    body: {
      billingStatus: "Paid",
    },
  });
  assert(agentTamperRes.status === 403, "Agent blocked from updating unassigned booking billing (got 403)");

  // Agent updates billing on own booking
  const updateBillingRes = await request(`/accounts/${accountsBooking.id}/billing`, {
    method: "PUT",
    token: accountsToken,
    body: {
      billingStatus: "Paid",
      billingNumber: "INV-9001-PAID",
      billingDate: "2026-09-15",
      billingRemark: "Full payment received via NEFT",
    },
  });
  assert(updateBillingRes.status === 200, "Updated billing fields with 200 OK");
  assert(updateBillingRes.data.billingStatus === "Paid", "billingStatus updated to 'Paid'");

  // Verify it moved from /unpaid to /paid
  const unpaidAfterRes = await request("/accounts/unpaid", { token: adminToken });
  assert(
    !unpaidAfterRes.data.data.some((b) => b.id === accountsBooking.id),
    "Booking no longer appears in unpaid accounts view"
  );

  const paidAfterRes = await request("/accounts/paid", { token: adminToken });
  assert(
    paidAfterRes.data.data.some((b) => b.id === accountsBooking.id),
    "Booking now appears in paid accounts view"
  );

  // Clean up test bookings
  await Booking.deleteMany({ _id: { $in: [accountsBooking._id, otherBooking._id] } });

  // ─── MODULE 3: Visa / Customer Documents ───────────────────────────────
  console.log("\n[Module 3] Testing Customer Document Management & Filesystem Storage...");

  // 3a. Permission gate on POST /api/customers
  const unauthCustRes = await request("/customers", {
    method: "POST",
    token: rahulToken,
    body: { name: "Unauthorized Customer", phone: "9999900000" },
  });
  assert(unauthCustRes.status === 403, "POST /api/customers requires customer.add (got 403)");

  // 3b. Create Customer with multipart file uploads (using FormData)
  const testPhone = "9876543210";
  const priorCusts = await Customer.find({ phone: testPhone });
  for (const c of priorCusts) {
    await Document.deleteMany({ customerId: c._id });
    await Customer.findByIdAndDelete(c._id);
  }
  const formData = new FormData();
  formData.append("name", "Ananya Singhania");
  formData.append("phone", testPhone);
  formData.append("city", "Bangalore");
  formData.append("documentType", "Passport");
  formData.append("reference", "Corporate Visa Request");
  formData.append("remarks", "Schengen 2-year business visa");

  // Create mock PDF and PNG files using Blob
  const pdfBlob = new Blob(["%PDF-1.4 Mock PDF Content For Test"], { type: "application/pdf" });
  formData.append("files", pdfBlob, "passport-scan.pdf");

  const pngBlob = new Blob(["\x89PNG\r\n\x1a\n Mock PNG Image Content"], { type: "image/png" });
  formData.append("files", pngBlob, "id-proof.png");

  const createCustomerRes = await request("/customers", {
    method: "POST",
    token: nehaToken,
    body: formData,
  });

  assert(createCustomerRes.status === 201, "Created customer with 201 Created");
  const createdCustomer = createCustomerRes.data;
  assert(createdCustomer.name === "Ananya Singhania", "Customer name verified");
  assert(createdCustomer.documents.length === 2, `Customer has 2 attached documents (got ${createdCustomer.documents.length})`);

  const doc1 = createdCustomer.documents[0];
  const doc2 = createdCustomer.documents[1];

  // Verify files physically exist on disk in uploads/customers/{phone}/
  const dbDoc1 = await Document.findById(doc1.id || doc1._id);
  assert(!!dbDoc1, "Document record 1 found in database");
  assert(fs.existsSync(dbDoc1.diskPath), `Physical file 1 exists on disk at: ${dbDoc1.diskPath}`);
  assert(dbDoc1.diskPath.includes(testPhone), "File path is scoped inside customer's phone directory");

  // 3c. List Customers (GET /api/customers)
  const listCustRes = await request(`/customers?q=${testPhone}`, {
    method: "GET",
    token: nehaToken,
  });
  assert(listCustRes.status === 200, "Listed customers with 200 OK");
  assert(
    listCustRes.data.data.some((c) => c.id === createdCustomer.id),
    "Created customer found in list"
  );

  // 3d. Detail View (GET /api/customers/:id)
  const detailCustRes = await request(`/customers/${createdCustomer.id}`, {
    method: "GET",
    token: nehaToken,
  });
  assert(detailCustRes.status === 200, "Fetched customer detail (200 OK)");
  assert(detailCustRes.data.documents.length === 2, "Detail includes 2 active documents");

  // 3e. Additive Document Upload (PUT /api/customers/:id)
  // Upload a 3rd document — must ADD to existing files, not replace!
  const updateFormData = new FormData();
  updateFormData.append("city", "Bengaluru");
  const extraBlob = new Blob(["%PDF-1.4 Extra Financial Document"], { type: "application/pdf" });
  updateFormData.append("files", extraBlob, "bank-statement.pdf");

  const updateCustRes = await request(`/customers/${createdCustomer.id}`, {
    method: "PUT",
    token: nehaToken,
    body: updateFormData,
  });
  assert(updateCustRes.status === 200, "Updated customer with 200 OK");
  assert(updateCustRes.data.city === "Bengaluru", "Customer city updated");
  assert(
    updateCustRes.data.documents.length === 3,
    `Documents appended additively: now 3 total documents (got ${updateCustRes.data.documents.length})`
  );

  // Find the newly added 3rd document
  const addedDoc = updateCustRes.data.documents.find((d) => d.fileName === "bank-statement.pdf");
  assert(!!addedDoc, "New document 'bank-statement.pdf' exists in customer documents");

  // 3f. Single Document Direct Delete (DELETE /api/customers/documents/:documentId)
  // Per original spec: this is a direct permanent delete of single document + physical file unlinking
  const dbDocToDelete = await Document.findById(addedDoc.id || addedDoc._id);
  const diskPathToDelete = dbDocToDelete.diskPath;
  assert(fs.existsSync(diskPathToDelete), "File exists on disk prior to single-document delete");

  const deleteSingleDocRes = await request(`/customers/documents/${addedDoc.id || addedDoc._id}`, {
    method: "DELETE",
    token: nehaToken,
  });
  assert(deleteSingleDocRes.status === 200, "Single document deleted with 200 OK");

  const checkDocInDb = await Document.findById(addedDoc.id || addedDoc._id);
  assert(checkDocInDb === null, "Single document record immediately removed from MongoDB");
  assert(!fs.existsSync(diskPathToDelete), "Physical file unlinked from disk immediately");

  // 3g. Cascading Soft-Delete (DELETE /api/customers/:id)
  const softDelCustRes = await request(`/customers/${createdCustomer.id}`, {
    method: "DELETE",
    token: nehaToken,
  });
  assert(softDelCustRes.status === 200, "Customer soft-deleted with 200 OK");

  // Assert customer is marked deletedAt
  const dbCustAfterSoftDel = await Customer.findById(createdCustomer.id);
  assert(dbCustAfterSoftDel.deletedAt !== null, "Customer marked with deletedAt timestamp");

  // Assert all remaining associated documents are cascade-marked deletedAt
  const remainingDocs = await Document.find({ customerId: createdCustomer.id });
  assert(
    remainingDocs.every((d) => d.deletedAt !== null),
    "All customer's documents cascade-marked with deletedAt timestamp"
  );

  // 3h. Customer Dedicated Recycle Bin (GET /api/customers/recycle-bin)
  const custBinRes = await request("/customers/recycle-bin", {
    method: "GET",
    token: nehaToken,
  });
  assert(custBinRes.status === 200, "Fetched customer recycle bin with 200 OK");
  assert(
    custBinRes.data.data.some((c) => c.id === createdCustomer.id),
    "Customer found in dedicated customer recycle bin"
  );

  // 3i. Cascading Restore (POST /api/customers/:id/restore)
  const restoreCustRes = await request(`/customers/${createdCustomer.id}/restore`, {
    method: "POST",
    token: nehaToken,
  });
  assert(restoreCustRes.status === 200, "Customer restored with 200 OK");

  const dbCustRestored = await Customer.findById(createdCustomer.id);
  assert(dbCustRestored.deletedAt === null, "Customer deletedAt restored to null");

  const docsRestored = await Document.find({ customerId: createdCustomer.id });
  assert(
    docsRestored.every((d) => d.deletedAt === null),
    "All customer documents cascade-restored with deletedAt = null"
  );

  // 3j. Force Delete Customer with Physical File Removal (DELETE /api/customers/:id/force)
  // Soft-delete again first
  await request(`/customers/${createdCustomer.id}`, { method: "DELETE", token: nehaToken });

  // Get physical paths of all customer files before force delete
  const docsBeforeForce = await Document.find({ customerId: createdCustomer.id });
  const physicalPaths = docsBeforeForce.map((d) => d.diskPath);
  assert(physicalPaths.length >= 2, "Customer has at least 2 files before force delete");
  physicalPaths.forEach((p) => {
    assert(fs.existsSync(p), `File exists on disk before force delete: ${p}`);
  });

  const forceDelCustRes = await request(`/customers/${createdCustomer.id}/force`, {
    method: "DELETE",
    token: nehaToken,
  });
  assert(forceDelCustRes.status === 200, "Force deleted customer with 200 OK");

  // Assert customer and document records are purged from MongoDB
  const dbCustPurged = await Customer.findById(createdCustomer.id);
  assert(dbCustPurged === null, "Customer record completely removed from MongoDB");

  const dbDocsPurged = await Document.find({ customerId: createdCustomer.id });
  assert(dbDocsPurged.length === 0, "All associated Document records purged from MongoDB");

  // Assert physical files are unlinked from disk
  physicalPaths.forEach((p) => {
    assert(!fs.existsSync(p), `Physical file unlinked from disk after force delete: ${p}`);
  });

  // ─── MODULE 4: Three Independent Recycle Bins Verification ─────────────
  console.log("\n[Module 4] Testing Independence of the Three Recycle Bins...");

  // Create and soft-delete one of each: Booking, Hotel, Customer
  const testBooking = await Booking.create({
    bookingId: "HHL-BIN-TEST",
    name: "Bin Test Booking",
    product: "hotel",
    status: "New Query",
    createdBy: adminUser._id,
    assignedAgent: adminUser._id,
    deletedAt: new Date(),
  });

  const testHotel = await Hotel.create({
    hotelName: "Bin Test Hotel",
    deletedAt: new Date(),
  });

  const testCustomer = await Customer.create({
    name: "Bin Test Customer",
    phone: "9111122222",
    deletedAt: new Date(),
  });

  const [bookingBin, hotelBin, customerBin] = await Promise.all([
    request("/bookings/recycle-bin", { token: adminToken }),
    request("/hotels/recycle-bin", { token: adminToken }),
    request("/customers/recycle-bin", { token: adminToken }),
  ]);

  // Bookings bin has only bookings
  assert(
    bookingBin.data.data.some((b) => b.id === testBooking.id),
    "Bookings bin contains deleted booking"
  );
  assert(
    !bookingBin.data.data.some((b) => b.hotelName === "Bin Test Hotel"),
    "Bookings bin does NOT contain deleted hotel"
  );
  assert(
    !bookingBin.data.data.some((b) => b.name === "Bin Test Customer"),
    "Bookings bin does NOT contain deleted customer"
  );

  // Hotels bin has only hotels
  assert(
    hotelBin.data.data.some((h) => h.id === testHotel.id),
    "Hotels bin contains deleted hotel"
  );
  assert(
    !hotelBin.data.data.some((h) => h.name === "Bin Test Booking"),
    "Hotels bin does NOT contain deleted booking"
  );
  assert(
    !hotelBin.data.data.some((h) => h.name === "Bin Test Customer"),
    "Hotels bin does NOT contain deleted customer"
  );

  // Customers bin has only customers
  assert(
    customerBin.data.data.some((c) => c.id === testCustomer.id),
    "Customers bin contains deleted customer"
  );
  assert(
    !customerBin.data.data.some((c) => c.name === "Bin Test Booking"),
    "Customers bin does NOT contain deleted booking"
  );
  assert(
    !customerBin.data.data.some((c) => c.hotelName === "Bin Test Hotel"),
    "Customers bin does NOT contain deleted hotel"
  );

  console.log("  ✓ Verified strict zero cross-contamination between all three recycle bins!");

  // Clean up test items
  await Promise.all([
    Booking.findByIdAndDelete(testBooking._id),
    Hotel.findByIdAndDelete(testHotel._id),
    Customer.findByIdAndDelete(testCustomer._id),
  ]);

  console.log("\n==================================================================");
  console.log("   🎉 ALL PHASE 3 BACKEND TESTS PASSED WITH 100% SUCCESS!        ");
  console.log("==================================================================");

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
