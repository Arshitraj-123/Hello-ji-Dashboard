/**
 * Comprehensive Integration Verification Suite for Backend Phase 1b
 *
 * Tests:
 * 1. Canonical permission key registry & rejection of unknown keys
 * 2. Profile self-service (GET /api/profile, PUT /api/profile with allowlist & photo upload)
 * 3. Prevention of privilege escalation on PUT /api/profile
 * 4. Roles CRUD (GET, POST, PUT, DELETE with system role protection)
 * 5. One-time copy in POST /api/admin/users/:id/apply-role/:roleId without touching user.role
 * 6. Deletion of role does not alter user permissions (decoupled architecture)
 */

import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import express from "express";
import cors from "cors";
import helmet from "helmet";

import config from "../config/index.js";
import User from "../models/User.js";
import Role from "../models/Role.js";
import { ALL_PERMISSIONS, PERMISSION_GROUPS } from "../constants/permissions.js";
import { seedAdmin, seedRoles } from "./seedAdmin.js";

import authRoutes from "../routes/auth.js";
import profileRoutes from "../routes/profile.js";
import permissionsRoutes from "../routes/permissions.js";
import roleRoutes from "../routes/roles.js";
import adminUserRoutes from "../routes/adminUsers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let server;
let baseUrl;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
}

async function startTestServer() {
  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.use(
    "/uploads",
    express.static(path.resolve(__dirname, "../../uploads"), {
      maxAge: "1d",
    })
  );

  app.use("/api/auth", authRoutes);
  app.use("/api/profile", profileRoutes);
  app.use("/api/permissions", permissionsRoutes);
  app.use("/api/roles", roleRoutes);
  app.use("/api/admin/users", adminUserRoutes);

  return new Promise((resolve) => {
    // Listen on random available port
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      console.log(`[test] Test server running at ${baseUrl}`);
      resolve();
    });
  });
}

async function makeRequest(endpoint, options = {}) {
  const url = `${baseUrl}${endpoint}`;
  const headers = options.headers || {};
  let body = options.body;

  if (body && typeof body === "object" && !(body instanceof Buffer) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(body);
  }

  const res = await fetch(url, {
    method: options.method || "GET",
    headers,
    body,
  });

  let data = null;
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  return { status: res.status, data, headers: res.headers };
}

async function runTests() {
  console.log("\n========================================================");
  console.log("   Running Backend Phase 1b Verification Suite");
  console.log("========================================================\n");

  await mongoose.connect(config.mongoUri);
  console.log("[test] Connected to MongoDB");

  await startTestServer();

  try {
    // Step 0: Run seed script
    console.log("\n--- TEST 0: Seed Admin & Preset Roles ---");
    const adminUser = await seedAdmin();
    assert(adminUser !== null, "Admin seeded successfully");
    assert(
      adminUser.permissions.length === ALL_PERMISSIONS.length,
      `Admin has all ${ALL_PERMISSIONS.length} canonical permissions`
    );

    // Generate tokens for admin and an agent
    const adminToken = jwt.sign(
      { id: adminUser._id.toString(), role: "admin", permissions: adminUser.permissions },
      config.jwt.secret,
      { expiresIn: "1h" }
    );

    // Create a test agent user
    await User.deleteOne({ email: "testagent@helloji.in" });
    const passwordHash = await User.hashPassword("AgentPass123!");
    const agentUser = await User.create({
      name: "Test Agent",
      email: "testagent@helloji.in",
      phone: "+919876549999",
      passwordHash,
      role: "agent",
      permissions: ["queries.add", "queries.viewAll"],
      status: "active",
      createdBy: adminUser._id,
    });

    const agentToken = jwt.sign(
      { id: agentUser._id.toString(), role: "agent", permissions: agentUser.permissions },
      config.jwt.secret,
      { expiresIn: "1h" }
    );

    // --- TEST 1: Canonical Permissions Registry ---
    console.log("\n--- TEST 1: Canonical Permissions Registry ---");
    const permRes = await makeRequest("/api/permissions", {
      headers: { Authorization: `Bearer ${agentToken}` },
    });
    assert(permRes.status === 200, "GET /api/permissions returned 200");
    assert(
      permRes.data.permissions.length === 18,
      `Registry exposes 18 canonical keys (got ${permRes.data.permissions.length})`
    );
    assert(
      permRes.data.groups.length === 8,
      `Registry contains 8 canonical groups (got ${permRes.data.groups.length})`
    );

    // --- TEST 2: Reject Unknown Permission Keys in Admin User Create ---
    console.log("\n--- TEST 2: Permission Validation ---");
    const badPermUser = await makeRequest("/api/admin/users", {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        name: "Bad Perm User",
        email: "badperm@helloji.in",
        password: "ValidPass123!",
        permissions: ["queries.add", "Add Hotel"], // "Add Hotel" is old invalid casing
      },
    });
    assert(
      [400, 422].includes(badPermUser.status),
      `POST /api/admin/users rejected unknown permission key 'Add Hotel' with status ${badPermUser.status}`
    );

    const goodPermUser = await makeRequest("/api/admin/users", {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        name: "Good Perm User",
        email: "goodperm@helloji.in",
        phone: "+919876541111",
        password: "ValidPass123!",
        permissions: ["queries.add", "hotel.add", "hotel.viewAll"],
      },
    });
    assert(
      goodPermUser.status === 201,
      "POST /api/admin/users accepted canonical permission keys with 201"
    );
    const createdUserId = goodPermUser.data.user.id;

    // --- TEST 3: Profile Self-Service (GET /api/profile) ---
    console.log("\n--- TEST 3: Profile Self-Service (GET) ---");
    const profileGet = await makeRequest("/api/profile", {
      headers: { Authorization: `Bearer ${agentToken}` },
    });
    assert(profileGet.status === 200, "GET /api/profile returned 200");
    assert(profileGet.data.user.email === "testagent@helloji.in", "Returned caller's profile");
    assert(!profileGet.data.user.passwordHash, "passwordHash is omitted from output");

    // --- TEST 4: Profile Self-Service Update (PUT /api/profile) ---
    console.log("\n--- TEST 4: Profile Self-Service Update (PUT) ---");
    const profileUpdate = await makeRequest("/api/profile", {
      method: "PUT",
      headers: { Authorization: `Bearer ${agentToken}` },
      body: {
        name: "Test Agent Updated",
        address: "Sector 22, Chandigarh",
        phone: "+919876548888",
      },
    });
    assert(profileUpdate.status === 200, "PUT /api/profile updated allowed fields with 200");
    assert(profileUpdate.data.user.name === "Test Agent Updated", "Name was updated");
    assert(profileUpdate.data.user.address === "Sector 22, Chandigarh", "Address was updated");

    // --- TEST 5: Privilege Escalation Prevention ---
    console.log("\n--- TEST 5: Privilege Escalation Defense ---");
    const escalateRole = await makeRequest("/api/profile", {
      method: "PUT",
      headers: { Authorization: `Bearer ${agentToken}` },
      body: { role: "admin" },
    });
    assert(
      [400, 422].includes(escalateRole.status),
      `PUT /api/profile rejected 'role' field with status ${escalateRole.status}`
    );

    const escalatePerms = await makeRequest("/api/profile", {
      method: "PUT",
      headers: { Authorization: `Bearer ${agentToken}` },
      body: { permissions: ALL_PERMISSIONS },
    });
    assert(
      [400, 422].includes(escalatePerms.status),
      `PUT /api/profile rejected 'permissions' field with status ${escalatePerms.status}`
    );

    const escalatePassword = await makeRequest("/api/profile", {
      method: "PUT",
      headers: { Authorization: `Bearer ${agentToken}` },
      body: { password: "HackedPassword123" },
    });
    assert(
      [400, 422].includes(escalatePassword.status),
      `PUT /api/profile rejected 'password' field with status ${escalatePassword.status}`
    );

    // Verify agent still has role 'agent'
    const checkAgent = await User.findById(agentUser._id);
    assert(checkAgent.role === "agent", "Agent role remains unchanged after attack attempts");

    // --- TEST 6: Profile Photo Upload ---
    console.log("\n--- TEST 6: Profile Photo Upload (Multipart) ---");
    // Create a 1x1 PNG dummy buffer
    const dummyPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );

    const boundary = "----WebKitFormBoundary" + Math.random().toString(36).substring(2);
    const multipartBody = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="name"\r\n\r\n` +
          `Test Agent Photo\r\n` +
          `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="photo"; filename="avatar.png"\r\n` +
          `Content-Type: image/png\r\n\r\n`
      ),
      dummyPng,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const photoRes = await makeRequest("/api/profile", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${agentToken}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body: multipartBody,
    });

    assert(photoRes.status === 200, "PUT /api/profile accepted multipart photo upload with 200");
    assert(
      photoRes.data.user.photo.startsWith("/uploads/profile-photos/"),
      `User photo path set to: ${photoRes.data.user.photo}`
    );

    // Verify uploaded photo is accessible via static server
    const staticPhotoRes = await makeRequest(photoRes.data.user.photo);
    assert(staticPhotoRes.status === 200, "Static /uploads serving returned photo successfully");

    // --- TEST 7: Roles CRUD Module ---
    console.log("\n--- TEST 7: Roles CRUD ---");
    const rolesList = await makeRequest("/api/roles", {
      headers: { Authorization: `Bearer ${agentToken}` },
    });
    assert(rolesList.status === 200, "GET /api/roles returned 200");
    assert(rolesList.data.roles.length >= 5, `Seeded preset roles found: ${rolesList.data.roles.length}`);

    // Create custom role (admin-only)
    const newRoleRes = await makeRequest("/api/roles", {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        name: "Custom Support Lead",
        description: "Handles customer inquiries and calendar",
        permissions: ["customer.view", "calendar.menu", "queries.viewAll"],
      },
    });
    assert(newRoleRes.status === 201, "POST /api/roles created role with 201");
    const customRole = newRoleRes.data.role;

    // Agent forbidden from creating role
    const agentRoleCreate = await makeRequest("/api/roles", {
      method: "POST",
      headers: { Authorization: `Bearer ${agentToken}` },
      body: { name: "Illegal Agent Role", permissions: [] },
    });
    assert(agentRoleCreate.status === 403, "Agent forbidden from POST /api/roles with 403");

    // Update role
    const roleUpdateRes = await makeRequest(`/api/roles/${customRole.id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        description: "Updated description",
        permissions: ["customer.view", "calendar.menu", "queries.viewAll", "trash.recycleBin"],
      },
    });
    assert(roleUpdateRes.status === 200, "PUT /api/roles/:id updated role with 200");

    // --- TEST 8: Apply Role Preset (POST /api/admin/users/:id/apply-role/:roleId) ---
    console.log("\n--- TEST 8: Apply Role Preset to User ---");
    const applyRoleRes = await makeRequest(
      `/api/admin/users/${agentUser._id}/apply-role/${customRole.id}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );
    assert(applyRoleRes.status === 200, "POST /apply-role returned 200");
    assert(
      applyRoleRes.data.user.permissions.includes("trash.recycleBin"),
      "User received role's permissions"
    );
    // CRITICAL USER FEEDBACK CHECK: user.role must still be 'agent', NOT modified to role name!
    assert(
      applyRoleRes.data.user.role === "agent",
      `CRITICAL: User.role is strictly preserved as '${applyRoleRes.data.user.role}' and NOT modified to role name`
    );

    // --- TEST 9: Delete Role & Decoupled Architecture Guarantee ---
    console.log("\n--- TEST 9: Role Deletion Decoupled Guarantee ---");
    const deleteRoleRes = await makeRequest(`/api/roles/${customRole.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(deleteRoleRes.status === 200, "DELETE /api/roles/:id succeeded with 200");

    // Verify user still retains their copied permissions
    const userAfterRoleDelete = await User.findById(agentUser._id);
    assert(
      userAfterRoleDelete.permissions.includes("trash.recycleBin"),
      "User permissions remain intact after role preset is deleted"
    );

    // Protect system role from deletion
    const adminPresetRole = await Role.findOne({ name: "Administrator" });
    const deleteSystemRoleRes = await makeRequest(`/api/roles/${adminPresetRole._id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(
      deleteSystemRoleRes.status === 400,
      "System Administrator role deletion was rejected with 400"
    );

    // Clean up created test users
    await User.deleteMany({ email: { $in: ["testagent@helloji.in", "goodperm@helloji.in"] } });

    console.log("\n========================================================");
    console.log("   🎉 ALL 9 TEST SUITES PASSED SUCCESSFULLY!");
    console.log("========================================================\n");
  } finally {
    if (server) server.close();
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error("\n❌ Test execution failed with error:", err);
  process.exit(1);
});
