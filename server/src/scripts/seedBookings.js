/**
 * Seed Bookings script — idempotent.
 *
 * Creates 17 realistic sample bookings across all 5 canonical statuses:
 *   - 4x New Query
 *   - 3x Pipeline
 *   - 3x Confirmed
 *   - 5x booked
 *   - 2x Abort
 *
 * Deliberately partitions assignments:
 *   - 7 bookings assigned to test agent (Neha Kapoor)
 *   - 10 bookings assigned to Admin / other agents
 *
 * This guarantees the server-side role-based visibility filter is directly
 * verifiable: Admin sees 17 total, Agent sees 7.
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import config from "../config/index.js";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import { seedAdmin } from "./seedAdmin.js";

dotenv.config();

export async function seedBookings() {
  console.log("[seed:bookings] Initializing booking seed data...");

  // 1. Ensure admin exists
  const admin = await seedAdmin();

  // 2. Ensure test agent Neha Kapoor exists with known test password and canonical permissions
  let agentNeha = await User.findOne({ email: "neha@helloji.in" });
  const agentPasswordHash = await User.hashPassword("AgentPass123!");
  const nehaCanonicalPerms = [
    "queries.add",
    "queries.viewAll",
    "booking.viewAll",
    "calendar.menu",
    "hotel.add",
    "hotel.viewAll",
  ];

  if (!agentNeha) {
    agentNeha = await User.create({
      name: "Neha Kapoor",
      email: "neha@helloji.in",
      phone: "+919820011223",
      passwordHash: agentPasswordHash,
      role: "agent",
      permissions: nehaCanonicalPerms,
      status: "active",
      createdBy: admin._id,
    });
    console.log(`[seed:bookings] Created test agent: ${agentNeha.email}`);
  } else {
    agentNeha.passwordHash = agentPasswordHash;
    agentNeha.permissions = nehaCanonicalPerms;
    agentNeha.status = "active";
    await agentNeha.save();
    console.log(`[seed:bookings] Synchronized test agent: ${agentNeha.email}`);
  }

  // 3. Ensure second agent Rahul Verma exists with canonical permissions
  let agentRahul = await User.findOne({ email: "rahul@helloji.in" });
  const rahulCanonicalPerms = ["queries.add", "queries.viewAll", "calendar.menu"];

  if (!agentRahul) {
    agentRahul = await User.create({
      name: "Rahul Verma",
      email: "rahul@helloji.in",
      phone: "+919910022331",
      passwordHash: agentPasswordHash,
      role: "agent",
      permissions: rahulCanonicalPerms,
      status: "active",
      createdBy: admin._id,
    });
    console.log(`[seed:bookings] Created second agent: ${agentRahul.email}`);
  } else {
    agentRahul.passwordHash = agentPasswordHash;
    agentRahul.permissions = rahulCanonicalPerms;
    agentRahul.status = "active";
    await agentRahul.save();
    console.log(`[seed:bookings] Synchronized second agent: ${agentRahul.email}`);
  }

  // 4. Clear existing bookings collection to ensure idempotency
  const deleteResult = await Booking.deleteMany({});
  console.log(`[seed:bookings] Cleared ${deleteResult.deletedCount} existing bookings.`);

  // 5. Sample dataset definitions (17 items)
  const sampleBookings = [
    // ─── 4x "New Query" ───
    {
      name: "Ankit Malhotra",
      email: "ankit.m@gmail.com",
      phone: "+91 99100 22331",
      city: "Delhi",
      product: "hotel",
      status: "New Query",
      createdBy: agentNeha._id,
      assignedAgent: agentNeha._id,
    },
    {
      name: "Sunita Rao",
      email: "sunita.r@tcs.com",
      phone: "+91 98220 55443",
      city: "Pune",
      product: "ticket",
      status: "New Query",
      createdBy: agentNeha._id,
      assignedAgent: agentNeha._id,
    },
    {
      name: "Rohan Singhal",
      email: "rohan@innovate.co",
      phone: "+91 98111 88990",
      city: "Bangalore",
      product: "package",
      status: "New Query",
      createdBy: admin._id,
      assignedAgent: admin._id,
    },
    {
      name: "Meera Krishnan",
      email: "meera.k@gmail.com",
      phone: "+91 94440 12345",
      city: "Chennai",
      product: "visa",
      status: "New Query",
      createdBy: admin._id,
      assignedAgent: agentRahul._id,
    },

    // ─── 3x "Pipeline" ───
    {
      name: "Vikram Mehta",
      email: "v.mehta@yahoo.com",
      phone: "+91 98200 44556",
      city: "Mumbai",
      product: "package",
      status: "Pipeline",
      createdBy: agentNeha._id,
      assignedAgent: agentNeha._id,
    },
    {
      name: "Pooja Hegde",
      email: "pooja.h@outlook.com",
      phone: "+91 97654 32109",
      city: "Hyderabad",
      product: "hotel",
      status: "Pipeline",
      createdBy: admin._id,
      assignedAgent: admin._id,
    },
    {
      name: "Arun Nair",
      email: "arun.nair@wipro.com",
      phone: "+91 98470 66778",
      city: "Kochi",
      product: "ticket",
      status: "Pipeline",
      createdBy: admin._id,
      assignedAgent: agentRahul._id,
    },

    // ─── 3x "Confirmed" ───
    {
      name: "Divya Sharma",
      email: "divya.s@gmail.com",
      phone: "+91 98100 11223",
      city: "Chandigarh",
      product: "hotel",
      status: "Confirmed",
      createdBy: agentNeha._id,
      assignedAgent: agentNeha._id,
    },
    {
      name: "Harish Patel",
      email: "harish@pateltraders.in",
      phone: "+91 98250 99887",
      city: "Ahmedabad",
      product: "ticket",
      status: "Confirmed",
      createdBy: admin._id,
      assignedAgent: admin._id,
    },
    {
      name: "Kavita Sen",
      email: "kavita.sen@rediffmail.com",
      phone: "+91 98300 77665",
      city: "Kolkata",
      product: "visa",
      status: "Confirmed",
      createdBy: admin._id,
      assignedAgent: agentRahul._id,
    },

    // ─── 5x "booked" ───
    {
      name: "Suresh Raina",
      email: "suresh.r@gmail.com",
      phone: "+91 98110 33445",
      city: "Lucknow",
      product: "hotel",
      status: "booked",
      createdBy: agentNeha._id,
      assignedAgent: agentNeha._id,
    },
    {
      name: "Deepak Chopra",
      email: "deepak.c@apex.in",
      phone: "+91 98201 22334",
      city: "Mumbai",
      product: "package",
      status: "booked",
      createdBy: agentNeha._id,
      assignedAgent: agentNeha._id,
    },
    {
      name: "Shreya Ghoshal",
      email: "shreya.g@music.com",
      phone: "+91 98200 88776",
      city: "Mumbai",
      product: "ticket",
      status: "booked",
      createdBy: admin._id,
      assignedAgent: admin._id,
    },
    {
      name: "Amitabh Roy",
      email: "amitabh@roycorp.com",
      phone: "+91 98310 44556",
      city: "Kolkata",
      product: "insurance",
      status: "booked",
      createdBy: admin._id,
      assignedAgent: admin._id,
    },
    {
      name: "Praveen Kumar",
      email: "praveen.k@gmail.com",
      phone: "+91 98450 55667",
      city: "Bangalore",
      product: "other",
      status: "booked",
      createdBy: admin._id,
      assignedAgent: agentRahul._id,
    },

    // ─── 2x "Abort" ───
    {
      name: "Naveen Jindal",
      email: "naveen.j@gmail.com",
      phone: "+91 98111 22233",
      city: "Gurgaon",
      product: "hotel",
      status: "Abort",
      createdBy: agentNeha._id,
      assignedAgent: agentNeha._id,
    },
    {
      name: "Gaurav Agarwal",
      email: "gaurav@agarwal.in",
      phone: "+91 98290 11223",
      city: "Jaipur",
      product: "package",
      status: "Abort",
      createdBy: admin._id,
      assignedAgent: agentRahul._id,
    },
  ];

  // Insert sequential bookings one by one so the pre-validate hook assigns HHL0001, HHL0002...
  const inserted = [];
  for (const b of sampleBookings) {
    const doc = await Booking.create(b);
    inserted.push(doc);
  }

  console.log(`[seed:bookings] Successfully created ${inserted.length} bookings.`);
  console.log(
    `[seed:bookings] First: ${inserted[0].bookingId} (${inserted[0].name}) -> Last: ${
      inserted[inserted.length - 1].bookingId
    } (${inserted[inserted.length - 1].name})`
  );

  return inserted;
}

// ─── Standalone execution ────────────────────────────────────────────────
const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  try {
    await mongoose.connect(config.mongoUri);
    console.log("[seed:bookings] Connected to MongoDB");
    await seedBookings();
  } catch (err) {
    console.error("[seed:bookings] Fatal error:", err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
