/**
 * express-validator chains for Role endpoints
 */

import { body, param } from "express-validator";
import { ALL_PERMISSIONS } from "../constants/permissions.js";

const validatePermissionsArray = (perms) => {
  if (!Array.isArray(perms)) {
    throw new Error("Permissions must be an array");
  }
  const invalid = perms.filter(
    (p) => typeof p !== "string" || !ALL_PERMISSIONS.includes(p)
  );
  if (invalid.length > 0) {
    throw new Error(
      `Invalid permission key(s): ${invalid.join(", ")}. Must be valid keys from the canonical registry.`
    );
  }
  return true;
};

// ─── POST /api/roles (create) ────────────────────────────────────────────
export const createRoleRules = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Role name is required"),

  body("description")
    .optional()
    .trim(),

  body("permissions")
    .optional()
    .isArray()
    .withMessage("Permissions must be an array")
    .custom(validatePermissionsArray),
];

// ─── PUT /api/roles/:id (update) ─────────────────────────────────────────
export const updateRoleRules = [
  param("id")
    .isMongoId()
    .withMessage("Invalid role ID"),

  body("name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Role name cannot be empty"),

  body("description")
    .optional()
    .trim(),

  body("permissions")
    .optional()
    .isArray()
    .withMessage("Permissions must be an array")
    .custom(validatePermissionsArray),
];

// ─── DELETE /api/roles/:id ───────────────────────────────────────────────
export const deleteRoleRules = [
  param("id")
    .isMongoId()
    .withMessage("Invalid role ID"),
];
