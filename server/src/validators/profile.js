/**
 * Validation rules for self-service profile update.
 *
 * Enforces strict boundary: users may ONLY update:
 *   name, email, phone, address, photo
 *
 * Rejects any attempt to modify:
 *   password, passwordHash, role, permissions, status, createdBy, id, _id
 */

import { body } from "express-validator";

const FORBIDDEN_FIELDS = [
  "password",
  "passwordHash",
  "role",
  "permissions",
  "status",
  "createdBy",
  "id",
  "_id",
];

export const updateProfileRules = [
  // ─── Rejection of forbidden fields ─────────────────────────────────────
  ...FORBIDDEN_FIELDS.map((field) =>
    body(field)
      .not()
      .exists()
      .withMessage(
        `Field '${field}' cannot be updated via profile self-service. Contact an administrator.`
      )
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

  body("address")
    .optional()
    .isString()
    .withMessage("Address must be a string"),

  body("photo")
    .optional()
    .isString()
    .withMessage("Photo must be a string URL or path"),
];
