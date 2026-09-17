/**
 * Booking Model — Full CRM Schema matching the approved specification.
 *
 * Preserves the original system's fields, default hidden values, product-specific attributes,
 * and canonical status pipeline:
 * ["New Query", "Pipeline", "Confirmed", "booked", "Abort"]
 *
 * Strict field set:
 * - Core: bookingId, name, email, phone, city, enquiryType, destination, product, details, priority, status, date
 * - Auto-set hidden defaults: bookingPolicy, dmName, dmContact, specialRequest
 * - Hotel/Package: hotelConfirmationNo, startDate, endDate, noOfRooms, noOfAdults, noOfChildren, noOfExtraBed, mealPlan, roomType, propertyName, propertyPhone, propertyEmail, propertyAddress
 * - Package additions: packageName, duration, inclusion
 * - Ticket additions: airlineName, flightNumber, sectorName, airlinePnr, gdsPnr, timeOnward, timeReturn, noOfInfant
 * - Visa additions: visaType, visaReference
 * - Insurance additions: insuranceType, insurancePolicyNo, insuranceCoverage
 * - Accounts/Billing: billingStatus, billingNumber, billingDate, billingRemark
 * - Ownership & Lifecycle: createdBy, assignedAgent, deletedAt
 */

import mongoose from "mongoose";
import { generateNextBookingId } from "../utils/bookingId.js";

export const BOOKING_STATUSES = Object.freeze([
  "New Query",
  "Pipeline",
  "Confirmed",
  "booked",
  "Abort",
]);

export const BOOKING_PRODUCTS = Object.freeze([
  "hotel",
  "ticket",
  "package",
  "visa",
  "insurance",
  "other",
  "Other",
]);

export const ENQUIRY_TYPES = Object.freeze(["B2B", "Corporate", "B2C"]);
export const DESTINATIONS = Object.freeze(["Domestic", "International"]);
export const PRIORITIES = Object.freeze(["Urgent", "Normal"]);
export const MEAL_PLANS = Object.freeze([
  "EPAI",
  "CPAI",
  "MAPI",
  "APAI",
  "Not Applicable",
  "",
]);
export const BILLING_STATUSES = Object.freeze(["Paid", "Unpaid", ""]);

const bookingSchema = new mongoose.Schema(
  {
    // ─── Core Identity ───────────────────────────────────────────────────
    bookingId: {
      type: String,
      unique: true,
      index: true,
    },

    // ─── Core Client / Enquiry Details ───────────────────────────────────
    name: {
      type: String,
      required: [true, "Guest/Client name is required"],
      trim: true,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },

    phone: {
      type: String,
      trim: true,
      default: "",
    },

    city: {
      type: String,
      trim: true,
      default: "",
    },

    enquiryType: {
      type: String,
      enum: {
        values: ENQUIRY_TYPES,
        message: "Invalid enquiryType: {VALUE}",
      },
      default: "B2C",
    },

    destination: {
      type: String,
      enum: {
        values: DESTINATIONS,
        message: "Invalid destination: {VALUE}",
      },
      default: "Domestic",
    },

    product: {
      type: String,
      required: [true, "Product is required"],
      trim: true,
    },

    priority: {
      type: String,
      enum: {
        values: PRIORITIES,
        message: "Invalid priority: {VALUE}",
      },
      default: "Normal",
    },

    details: {
      type: String,
      default: "",
      trim: true,
    },

    status: {
      type: String,
      enum: {
        values: BOOKING_STATUSES,
        message: "Invalid status: {VALUE}",
      },
      default: "New Query",
      index: true,
    },

    date: {
      type: String,
      default: "",
    },

    // ─── Auto-Set Hidden Default Fields ──────────────────────────────────
    bookingPolicy: {
      type: String,
      default:
        "Please Note: Advance amount is non-refundable. Rate of exchange (ROE) will be calculated on the day of payment. Hotel vouchers will be delivered to guest before 03 days of travel date.",
    },

    dmName: {
      type: String,
      default: "Rohit Sharma",
    },

    dmContact: {
      type: String,
      default: "+91 9356444000",
    },

    specialRequest: {
      type: String,
      default: "VIP Request",
    },

    // ─── Hotel & Package Common Attributes ───────────────────────────────
    hotelConfirmationNo: {
      type: String,
      default: "",
      trim: true,
    },

    startDate: {
      type: String,
      default: "",
      trim: true,
    },

    endDate: {
      type: String,
      default: "",
      trim: true,
    },

    noOfRooms: {
      type: String,
      default: "",
      trim: true,
    },

    noOfAdults: {
      type: String,
      default: "",
      trim: true,
    },

    noOfChildren: {
      type: String,
      default: "",
      trim: true,
    },

    noOfExtraBed: {
      type: String,
      default: "",
      trim: true,
    },

    mealPlan: {
      type: String,
      enum: MEAL_PLANS,
      default: "Not Applicable",
    },

    roomType: {
      type: String,
      default: "",
      trim: true,
    },

    propertyName: {
      type: String,
      default: "",
      trim: true,
    },

    propertyPhone: {
      type: String,
      default: "",
      trim: true,
    },

    propertyEmail: {
      type: String,
      default: "",
      trim: true,
    },

    propertyAddress: {
      type: String,
      default: "",
      trim: true,
    },

    // ─── Package Additions ───────────────────────────────────────────────
    packageName: {
      type: String,
      default: "",
      trim: true,
    },

    duration: {
      type: String,
      default: "",
      trim: true,
    },

    inclusion: {
      type: String,
      default: "",
      trim: true,
    },

    // ─── Ticket & Flight Additions ────────────────────────────────────────
    airlineName: {
      type: String,
      default: "",
      trim: true,
    },

    flightNumber: {
      type: String,
      default: "",
      trim: true,
    },

    sectorName: {
      type: String,
      default: "",
      trim: true,
    },

    airlinePnr: {
      type: String,
      default: "",
      trim: true,
    },

    gdsPnr: {
      type: String,
      default: "",
      trim: true,
    },

    timeOnward: {
      type: String,
      default: "",
      trim: true,
    },

    timeReturn: {
      type: String,
      default: "",
      trim: true,
    },

    noOfInfant: {
      type: String,
      default: "",
      trim: true,
    },

    // ─── Visa & Insurance Additions ───────────────────────────────────────
    visaType: {
      type: String,
      default: "",
      trim: true,
    },

    visaReference: {
      type: String,
      default: "",
      trim: true,
    },

    insuranceType: {
      type: String,
      default: "",
      trim: true,
    },

    insurancePolicyNo: {
      type: String,
      default: "",
      trim: true,
    },

    insuranceCoverage: {
      type: String,
      default: "",
      trim: true,
    },

    // ─── Accounts & Billing ──────────────────────────────────────────────
    billingStatus: {
      type: String,
      enum: BILLING_STATUSES,
      default: "Unpaid",
    },

    billingNumber: {
      type: String,
      default: "",
      trim: true,
    },

    billingDate: {
      type: String,
      default: "",
      trim: true,
    },

    billingRemark: {
      type: String,
      default: "",
      trim: true,
    },

    // ─── Ownership & Access Control ──────────────────────────────────────
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Creator reference (createdBy) is required"],
      index: true,
    },

    assignedAgent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Assigned agent reference (assignedAgent) is required"],
      index: true,
    },

    // ─── Lifecycle & Soft Delete ─────────────────────────────────────────
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Auto-increment sequential bookingId (HHL0001, HHL0002, ...)
 * Executes prior to validation so bookingId is present on new documents.
 * Only triggers if document is new and lacks bookingId.
 */
bookingSchema.pre("validate", async function (next) {
  if (this.isNew && !this.bookingId) {
    try {
      this.bookingId = await generateNextBookingId();
    } catch (err) {
      return next(err);
    }
  }

  // Auto-set date to today if not provided
  if (!this.date) {
    this.date = new Date().toISOString().slice(0, 10);
  }

  next();
});

bookingSchema.statics.generateNextBookingId = generateNextBookingId;

// Strip __v and map _id to id in JSON output
const sanitise = (_doc, ret) => {
  ret.id = ret._id.toString();
  delete ret.__v;
  return ret;
};

bookingSchema.set("toJSON", { transform: sanitise });
bookingSchema.set("toObject", { transform: sanitise });

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;
