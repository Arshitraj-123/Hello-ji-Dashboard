/**
 * BookingTicket Model — Booking Ticket Management.
 *
 * Captures tickets with sequential BT ID (e.g., BT0001, BT0012, BT0017),
 * status lifecycle (unapproved -> approved), approval tracking,
 * and soft deletion for the recycle bin.
 */

import mongoose from "mongoose";

export async function generateNextBookingTicketId() {
  const latestTicket = await mongoose
    .model("BookingTicket")
    .findOne({ btId: /^BT\d+$/ })
    .sort({ btId: -1 })
    .select("btId")
    .lean();

  let nextNum = 1;
  if (latestTicket && latestTicket.btId) {
    const match = latestTicket.btId.match(/^BT(\d+)$/);
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  }

  return `BT${String(nextNum).padStart(4, "0")}`;
}

export const BOOKING_TICKET_PRODUCTS = Object.freeze([
  "Hotel",
  "Ticket",
  "Visa",
  "Package",
  "Others",
]);

const bookingTicketSchema = new mongoose.Schema(
  {
    btId: {
      type: String,
      unique: true,
      index: true,
    },

    date: {
      type: Date,
      default: Date.now,
    },

    guestName: {
      type: String,
      required: [true, "Guest Name is required"],
      trim: true,
    },

    createdBy: {
      type: String,
      default: "Admin",
      trim: true,
    },

    saleBy: {
      type: String,
      default: "",
      trim: true,
    },

    approvedBy: {
      type: String,
      default: "Unapproved",
      trim: true,
    },

    sp: {
      type: String,
      default: "",
      trim: true,
    },

    product: {
      type: String,
      enum: {
        values: [
          "Hotel",
          "Ticket",
          "Visa",
          "Package",
          "Others",
          "hotel",
          "ticket",
          "visa",
          "package",
          "other",
          "Other",
          "others",
        ],
        message: "{VALUE} is not a valid product type",
      },
      default: "Ticket",
      trim: true,
    },

    detail: {
      type: String,
      default: "",
      trim: true,
    },

    remark: {
      type: String,
      default: "N/A",
      trim: true,
    },

    status: {
      type: String,
      enum: ["unapproved", "approved"],
      default: "unapproved",
      index: true,
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },

    deletedBy: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-validate hook to assign sequential btId if not set
bookingTicketSchema.pre("validate", async function (next) {
  if (!this.btId) {
    try {
      this.btId = await generateNextBookingTicketId();
    } catch (err) {
      return next(err);
    }
  }
  next();
});

const BookingTicket = mongoose.model("BookingTicket", bookingTicketSchema);

export default BookingTicket;
