/**
 * Admin user-management routes — CRUD for users (admin-only).
 *
 * POST   /api/admin/users      — create a new user
 * GET    /api/admin/users      — list all users
 * PUT    /api/admin/users/:id  — update user fields (no password!)
 * DELETE /api/admin/users/:id  — delete user (reassign bookings first)
 *
 * All routes require: authenticate + authorize('admin')
 */

import { Router } from "express";
import { param } from "express-validator";
import User from "../models/User.js";
import Role from "../models/Role.js";
import Booking from "../models/Booking.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { validate } from "../middleware/validate.js";
import {
  createUserRules,
  updateUserRules,
  deleteUserRules,
} from "../validators/auth.js";

const router = Router();

// All routes in this file require admin role
router.use(authenticate, authorize("admin"));

// ─── POST / — Create user ───────────────────────────────────────────────
router.post("/", createUserRules, validate, async (req, res, next) => {
  try {
    const { name, email, phone, password, role, permissions, status } =
      req.body;

    // Check for duplicate email or phone
    const conditions = [];
    if (email) conditions.push({ email: email.toLowerCase() });
    if (phone) conditions.push({ phone });

    if (conditions.length > 0) {
      const existing = await User.findOne({ $or: conditions });
      if (existing) {
        const field =
          existing.email === (email && email.toLowerCase()) ? "email" : "phone";
        return res.status(409).json({
          message: `A user with this ${field} already exists`,
          code: "DUPLICATE",
          field,
        });
      }
    }

    const passwordHash = await User.hashPassword(password);

    const user = await User.create({
      name,
      email: email || undefined, // don't store empty string; let sparse index work
      phone: phone || undefined,
      passwordHash,
      role: role || "agent",
      permissions: permissions || [],
      status: status || "active",
      createdBy: req.user.id,
    });

    return res.status(201).json({ user: user.toJSON() });
  } catch (err) {
    // Mongoose duplicate key error (race condition fallback)
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(409).json({
        message: `A user with this ${field} already exists`,
        code: "DUPLICATE",
        field,
      });
    }
    next(err);
  }
});

// ─── GET / — List all users ──────────────────────────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status && ["active", "inactive"].includes(req.query.status)) {
      filter.status = req.query.status;
    }

    const users = await User.find(filter)
      .sort({ createdAt: -1 })
      .populate("createdBy", "name email");

    return res.json({ users });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /:id — Update user ─────────────────────────────────────────────
router.put("/:id", updateUserRules, validate, async (req, res, next) => {
  try {
    // Build an update object from only the allowed fields
    const allowed = [
      "name",
      "email",
      "phone",
      "role",
      "permissions",
      "status",
      "photo",
      "address",
    ];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        update[key] = req.body[key];
      }
    }

    // Normalise email to lowercase if present
    if (update.email) {
      update.email = update.email.toLowerCase();
    }

    const user = await User.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
        code: "NOT_FOUND",
      });
    }

    return res.json({ user: user.toJSON() });
  } catch (err) {
    // Mongoose duplicate key error
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(409).json({
        message: `A user with this ${field} already exists`,
        code: "DUPLICATE",
        field,
      });
    }
    next(err);
  }
});

// ─── DELETE /:id — Delete user ───────────────────────────────────────────
router.delete("/:id", deleteUserRules, validate, async (req, res, next) => {
  try {
    // Prevent self-deletion
    if (req.user.id === req.params.id) {
      return res.status(400).json({
        message: "You cannot delete your own account",
        code: "SELF_DELETE",
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
        code: "NOT_FOUND",
      });
    }

    // Reassign all of the deleted user's bookings and queries to the requesting admin
    await Booking.updateMany(
      { assignedAgent: req.params.id },
      { $set: { assignedAgent: req.user.id } }
    );
    await Booking.updateMany(
      { createdBy: req.params.id },
      { $set: { createdBy: req.user.id } }
    );

    await User.findByIdAndDelete(req.params.id);

    return res.json({
      message: "User deleted",
      deletedUserId: req.params.id,
      reassignedTo: req.user.id,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /:id/apply-role/:roleId — Apply role permission preset to user ───
// IMPORTANT ARCHITECTURAL NOTE:
// A Role is a named, reusable permission preset (e.g. "Travel Agent", "Visa Specialist").
// This endpoint performs an explicit one-time COPY of role.permissions onto user.permissions.
// It strictly DOES NOT modify user.role (which is the distinct access-control enum ['admin', 'agent']
// that governs route-level authorization and record visibility).
// It also does NOT create a persistent foreign-key relation — users retain their independent
// permission set even if the role preset is later edited or removed.
router.post(
  "/:id/apply-role/:roleId",
  [
    param("id").isMongoId().withMessage("Invalid user ID"),
    param("roleId").isMongoId().withMessage("Invalid role ID"),
  ],
  validate,
  async (req, res, next) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({
          message: "User not found",
          code: "NOT_FOUND",
        });
      }

      const role = await Role.findById(req.params.roleId);
      if (!role) {
        return res.status(404).json({
          message: "Role not found",
          code: "NOT_FOUND",
        });
      }

      // One-time copy of role permissions onto user.permissions only.
      // user.role is intentionally NOT changed.
      user.permissions = [...role.permissions];
      await user.save();

      return res.json({
        message: `Applied permissions from role preset "${role.name}" to user`,
        user: user.toJSON(),
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
