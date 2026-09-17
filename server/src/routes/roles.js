/**
 * Roles routes — CRUD for reusable permission preset roles.
 *
 * GET    /api/roles     — list all roles (authenticated)
 * POST   /api/roles     — create role (admin-only)
 * PUT    /api/roles/:id — update role (admin-only)
 * DELETE /api/roles/:id — delete role (admin-only)
 *
 * DESIGN GUARANTEE:
 * Permissions live directly on User documents (`user.permissions`).
 * A Role document is only a convenient named preset. Deleting or editing
 * a role NEVER mutates or cascades to users who were previously assigned it.
 */

import { Router } from "express";
import Role from "../models/Role.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { validate } from "../middleware/validate.js";
import {
  createRoleRules,
  updateRoleRules,
  deleteRoleRules,
} from "../validators/roles.js";

const router = Router();

// All routes require authentication
router.use(authenticate);

// ─── GET / — List all roles ──────────────────────────────────────────────
router.get("/", async (_req, res, next) => {
  try {
    const roles = await Role.find().sort({ isSystem: -1, name: 1 });
    return res.json({ roles });
  } catch (err) {
    next(err);
  }
});

// ─── POST / — Create role (admin-only) ───────────────────────────────────
router.post(
  "/",
  authorize("admin"),
  createRoleRules,
  validate,
  async (req, res, next) => {
    try {
      const { name, description, permissions } = req.body;

      const existing = await Role.findOne({
        name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
      });
      if (existing) {
        return res.status(409).json({
          message: `Role "${name}" already exists`,
          code: "DUPLICATE",
          field: "name",
        });
      }

      const role = await Role.create({
        name: name.trim(),
        description: description || "",
        permissions: permissions || [],
        isSystem: false,
      });

      return res.status(201).json({ role: role.toJSON() });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({
          message: "A role with this name already exists",
          code: "DUPLICATE",
          field: "name",
        });
      }
      next(err);
    }
  }
);

// ─── PUT /:id — Update role (admin-only) ─────────────────────────────────
router.put(
  "/:id",
  authorize("admin"),
  updateRoleRules,
  validate,
  async (req, res, next) => {
    try {
      const role = await Role.findById(req.params.id);
      if (!role) {
        return res.status(404).json({
          message: "Role not found",
          code: "NOT_FOUND",
        });
      }

      const { name, description, permissions } = req.body;

      // Prevent renaming system roles to avoid breaking system conventions
      if (role.isSystem && name && name.trim().toLowerCase() !== role.name.toLowerCase()) {
        return res.status(400).json({
          message: "System role name cannot be modified",
          code: "SYSTEM_ROLE_PROTECTED",
        });
      }

      if (name && name.trim().toLowerCase() !== role.name.toLowerCase()) {
        const existing = await Role.findOne({
          _id: { $ne: role._id },
          name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
        });
        if (existing) {
          return res.status(409).json({
            message: `Role "${name}" already exists`,
            code: "DUPLICATE",
            field: "name",
          });
        }
        role.name = name.trim();
      }

      if (description !== undefined) {
        role.description = description;
      }

      if (permissions !== undefined) {
        role.permissions = permissions;
      }

      await role.save();

      return res.json({ role: role.toJSON() });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({
          message: "A role with this name already exists",
          code: "DUPLICATE",
          field: "name",
        });
      }
      next(err);
    }
  }
);

// ─── DELETE /:id — Delete role (admin-only) ─────────────────────────────
router.delete(
  "/:id",
  authorize("admin"),
  deleteRoleRules,
  validate,
  async (req, res, next) => {
    try {
      const role = await Role.findById(req.params.id);
      if (!role) {
        return res.status(404).json({
          message: "Role not found",
          code: "NOT_FOUND",
        });
      }

      if (role.isSystem) {
        return res.status(400).json({
          message: "System roles cannot be deleted",
          code: "SYSTEM_ROLE_PROTECTED",
        });
      }

      // NOTE: Deleting a role explicitly does NOT alter any User documents.
      // Users retain their copied permissions array independently.
      await Role.findByIdAndDelete(req.params.id);

      return res.json({
        message: `Role "${role.name}" deleted successfully`,
        deletedRoleId: req.params.id,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
