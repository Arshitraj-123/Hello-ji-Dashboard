/**
 * Hotel Model — Supplier contact directory (NOT bookings).
 *
 * Captures hotel supplier information, room categories, contacts, and inventory.
 * Supports soft-delete for the dedicated hotel recycle bin.
 */

import mongoose from "mongoose";

const hotelSchema = new mongoose.Schema(
  {
    hotelName: {
      type: String,
      required: [true, "Hotel name is required"],
      trim: true,
    },

    city: {
      type: String,
      default: "",
      trim: true,
    },

    star: {
      type: String,
      default: "",
      trim: true,
    },

    salesPerson: {
      type: String,
      default: "",
      trim: true,
    },

    email: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },

    phone: {
      type: String,
      default: "",
      trim: true,
    },

    address: {
      type: String,
      default: "",
      trim: true,
    },

    reservationNumber: {
      type: String,
      default: "",
      trim: true,
    },

    totalRooms: {
      type: String,
      default: "",
      trim: true,
    },

    roomsCategory: {
      type: String,
      default: "",
      trim: true,
    },

    remarks: {
      type: String,
      default: "",
      trim: true,
    },

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

// Strip __v and map _id to id in JSON output
const sanitise = (_doc, ret) => {
  ret.id = ret._id.toString();
  delete ret.__v;
  return ret;
};

hotelSchema.set("toJSON", { transform: sanitise });
hotelSchema.set("toObject", { transform: sanitise });

const Hotel = mongoose.model("Hotel", hotelSchema);

export default Hotel;
