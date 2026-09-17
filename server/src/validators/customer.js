/**
 * Validation rules for Visa Customer endpoints.
 */

import { body, param } from "express-validator";
import mongoose from "mongoose";

export const mongoIdParam = (paramName = "id") => [
  param(paramName)
    .custom((val) => mongoose.Types.ObjectId.isValid(val))
    .withMessage(`Invalid ${paramName} parameter`),
];

export const createCustomerRules = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Customer name is required")
    .isLength({ max: 150 })
    .withMessage("Customer name cannot exceed 150 characters"),

  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Phone number is required")
    .isLength({ max: 50 })
    .withMessage("Phone number cannot exceed 50 characters"),

  body("city")
    .optional()
    .trim()
    .isLength({ max: 100 }),

  body("documentType")
    .optional()
    .trim()
    .isLength({ max: 100 }),

  body("reference")
    .optional()
    .trim()
    .isLength({ max: 100 }),

  body("remarks")
    .optional()
    .trim()
    .isLength({ max: 2000 }),
];

export const updateCustomerRules = [
  ...mongoIdParam("id"),

  body("name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Customer name cannot be empty")
    .isLength({ max: 150 }),

  body("phone")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Phone number cannot be empty")
    .isLength({ max: 50 }),

  body("city")
    .optional()
    .trim()
    .isLength({ max: 100 }),

  body("documentType")
    .optional()
    .trim()
    .isLength({ max: 100 }),

  body("reference")
    .optional()
    .trim()
    .isLength({ max: 100 }),

  body("remarks")
    .optional()
    .trim()
    .isLength({ max: 2000 }),
];
