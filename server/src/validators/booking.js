/**
 * Validation rules for Booking / Query endpoints matching the approved schema.
 */

import { body, param } from "express-validator";
import mongoose from "mongoose";
import {
  BOOKING_STATUSES,
  BOOKING_PRODUCTS,
  ENQUIRY_TYPES,
  DESTINATIONS,
  PRIORITIES,
  MEAL_PLANS,
  BILLING_STATUSES,
} from "../models/Booking.js";

/** Validates Mongo ObjectId in URL params */
export const mongoIdParam = (paramName = "id") => [
  param(paramName)
    .custom((val) => mongoose.Types.ObjectId.isValid(val))
    .withMessage(`Invalid ${paramName} parameter`),
];

/** Validation chain for creating a new query */
export const createQueryRules = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Guest/Client name is required")
    .isLength({ max: 150 })
    .withMessage("Name cannot exceed 150 characters"),

  body("product")
    .trim()
    .notEmpty()
    .withMessage("Product is required")
    .isIn(BOOKING_PRODUCTS)
    .withMessage(`Product must be one of: ${BOOKING_PRODUCTS.join(", ")}`),

  body("email")
    .optional({ checkFalsy: true })
    .trim()
    .isEmail()
    .withMessage("Must be a valid email address")
    .normalizeEmail(),

  body("phone")
    .optional()
    .trim()
    .isLength({ max: 30 })
    .withMessage("Phone cannot exceed 30 characters"),

  body("city")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("City cannot exceed 100 characters"),

  body("enquiryType")
    .optional()
    .trim()
    .isIn(ENQUIRY_TYPES)
    .withMessage(`Enquiry type must be one of: ${ENQUIRY_TYPES.join(", ")}`),

  body("enqueryType")
    .optional()
    .trim()
    .isIn(ENQUIRY_TYPES)
    .withMessage(`Enquiry type must be one of: ${ENQUIRY_TYPES.join(", ")}`),

  body("destination")
    .optional()
    .trim()
    .isIn(DESTINATIONS)
    .withMessage(`Destination must be one of: ${DESTINATIONS.join(", ")}`),

  body("priority")
    .optional()
    .trim()
    .isIn(PRIORITIES)
    .withMessage(`Priority must be one of: ${PRIORITIES.join(", ")}`),

  body("details")
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage("Details cannot exceed 5000 characters"),

  body("date")
    .optional()
    .trim()
    .isLength({ max: 50 }),

  body("startDate")
    .optional()
    .trim()
    .isLength({ max: 50 }),

  body("endDate")
    .optional()
    .trim()
    .isLength({ max: 50 }),
];

/** Validation chain for updating an existing query (general edit) */
export const updateQueryRules = [
  ...mongoIdParam("id"),

  body("name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Guest/Client name cannot be empty")
    .isLength({ max: 150 })
    .withMessage("Name cannot exceed 150 characters"),

  body("product")
    .optional()
    .trim()
    .isIn(BOOKING_PRODUCTS)
    .withMessage(`Product must be one of: ${BOOKING_PRODUCTS.join(", ")}`),

  body("email")
    .optional({ checkFalsy: true })
    .trim()
    .isEmail()
    .withMessage("Must be a valid email address")
    .normalizeEmail(),

  body("phone")
    .optional()
    .trim()
    .isLength({ max: 30 })
    .withMessage("Phone cannot exceed 30 characters"),

  body("city")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("City cannot exceed 100 characters"),

  body("enquiryType")
    .optional()
    .trim()
    .isIn(ENQUIRY_TYPES)
    .withMessage(`Enquiry type must be one of: ${ENQUIRY_TYPES.join(", ")}`),

  body("enqueryType")
    .optional()
    .trim()
    .isIn(ENQUIRY_TYPES)
    .withMessage(`Enquiry type must be one of: ${ENQUIRY_TYPES.join(", ")}`),

  body("destination")
    .optional()
    .trim()
    .isIn(DESTINATIONS)
    .withMessage(`Destination must be one of: ${DESTINATIONS.join(", ")}`),

  body("priority")
    .optional()
    .trim()
    .isIn(PRIORITIES)
    .withMessage(`Priority must be one of: ${PRIORITIES.join(", ")}`),

  body("details")
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage("Details cannot exceed 5000 characters"),

  body("date")
    .optional()
    .trim()
    .isLength({ max: 50 }),

  body("startDate")
    .optional()
    .trim()
    .isLength({ max: 50 }),

  body("endDate")
    .optional()
    .trim()
    .isLength({ max: 50 }),
];

/** Dedicated status update validation */
export const updateStatusRules = [
  ...mongoIdParam("id"),
  body("status")
    .trim()
    .notEmpty()
    .withMessage("Status is required")
    .customSanitizer((val) => {
      if (typeof val === "string") {
        const lower = val.toLowerCase();
        if (lower === "confirmed") return "Confirmed";
        if (lower === "pipeline") return "Pipeline";
        if (lower === "new query") return "New Query";
        if (lower === "booked") return "booked";
        if (lower === "abort") return "Abort";
      }
      return val;
    })
    .isIn(BOOKING_STATUSES)
    .withMessage(`Status must be one of: ${BOOKING_STATUSES.join(", ")}`),
];

/** Dedicated agent assignment validation */
export const assignQueryRules = [
  ...mongoIdParam("id"),
  body("assignedAgent")
    .trim()
    .notEmpty()
    .withMessage("Assigned agent ID is required")
    .custom((val) => mongoose.Types.ObjectId.isValid(val))
    .withMessage("Assigned agent must be a valid User ID"),
];

/** Dedicated raisedBy (creator) reassignment validation */
export const raisedByQueryRules = [
  ...mongoIdParam("id"),
  body("raisedBy")
    .trim()
    .notEmpty()
    .withMessage("Raised by user ID is required")
    .custom((val) => mongoose.Types.ObjectId.isValid(val))
    .withMessage("Raised by must be a valid User ID"),
];

/** Conversion to booking and booking update validation — strictly approved schema */
export const convertBookingRules = [
  ...mongoIdParam("id"),

  body("mealPlan")
    .optional()
    .trim()
    .isIn(MEAL_PLANS)
    .withMessage(`Meal plan must be one of: ${MEAL_PLANS.join(", ")}`),

  body("billingStatus")
    .optional()
    .trim()
    .isIn(BILLING_STATUSES)
    .withMessage(`Billing status must be one of: ${BILLING_STATUSES.join(", ")}`),

  body("propertyName")
    .optional()
    .trim()
    .isLength({ max: 200 }),

  body("hotelConfirmationNo")
    .optional()
    .trim()
    .isLength({ max: 100 }),

  body("startDate")
    .optional()
    .trim()
    .isLength({ max: 50 }),

  body("endDate")
    .optional()
    .trim()
    .isLength({ max: 50 }),

  body("airlineName")
    .optional()
    .trim()
    .isLength({ max: 100 }),

  body("flightNumber")
    .optional()
    .trim()
    .isLength({ max: 50 }),

  body("sectorName")
    .optional()
    .trim()
    .isLength({ max: 100 }),

  body("airlinePnr")
    .optional()
    .trim()
    .isLength({ max: 50 }),

  body("gdsPnr")
    .optional()
    .trim()
    .isLength({ max: 50 }),

  body("packageName")
    .optional()
    .trim()
    .isLength({ max: 200 }),

  body("duration")
    .optional()
    .trim()
    .isLength({ max: 100 }),

  body("billingNumber")
    .optional()
    .trim()
    .isLength({ max: 100 }),
];

/** Append note validation */
export const addNoteRules = [
  ...mongoIdParam("id"),
  body("note")
    .trim()
    .notEmpty()
    .withMessage("Note content cannot be empty")
    .isLength({ max: 5000 })
    .withMessage("Note cannot exceed 5000 characters"),
];
