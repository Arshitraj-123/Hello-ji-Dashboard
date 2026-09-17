/**
 * express-validator chains for auth and user-management endpoints.
 *
 * Centralised so validation rules aren't scattered across route handlers.
 */

import { body, param } from "express-validator";
import { ALL_PERMISSIONS } from "../constants/permissions.js";

// Helper validator function for permission arrays
const validatePermissionsArray = (perms) => {
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

// ─── POST /api/auth/login ────────────────────────────────────────────────
export const loginRules = [
  body("identifier")
    .trim()
    .notEmpty()
    .withMessage("Email or phone is required"),

  body("password")
    .notEmpty()
    .withMessage("Password is required"),
];

// ─── POST /api/auth/change-password ──────────────────────────────────────
export const changePasswordRules = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),

  body("newPassword")
    .isLength({ min: 8 })
    .withMessage("New password must be at least 8 characters"),
];

// ─── POST /api/admin/users  (create) ─────────────────────────────────────
export const createUserRules = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required"),

  // At least one of email/phone is required — custom check after individual rules
  body("email")
    .optional({ values: "falsy" })
    .isEmail()
    .withMessage("Invalid email format")
    .normalizeEmail(),

  body("phone")
    .optional({ values: "falsy" })
    .trim()
    .notEmpty()
    .withMessage("Phone cannot be empty if provided"),

  // Ensure at least one contact method is given
  body().custom((_, { req }) => {
    if (!req.body.email && !req.body.phone) {
      throw new Error("At least one of email or phone must be provided");
    }
    return true;
  }),

  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters"),

  body("role")
    .optional()
    .isIn(["admin", "agent"])
    .withMessage("Role must be admin or agent"),

  body("permissions")
    .optional()
    .isArray()
    .withMessage("Permissions must be an array")
    .custom(validatePermissionsArray),

  body("status")
    .optional()
    .isIn(["active", "inactive"])
    .withMessage("Status must be active or inactive"),
];

// ─── PUT /api/admin/users/:id  (update) ──────────────────────────────────
export const updateUserRules = [
  param("id")
    .isMongoId()
    .withMessage("Invalid user ID"),

  // Explicitly reject password fields — password changes only go through
  // the self-service change-password endpoint, never through admin edit.
  body("password").not().exists().withMessage(
    "Password cannot be changed through this endpoint. " +
      "Use POST /api/auth/change-password instead."
  ),
  body("passwordHash").not().exists().withMessage(
    "passwordHash cannot be set directly"
  ),

  body("name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Name cannot be empty"),

  body("email")
    .optional({ values: "falsy" })
    .isEmail()
    .withMessage("Invalid email format")
    .normalizeEmail(),

  body("phone")
    .optional({ values: "falsy" })
    .trim(),

  body("role")
    .optional()
    .isIn(["admin", "agent"])
    .withMessage("Role must be admin or agent"),

  body("permissions")
    .optional()
    .isArray()
    .withMessage("Permissions must be an array")
    .custom(validatePermissionsArray),

  body("status")
    .optional()
    .isIn(["active", "inactive"])
    .withMessage("Status must be active or inactive"),
];

// ─── DELETE /api/admin/users/:id ─────────────────────────────────────────
export const deleteUserRules = [
  param("id")
    .isMongoId()
    .withMessage("Invalid user ID"),
];
