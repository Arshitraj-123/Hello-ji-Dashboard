/**
 * HelloJi CRM — Express API entry point.
 *
 * Connects to MongoDB, seeds the bootstrap admin, and starts the HTTP server.
 */

import dotenv from "dotenv";
dotenv.config(); // load .env before anything reads process.env

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";

import path from "path";
import { fileURLToPath } from "url";

import config from "./config/index.js";
import { seedAdmin } from "./scripts/seedAdmin.js";
import authRoutes from "./routes/auth.js";
import profileRoutes from "./routes/profile.js";
import permissionsRoutes from "./routes/permissions.js";
import roleRoutes from "./routes/roles.js";
import adminUserRoutes from "./routes/adminUsers.js";
import dashboardRoutes from "./routes/dashboard.js";
import queriesRoutes from "./routes/queries.js";
import bookingsRoutes from "./routes/bookings.js";
import hotelsRoutes from "./routes/hotels.js";
import accountsRoutes from "./routes/accounts.js";
import customersRoutes from "./routes/customers.js";
import bookingTicketRoutes from "./routes/bookingTickets.js";
import activityLogsRoutes from "./routes/activityLogs.js";
import { checkSmtpHealth } from "./services/emailService.js";
import {
  checkWhatsAppHealth,
  ensureTempBrochuresDir,
} from "./services/whatsappService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ─── Security headers ───────────────────────────────────────────────────
app.use(helmet());

// ─── CORS — only allow the configured frontend origin(s) ────────────────
app.use(
  cors({
    origin: config.cors.origins,
    credentials: true,
  })
);

// ─── Parse JSON request bodies ──────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));

// ─── Static file serving (uploaded profile photos) ─────────────────────
app.use(
  "/uploads",
  express.static(path.resolve(__dirname, "../uploads"), {
    maxAge: "1d",
  })
);

// ─── Routes ─────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/permissions", permissionsRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/admin/users", adminUserRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/queries", queriesRoutes);
app.use("/api/bookings", bookingsRoutes);
app.use("/api/hotels", hotelsRoutes);
app.use("/api/accounts", accountsRoutes);
app.use("/api/customers", customersRoutes);
app.use("/api/booking-tickets", bookingTicketRoutes);
app.use("/api/activity-logs", activityLogsRoutes);

// ─── Root & Health check ────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    name: "HelloJi CRM API",
    message: "API server is running. Access the frontend dashboard to use the app.",
    health: "/api/health",
  });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── 404 catch-all ──────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ message: "Route not found", code: "NOT_FOUND" });
});

// ─── Global error handler ───────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error("[error]", err);

  // Never leak stack traces in production
  const message =
    process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message || "Internal server error";

  res.status(err.status || 500).json({
    message,
    code: "SERVER_ERROR",
  });
});

// ─── Start ──────────────────────────────────────────────────────────────
async function start() {
  try {
    await mongoose.connect(config.mongoUri);
    const host = mongoose.connection.host || "MongoDB";
    const dbName = mongoose.connection.name || "";
    console.log(`[db] Connected to MongoDB: ${host}/${dbName}`);

    // Seed the bootstrap admin on every start (idempotent)
    await seedAdmin();

    // Ensure temporary brochure uploads directory exists
    await ensureTempBrochuresDir();

    // Check health of external delivery channels and log prominent warnings if unconfigured
    checkSmtpHealth();
    checkWhatsAppHealth();

    app.listen(config.port, () => {
      console.log(`[server] HelloJi API listening on http://localhost:${config.port}`);
    });
  } catch (err) {
    console.error("[startup] Fatal:", err);
    process.exit(1);
  }
}

start();
