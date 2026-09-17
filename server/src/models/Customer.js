/**
 * Customer Model — Visa & Travel Customer Records.
 *
 * Captures client identity, city, phone, document type, and reference.
 * Associated documents are stored in the Document collection with physical files
 * in uploads/customers/{phone}/.
 */

import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Customer name is required"],
      trim: true,
    },

    city: {
      type: String,
      default: "",
      trim: true,
    },

    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      index: true,
    },

    documentType: {
      type: String,
      default: "Passport",
      trim: true,
    },

    reference: {
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

customerSchema.set("toJSON", { transform: sanitise });
customerSchema.set("toObject", { transform: sanitise });

const Customer = mongoose.model("Customer", customerSchema);

export default Customer;
