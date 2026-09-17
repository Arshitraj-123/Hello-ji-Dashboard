/**
 * Validation rules for Hotel Directory endpoints.
 */

import { body, param } from "express-validator";
import mongoose from "mongoose";

export const mongoIdParam = (paramName = "id") => [
  param(paramName)
    .custom((val) => mongoose.Types.ObjectId.isValid(val))
    .withMessage(`Invalid ${paramName} parameter`),
];

export const createHotelRules = [
  body("hotelName")
    .trim()
    .notEmpty()
    .withMessage("Hotel name is required")
    .isLength({ max: 200 })
    .withMessage("Hotel name cannot exceed 200 characters"),

  body("email")
    .optional({ checkFalsy: true })
    .trim()
    .isEmail()
    .withMessage("Must be a valid email address")
    .normalizeEmail(),

  body("phone")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Phone cannot exceed 50 characters"),

  body("city")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("City cannot exceed 100 characters"),

  body("star")
    .optional()
    .trim()
    .isLength({ max: 50 }),

  body("salesPerson")
    .optional()
    .trim()
    .isLength({ max: 100 }),

  body("address")
    .optional()
    .trim()
    .isLength({ max: 500 }),

  body("reservationNumber")
    .optional()
    .trim()
    .isLength({ max: 100 }),

  body("totalRooms")
    .optional()
    .trim()
    .isLength({ max: 50 }),

  body("roomsCategory")
    .optional()
    .trim()
    .isLength({ max: 200 }),

  body("remarks")
    .optional()
    .trim()
    .isLength({ max: 2000 }),
];

export const updateHotelRules = [
  ...mongoIdParam("id"),

  body("hotelName")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Hotel name cannot be empty")
    .isLength({ max: 200 })
    .withMessage("Hotel name cannot exceed 200 characters"),

  body("email")
    .optional({ checkFalsy: true })
    .trim()
    .isEmail()
    .withMessage("Must be a valid email address")
    .normalizeEmail(),

  body("phone")
    .optional()
    .trim()
    .isLength({ max: 50 }),

  body("city")
    .optional()
    .trim()
    .isLength({ max: 100 }),

  body("star")
    .optional()
    .trim()
    .isLength({ max: 50 }),

  body("salesPerson")
    .optional()
    .trim()
    .isLength({ max: 100 }),

  body("address")
    .optional()
    .trim()
    .isLength({ max: 500 }),

  body("reservationNumber")
    .optional()
    .trim()
    .isLength({ max: 100 }),

  body("totalRooms")
    .optional()
    .trim()
    .isLength({ max: 50 }),

  body("roomsCategory")
    .optional()
    .trim()
    .isLength({ max: 200 }),

  body("remarks")
    .optional()
    .trim()
    .isLength({ max: 2000 }),
];
