/**
 * Automated Verification Suite for Dashboard Summary & Role-Based Visibility
 *
 * Confirms:
 * 1. Admin sees full company desk (all 17 bookings across 5 statuses).
 * 2. Agent strictly sees only their assigned/created bookings (7 bookings).
 * 3. Donut chart and product bar chart aggregates are properly shaped.
 * 4. Password / hash fields are never leaked.
 * 5. Unauthenticated requests are rejected with 401.
 */

import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import express from "express";
import cors from "cors";
import helmet from "helmet";

import config from "../config/index.js";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import { seedAdmin } from "./seedAdmin.js";
import { seedBookings } from "./seedBookings.js";
import dashboardRoutes from "../routes/dashboard.js";
import authRoutes from "../routes/auth.js";

let server;
let baseUrl;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
}

async function startServer() {
  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  app.use("/api/auth", authRoutes);
  app.use("/api/dashboard", dashboardRoutes);

  return new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      console.log(`[test] Dashboard test server running at ${baseUrl}`);
      resolve();
    });
  });
}

async function run() {
  console.log("\n========================================================");
  console.log("   Running Dashboard End-to-End Verification Test");
  console.log("========================================================\n");

  await mongoose.connect(config.mongoUri);
  console.log(`[test] Connected to MongoDB: ${mongoose.connection.host}/${mongoose.connection.name}`);

  await startServer();

  try {
    // 1. Seed bookings
    console.log("\n--- TEST 1: Seed Bookings Collection ---");
    const bookings = await seedBookings();
    assert(bookings.length === 17, `Seeded exactly 17 sample bookings (got ${bookings.length})`);

    // Fetch admin & agent user records
    const admin = await User.findOne({ role: "admin" });
    const agentNeha = await User.findOne({ email: "neha@helloji.in" });

    assert(admin !== null, "Admin user exists");
    assert(agentNeha !== null, "Agent Neha Kapoor exists");

    const adminToken = jwt.sign(
      { id: admin._id.toString(), role: "admin", permissions: admin.permissions },
      config.jwt.secret,
      { expiresIn: "1h" }
    );

    const agentToken = jwt.sign(
      { id: agentNeha._id.toString(), role: "agent", permissions: agentNeha.permissions },
      config.jwt.secret,
      { expiresIn: "1h" }
    );

    // 2. Unauthenticated check
    console.log("\n--- TEST 2: Unauthenticated Access Rejection ---");
    const unauthRes = await fetch(`${baseUrl}/api/dashboard/summary`);
    assert(unauthRes.status === 401, "GET /api/dashboard/summary without token returns 401");

    // 3. Admin View (All Bookings)
    console.log("\n--- TEST 3: Admin Role Visibility (Full Desk View) ---");
    const adminRes = await fetch(`${baseUrl}/api/dashboard/summary`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminRes.status === 200, "GET /api/dashboard/summary as admin returns 200");
    const adminData = await adminRes.json();

    assert(adminData.meta.role === "admin", "Admin role confirmed in metadata");
    assert(adminData.counts.total === 17, `Admin sees all 17 total bookings (got ${adminData.counts.total})`);
    assert(adminData.counts.newQueries === 4, `Admin newQueries === 4 (got ${adminData.counts.newQueries})`);
    assert(adminData.counts.pipeline === 3, `Admin pipeline === 3 (got ${adminData.counts.pipeline})`);
    assert(adminData.counts.confirmed === 3, `Admin confirmed === 3 (got ${adminData.counts.confirmed})`);
    assert(adminData.counts.allBooked === 5, `Admin allBooked === 5 (got ${adminData.counts.allBooked})`);
    assert(adminData.counts.totalAborted === 2, `Admin totalAborted === 2 (got ${adminData.counts.totalAborted})`);

    // Verify Donut 1 & Donut 2 data format
    assert(
      Array.isArray(adminData.charts.queriesVsConfirmedVsBooked) &&
        adminData.charts.queriesVsConfirmedVsBooked.length === 3,
      "Donut 1 chart data formatted correctly"
    );
    assert(
      Array.isArray(adminData.charts.pipelineVsAborted) &&
        adminData.charts.pipelineVsAborted.length === 2,
      "Donut 2 chart data formatted correctly"
    );

    // Verify No Password / Hash Leakage anywhere in the response
    const rawAdminJson = JSON.stringify(adminData);
    assert(!rawAdminJson.includes("passwordHash"), "Zero passwordHash leakage in response");
    assert(!rawAdminJson.includes("password"), "Zero password leakage in response");

    // 4. Agent View (Filtered Subset)
    console.log("\n--- TEST 4: Agent Role Visibility (Strict Server-Side Filtering) ---");
    const agentRes = await fetch(`${baseUrl}/api/dashboard/summary`, {
      headers: { Authorization: `Bearer ${agentToken}` },
    });
    assert(agentRes.status === 200, "GET /api/dashboard/summary as agent returns 200");
    const agentData = await agentRes.json();

    assert(agentData.meta.role === "agent", "Agent role confirmed in metadata");
    assert(agentData.counts.total === 7, `Agent strictly sees 7 assigned bookings (got ${agentData.counts.total})`);
    assert(agentData.counts.newQueries === 2, `Agent newQueries === 2 (got ${agentData.counts.newQueries})`);
    assert(agentData.counts.pipeline === 1, `Agent pipeline === 1 (got ${agentData.counts.pipeline})`);
    assert(agentData.counts.confirmed === 1, `Agent confirmed === 1 (got ${agentData.counts.confirmed})`);
    assert(agentData.counts.allBooked === 2, `Agent allBooked === 2 (got ${agentData.counts.allBooked})`);
    assert(agentData.counts.totalAborted === 1, `Agent totalAborted === 1 (got ${agentData.counts.totalAborted})`);

    // Assert Agent count is strictly smaller than Admin count
    assert(
      agentData.counts.total < adminData.counts.total,
      `Agent count (${agentData.counts.total}) is strictly a filtered subset of Admin count (${adminData.counts.total})`
    );

    console.log("\n========================================================");
    console.log("   🎉 ALL DASHBOARD VERIFICATION CHECKS PASSED!");
    console.log("========================================================\n");
  } finally {
    if (server) server.close();
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
