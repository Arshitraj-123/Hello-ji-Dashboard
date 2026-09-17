/**
 * Express-validator rules for Brochure Delivery endpoints.
 */

import { body } from "express-validator";

export const sendEmailRules = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Recipient email address is required")
    .isEmail()
    .withMessage("Please enter a valid email address")
    .normalizeEmail(),

  body("subject")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Subject must not exceed 200 characters"),

  body("message")
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage("Message must not exceed 2000 characters"),

  body("withHeader")
    .optional()
    .isBoolean()
    .withMessage("withHeader must be a boolean")
    .toBoolean(),
];

export const sendWhatsAppRules = [
  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Recipient phone number is required")
    .matches(/^[0-9+ -]{7,20}$/)
    .withMessage("Please enter a valid phone number with 7 to 20 digits"),

  body("message")
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage("Message must not exceed 2000 characters"),

  body("withHeader")
    .optional()
    .isBoolean()
    .withMessage("withHeader must be a boolean")
    .toBoolean(),
];
