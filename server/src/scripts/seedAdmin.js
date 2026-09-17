/**
 * Seed admin & preset roles script — idempotent.
 *
 * Creates the bootstrap admin user from environment variables if one doesn't
 * already exist, and initializes the canonical preset roles.
 * Safe to run on every server start and as standalone: `npm run seed`.
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.js";
import Role from "../models/Role.js";
import config from "../config/index.js";
import { ALL_PERMISSIONS } from "../constants/permissions.js";

// When run standalone (npm run seed), load .env ourselves.
// When called from index.js, dotenv will already have been loaded.
dotenv.config();

/**
 * Creates default preset roles if not already present.
 */
export async function seedRoles() {
  const defaultRoles = [
    {
      name: "Administrator",
      description:
        "Full administrative access to all modules, system configurations, and activity logs.",
      permissions: ALL_PERMISSIONS,
      isSystem: true,
    },
    {
      name: "Travel Agent",
      description:
        "Standard agent role for managing queries, viewing bookings, calendar, and hotels.",
      permissions: [
        "queries.add",
        "queries.viewAll",
        "booking.viewAll",
        "calendar.menu",
        "hotel.add",
        "hotel.viewAll",
      ],
      isSystem: false,
    },
    {
      name: "Front Desk Officer",
      description:
        "Front desk staff role focused on querying status, monitoring bookings, and calendar view.",
      permissions: ["queries.viewAll", "booking.viewAll", "calendar.menu"],
      isSystem: false,
    },
    {
      name: "Visa Specialist",
      description:
        "Dedicated access to manage visa customer records, documentation, and client archives.",
      permissions: ["customer.add", "customer.view", "customer.recycleBin"],
      isSystem: false,
    },
    {
      name: "Accounts Manager",
      description:
        "Access to billing status, payment tracking, and financial account reconciliations.",
      permissions: ["accounts.menu", "booking.viewAll"],
      isSystem: false,
    },
  ];

  for (const r of defaultRoles) {
    const existing = await Role.findOne({ name: r.name });
    if (!existing) {
      await Role.create(r);
      console.log(`[seed] Created preset role: ${r.name}`);
    } else if (r.isSystem) {
      // Keep system Administrator role updated with all canonical permissions
      existing.permissions = ALL_PERMISSIONS;
      existing.isSystem = true;
      await existing.save();
    }
  }
}

/**
 * Creates the seed admin if not already present, ensuring full canonical permissions.
 * Returns the admin document.
 */
export async function seedAdmin() {
  const { name, email, phone, password } = config.seed;

  // Check by email OR phone — either match means the admin exists.
  let admin = await User.findOne({
    $or: [{ email }, { phone }],
    role: "admin",
  });

  if (admin) {
    // Ensure existing admin possesses all canonical permissions
    admin.permissions = ALL_PERMISSIONS;
    await admin.save();
    console.log(
      `[seed] Admin already exists (${admin.email || admin.phone}) — synchronized permissions.`
    );
  } else {
    const passwordHash = await User.hashPassword(password);

    admin = await User.create({
      name,
      email,
      phone,
      passwordHash,
      role: "admin",
      permissions: ALL_PERMISSIONS,
      status: "active",
      createdBy: null, // bootstrap — no creator
    });

    console.log(
      `[seed] Admin created: ${admin.email} / ${admin.phone}. ` +
        `Change this password immediately after first login.`
    );
  }

  // Seed preset roles
  await seedRoles();

  return admin;
}

import { fileURLToPath } from "url";
import path from "path";

// ─── Standalone execution ────────────────────────────────────────────────
const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  try {
    await mongoose.connect(config.mongoUri);
    console.log("[seed] Connected to MongoDB");
    await seedAdmin();
  } catch (err) {
    console.error("[seed] Fatal:", err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
