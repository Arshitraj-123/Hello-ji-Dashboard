/**
 * Validation rules for Accounts endpoints.
 */

import { body, param } from "express-validator";
import mongoose from "mongoose";
import { BILLING_STATUSES } from "../models/Booking.js";

export const mongoIdParam = (paramName = "bookingId") => [
  param(paramName)
    .custom((val) => mongoose.Types.ObjectId.isValid(val))
    .withMessage(`Invalid ${paramName} parameter`),
];

export const updateBillingRules = [
  ...mongoIdParam("bookingId"),

  body("billingStatus")
    .optional()
    .trim()
    .isIn(BILLING_STATUSES)
    .withMessage(`Billing status must be one of: ${BILLING_STATUSES.join(", ")}`),

  body("billingNumber")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Billing number cannot exceed 100 characters"),

  body("billingDate")
    .optional()
    .trim()
    .isLength({ max: 50 }),

  body("billingRemark")
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage("Billing remark cannot exceed 2000 characters"),
];
